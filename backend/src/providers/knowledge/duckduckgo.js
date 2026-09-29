/**
 * DuckDuckGo Instant Answer connector (free, no API key).
 * https://api.duckduckgo.com/#instant-answer
 */
import { KnowledgeConnector } from './base.js';
import { requestJson } from '../../utils/http.js';
import { cleanText, truncate } from '../../utils/text.js';

export class DuckDuckGoConnector extends KnowledgeConnector {
  constructor () {
    super();
    this.name = 'duckduckgo';
    this.label = 'DuckDuckGo';
  }

  supports () {
    return true;
  }

  async search (query, { limit = 2, signal } = {}) {
    const params = new URLSearchParams({
      q: String(query),
      format: 'json',
      no_html: '1',
      skip_disambig: '1',
    });
    const data = await requestJson(`https://api.duckduckgo.com/?${params.toString()}`, { method: 'GET' }, { signal });
    const results = [];

    if (data.AbstractText) {
      results.push({
        title: data.Heading || data.AbstractSource || 'DuckDuckGo',
        url: data.AbstractURL || 'https://duckduckgo.com/',
        snippet: truncate(cleanText(data.AbstractText), 320),
        content: cleanText(data.AbstractText),
        provider: this.name,
        score: 0.9,
      });
    }
    if (data.Answer) {
      const answer = cleanText(String(data.Answer));
      results.push({
        title: data.AnswerType ? `Answer (${data.AnswerType})` : 'Direct answer',
        url: data.AbstractURL || 'https://duckduckgo.com/',
        snippet: truncate(answer, 320),
        content: answer,
        provider: this.name,
        score: 0.95,
      });
    }
    if (data.Definition && data.DefinitionURL) {
      results.push({
        title: 'Definition',
        url: data.DefinitionURL,
        snippet: truncate(cleanText(data.Definition), 320),
        content: cleanText(data.Definition),
        provider: this.name,
        score: 0.85,
      });
    }

    const related = (data.RelatedTopics || [])
      .flatMap((topic) => (topic.Topics ? topic.Topics : [topic]))
      .filter((topic) => topic.Text && topic.FirstURL)
      .slice(0, limit + 2);
    for (const topic of related) {
      const [head, ...rest] = cleanText(topic.Text).split(' - ');
      results.push({
        title: truncate(head, 140),
        url: topic.FirstURL,
        snippet: truncate(rest.join(' - ') || head, 320),
        content: cleanText(topic.Text),
        provider: this.name,
        score: 0.6,
      });
    }

    return results.slice(0, limit + 3);
  }
}

export default DuckDuckGoConnector;
