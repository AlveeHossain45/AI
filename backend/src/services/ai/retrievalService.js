/**
 * Retrieval orchestration: web search + knowledge connectors + RAG,
 * followed by deduplication, cleaning, relevance ranking and persistence
 * for auditing (search_queries / search_results tables).
 */
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { webSearch } from '../../providers/search/index.js';
import { knowledgeSearch, CORE_CONNECTORS, RESEARCH_CONNECTORS } from '../../providers/knowledge/index.js';
import { extractCompareEntities, contentTokens } from './groundedEngine.js';
import { retrieveDocumentContext } from '../rag/ingestService.js';
import searchRepo from '../../repositories/searchRepo.js';
import { settingRepo } from '../../repositories/settingRepo.js';
import { canonicalUrl, getDomain, domainAuthorityBoost, isSafeHttpUrl } from '../../utils/url.js';
import { htmlToText, relevanceScore, truncate, estimateTokens, tokenize } from '../../utils/text.js';

/**
 * @returns {{sources: Array, documentChunks: Array, meta: object}}
 */
export async function executeRetrieval ({
  question,
  analysis,
  mode = 'AUTO',
  userId = null,
  conversationId = null,
  documentIds = [],
  signal,
}) {
  const started = Date.now();
  const sources = [];
  const documentChunks = [];
  const searchLog = [];
  const blockedDomains = await settingRepo.getGlobal('blocked_domains', []);

  // 1) Web search ---------------------------------------------------------
  if (analysis.needsWeb) {
    const queries = analysis.queries.slice(0, mode === 'DEEP' ? config.research.maxSearches : 1);
    for (const query of queries) {
      if (signal?.aborted) break;
      const queryStart = Date.now();
      try {
        // eslint-disable-next-line no-await-in-loop
        const { results, provider, notice } = await webSearch(query, {
          maxResults: config.limits.maxSearchResults,
          signal,
          topic: analysis.intent === 'current' ? 'news' : 'general',
        });
        searchLog.push({ query, provider, latencyMs: Date.now() - queryStart, count: results.length, notice });
        sources.push(...results.map((result) => ({ ...result, via: 'web', query })));
        if (notice) logger.warn(`Web search degraded: ${notice}`);
      } catch (error) {
        if (signal?.aborted) break;
        searchLog.push({ query, provider: null, latencyMs: Date.now() - queryStart, count: 0, error: error.message });
        logger.warn(`Web search failed for "${query}": ${error.message}`);
      }
      if (sources.length >= config.research.maxSources) break;
    }
  }

  // 2) Knowledge connectors (keyless public APIs) --------------------------
  const wantKnowledge =
    analysis.needsKnowledge ||
    (analysis.needsWeb && sources.filter((s) => !s.synthetic).length < 2 && !signal?.aborted);

  if (wantKnowledge) {
    const connectorNames = mode === 'DEEP' ? RESEARCH_CONNECTORS : CORE_CONNECTORS;
    const coreSubject = analysis.queries?.[0] || question;
    const compareEntities = extractCompareEntities(question);
    const knowledgeQueries = compareEntities ? compareEntities : [coreSubject];
    try {
      for (const knowledgeQuery of knowledgeQueries) {
        if (signal?.aborted) break;
        // eslint-disable-next-line no-await-in-loop
        const { results, connectors } = await knowledgeSearch(knowledgeQuery, {
          connectorNames,
          limitPerConnector: compareEntities
            ? 2
            : analysis.intent === 'current'
              ? 5
              : mode === 'DEEP' ? 3 : 2,
          signal,
        });
        searchLog.push({ query: knowledgeQuery, provider: 'knowledge', latencyMs: 0, count: results.length, connectors });
        sources.push(...results.map((result) => ({ ...result, via: 'knowledge', query: knowledgeQuery })));
      }
    } catch (error) {
      if (!signal?.aborted) logger.warn(`Knowledge search failed: ${error.message}`);
    }
  }

  // 3) Document retrieval (RAG) --------------------------------------------
  if (analysis.needsDocuments && userId) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const chunks = await retrieveDocumentContext(userId, question, {
        documentIds: documentIds.length ? documentIds : null,
        topK: config.limits.maxRetrievedChunks,
      });
      documentChunks.push(...chunks);
    } catch (error) {
      logger.warn(`Document retrieval failed: ${error.message}`);
    }
  }

  const ranked = rankAndClean(sources, question, { blockedDomains, limit: config.research.maxSources });

  // 4) Audit persistence (best-effort, never blocks the answer) ------------
  if (userId && searchLog.length) {
    try {
      await Promise.all(
        searchLog.map((entry) =>
          searchRepo.createQuery({
            userId,
            conversationId,
            mode,
            query: entry.query,
            provider: entry.provider,
            latencyMs: entry.latencyMs,
            results: entry.query === question ? ranked : [],
          })
        )
      );
    } catch (error) {
      logger.debug(`Search audit persistence failed: ${error.message}`);
    }
  }

  return {
    sources: ranked,
    documentChunks,
    meta: {
      ms: Date.now() - started,
      searchLog,
      rawCount: sources.length,
      sourceCount: ranked.length,
      documentChunkCount: documentChunks.length,
      providers: [...new Set(searchLog.map((entry) => entry.provider).filter(Boolean))],
      degraded: searchLog.some((entry) => entry.error || entry.notice),
    },
  };
}

