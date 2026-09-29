import config from '../config/index.js';
import { ApiError, upstreamError } from './errors.js';
import logger from './logger.js';

/**
 * Fetch with timeout + caller-abort support and safe JSON parsing.
 * All upstream provider calls go through this helper.
 */
export async function fetchWithTimeout (url, options = {}, { timeoutMs = config.limits.upstreamTimeoutMs, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason || new Error('aborted'));
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

export async function requestJson (url, options = {}, opts = {}) {
  const response = await fetchWithTimeout(url, options, opts);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = body?.error?.message || body?.message || body?.error || `HTTP ${response.status}`;
    logger.warn(`Upstream ${response.status} from ${safeHost(url)}: ${String(message).slice(0, 200)}`);
    throw upstreamError(humanizeUpstreamError(response.status, message), { status: response.status, provider: safeHost(url) });
  }
  return body;
}

export function humanizeUpstreamError (status, message = '') {
  if (status === 401 || status === 403) return 'The AI provider rejected the API key. Check the server configuration.';
  if (status === 404) return 'The configured model was not found. Check the AI_MODEL setting.';
  if (status === 429) return 'The AI provider is rate limited. Please try again in a moment.';
  if (status >= 500) return 'The AI provider is currently unavailable. Please try again shortly.';
  return `The AI provider returned an error: ${String(message).slice(0, 160)}`;
}

const safeHost = (url) => {
  try { return new URL(url).hostname; } catch { return 'upstream'; }
};

/**
 * Incremental parser for text/event-stream payloads.
 * Calls onEvent(dataString) for every `data:` payload.
 */
export function createSseParser (onData) {
  let buffer = '';
  return {
    push (chunk) {
      buffer += chunk;
      let index;
      // eslint-disable-next-line no-cond-assign
      while ((index = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, index).replace(/\r$/, '');
        buffer = buffer.slice(index + 1);
        if (!line || line.startsWith(':')) continue;
        if (line.startsWith('data:')) {
          const payload = line.slice(5).trim();
          if (payload && payload !== '[DONE]') onData(payload);
        }
      }
    },
    flush () {
      if (buffer.trim().startsWith('data:')) {
        const payload = buffer.slice(5).trim();
        if (payload && payload !== '[DONE]') onData(payload);
      }
      buffer = '';
    },
  };
}

export const withTimeout = (promise, ms, label = 'operation') => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new ApiError(504, 'TIMEOUT', `${label} timed out. Please try again.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

export default { fetchWithTimeout, requestJson, createSseParser, withTimeout, humanizeUpstreamError };
