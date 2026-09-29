/**
 * Google Gemini provider (generativelanguage REST API).
 */
import config from '../../config/index.js';
import { AiProvider, normalizeUsage } from './base.js';
import { fetchWithTimeout, humanizeUpstreamError, requestJson } from '../../utils/http.js';
import { upstreamError } from '../../utils/errors.js';
import { toGeminiParts, flattenText } from './content.js';

export class GeminiProvider extends AiProvider {
  constructor () {
    super();
    this.name = 'gemini';
    this.label = 'Google Gemini';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  isAvailable () {
    return Boolean(config.ai.geminiApiKey);
  }

  defaultModel () {
    return config.ai.model || 'gemini-2.0-flash';
  }

  buildContents (messages) {
    const contents = [];
    for (const message of messages) {
      if (message.role === 'system') continue;
      contents.push({ role: message.role === 'assistant' ? 'model' : 'user', parts: toGeminiParts(message.content) });
    }
    return contents;
  }

  systemInstruction (messages, system) {
    const parts = [system, ...messages.filter((m) => m.role === 'system').map((m) => flattenText(m.content))].filter(Boolean);
    return parts.length ? { parts: [{ text: parts.join('\n\n') }] } : undefined;
  }

  buildBody (messages, options, stream = false) {
    const body = {
      contents: this.buildContents(messages),
      generationConfig: {
        temperature: options.temperature ?? config.ai.temperature,
        maxOutputTokens: options.maxTokens || config.ai.maxTokens,
      },
    };
    const system = this.systemInstruction(messages, options.system);
    if (system) body.systemInstruction = system;
    if (options.json) body.generationConfig.responseMimeType = 'application/json';
    void stream;
    return body;
  }

  async chat (messages, options = {}) {
    const model = this.resolveModel(options.model);
    const body = await requestJson(
      `${this.baseUrl}/models/${model}:generateContent?key=${config.ai.geminiApiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.buildBody(messages, options)) },
      { timeoutMs: options.timeoutMs, signal: options.signal }
    );
    const text = (body.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('');
    return {
      content: text,
      model,
      usage: normalizeUsage(body.usageMetadata),
      finishReason: body.candidates?.[0]?.finishReason || 'STOP',
    };
  }

  async *stream (messages, options = {}) {
    const model = this.resolveModel(options.model);
    const response = await fetchWithTimeout(
      `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${config.ai.geminiApiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.buildBody(messages, options, true)) },
      { timeoutMs: options.timeoutMs || config.limits.streamTimeoutMs, signal: options.signal }
    );
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw upstreamError(humanizeUpstreamError(response.status, text), { status: response.status, provider: 'gemini' });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage = { promptTokens: 0, completionTokens: 0 };
    let finishReason = 'STOP';

    const handleLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) return null;
      const payload = trimmed.slice(5).trim();
      if (!payload) return null;
      try {
        const data = JSON.parse(payload);
        if (data.usageMetadata) usage = normalizeUsage(data.usageMetadata);
        const candidate = data.candidates?.[0];
        if (candidate?.finishReason) finishReason = candidate.finishReason;
        const text = (candidate?.content?.parts || []).map((part) => part.text || '').join('');
        return text || null;
      } catch {
        return null;
      }
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

export default GeminiProvider;
