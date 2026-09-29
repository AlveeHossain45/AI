/**
 * Knowledge source connector contract.
 *
 * These connectors use official public APIs (Wikipedia, arXiv, Crossref,
 * OpenAlex, Open Library, Gutenberg, PubMed, Wikidata). No scraping, no
 * robots.txt violations, no paywalled content.
 *
 * search(query, { limit, signal }) -> normalized search results with content.
 */
import { SearchProvider } from '../search/base.js';

export class KnowledgeConnector {
  constructor () {
    this.name = 'base';
    this.label = 'Base';
    this.enabled = true;
  }

  /** Whether this connector is relevant for the given query/mode. */
  supports (query, context = {}) {
    void query;
    void context;
    return true;
  }

  async search () {
    throw new Error(`${this.name} does not implement search()`);
  }
}

export { SearchProvider };
export default KnowledgeConnector;
