/**
 * System prompts. The base prompt is configurable through admin settings
 * (key: "system_prompt"); instructions for retrieval/citations are appended
 * dynamically based on what was actually retrieved.
 */
import { answerStyleFor } from './routerService.js';

export const BASE_SYSTEM_PROMPT = `You are NovaAI, a precise, helpful and honest AI answer engine.

Rules:
- Answer the user's actual question directly; do not pad with restated questions.
- Use clean Markdown: headings, lists, tables and fenced code blocks with language tags.
- Match the user's language. If they write in another language, answer in that language.
- Never fabricate citations, statistics, quotes, URLs or sources. Only cite what is given to you in CONTEXT.
- If evidence is missing, ambiguous or conflicting, say so plainly and describe what is known vs unknown.
- Prefer recent, authoritative information when the context contains it.
- For code, provide working, idiomatic examples.`;

/** @returns {string} system prompt for this specific request */
export function buildSystemPrompt ({ customPrompt, task = 'chat', sources = [], documents = [], mode = 'AUTO', isDemo = false, currentDate = new Date().toISOString().slice(0, 10) } = {}) {
  const parts = [customPrompt?.trim() || BASE_SYSTEM_PROMPT];
  parts.push(`Today's date is ${currentDate}.`);
  parts.push(`Search mode: ${mode}.`);
  parts.push(answerStyleFor(task));

  if (sources.length) {
    parts.push(
      `You were given ${sources.length} external source(s) in the CONTEXT block, numbered [1]..[${sources.length}].`,
      'When you use information from a source, cite it inline as [1], [2] etc. at the end of the sentence.',
      'Do not cite sources that were not provided. Do not invent URLs.',
      'If the retrieved sources conflict, present both sides and say the point is contested.'
    );
  }
  if (documents.length) {
    parts.push(
      `The user's uploaded documents are provided as DOCUMENT EXCERPT blocks (${documents.length} chunk(s)).`,
      'Ground answers about those files in the excerpts and cite them as (file: page X) when a page number exists.'
    );
  }
  if (!sources.length && !documents.length) {
    parts.push('No external context was retrieved for this turn; answer from general knowledge and be explicit when something may have changed recently.');
  }
  if (mode === 'FAST') parts.push('This is FAST mode: be concise. Aim for the shortest useful answer.');
  if (mode === 'DEEP') parts.push('This is DEEP SEARCH: synthesize the retrieved material thoroughly and note disagreements between sources.');
  if (isDemo) {
    parts.push(
      'IMPORTANT: The deployment is running in demo mode with a mock model. Never present the mock output as real generated knowledge.'
    );
  }
  return parts.join('\n\n');
}

export default { buildSystemPrompt, BASE_SYSTEM_PROMPT };
