/**
 * Knowledge connector registry.
 * Connectors are keyless, lawful public APIs. They run in parallel and are
 * merged/deduplicated by the retrieval service.
 */
import { WikipediaConnector } from './wikipedia.js';
import { ArxivConnector } from './arxiv.js';
import { CrossrefConnector, OpenAlexConnector, PubmedConnector } from './scholarly.js';
import { OpenLibraryConnector, GutenbergConnector } from './books.js';
import { WikidataConnector } from './wikidata.js';
import { DuckDuckGoConnector } from './duckduckgo.js';
import { StackOverflowConnector } from './stackoverflow.js';
import { MdnConnector } from './mdn.js';
import { HackerNewsConnector } from './hackernews.js';

const registry = {
  wikipedia: new WikipediaConnector(),
  wikidata: new WikidataConnector(),
  duckduckgo: new DuckDuckGoConnector(),
  stackoverflow: new StackOverflowConnector(),
  mdn: new MdnConnector(),
  hackernews: new HackerNewsConnector(),
  arxiv: new ArxivConnector(),
  crossref: new CrossrefConnector(),
  openalex: new OpenAlexConnector(),
  pubmed: new PubmedConnector(),
  openlibrary: new OpenLibraryConnector(),
  gutenberg: new GutenbergConnector(),
};

/** Default connector set used for a quick knowledge lookup (AUTO mode). */
export const CORE_CONNECTORS = [
  'duckduckgo',
  'wikipedia',
  'wikidata',
  'stackoverflow',
  'mdn',
  'hackernews',
];

/** Wider connector set used by deep research. */
export const RESEARCH_CONNECTORS = [
  'duckduckgo',
  'wikipedia',
  'wikidata',
  'stackoverflow',
  'mdn',
  'hackernews',
  'arxiv',
  'crossref',
  'openalex',
  'pubmed',
  'openlibrary',
  'gutenberg',
];

export const getConnector = (name) => registry[name] || null;
export const listConnectors = () => Object.values(registry).map((connector) => ({ id: connector.name, label: connector.label }));

/**
 * Run selected connectors in parallel.
 * Returns { results, connectors: [{name, count, error?}] }.
 */
export async function knowledgeSearch (query, { connectorNames = CORE_CONNECTORS, limitPerConnector = 2, signal, timeoutMs = 8000 } = {}) {
  const names = connectorNames.filter((name) => registry[name]);
  const outcomes = await Promise.allSettled(
    names.map(async (name) => {
      const connector = registry[name];
      if (!connector.supports(query)) return { name, results: [] };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error('connector timeout')), timeoutMs);
      const onAbort = () => controller.abort(signal?.reason);
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      try {
        const results = await connector.search(query, { limit: limitPerConnector, signal: controller.signal });
        return { name, results: results || [] };
      } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
      }
    })
  );

  const results = [];
  const meta = [];
  outcomes.forEach((outcome, index) => {
    const name = names[index];
    if (outcome.status === 'fulfilled') {
      meta.push({ name, count: outcome.value.results.length });
      results.push(...outcome.value.results);
    } else {
      meta.push({ name, count: 0, error: String(outcome.reason?.message || outcome.reason) });
    }
  });
  return { results, connectors: meta };
}

export default { knowledgeSearch, getConnector, listConnectors, CORE_CONNECTORS, RESEARCH_CONNECTORS };
