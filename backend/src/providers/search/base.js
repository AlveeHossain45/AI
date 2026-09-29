/**
 * Search provider contract.
 *
 * search(query, { maxResults, signal, country, freshness }) ->
 *   [{ title, url, snippet, content?, score?, publishedAt?, provider }]
 */
import config from '../../config/index.js';

export class SearchProvider {
  constructor () {
    this.name = 'base';
    this.label = 'Base';
  }

  isAvailable () {
    return false;
  }

  async search () {
    throw new Error(`${this.name} does not implement search()`);
  }

  static normalize (results = [], providerName) {
    return results
      .filter((result) => result && result.url && result.title)
      .map((result) => ({
        title: String(result.title).trim(),
        url: String(result.url).trim(),
        snippet: result.snippet ? String(result.snippet).trim() : '',
        content: result.content ? String(result.content).trim() : '',
        score: typeof result.score === 'number' ? result.score : undefined,
        publishedAt: result.publishedAt || undefined,
        provider: result.provider || providerName,
        synthetic: Boolean(result.synthetic),
      }));
  }
}

export const searchConfig = config.search;

export default SearchProvider;
