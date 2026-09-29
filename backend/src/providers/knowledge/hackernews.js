/**
 * Hacker News connector (Algolia HN Search API — free, no key).
 * Used for time-sensitive "what's happening now" tech questions:
 * https://hn.algolia.com/api
 */
import { KnowledgeConnector } from './base.js';
import { requestJson } from '../../utils/http.js';
import { truncate } from '../../utils/text.js';

const NEWS_PATTERN = /\b(news|today|latest|current|recent|this (week|month|day)|yesterday|breaking|now|trending)\b/i;

export class HackerNewsConnector extends KnowledgeConnector {
  constructor () {
    super();
    this.name = 'hackernews';
    this.label = 'Hacker News';
  }

  supports (query) {
    return NEWS_PATTERN.test(query);
  }

  async search (query, { limit = 5, signal } = {}) {
    const cleanQuery = String(query)
      .replace(NEWS_PATTERN, '')
      .replace(/[?.!,:"']/g, ' ')
      .replace(/\b(what|when|which|happened|happening|is|are|was|were|the|in|on|of|for|to|and|please|tell|me|about|latest|recent|recently|breaking|day|week|month|year|this|that|today|yesterday|news|current|now|going on)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'technology';
    const since = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60; // last 7 days
    const params = new URLSearchParams({
      query: cleanQuery,
      tags: 'story',
      hitsPerPage: String(Math.min(limit, 8)),
      numericFilters: `created_at_i>${since}`,
    });
    const data = await requestJson(`https://hn.algolia.com/api/v1/search?${params.toString()}`, { method: 'GET' }, { signal });
    const hits = data?.hits || [];
    return hits.slice(0, limit).map((hit) => {
      const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
      return {
        title: truncate(hit.title || 'Untitled story', 160),
        url,
        snippet: truncate(`${hit.points ?? 0} points, ${hit.num_comments ?? 0} comments on Hacker News`, 320),
        content: truncate(`${hit.title || ''}. Shared on Hacker News with ${hit.points ?? 0} points and ${hit.num_comments ?? 0} comments.`, 600),
        publishedAt: hit.created_at ? hit.created_at.slice(0, 10) : undefined,
        provider: this.name,
        score: Math.min(1, 0.5 + (hit.points || 0) / 400),
      };
    }).filter((result) => result.title);
  }
}

export default HackerNewsConnector;
