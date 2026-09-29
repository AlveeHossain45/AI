/**
 * Wikidata connector (official MediaWiki API) — structured facts/identifiers.
 */
import { KnowledgeConnector } from './base.js';
import { requestJson } from '../../utils/http.js';
import { truncate } from '../../utils/text.js';

export class WikidataConnector extends KnowledgeConnector {
  constructor () {
    super();
    this.name = 'wikidata';
    this.label = 'Wikidata';
  }

  supports (query) {
    return /\b(who|what|when|where|born|died|invented|founded|is a|was a)\b/i.test(query) || query.split(' ').length <= 6;
  }

  async search (query, { limit = 3, signal } = {}) {
    const params = new URLSearchParams({
      action: 'wbsearchentities',
      search: String(query),
      language: 'en',
      uselang: 'en',
      type: 'item',
      limit: String(limit),
      format: 'json',
    });
    const data = await requestJson(`https://www.wikidata.org/w/api.php?${params.toString()}`, { method: 'GET' }, { signal });
    const hits = data?.search || [];
    return hits.map((hit) => ({
      title: `${hit.label}${hit.description ? ` — ${hit.description}` : ''}`,
      url: `https://www.wikidata.org/wiki/${hit.id}`,
      snippet: truncate(hit.description || hit.label || '', 320),
      content: [hit.label, hit.description, hit.id].filter(Boolean).join('. '),
      provider: this.name,
      score: hit.score ? Number(hit.score) / 100 : undefined,
    }));
  }
}

export default WikidataConnector;
