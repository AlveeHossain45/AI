/**
 * Serper provider (Google results via https://serper.dev)
 */
import config from '../../config/index.js';
import { SearchProvider } from './base.js';
import { requestJson } from '../../utils/http.js';

export class SerperSearchProvider extends SearchProvider {
  constructor () {
    super();
    this.name = 'serper';
    this.label = 'Serper (Google)';
  }

  isAvailable () {
    return Boolean(config.search.serperApiKey);
  }

  async search (query, { maxResults = 5, signal } = {}) {
    const data = await requestJson(
      'https://google.serper.dev/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': config.search.serperApiKey },
        body: JSON.stringify({ q: query, num: Math.min(maxResults, 20) }),
      },
      { signal }
    );
    const organic = (data.organic || []).map((result) => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet || '',
      content: '',
      publishedAt: result.date,
    }));
    const answerBox = data.answerBox
      ? [{
          title: data.answerBox.title || 'Answer box',
          url: data.answerBox.link || 'https://www.google.com/search?q=' + encodeURIComponent(query),
          snippet: [data.answerBox.answer, data.answerBox.snippet].filter(Boolean).join(' '),
          content: '',
        }]
      : [];
    return SearchProvider.normalize([...answerBox, ...organic], this.name);
  }
}

export default SerperSearchProvider;
