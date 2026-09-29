/**
 * Brave Search API provider (https://brave.com/search/api/)
 */
import config from '../../config/index.js';
import { SearchProvider } from './base.js';
import { requestJson } from '../../utils/http.js';

export class BraveSearchProvider extends SearchProvider {
  constructor () {
    super();
    this.name = 'brave';
    this.label = 'Brave Search';
  }

  isAvailable () {
    return Boolean(config.search.braveApiKey);
  }

  async search (query, { maxResults = 5, signal, freshness } = {}) {
    const params = new URLSearchParams({ q: query, count: String(Math.min(maxResults, 20)), safesearch: 'moderate' });
    if (freshness === 'week') params.set('freshness', 'pw');
    else if (freshness === 'day') params.set('freshness', 'pd');
    const data = await requestJson(
      `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json', 'X-Subscription-Token': config.search.braveApiKey },
      },
      { signal }
    );
    return SearchProvider.normalize(
      (data.web?.results || []).map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.description || '',
        content: '',
        publishedAt: result.age || undefined,
      })),
      this.name
    );
  }
}

export default BraveSearchProvider;
