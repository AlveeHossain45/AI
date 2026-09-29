/**
 * GroundedProvider — the default answer engine when no LLM key is set.
 *
 * Streams a real, cited answer built by the grounded engine (verified code
 * templates, exact math, extractive synthesis over retrieved sources).
 * It never fabricates facts: unsupported questions fall back to an honest
 * explanation instead of invented content.
 */
import config from '../../config/index.js';
import { AiProvider } from './base.js';
import { buildGroundedAnswer, parseContext } from '../../services/ai/groundedEngine.js';
import { estimateTokens } from '../../utils/text.js';

export class GroundedProvider extends AiProvider {
  constructor () {
    super();
    this.name = 'grounded';
    this.label = 'NovaAI Grounded Engine';
  }

  isAvailable () {
    // No credentials required — it answers from retrieved, cited material.
    return true;
  }

  defaultModel () {
    return 'grounded-retrieval-v1';
  }

  build (messages) {
    const { sources, documents, question, history } = parseContext(messages);
    const systemText = messages
      .filter((message) => message.role === 'system')
      .map((message) => (typeof message.content === 'string' ? message.content : ''))
      .join('\n');
    const mode = /Search mode: (AUTO|FAST|DEEP|DOCUMENTS|WEB)\./.exec(systemText)?.[1] || 'AUTO';
    return buildGroundedAnswer({ question, sources, documents, history, mode });
  }

  async chat (messages, options = {}) {
    const { content, strategy, sourcesUsed } = this.build(messages);
    return {
      content,
      model: this.resolveModel(options.model),
      usage: {
        promptTokens: estimateTokens(messages.map((message) => (typeof message.content === 'string' ? message.content : '')).join(' ')),
        completionTokens: estimateTokens(content),
      },
      finishReason: 'stop',
      strategy,
      sourcesUsed,
    };
  }

  async *stream (messages, options = {}) {
    const { content, strategy, sourcesUsed } = this.build(messages);
    const model = this.resolveModel(options.model);
    const tokens = content.match(/\S+\s*/g) || [content];

    let buffer = '';
    let emitted = 0;
    for (const token of tokens) {
      if (options.signal?.aborted) break;
      buffer += token;
      emitted += 1;
      // Flush on line boundaries or every ~90 chars for a natural stream.
      if (buffer.includes('\n') || buffer.length > 90) {
        yield { type: 'delta', text: buffer };
        buffer = '';
        if (emitted % 6 === 0) await new Promise((resolve) => setTimeout(resolve, 4));
      }
    }
    if (buffer && !options.signal?.aborted) yield { type: 'delta', text: buffer };

    yield {
      type: 'done',
      model,
      usage: {
        promptTokens: estimateTokens(messages.map((message) => (typeof message.content === 'string' ? message.content : '')).join(' ')),
        completionTokens: estimateTokens(content),
      },
      finishReason: 'stop',
      strategy,
      sourcesUsed,
    };
  }
}

export const groundedEngineInfo = () => ({
  provider: 'grounded',
  model: 'grounded-retrieval-v1',
  note: config.isProduction ? 'production' : 'development',
});

export default GroundedProvider;
