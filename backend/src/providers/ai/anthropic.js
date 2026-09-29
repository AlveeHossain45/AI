/**
 * Anthropic Messages API provider (Claude models).
 */
import config from '../../config/index.js';
import { AiProvider, normalizeUsage } from './base.js';
import { fetchWithTimeout, humanizeUpstreamError, requestJson } from '../../utils/http.js';
import { upstreamError } from '../../utils/errors.js';
import { toAnthropicContent } from './content.js';

const API_VERSION = '2023-06-01';

export class AnthropicProvider extends AiProvider {
  constructor () {
    super();
    this.name = 'anthropic';
    this.label = 'Anthropic';
    this.baseUrl = 'https://api.anthropic.com/v1';
  }

  isAvailable () {
    return Boolean(config.ai.anthropicApiKey);
  }

  defaultModel () {
    return config.ai.model || 'claude-3-5-haiku-latest';
  }

  headers () {
    return {
      'Content-Type': 'application/json',
      'x-api-key': config.ai.anthropicApiKey,
      'anthropic-version': API_VERSION,
    };
  }

  splitSystem (messages, system) {
    const systemText = [system, ...messages.filter((m) => m.role === 'system').map((m) => (typeof m.content === 'string' ? m.content : ''))]
      .filter(Boolean)
      .join('\n\n');
    const rest = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: toAnthropicContent(m.content) }));
    return { system: systemText || undefined, messages: rest };
  }

  buildBody (messages, options, stream = false) {
    const { system, messages: rest } = this.splitSystem(messages, options.system);
    const body = {
      model: this.resolveModel(options.model),
      max_tokens: options.maxTokens || config.ai.maxTokens,
      messages: rest,
      temperature: options.temperature ?? config.ai.temperature,
      stream,
    };
    if (system) body.system = system;
    if (options.json) {
      body.messages = rest.map((m, i) =>
        i === rest.length - 1 ? { ...m, content: `${m.content}\n\nRespond with valid JSON only.` } : m
      );
    }
    return body;
  }

  async chat (messages, options = {}) {
    const body = await requestJson(
      `${this.baseUrl}/messages`,
      { method: 'POST', headers: this.headers(), body: JSON.stringify(this.buildBody(messages, options)) },
      { timeoutMs: options.timeoutMs, signal: options.signal }
    );
    const text = (body.content || []).filter((block) => block.type === 'text').map((block) => block.text).join('');
    return {
      content: text,
      model: body.model || this.resolveModel(options.model),
      usage: normalizeUsage(body.usage),
      finishReason: body.stop_reason || 'stop',
    };
  }

  async *stream (messages, options = {}) {
    const response = await fetchWithTimeout(
      `${this.baseUrl}/messages`,
      { method: 'POST', headers: this.headers(), body: JSON.stringify(this.buildBody(messages, options, true)) },
      { timeoutMs: options.timeoutMs || config.limits.streamTimeoutMs, signal: options.signal }
    );
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw upstreamError(humanizeUpstreamError(response.status, text), { status: response.status, provider: 'anthropic' });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage = { promptTokens: 0, completionTokens: 0 };
    let model = this.resolveModel(options.model);
    let finishReason = 'stop';

    const handleLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) return null;
      const payload = trimmed.slice(5).trim();
      if (!payload) return null;
      try {
        const event = JSON.parse(payload);
        if (event.message?.model) model = event.message.model;
        if (event.type === 'message_start' && event.message?.usage) {
          usage = { ...usage, promptTokens: event.message.usage.input_tokens || 0 };
        }
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') return event.delta.text;
        if (event.type === 'message_delta') {
          if (event.usage?.output_tokens) usage = { ...usage, completionTokens: event.usage.output_tokens };
          if (event.delta?.stop_reason) finishReason = event.delta.stop_reason;
        }
      } catch { /* ignore malformed frames */ }
      return null;
    };

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      // eslint-disable-next-line no-cond-assign
      while ((index = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        const text = handleLine(line);
        if (text) yield { type: 'delta', text };
      }
    }
    const trailing = handleLine(buffer);
    if (trailing) yield { type: 'delta', text: trailing };

    yield { type: 'done', model, usage, finishReason };
  }
}

export default AnthropicProvider;
