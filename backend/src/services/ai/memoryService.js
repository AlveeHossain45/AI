/**
 * Conversation memory:
 *  - windowing to the most recent N messages
 *  - optional AI-generated summary of older turns (compression)
 *  - summary persisted on the conversation row
 */
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { chatWithFallback, isGenerativeAiAvailable } from '../../providers/ai/index.js';
import { buildHistory } from './contextService.js';
import { estimateTokens, truncate } from '../../utils/text.js';

const SUMMARY_TRIGGER_MESSAGES = 24;
const SUMMARY_TARGET_TOKENS = 1500;

/**
 * @returns {{history: Array, summary: string|null, compressed: boolean}}
 */
export async function buildConversationMemory (conversation, messages, { signal } = {}) {
  const summary = conversation?.summary || null;

  if (messages.length <= config.limits.contextMaxMessages && !summary) {
    const { messages: history } = buildHistory(messages);
    return { history, summary: null, compressed: false };
  }

  let workingSummary = summary;
  let compressed = false;

  // Compress older turns when the conversation grows beyond the window.
  if (messages.length > SUMMARY_TRIGGER_MESSAGES || (summary && messages.length > config.limits.contextMaxMessages)) {
    const older = messages.slice(0, Math.max(0, messages.length - config.limits.contextMaxMessages));
    const olderTokens = older.reduce((acc, m) => acc + estimateTokens(m.content), 0);
    if (older.length >= 4 || olderTokens > SUMMARY_TARGET_TOKENS) {
      const produced = await summarizeMessages(older, workingSummary, { signal });
      if (produced) {
        workingSummary = truncate(produced, 2500);
        compressed = true;
      }
    }
  }

  const { messages: history } = buildHistory(messages);
  return { history, summary: workingSummary, compressed };
}

async function summarizeMessages (messages, existingSummary, { signal } = {}) {
  // Summarisation needs a generative model; windowing alone handles the rest.
  if (!isGenerativeAiAvailable()) return null;
  try {
    const transcript = messages
      .slice(-30)
      .map((message) => `${message.role.toUpperCase()}: ${String(message.content).slice(0, 600)}`)
      .join('\n');
    const { result } = await chatWithFallback(
      [
        {
          role: 'user',
          content:
            `${existingSummary ? `Existing summary:\n${existingSummary}\n\nUpdate it with the new messages below.\n\n` : ''}` +
            `Summarize this conversation for context continuity (facts, decisions, open questions, preferences). Max 200 words:\n\n${transcript}`,
        },
      ],
      { maxTokens: 350, temperature: 0.2, signal }
    );
    return result.content.trim();
  } catch (error) {
    logger.debug(`Conversation summarization skipped: ${error.message}`);
    return null;
  }
}

/** Include the summary as a leading context message when present. */
export function summaryAsMessage (summary) {
  if (!summary) return null;
  return { role: 'system', content: `Summary of earlier conversation turns:\n${summary}` };
}

export default { buildConversationMemory, summaryAsMessage };