/** Deduplicate, score, filter and clean retrieved results. */
export function rankAndClean (results, question, { blockedDomains = [], limit = 12 } = {}) {
  const seen = new Set();
  const cleaned = [];

  for (const result of results || []) {
    if (!result?.url || !isSafeHttpUrl(result.url)) continue;
    const key = canonicalUrl(result.url);
    if (seen.has(key)) continue;
    const domain = getDomain(result.url);
    if (domain && blockedDomains.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`))) continue;
    seen.add(key);

    const content = htmlToText(result.content || '').replace(/\s+/g, ' ').trim();
    const snippet = htmlToText(result.snippet || '').replace(/\s+/g, ' ').trim();
    if (!content && !snippet) continue;

    const relevance = relevanceScore(question, `${result.title} ${snippet} ${content.slice(0, 1500)}`);
    const providerScore = typeof result.score === 'number' ? Math.min(Math.max(result.score, 0), 1) : 0.5;
    const authority = domainAuthorityBoost(result.url) - 1;
    const syntheticPenalty = result.synthetic ? -0.6 : 0;

    // Title/subject alignment: exact subject titles beat disambiguation noise.
    const querySet = new Set(contentTokens(tokenize(question)));
    const titleSet = new Set(contentTokens(tokenize(result.title)));
    let titleBonus = 0;
    if (querySet.size && titleSet.size) {
      const allInTitle = [...querySet].every((token) => titleSet.has(token));
      const exact = allInTitle && [...titleSet].every((token) => querySet.has(token));
      if (exact) titleBonus = 0.25;
      else if (allInTitle) titleBonus = 0.12;
      else {
        const overlap = [...querySet].filter((token) => titleSet.has(token)).length / querySet.size;
        titleBonus = overlap * 0.08;
      }
    }
    // Short one-line entity cards (wikidata/related-topic stubs) rank below articles.
    const shortCardPenalty = (result.content || '').length < 160 ? -0.12 : 0;

    const score = Math.max(
      0,
      Math.min(
        1,
        relevance * 0.5 + providerScore * 0.25 + authority * 0.5 + titleBonus + shortCardPenalty + syntheticPenalty
      )
    );

    cleaned.push({
      title: truncate(result.title, 200),
      url: result.url,
      domain,
      snippet: truncate(snippet || content, 400),
      content: truncate(content || snippet, 6000),
      provider: result.provider,
      via: result.via || 'web',
      publishedAt: result.publishedAt,
      synthetic: Boolean(result.synthetic),
      relevance,
      score: Number(score.toFixed(4)),
      tokenCount: estimateTokens(content || snippet),
    });
  }

  cleaned.sort((a, b) => b.score - a.score);
  return cleaned.slice(0, limit);
}

export default { executeRetrieval, rankAndClean };
