/**
 * Chat pipeline orchestrator — implements the full AI flow:
 *
 * question → intent → retrieval decision → (web | knowledge | RAG)
 *         → context building → model routing → streamed LLM answer
 *         → citation sanitising → optional fact-check → persistence → analytics
 *
 * Emits SSE events through `emit(type, data)`:
 *   status, meta, sources, delta, verification, done, error
 */
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { getAiProvider, isGenerativeAiAvailable } from '../../providers/ai/index.js';
import { availableSearchProviders } from '../../providers/search/index.js';
import { analyzeQuestion, refineIntentWithLlm } from './intentService.js';
import { executeRetrieval } from './retrievalService.js';
import { runResearch } from './researchService.js';
import { buildConversationMemory, summaryAsMessage } from './memoryService.js';
import { assembleMessages, contextTokenEstimate } from './contextService.js';
import { buildSystemPrompt } from './prompts.js';
import { routeModel } from './routerService.js';
import { verifyAnswer, sanitizeCitations, factCheckEnabled } from './factCheckService.js';
import conversationRepo, { messageRepo } from '../../repositories/conversationRepo.js';
import documentRepo from '../../repositories/documentRepo.js';
import usageRepo from '../../repositories/usageRepo.js';
import { getSystemPrompt, getUserPreferences } from '../settingsService.js';
import { estimateCost } from '../../utils/pricing.js';
import { flattenText, imageParts } from '../../providers/ai/content.js';
import { badRequest, notFound, serviceUnavailable } from '../../utils/errors.js';
import { truncate } from '../../utils/text.js';

