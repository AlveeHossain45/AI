/**
 * Search provider registry with graceful fallback across providers.
 */
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { SearchProvider } from './base.js';
import { TavilySearchProvider } from './tavily.js';
import { BraveSearchProvider } from './brave.js';
import { SerperSearchProvider } from './serper.js';
import { GoogleSearchProvider } from './google.js';
import { MockSearchProvider } from './mock.js';

const registry = {
  tavily: new TavilySearchProvider(),
  brave: new BraveSearchProvider(),
  serper: new SerperSearchProvider(),
  google: new GoogleSearchProvider(),
  mock: new MockSearchProvider(),
};

export const availableSearchProviders = () =>
  Object.values(registry)
    .filter((provider) => provider.isAvailable())
    .map((provider) => ({ id: provider.name, label: provider.label }));

export function getSearchProvider () {
  const preferred = registry[config.search.provider];
  if (preferred?.isAvailable()) return preferred;
  const fallback = Object.values(registry).find((provider) => provider.name !== 'mock' && provider.isAvailable());
  if (fallback) return fallback;
  if (registry.mock.isAvailable()) return registry.mock;
  return null;
}

/**
 * Execute a web search with fallback.
 * Returns { results, provider, degraded, notice? } — never throws for
 * "no provider configured" (returns empty with a notice instead).
 */
export async function webSearch (query, options = {}) {
  const { maxResults = config.limits.maxSearchResults, signal, allowMock = true } = options;
  const chain = [];
  const primary = getSearchProvider();
  if (primary) chain.push(primary);
  if (config.search.fallback) {
    for (const provider of Object.values(registry)) {
      if (provider.name === 'mock' || chain.includes(provider) || !provider.isAvailable()) continue;
      chain.push(provider);
    }
  }

  const seen = new Set();
  const merged = [];
  let usedProvider = null;
  let lastError = null;
  let degraded = false;

  for (const provider of chain) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const results = await provider.search(query, { maxResults, signal, ...options });
      usedProvider = usedProvider || provider.name;
      for (const result of results) {
        const key = result.url.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(result);
      }
      if (merged.length >= maxResults) break;
    } catch (error) {
      degraded = true;
      lastError = error;
      logger.warn(`Search provider ${provider.name} failed: ${error.message}`);
    }
  }

  if (!merged.length && lastError && !allowMock) {
    throw lastError;
  }
  if (!merged.length && registry.mock.isAvailable() && allowMock) {
    const mockResults = await registry.mock.search(query, { maxResults });
    merged.push(...mockResults);
    usedProvider = 'mock';
  }

  return {
    results: merged.slice(0, maxResults),
    provider: usedProvider,
    degraded,
    notice: degraded && lastError ? 'Some search providers failed; results may be incomplete.' : undefined,
    error: lastError ? lastError.message : undefined,
  };
}

export { SearchProvider };
export default { webSearch, getSearchProvider, availableSearchProviders };
