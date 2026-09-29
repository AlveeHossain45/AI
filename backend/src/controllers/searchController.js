/**
 * Standalone search + research endpoints (outside the chat flow).
 */
import { asyncHandler } from '../utils/crypto.js';
import { executeRetrieval } from '../services/ai/retrievalService.js';
import { runResearch } from '../services/ai/researchService.js';
import { analyzeQuestion } from '../services/ai/intentService.js';
import { initSse, sendEvent, endSse } from '../utils/sse.js';
import { publicRetrievalMeta } from '../services/ai/chatPipeline.js';
import { notFound } from '../utils/errors.js';

export const searchController = {
  /** POST /api/search — retrieve + rank results without generating an answer. */
  search: asyncHandler(async (req, res) => {
    const { query, mode, limit } = req.body;
    const analysis = analyzeQuestion(query, { mode: mode === 'AUTO' ? 'WEB' : mode, hasDocuments: false });
    analysis.needsWeb = true;
    analysis.needsKnowledge = mode !== 'FAST';

    const retrieval = await executeRetrieval({
      question: query,
      analysis,
      mode,
      userId: req.user?.id || null,
      signal: req.abortSignal,
    });

    res.json({
      query,
      sources: retrieval.sources.slice(0, limit).map((source, index) => ({
        id: index + 1,
        title: source.title,
        url: source.url,
        domain: source.domain,
        provider: source.provider,
        via: source.via,
        snippet: source.snippet,
        publishedAt: source.publishedAt || null,
        score: source.score,
        synthetic: source.synthetic || false,
      })),
      retrieval: publicRetrievalMeta(retrieval.meta),
    });
  }),

  /** GET /api/search/recent — the user's recent search queries (audit trail). */
  recent: asyncHandler(async (req, res) => {
    const { recentQueries } = await import('../repositories/searchRepo.js');
    const rows = await recentQueries(req.user.id, Math.min(Number(req.query.limit) || 20, 50));
    res.json({ queries: rows });
  }),

  /** GET /api/conversations/:id — placeholder guard used by research routes. */
  assertConversationOwnership: async (conversationId, userId) => {
    const { default: conversationRepo } = await import('../repositories/conversationRepo.js');
    const conversation = await conversationRepo.findById(conversationId, userId);
    if (!conversation) throw notFound('Conversation not found.');
    return conversation;
  },
};

export const researchController = {
  /** POST /api/research — deep research, JSON report. */
  research: asyncHandler(async (req, res) => {
    const { question } = req.body;
    const abort = new AbortController();
    req.on('close', () => abort.abort());
    const result = await runResearch({
      question,
      userId: req.user.id,
      signal: abort.signal,
    });
    res.json({
      question,
      findings: result.findings,
      sources: result.sources.map((source, index) => ({
        id: index + 1,
        title: source.title,
        url: source.url,
        domain: source.domain,
        provider: source.provider,
        publishedAt: source.publishedAt || null,
        score: source.score,
        snippet: source.snippet,
      })),
      meta: result.meta,
    });
  }),

  /** POST /api/research/stream — SSE progress + findings. */
  stream: asyncHandler(async (req, res) => {
    const { question } = req.body;
    const abort = new AbortController();
    req.on('close', () => abort.abort());

    initSse(res);
    sendEvent(res, 'open', { question });
    try {
      const result = await runResearch({
        question,
        userId: req.user.id,
        signal: abort.signal,
        onProgress: (progress) => sendEvent(res, 'status', progress),
      });
      sendEvent(res, 'done', {
        findings: result.findings,
        sources: result.sources.map((source, index) => ({
          id: index + 1,
          title: source.title,
          url: source.url,
          domain: source.domain,
          snippet: source.snippet,
        })),
        meta: result.meta,
      });
    } catch (error) {
      sendEvent(res, 'error', { code: error.code || 'RESEARCH_ERROR', message: error.message });
    } finally {
      endSse(res);
    }
  }),
};

export default { searchController, researchController };
