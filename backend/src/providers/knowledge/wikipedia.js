/**
 * Wikipedia connector (MediaWiki API — official, CC BY-SA content with attribution).
 * https://en.wikipedia.org/api/rest_sitemaps/  |  https://en.wikipedia.org/w/api.php
 */
import { KnowledgeConnector } from './base.js';
import { requestJson } from '../../utils/http.js';
import { truncate } from '../../utils/text.js';

const API = 'https://en.wikipedia.org/w/api.php';

export class WikipediaConnector extends KnowledgeConnector {
  constructor () {
    super();
    this.name = 'wikipedia';
    this.label = 'Wikipedia';
  }

  async search (query, { limit = 3, signal } = {}) {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: String(query),
      srlimit: String(limit),
      srprop: 'snippet|wordcount',
      format: 'json',
      origin: '*',
    });
    const data = await requestJson(`${API}?${params.toString()}`, { method: 'GET' }, { signal });
    const hits = data?.query?.search || [];
    if (!hits.length) return [];

    const titles = hits.map((hit) => hit.title);
    const summaryParams = new URLSearchParams({
      action: 'query',
      prop: 'extracts',
      exintro: '1',
      explaintext: '1',
      exsentences: '8',
      redirects: '1',
      titles: titles.join('|'),
      format: 'json',
      origin: '*',
    });
    let extracts = {};
    try {
      const summaries = await requestJson(`${API}?${summaryParams.toString()}`, { method: 'GET' }, { signal });
      const pages = summaries?.query?.pages || {};
      extracts = Object.fromEntries(Object.values(pages).map((page) => [page.title, page.extract || '']));
    } catch {
      extracts = {};
    }

    return hits.map((hit) => {
      const title = hit.title;
      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
      const snippet = String(hit.snippet || '').replace(/<[^>]+>/g, '');
      return {
        title,
        url,
        snippet: truncate(snippet, 320),
        content: extracts[title] || snippet,
        provider: this.name,
        score: 1 - Math.min(0.5, (hit.index || 0) / 20),
      };
    });
  }
}

export default WikipediaConnector;