export async function runChatPipeline ({
  user,
  conversation,
  question,
  mode = 'AUTO',
  documentIds = [],
  imageData = [],
  signal,
  emit = () => {},
}) {
  const startedAt = Date.now();
  const questionText = String(question || '').trim();
  if (!questionText) throw badRequest('Please enter a question.');
  if (questionText.length > 20000) throw badRequest('Your message is too long (max 20,000 characters).');
  if (!conversation) throw notFound('Conversation not found.');

  const safe = (type, data) => {
    try { emit(type, data); } catch { /* client disconnected */ }
  };

  // 1) Persist the user turn --------------------------------------------
  const userMessage = await messageRepo.create({
    conversationId: conversation.id,
    role: 'USER',
    content: questionText,
    metadata: {
      mode,
      documentIds,
      images: imageData.map((image) => ({ filename: image.filename, mimeType: image.mimeType })),
    },
  });

  // 2) Intent detection + retrieval decision ------------------------------
  const readyDocs = await listReadyDocuments(user.id);
  // Only documents attached to THIS message drive retrieval in AUTO mode;
  // the full library applies when mode=DOCUMENTS or the question is doc-shaped.
  const attachedIds = documentIds.filter((id) => readyDocs.some((doc) => doc.id === id));
  let analysis = analyzeQuestion(questionText, {
    mode,
    hasDocuments: readyDocs.length > 0,
    documentIds: attachedIds,
  });
  analysis = await refineIntentWithLlm(questionText, analysis, { signal });
  safe('status', { stage: 'analyze', detail: `Detected intent: ${analysis.intent}` });

  // Resolve the answer engine up front: without a generative model the
  // grounded engine needs retrieved material to cite, so retrieval is forced.
  const provider = getAiProvider();
  const generative = isGenerativeAiAvailable();
  if (!generative) {
    const realSearchConfigured = availableSearchProviders().some((entry) => entry.id !== 'mock');
    if (mode !== 'FAST' && mode !== 'DOCUMENTS') analysis.needsKnowledge = true;
    if (realSearchConfigured || mode === 'WEB' || mode === 'DEEP') analysis.needsWeb = true;
    analysis.signals = [...new Set([...(analysis.signals || []), 'grounded-retrieval'])];
  }
  analysis.documentIds = attachedIds;

  // 3) Retrieval ----------------------------------------------------------
  let retrieval = { sources: [], documentChunks: [], meta: { sourceCount: 0, documentChunkCount: 0, searchLog: [], providers: [] } };
  try {
    if (mode === 'DEEP') {
      retrieval = await runResearch({
        question: questionText,
        userId: user.id,
        conversationId: conversation.id,
        signal,
        onProgress: (progress) => safe('status', progress),
      });
      retrieval.documentChunks = analysis.needsDocuments ? await safeRetrieve(user.id, questionText, analysis, signal) : [];
    } else {
      safe('status', { stage: 'retrieve', detail: 'Searching sources' });
      retrieval = await executeRetrieval({
        question: questionText,
        analysis,
        mode,
        userId: user.id,
        conversationId: conversation.id,
        documentIds: analysis.documentIds,
        signal,
      });
    }
  } catch (error) {
    if (signal?.aborted) return persistStopped({ user, conversation, userMessage, startedAt, safe });
    logger.warn(`Retrieval failed, continuing with model knowledge: ${error.message}`);
    safe('status', { stage: 'retrieve', detail: 'Retrieval unavailable — using model knowledge' });
  }

  const sources = retrieval.sources || [];
  const documentChunks = retrieval.documentChunks || [];
  const clientSources = sources.map((source, index) => ({
    id: index + 1,
    title: source.title,
    url: source.url,
    domain: source.domain,
    provider: source.provider,
    via: source.via,
    publishedAt: source.publishedAt || null,
    score: source.score,
    snippet: truncate(source.snippet, 300),
    synthetic: source.synthetic || false,
  }));

  safe('sources', { sources: clientSources, retrieval: publicRetrievalMeta(retrieval.meta) });

  // 4) Memory + context ---------------------------------------------------
  const historyRows = await messageRepo.listByConversation(conversation.id);
  const priorRows = historyRows.filter((row) => row.id !== userMessage.id);
  const { history, summary, compressed } = await buildConversationMemory(conversation, priorRows, { signal });

  const systemPrompt = buildSystemPrompt({
    customPrompt: await getSystemPrompt(),
    task: analysis.task,
    sources,
    documents: documentChunks,
    mode,
    isDemo: provider.name === 'mock',
  });

  const contentParts = [{ type: 'text', text: questionText }, ...imageData.map((image) => ({
    type: 'image',
    mediaType: image.mimeType,
    data: image.base64,
  }))];

  const llmMessages = assembleMessages({
    systemPrompt,
    sources,
    documentChunks,
    history,
    question: questionText,
  });
  // Attach multimodal parts to the final user turn.
  llmMessages[llmMessages.length - 1] = { role: 'user', content: contentParts };
  const summaryMsg = summaryAsMessage(summary);
  if (summaryMsg) llmMessages.splice(2, 0, summaryMsg);
  if (compressed) await conversationRepo.update(conversation.id, { summary }).catch(() => {});

  // 5) Model routing ------------------------------------------------------
  const routed = routeModel({
    intent: analysis.intent,
    complexity: analysis.complexity,
    task: analysis.task,
    mode,
    contextTokens: contextTokenEstimate(llmMessages),
  });

  safe('meta', {
    conversationId: conversation.id,
    userMessageId: userMessage.id,
    mode,
    intent: analysis.intent,
    task: analysis.task,
    complexity: analysis.complexity,
    model: routed.model || provider.defaultModel(),
    provider: provider.name,
    routeReason: generative ? routed.reason : 'grounded-retrieval',
    retrieval: publicRetrievalMeta(retrieval.meta),
    grounded: provider.name === 'grounded',
    demo: provider.name === 'mock',
    images: imageData.length,
    summaryUsed: Boolean(summary),
  });

  // 6) Stream the answer --------------------------------------------------
  const sourceCount = clientSources.length;
  let answer = '';
  let held = '';
  let usage = { promptTokens: 0, completionTokens: 0 };
  let modelUsed = routed.model || provider.defaultModel();
  let finishReason = 'stop';
  let aborted = false;

  const emitFiltered = (text) => {
    if (!text) return;
    const clean = sourceCount
      ? text.replace(/\[(\d{1,2})\]/g, (match, num) => (Number(num) <= sourceCount ? match : ''))
      : text.replace(/ ?\[\d{1,2}\]/g, '');
    if (clean) {
      safe('delta', { text: clean });
      answer += clean;
    }
  };

  // Hold back incomplete trailing "[12" fragments so citations can be validated.
  const pushDelta = (text) => {
    held += text;
    const match = /\[(\d{1,2})?$/.exec(held);
    if (match) {
      emitFiltered(held.slice(0, match.index));
      held = held.slice(match.index);
    } else {
      emitFiltered(held);
      held = '';
    }
  };

  const flushHeld = () => {
    if (held) {
      emitFiltered(held);
      held = '';
    }
  };

  try {
    safe('status', { stage: 'generate', detail: 'Generating answer' });
    const stream = provider.stream(llmMessages, {
      model: routed.model,
      temperature: config.ai.temperature,
      maxTokens: config.ai.maxTokens,
      signal,
    });

    for await (const event of stream) {
      if (signal?.aborted) { aborted = true; break; }
      if (event.type === 'delta') pushDelta(event.text);
      else if (event.type === 'done') {
        usage = event.usage || usage;
        modelUsed = event.model || modelUsed;
        finishReason = event.finishReason || finishReason;
      }
    }
    if (signal?.aborted) aborted = true;
    flushHeld();
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') {
      aborted = true;
      flushHeld();
    } else {
      logger.error(`Chat pipeline stream failed: ${error.message}`);
      await usageRepo.record({
        userId: user.id,
        endpoint: '/api/chat/stream',
        provider: provider.name,
        model: modelUsed,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.promptTokens + usage.completionTokens,
        latencyMs: Date.now() - startedAt,
        status: 'error',
        errorCode: error.code || 'UPSTREAM_ERROR',
        estimatedCost: 0,
      }).catch(() => {});

      if (!answer) {
        safe('error', {
          code: error.code || 'AI_ERROR',
          message: error.message || 'Something went wrong. Please try again.',
        });
        throw error;
      }
      // Keep the partial answer and report the failure honestly.
      safe('error', {
        code: error.code || 'AI_ERROR',
        message: `${error.message || 'Generation failed.'} The response may be incomplete.`,
        partial: true,
      });
    }
  }

  // 7) Optional verification layer ---------------------------------------
  let verification = null;
  if (!aborted && answer && factCheckEnabled() && sources.length && !signal?.aborted) {
    safe('status', { stage: 'verify', detail: 'Checking claims against sources' });
    verification = await verifyAnswer(answer, sources, { signal });
    if (verification?.status === 'uncertain' && verification.notes) {
      const note = `\n\n---\n\n**Verification note:** ${verification.notes}`;
      safe('delta', { text: note });
      answer += note;
    }
    if (verification) safe('verification', verification);
  }

  const finalAnswer = sanitizeCitations(answer, sourceCount) || answer;

  // 8) Persist assistant turn + conversation state ------------------------
  const latencyMs = Date.now() - startedAt;
  const assistantMessage = await messageRepo.create({
    conversationId: conversation.id,
    role: 'ASSISTANT',
    content: finalAnswer,
    metadata: {
      provider: provider.name,
      model: modelUsed,
      mode,
      intent: analysis.intent,
      task: analysis.task,
      sources: clientSources,
      retrieval: publicRetrievalMeta(retrieval.meta),
      usage,
      latencyMs,
      finishReason,
      verification,
      partial: aborted,
      demo: provider.name === 'mock',
      grounded: provider.name === 'grounded',
      images: imageData.length,
    },
  });

  if (conversation.title === 'New chat' || !conversation.title) {
    const title = deriveTitle(questionText);
    await conversationRepo.update(conversation.id, { title }).catch(() => {});
  } else {
    await conversationRepo.update(conversation.id, {}).catch(() => {});
  }

  // 9) Analytics (skipped when the user opted out of usage analytics) ------
  try {
    const prefs = await getUserPreferences(user.id);
    if (!prefs.analyticsOptOut) {
      await usageRepo.record({
        userId: user.id,
        endpoint: '/api/chat/stream',
        provider: provider.name,
        model: modelUsed,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.promptTokens + usage.completionTokens,
        latencyMs,
        status: aborted ? 'aborted' : 'ok',
        estimatedCost: estimateCost(provider.name, modelUsed, usage),
        metadata: { mode, intent: analysis.intent, sources: clientSources.length, chunks: documentChunks.length },
      });
    }
  } catch (error) {
    logger.debug(`Usage record failed: ${error.message}`);
  }

  safe('done', {
    conversationId: conversation.id,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
    content: finalAnswer,
    model: modelUsed,
    provider: provider.name,
    mode,
    usage,
    latencyMs,
    stopped: aborted,
    demo: provider.name === 'mock',
    grounded: provider.name === 'grounded',
    verification,
    sources: clientSources.length,
    title: deriveTitle(questionText),
  });

  return { userMessage, assistantMessage, sources: clientSources };
}

