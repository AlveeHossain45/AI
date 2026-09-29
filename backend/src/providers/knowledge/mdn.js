/**
 * MDN Web Docs connector (official public search API — free, no key).
 * https://developer.mozilla.org/api/v1/search
 */
import { KnowledgeConnector } from './base.js';
import { requestJson } from '../../utils/http.js';
import { htmlToText, truncate } from '../../utils/text.js';

const WEB_TECH = /\b(javascript|typescript|html|css|dom|browser|fetch|promise|async|event|api|web|document|window|regex|json|http|react|vue|node)\b/i;

export class MdnConnector extends KnowledgeConnector {
  constructor () {
    super();
    this.name = 'mdn';
    this.label = 'MDN Web Docs';
  }

  supports (query) {
    return WEB_TECH.test(query);
  }

  async search (query, { limit = 2, signal } = {}) {
    const params = new URLSearchParams({ q: String(query), locale: 'en' });
    const data = await requestJson(`https://developer.mozilla.org/api/v1/search?${params.toString()}`, { method: 'GET' }, { signal });
    const documents = data?.documents || [];
    return documents.slice(0, limit).map((document) => {
      const summary = htmlToText(document.summary || '');
      return {
        title: truncate(document.title, 160),
        url: `https://developer.mozilla.org${document.mdn_url}`,
        snippet: truncate(summary, 320),
        content: summary,
        provider: this.name,
        score: document.score ? Math.min(1, document.score / 10) : 0.7,
      };
    }).filter((result) => result.url);
  }
}

export default MdnConnector;
