/**
 * Stack Overflow connector via the official Stack Exchange API
 * (free, no key required; anonymous quota applies).
 * https://api.stackexchange.com/docs
 *
 * Fetches top-voted, answered questions and their highest-voted answers so
 * code questions get real, community-verified snippets with attribution.
 */
import { KnowledgeConnector } from './base.js';
import { requestJson } from '../../utils/http.js';
import { htmlToText, truncate } from '../../utils/text.js';

const API = 'https://api.stackexchange.com/2.3';
const CODE_PATTERN = /\b(code|error|exception|bug|example|implement|write|function|api|regex|query|sort|parse|convert|loop|async|await|promise|hook|component|undefined|null|crash|fix|debug|syntax)\b/i;
const TECH_PATTERN = /\b(javascript|typescript|python|java\b|c#|c\+\+|php|ruby|go\b|rust|sql|react|vue|angular|node|django|flask|css|html|bash|swift|kotlin|r\b|scala)\b/i;

export class StackOverflowConnector extends KnowledgeConnector {
  constructor () {
    super();
    this.name = 'stackoverflow';
    this.label = 'Stack Overflow';
  }

  supports (query) {
    if (/\b(vs\.?|versus|compare|difference between)\b/i.test(query) && TECH_PATTERN.test(query)) return true;
    return CODE_PATTERN.test(query) && (TECH_PATTERN.test(query) || /\b(how|why|best way)\b/i.test(query));
  }

  async search (query, { limit = 3, signal } = {}) {
    const searchParams = new URLSearchParams({
      order: 'desc',
      sort: 'votes',
      q: String(query),
      site: 'stackoverflow',
      pagesize: String(Math.min(limit, 5)),
      filter: 'default',
      accepted: 'True',
      answers: '1',
    });
    const data = await requestJson(`${API}/search/advanced?${searchParams.toString()}`, { method: 'GET' }, { signal });
    const questions = (data.items || []).filter((item) => item.is_answered && item.score >= 0);
    if (!questions.length) return [];

    const topIds = questions.slice(0, 2).map((item) => item.question_id).join(';');
    let answers = [];
    if (topIds) {
      try {
        const answerParams = new URLSearchParams({
          order: 'desc',
          sort: 'votes',
          site: 'stackoverflow',
          filter: 'withbody',
        });
        const answerData = await requestJson(`${API}/questions/${topIds}/answers?${answerParams.toString()}`, { method: 'GET' }, { signal });
        answers = answerData.items || [];
      } catch {
        answers = [];
      }
    }

    const results = questions.map((question) => {
      const bestAnswer = answers
        .filter((answer) => answer.question_id === question.question_id)
        .sort((a, b) => (b.is_accepted - a.is_accepted) || (b.score - a.score))[0];
      const answerText = bestAnswer ? htmlToText(bestAnswer.body) : '';
      const codeBlock = bestAnswer ? extractFirstCodeBlock(bestAnswer.body) : '';
      const content = [answerText, codeBlock ? `\n\`\`\`\n${codeBlock}\n\`\`\`` : ''].join('').trim();
      return {
        title: truncate(question.title, 160),
        url: bestAnswer
          ? `https://stackoverflow.com/a/${bestAnswer.answer_id}`
          : `https://stackoverflow.com/q/${question.question_id}`,
        snippet: truncate(answerText || question.title, 320),
        content: content || question.title,
        publishedAt: question.creation_date
          ? new Date(question.creation_date * 1000).toISOString().slice(0, 10)
          : undefined,
        provider: this.name,
        score: Math.min(1, 0.5 + question.score / 40),
      };
    });

    return results;
  }
}

function extractFirstCodeBlock (html = '') {
  const blocks = [...String(html).matchAll(/<pre><code>([\s\S]*?)<\/code><\/pre>/g)]
    .map((match) => decodeEntitiesBasic(match[1]))
    .filter((block) => block.trim().length > 10);
  return blocks.sort((a, b) => b.length - a.length)[0] || '';
}

function decodeEntitiesBasic (text) {
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export default StackOverflowConnector;
