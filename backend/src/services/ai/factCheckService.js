/**
 * Optional fact-checking layer (FACT_CHECK_ENABLED=true):
 *   answer → claim extraction → evidence check against retrieved sources →
 *   uncertainty annotations appended to the answer.
 *
 * Never invents citations: each claim is checked only against the sources
 * that were actually retrieved for this request.
 */
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { chatWithFallback, isGenerativeAiAvailable } from '../../providers/ai/index.js';
import { tokenize, truncate } from '../../utils/text.js';

export const factCheckEnabled = () => config.features.factCheckEnabled;

/**
 * @returns {{status:'passed'|'uncertain'|'skipped', notes?:string, claims?:Array}|null}
 */
export async function verifyAnswer (answer, sources, { signal } = {}) {
  if (!factCheckEnabled()) return null;
  if (!sources?.length) return { status: 'skipped', notes: 'No external sources were retrieved to verify against.' };
  if (signal?.aborted) return null;
  if (!isGenerativeAiAvailable()) {
    // Lexical grounding check: the answer must actually use the sources.
    const answerTokens = new Set(tokenize(answer));
    const overlap = Math.min(
      1,
      sources.reduce((acc, source) => acc + tokenize(`${source.title} ${source.snippet}`).filter((t) => answerTokens.has(t)).length, 0) / 25
    );
    return overlap >= 0.35
      ? { status: 'passed', notes: 'Answer content matches the retrieved sources.' }
      : { status: 'uncertain', notes: 'Only part of the answer could be matched against the retrieved sources.' };
  }
  try {
    const evidence = sources
      .map((source, index) => `[${index + 1}] ${source.title}: ${truncate(source.snippet, 400)}`)
      .join('\n');
    const { result } = await chatWithFallback(
      [
        {
          role: 'user',
          content:
            'Extract up to 4 key factual claims from the ANSWER and check each against the EVIDENCE. ' +
            'Respond with JSON only: {"claims":[{"claim":"...","verdict":"supported|uncertain|unsupported","evidence":[1]}],"overall":"ok|needs-caution"}. ' +
            `Do not use outside knowledge.\n\nEVIDENCE:\n${evidence}\n\nANSWER:\n${truncate(answer, 4000)}`,
        },
      ],
      { json: true, maxTokens: 700, temperature: 0, signal }
    );
    const match = result.content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const claims = Array.isArray(parsed.claims) ? parsed.claims : [];
    const unsupported = claims.filter((claim) => claim.verdict === 'unsupported').length;
    const uncertain = claims.filter((claim) => claim.verdict === 'uncertain').length;

    if (!claims.length) return { status: 'passed', claims: [] };
    if (unsupported > 0) {
      return {
        status: 'uncertain',
        claims,
        notes: 'Some statements in the answer are not supported by the retrieved sources — treat them with caution.',
      };
    }
    if (uncertain > 0) {
      return { status: 'uncertain', claims, notes: 'Some claims are only partially supported by the retrieved sources.' };
    }
    return { status: 'passed', claims };
  } catch (error) {
    logger.debug(`Fact check skipped: ${error.message}`);
    return { status: 'skipped', notes: 'Verification was unavailable for this response.' };
  }
}

/** Remove citations that point at sources which do not exist. */
export function sanitizeCitations (answer, sourceCount) {
  if (!answer) return answer;
  if (!sourceCount) {
    // No sources: strip bracketed numeric citations the model may have hallucinated.
    return answer.replace(/ ?\[(\d{1,2})\]/g, '');
  }
  return answer.replace(/\[(\d{1,2})\]/g, (match, num) => (Number(num) <= sourceCount ? match : ''));
}

/** Cheap lexical overlap check (used when no LLM is available). */
export function lexicalSupport (claim, sources) {
  const claimTokens = new Set(tokenize(claim));
  if (!claimTokens.size) return 0;
  let best = 0;
  for (const source of sources) {
    const sourceTokens = new Set(tokenize(`${source.title} ${source.snippet} ${source.content || ''}`));
    let hits = 0;
    for (const token of claimTokens) if (sourceTokens.has(token)) hits += 1;
    best = Math.max(best, hits / claimTokens.size);
  }
  return best;
}

export default { verifyAnswer, sanitizeCitations, factCheckEnabled };
