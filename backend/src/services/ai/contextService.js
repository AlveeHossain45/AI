/**
 * Context building: conversation history window, retrieved source blocks,
 * document excerpts — all token-budgeted before reaching the LLM.
 */
import config from '../../config/index.js';
import { estimateTokens, compressForContext, truncate } from '../../utils/text.js';
import { getDomain } from '../../utils/url.js';

/**
 * Trim conversation history to fit the token budget while keeping the
 * most recent messages (and role pairing) intact.
 */
export function buildHistory (messages, { maxMessages = config.limits.contextMaxMessages, maxTokens = config.limits.contextMaxTokens } = {}) {
  const usable = messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({ role: message.role, content: String(message.content || '') }));

  const recent = usable.slice(-maxMessages);
  let tokens = 0;
  const kept = [];
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const message = recent[i];
    const cost = estimateTokens(message.content) + 4;
    if (tokens + cost > maxTokens && kept.length > 1) break;
    tokens += cost;
    kept.unshift(message);
  }
  // Avoid dangling assistant opening message.
  while (kept.length > 1 && kept[0].role === 'assistant' && kept[1].role === 'assistant') kept.shift();
  return { messages: kept, tokens };
}

/** Format retrieved web/knowledge sources as a numbered context block. */
export function buildSourceContext (sources, { maxCharsPerSource = 1800 } = {}) {
  if (!sources?.length) return '';
  const blocks = sources.map((source, index) => {
    const domain = getDomain(source.url) || 'source';
    const body = truncate(compressForContext(source.content || source.snippet || '', maxCharsPerSource), maxCharsPerSource);
    return `SOURCE [${index + 1}]\nTitle: ${source.title}\nURL: ${source.url}\nDomain: ${domain}${source.publishedAt ? `\nPublished: ${source.publishedAt}` : ''}\nExcerpt:\n${body}`;
  });
  return `CONTEXT — retrieved from external sources (use for citations [n]):\n\n${blocks.join('\n\n')}`;
}

/** Format RAG chunks as document excerpt blocks. */
export function buildDocumentContext (chunks, { maxChars = 1500 } = {}) {
  if (!chunks?.length) return '';
  const blocks = chunks.map((chunk, index) => {
    const where = chunk.pageNumber ? `page ${chunk.pageNumber}` : `section ${chunk.idx + 1}`;
    return `DOCUMENT EXCERPT ${index + 1} (file: ${chunk.filename}, ${where}, relevance ${Number(chunk.score || 0).toFixed(2)}):\n${truncate(compressForContext(chunk.content, maxChars), maxChars)}`;
  });
  return `CONTEXT — excerpts from the user's uploaded documents:\n\n${blocks.join('\n\n')}`;
}

/**
 * Assemble the final chat messages for the model.
 * Order: system prompt → source/document context → history → current question.
 */
export function assembleMessages ({ systemPrompt, sources = [], documentChunks = [], history = [], question }) {
  const contextParts = [buildSourceContext(sources), buildDocumentContext(documentChunks)].filter(Boolean);
  const messages = [{ role: 'system', content: systemPrompt }];
  if (contextParts.length) messages.push({ role: 'system', content: contextParts.join('\n\n---\n\n') });
  for (const message of history) messages.push({ role: message.role, content: message.content });
  messages.push({ role: 'user', content: question });
  return messages;
}

export const contextTokenEstimate = (messages) => messages.reduce((acc, message) => acc + estimateTokens(message.content) + 4, 0);

export default { buildHistory, buildSourceContext, buildDocumentContext, assembleMessages, contextTokenEstimate };
