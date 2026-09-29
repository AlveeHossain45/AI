/**
 * Tavily Search API provider (https://tavily.com)
 * Returns page content with results — best for RAG-style context building.
 */
import config from '../../config/index.js';
import { SearchProvider } from './base.js';
import { requestJson } from '../../utils/http.js';

export class TavilySearchProvider extends SearchProvider {
  constructor () {
    super();
    this.name = 'tavily';
    this.label = 'Tavily';
  }

  isAvailable () {
    return Boolean(config.search.tavilyApiKey);
  }

  async search (query, { maxResults = 5, signal, topic = 'general' } = {}) {
    const body = {
      api_key: config.search.tavilyApiKey,
      query,
      max_results: Math.min(maxResults, 10),
      search_depth: 'advanced',
      include_answer: false,
      include_raw_content: true,
    };
    if (topic === 'news') body.topic = 'news';
    const data = await requestJson(
      'https://api.tavily.com/search',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      { signal }
    );
    return SearchProvider.normalize(
      (data.results || []).map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.content ? String(result.content).slice(0, 400) : '',
        content: result.raw_content || result.content || '',
        score: result.score,
        publishedAt: result.published_date,
      })),
      this.name
    );
  }
}

export default TavilySearchProvider;
