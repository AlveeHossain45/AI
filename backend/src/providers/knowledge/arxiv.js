/**
 * arXiv connector (official Atom API — open access preprints).
 * https://info.arxiv.org/help/api/index.html
 */
import { KnowledgeConnector } from './base.js';
import { fetchWithTimeout } from '../../utils/http.js';
import { cleanText, truncate } from '../../utils/text.js';

export class ArxivConnector extends KnowledgeConnector {
  constructor () {
    super();
    this.name = 'arxiv';
    this.label = 'arXiv';
  }

  supports (query) {
    // arXiv is most useful for technical/scientific queries
    return true;
  }

  async search (query, { limit = 3, signal } = {}) {
    const params = new URLSearchParams({
      search_query: `all:"${String(query).replace(/"/g, '')}"`,
      start: '0',
      max_results: String(limit),
      sortBy: 'relevance',
    });
    const response = await fetchWithTimeout(`http://export.arxiv.org/api/query?${params.toString()}`, { method: 'GET' }, { signal });
    if (!response.ok) throw new Error(`arXiv HTTP ${response.status}`);
    const xml = await response.text();
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    return entries.map((entry) => {
      const title = cleanText((entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
      const id = cleanText((entry.match(/<id>([\s\S]*?)<\/id>/) || [])[1] || '');
      const summary = cleanText((entry.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1] || '');
      const published = (entry.match(/<published>([\s\S]*?)<\/published>/) || [])[1] || '';
      return {
        title,
        url: id,
        snippet: truncate(summary, 320),
        content: summary,
        publishedAt: published.slice(0, 10) || undefined,
        provider: this.name,
        score: undefined,
      };
    }).filter((result) => result.title && result.url);
  }
}

export default ArxivConnector;
