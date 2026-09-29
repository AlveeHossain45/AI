/**
 * OpenAI provider — also works with any OpenAI-compatible endpoint
 * (Ollama, LM Studio, vLLM, OpenRouter, ...) via OPENAI_BASE_URL.
 */
import config from '../../config/index.js';
import { AiProvider, normalizeUsage } from './base.js';
import { fetchWithTimeout, createSseParser, humanizeUpstreamError, requestJson } from '../../utils/http.js';
import { upstreamError } from '../../utils/errors.js';
import { toOpenAiContent } from './content.js';

const mapMessages = (messages) => messages.map((message) => ({ ...message, content: toOpenAiContent(message.content) }));

export class OpenAiProvider extends AiProvider {
  constructor () {
    super();
    this.name = 'openai';
    this.label = 'OpenAI';
    this.baseUrl = (config.ai.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  isAvailable () {
    return Boolean(config.ai.openaiApiKey);
  }

  defaultModel () {
    return config.ai.model || 'gpt-4o-mini';
  }

  headers () {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ai.openaiApiKey}` };
  }

  buildBody (messages, options, stream = false) {
    const body = {
      model: this.resolveModel(options.model),
      messages,
      stream,
      temperature: options.temperature ?? config.ai.temperature,
    };
    if (options.maxTokens) body.max_tokens = options.maxTokens;
    if (options.json && this.baseUrl.includes('api.openai.com')) body.response_format = { type: 'json_object' };
    return body;
  }

  async chat (messages, options = {}) {
    const payload = mapMessages(AiProvider.withSystem(messages, options.system));
    const body = await requestJson(
      `${this.baseUrl}/chat/completions`,
      { method: 'POST', headers: this.headers(), body: JSON.stringify(this.buildBody(payload, options)) },
      { timeoutMs: options.timeoutMs, signal: options.signal }
    );
    const choice = body.choices?.[0];
    return {
      content: choice?.message?.content || '',
      model: body.model || this.resolveModel(options.model),
      usage: normalizeUsage(body.usage),
      finishReason: choice?.finish_reason || 'stop',
    };
  }

  async *stream (messages, options = {}) {
    const payload = mapMessages(AiProvider.withSystem(messages, options.system));
    const response = await fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      { method: 'POST', headers: this.headers(), body: JSON.stringify(this.buildBody(payload, options, true)) },
      { timeoutMs: options.timeoutMs || config.limits.streamTimeoutMs, signal: options.signal }
    );
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw upstreamError(humanizeUpstreamError(response.status, text), { status: response.status, provider: 'openai' });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let usage = null;
    let model = this.resolveModel(options.model);
    let finishReason = 'stop';
    const deltas = [];

    const parser = createSseParser((payload) => {
      try {
        const data = JSON.parse(payload);
        if (data.model) model = data.model;
        if (data.usage) usage = normalizeUsage(data.usage);
        const choice = data.choices?.[0];
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        if (choice?.delta?.content) deltas.push(choice.delta.content);
      } catch { /* ignore malformed frames */ }
    });

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
      while (deltas.length) yield { type: 'delta', text: deltas.shift() };
    }
    parser.flush();
    while (deltas.length) yield { type: 'delta', text: deltas.shift() };

    yield { type: 'done', model, usage: usage || { promptTokens: 0, completionTokens: 0 }, finishReason };
  }
}

export default OpenAiProvider;
