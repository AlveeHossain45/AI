/**
 * Book/literature connectors: Open Library and Project Gutenberg.
 * Both expose official public JSON APIs over openly licensed metadata.
 */
import { KnowledgeConnector } from './base.js';
import { requestJson } from '../../utils/http.js';
import { truncate } from '../../utils/text.js';

export class OpenLibraryConnector extends KnowledgeConnector {
  constructor () {
    super();
    this.name = 'openlibrary';
    this.label = 'Open Library';
  }

  supports (query) {
    return /\b(book|novel|author|write|writer|literature|fiction|read|library|poem|poet)\b/i.test(query) || query.split(' ').length <= 4;
  }

  async search (query, { limit = 3, signal } = {}) {
    const params = new URLSearchParams({ q: String(query), limit: String(limit), fields: 'title,author_name,first_publish_year,key,subject,ia' });
    const data = await requestJson(`https://openlibrary.org/search.json?${params.toString()}`, { method: 'GET' }, { signal });
    const docs = data?.docs || [];
    return docs.map((doc) => {
      const key = doc.key || '';
      return {
        title: [doc.title, doc.author_name?.[0]].filter(Boolean).join(' — '),
        url: key ? `https://openlibrary.org${key}` : 'https://openlibrary.org',
        snippet: truncate(
          [doc.first_publish_year ? `First published ${doc.first_publish_year}` : '', (doc.subject || []).slice(0, 6).join(', ')].filter(Boolean).join('. '),
          320
        ),
        content: [(doc.subject || []).slice(0, 20).join(', ')].filter(Boolean).join('. '),
        publishedAt: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
        provider: this.name,
      };
    }).filter((result) => result.title);
  }
}

export class GutenbergConnector extends KnowledgeConnector {
  constructor () {
    super();
    this.name = 'gutenberg';
    this.label = 'Project Gutenberg';
  }

  supports (query) {
    return /\b(gutenberg|public domain|classic|ebook|full text|shakespeare|austen|tolstoy)\b/i.test(query);
  }

  async search (query, { limit = 3, signal } = {}) {
    const data = await requestJson(`https://gutendex.com/search?search=${encodeURIComponent(String(query))}`, { method: 'GET' }, { signal });
    const books = Object.values(data?.books || {}).slice(0, limit);
    return books.map((book) => ({
      title: book.title,
      url: book.url?.[0] || `https://www.gutenberg.org/ebooks/${book.id}`,
      snippet: truncate((book.subjects || []).slice(0, 5).join('; '), 320),
      content: (book.subjects || []).join('; '),
      provider: this.name,
    })).filter((result) => result.title);
  }
}

export default { OpenLibraryConnector, GutenbergConnector };
