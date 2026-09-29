/**
 * Google Programmable Search Engine (JSON API) — optional key-based provider.
 * Requires GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX (a programmable engine
 * with "Search the entire web" enabled).
 * https://developers.google.com/custom-search/v1/overview
 */
import config from '../../config/index.js';
import { SearchProvider } from './base.js';
import { requestJson } from '../../utils/http.js';

export class GoogleSearchProvider extends SearchProvider {
  constructor () {
    super();
    this.name = 'google';
    this.label = 'Google (Programmable Search)';
  }

  isAvailable () {
    return Boolean(config.search.googleApiKey && config.search.googleCx);
  }

  async search (query, { maxResults = 5, signal, freshness } = {}) {
    const params = new URLSearchParams({
      key: config.search.googleApiKey,
      cx: config.search.googleCx,
      q: String(query),
      num: String(Math.min(maxResults, 10)),
    });
    if (freshness === 'day') params.set('dateRestrict', 'd1');
    else if (freshness === 'week') params.set('dateRestrict', 'w1');

    const data = await requestJson(`https://www.googleapis.com/customsearch/v1?${params.toString()}`, { method: 'GET' }, { signal });
    const items = data.items || [];
    return SearchProvider.normalize(
      items.map((item) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet || '',
        content: item.htmlSnippet ? String(item.htmlSnippet).replace(/<[^>]+>/g, ' ') : '',
        score: 0.7,
      })),
      this.name
    );
  }
}

export default GoogleSearchProvider;