/** Fire-and-forget path when the client aborts before any tokens stream. */
async function persistStopped ({ user, conversation, userMessage, startedAt, safe }) {
  await messageRepo.create({
    conversationId: conversation.id,
    role: 'ASSISTANT',
    content: '*Generation stopped.*',
    metadata: { partial: true, stopped: true, latencyMs: Date.now() - startedAt },
  }).catch(() => {});
  safe('done', { conversationId: conversation.id, stopped: true, content: '' });
  void user;
  return null;
}

async function listReadyDocuments (userId, documentIds) {
  try {
    const { rows } = await documentRepo.listByUser(userId, { limit: 100 });
    const ready = rows.filter((doc) => doc.status === 'READY');
    return documentIds?.length ? ready.filter((doc) => documentIds.includes(doc.id)) : ready;
  } catch {
    return [];
  }
}

async function safeRetrieve (userId, question, analysis, signal) {
  try {
    const { retrieveDocumentContext } = await import('../rag/ingestService.js');
    return await retrieveDocumentContext(userId, question, {
      documentIds: analysis.documentIds.length ? analysis.documentIds : null,
      signal,
    });
  } catch {
    return [];
  }
}

export const publicRetrievalMeta = (meta = {}) => ({
  ms: meta.ms ?? 0,
  rawCount: meta.rawCount ?? 0,
  sourceCount: meta.sourceCount ?? 0,
  documentChunkCount: meta.documentChunkCount ?? 0,
  providers: meta.providers ?? [],
  degraded: Boolean(meta.degraded),
  searches: meta.searchLog?.length ?? 0,
  subquestions: meta.subquestions,
  budget: meta.budget,
});

export function deriveTitle (question) {
  const base = String(question).replace(/\s+/g, ' ').trim();
  if (base.length <= 56) return base || 'New chat';
  const cut = base.slice(0, 56);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 20 ? lastSpace : 56)}…`;
}

export const flattenMessageContent = flattenText;
export const messageImageParts = imageParts;
export { serviceUnavailable };
export default runChatPipeline;
