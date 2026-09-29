/**
 * Scholarly connectors: Crossref, OpenAlex, PubMed (NCBI E-utilities).
 * All are official, publicly documented APIs with clear usage policies.
 */
import { KnowledgeConnector } from './base.js';
import { requestJson, fetchWithTimeout } from '../../utils/http.js';
import { truncate } from '../../utils/text.js';

export class CrossrefConnector extends KnowledgeConnector {
  constructor () {
    super();
    this.name = 'crossref';
    this.label = 'Crossref';
    this.email = process.env.CROSSREF_MAILTO || '';
  }

  supports (query) {
    return /\b(paper|study|research|journal|doi|publication|cite|citation)\b/i.test(query) || query.split(' ').length > 6;
  }

  async search (query, { limit = 3, signal } = {}) {
    const params = new URLSearchParams({ query: String(query), rows: String(limit), select: 'title,URL,abstract,container-title,issued' });
    if (this.email) params.set('mailto', this.email);
    const data = await requestJson(`https://api.crossref.org/works?${params.toString()}`, { method: 'GET' }, { signal });
    const items = data?.message?.items || [];
    return items.map((item) => {
      const title = Array.isArray(item.title) ? item.title[0] : item.title;
      const container = Array.isArray(item['container-title']) ? item['container-title'][0] : item['container-title'];
      const year = item.issued?.['date-parts']?.[0]?.[0];
      const abstract = item.abstract ? String(item.abstract).replace(/<[^>]+>/g, ' ') : '';
      return {
        title: title || 'Untitled work',
        url: item.URL || '',
        snippet: truncate(abstract || container || '', 320),
        content: abstract,
        publishedAt: year ? String(year) : undefined,
        provider: this.name,
      };
    }).filter((result) => result.url);
  }
}

export class OpenAlexConnector extends KnowledgeConnector {
  constructor () {
    super();
    this.name = 'openalex';
    this.label = 'OpenAlex';
    this.email = process.env.OPENALEX_MAILTO || '';
  }

  supports (query) {
    return CrossrefConnector.prototype.supports.call(this, query);
  }

  async search (query, { limit = 3, signal } = {}) {
    const params = new URLSearchParams({ search: String(query), 'per-page': String(limit) });
    if (this.email) params.set('mailto', this.email);
    const data = await requestJson(`https://api.openalex.org/works?${params.toString()}`, { method: 'GET' }, { signal });
    const results = data?.results || [];
    return results.map((work) => ({
      title: work.display_name || 'Untitled work',
      url: work.id || '',
      snippet: truncate(work.abstract_inverted_index ? reconstructAbstract(work.abstract_inverted_index).slice(0, 320) : (work.primary_location?.source?.display_name || ''), 320),
      content: work.abstract_inverted_index ? reconstructAbstract(work.abstract_inverted_index) : '',
      publishedAt: work.publication_year ? String(work.publication_year) : undefined,
      provider: this.name,
    })).filter((result) => result.url);
  }
}

function reconstructAbstract (inverted) {
  const positions = [];
  for (const [word, indexes] of Object.entries(inverted || {})) {
    for (const index of indexes) positions[index] = word;
  }
  return positions.filter(Boolean).join(' ');
}

export class PubmedConnector extends KnowledgeConnector {
  constructor () {
    super();
    this.name = 'pubmed';
    this.label = 'PubMed';
  }

  supports (query) {
    return /\b(medical|health|clinical|disease|treatment|patient|biolog|cancer|therapy|drug)\b/i.test(query);
  }

  async search (query, { limit = 3, signal } = {}) {
    const searchParams = new URLSearchParams({
      db: 'pubmed', term: String(query), retmode: 'json', retmax: String(limit),
    });
    const search = await requestJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams.toString()}`, { method: 'GET' }, { signal });
    const ids = search?.esearchresult?.idlist || [];
    if (!ids.length) return [];
    const summaryParams = new URLSearchParams({ db: 'pubmed', id: ids.join(','), retmode: 'json' });
    const summary = await requestJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams.toString()}`, { method: 'GET' }, { signal });
    return ids.map((id) => {
      const record = summary?.result?.[id] || {};
      return {
        title: record.title || 'PubMed record',
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        snippet: truncate(record.title || '', 320),
        content: [record.title, record.fulljournalname, record.pubdate].filter(Boolean).join('. '),
        publishedAt: record.pubdate,
        provider: this.name,
      };
    });
  }
}

export { fetchWithTimeout };
export default { CrossrefConnector, OpenAlexConnector, PubmedConnector };
