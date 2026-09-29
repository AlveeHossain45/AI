/**
 * AI provider contract.
 *
 * Every provider implements:
 *   isAvailable()            -> boolean
 *   chat(messages, options)  -> { content, model, usage, finishReason }
 *   stream(messages, options)-> AsyncGenerator<{type:'delta'|'done', ...}>
 *
 * options: { model, temperature, maxTokens, signal, json, system }
 * messages: [{ role: 'system'|'user'|'assistant', content }]
 */
import config from '../../config/index.js';

export class AiProvider {
  constructor () {
    this.name = 'base';
    this.label = 'Base';
  }

  isAvailable () {
    return false;
  }

  /** Best-effort default model when the operator did not pin AI_MODEL. */
  defaultModel () {
    return config.ai.model || 'unknown-model';
  }

  resolveModel (requested) {
    return requested || config.ai.model || this.defaultModel();
  }

  async chat () {
    throw new Error(`${this.name} does not implement chat()`);
  }

  // eslint-disable-next-line require-yield
  async *stream () {
    throw new Error(`${this.name} does not implement stream()`);
  }

  /** Inject/replace the system prompt for providers that take it as a message. */
  static withSystem (messages, system) {
    if (!system) return messages;
    const index = messages.findIndex((m) => m.role === 'system');
    if (index >= 0) {
      const copy = [...messages];
      copy[index] = { ...copy[index], content: system };
      return copy;
    }
    return [{ role: 'system', content: system }, ...messages];
  }

  static estimateTokens (text) {
    return Math.ceil(String(text || '').length / 4);
  }
}

/** Normalise a usage object so every provider reports the same shape. */
export const normalizeUsage = (usage = {}) => ({
  promptTokens: usage.promptTokens ?? usage.input_tokens ?? usage.prompt_tokens ?? 0,
  completionTokens: usage.completionTokens ?? usage.output_tokens ?? usage.completion_tokens ?? 0,
});

export default AiProvider;
