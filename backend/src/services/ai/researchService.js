/**
 * Deep research agent (bounded — never searches endlessly):
 *   decompose → fan-out searches → dedupe/rank → synthesize findings
 * Limits come from DEEP_RESEARCH_* env vars (subqueries, searches, sources, time).
 */
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { chatWithFallback, isGenerativeAiAvailable } from '../../providers/ai/index.js';
import { webSearch } from '../../providers/search/index.js';
import { knowledgeSearch, RESEARCH_CONNECTORS } from '../../providers/knowledge/index.js';
import { buildQueries } from './intentService.js';
import { rankAndClean } from './retrievalService.js';
import { settingRepo } from '../../repositories/settingRepo.js';
import { truncate } from '../../utils/text.js';

/**
 * @returns {{sources: Array, findings: string|null, meta: object}}
 */
export async function runResearch ({ question, userId = null, conversationId = null, signal, onProgress = () => {} }) {
  const deadline = Date.now() + config.research.maxTimeMs;
  const started = Date.now();
  const blockedDomains = await settingRepo.getGlobal('blocked_domains', []);

  onProgress({ stage: 'decompose', detail: 'Breaking the question into subquestions' });
  const subquestions = await decomposeQuestion(question, { signal, deadline });

  const raw = [];
  const searchLog = [];
  let searches = 0;

  for (const subquestion of subquestions) {
    if (signal?.aborted || Date.now() > deadline || searches >= config.research.maxSearches) break;
    const queries = buildQueries(subquestion, { intent: 'current' }).slice(0, 2);
    for (const query of queries) {
      if (signal?.aborted || Date.now() > deadline || searches >= config.research.maxSearches) break;
      searches += 1;
      onProgress({ stage: 'search', detail: query });
      const queryStart = Date.now();
      try {
        // eslint-disable-next-line no-await-in-loop
        const { results, provider, notice } = await webSearch(query, { maxResults: 5, signal });
        searchLog.push({ query, provider, latencyMs: Date.now() - queryStart, count: results.length, notice });
        raw.push(...results.map((result) => ({ ...result, via: 'web', query })));
      } catch (error) {
        if (signal?.aborted) break;
        searchLog.push({ query, provider: null, latencyMs: Date.now() - queryStart, count: 0, error: error.message });
        logger.warn(`Research search failed: ${error.message}`);
      }
    }
  }

  // One knowledge pass for keyless, citable reference material.
  if (!signal?.aborted && Date.now() < deadline) {
    onProgress({ stage: 'knowledge', detail: 'Consulting open knowledge sources' });
    try {
      // eslint-disable-next-line no-await-in-loop
      const { results } = await knowledgeSearch(question, { connectorNames: RESEARCH_CONNECTORS, limitPerConnector: 2, signal });
      raw.push(...results.map((result) => ({ ...result, via: 'knowledge' })));
    } catch (error) {
      logger.debug(`Research knowledge pass failed: ${error.message}`);
    }
  }

  const sources = rankAndClean(raw, question, { blockedDomains, limit: config.research.maxSources });

  onProgress({ stage: 'synthesize', detail: 'Comparing sources' });
  const findings = await synthesizeFindings(question, sources, { signal, deadline });

  return {
    sources,
    findings,
    meta: {
      subquestions,
      searches,
      searchLog,
      rawCount: raw.length,
      sourceCount: sources.length,
      ms: Date.now() - started,
      budget: {
        maxSearches: config.research.maxSearches,
        maxSources: config.research.maxSources,
        maxTimeMs: config.research.maxTimeMs,
        timedOut: Date.now() >= deadline,
      },
      providers: [...new Set(searchLog.map((entry) => entry.provider).filter(Boolean))],
    },
  };
}

/** Subquestion decomposition: LLM when available, deterministic facets otherwise. */
async function decomposeQuestion (question, { signal, deadline }) {
  const facets = [
    question,
    `${question} overview key facts`,
    `${question} recent developments`,
    `${question} examples comparisons`,
  ].slice(0, config.research.maxSubqueries);

  if (!isGenerativeAiAvailable() || signal?.aborted || Date.now() > deadline) {
    return facets.slice(0, signal?.aborted ? 2 : config.research.maxSubqueries);
  }
  try {
    const { result } = await chatWithFallback(
      [
        {
          role: 'user',
          content:
            `Split this research question into ${config.research.maxSubqueries} focused subquestions that together answer it. ` +
            `Respond with JSON array of strings only. Question: ${JSON.stringify(String(question).slice(0, 600))}`,
        },
      ],
      { json: true, maxTokens: 300, temperature: 0.2, signal }
    );
    const match = result.content.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]).filter((item) => typeof item === 'string' && item.trim());
      if (parsed.length) return parsed.slice(0, config.research.maxSubqueries);
    }
  } catch (error) {
    logger.debug(`Subquestion decomposition fell back to facets: ${error.message}`);
  }
  return facets;
}

/** Optional: a compact comparison digest that highlights conflicts. */
async function synthesizeFindings (question, sources, { signal, deadline }) {
  if (!sources.length || signal?.aborted || Date.now() >= deadline) return null;
  if (process.env.RESEARCH_SYNTHESIS === 'off') return null;
  if (!isGenerativeAiAvailable()) {
    // Grounded mode: build the digest from ranked source sentences instead.
    const { buildGroundedAnswer } = await import('./groundedEngine.js');
    const digest = buildGroundedAnswer({ question, sources, history: [], mode: 'DEEP' });
    return digest.strategy.startsWith('fallback') ? null : truncate(digest.content, 3500);
  }
  try {
    const evidence = sources
      .slice(0, 8)
      .map((source, index) => `[${index + 1}] ${source.title} (${source.domain}): ${truncate(source.snippet, 300)}`)
      .join('\n');
    const { result } = await chatWithFallback(
      [
        {
          role: 'user',
          content:
            `Using ONLY the evidence list below, write brief research notes for the question "${question}". ` +
            'Include: (a) what the sources agree on, (b) where they conflict or are uncertain, (c) key numbers/facts with [n] citations. ' +
            'If the evidence is thin, say so. Max 250 words.\n\n' + evidence,
        },
      ],
      { maxTokens: 500, temperature: 0.2, signal }
    );
    return truncate(result.content.trim(), 3500);
  } catch (error) {
    logger.debug(`Research synthesis skipped: ${error.message}`);
    return null;
  }
}

export default { runResearch };
