/**
 * API client: fetch wrapper with credentials, friendly error normalization
 * and an SSE-over-fetch streaming helper.
 */

export class ApiError extends Error {
  constructor (message, { status = 0, code = 'ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const BASE = import.meta.env.VITE_API_BASE || '';

async function parseError (response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const message = payload?.error?.message || defaultMessage(response.status);
  return new ApiError(message, {
    status: response.status,
    code: payload?.error?.code || 'HTTP_ERROR',
    details: payload?.error?.details || null,
  });
}

const defaultMessage = (status) => {
  if (status === 401) return 'Please sign in to continue.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'Not found.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'Something went wrong. Please try again.';
  return 'Request failed. Please try again.';
};

async function request (path, { method = 'GET', body, headers = {}, signal, raw = false, formData = false } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(formData || body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      'X-Requested-With': 'NovaAI',
      ...headers,
    },
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) throw await parseError(response);
  if (raw) return response;
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
  upload: (path, formData, options) => request(path, { ...options, method: 'POST', body: formData, formData: true }),
};

/**
 * Stream an SSE endpoint via POST fetch.
 * @returns {{promise: Promise<void>, abort: () => void}}
 */
export function streamRequest (path, body, { onEvent, signal } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal) signal.addEventListener('abort', abort, { once: true });

  const promise = (async () => {
    const response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'NovaAI' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) throw await parseError(response);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventType = 'message';

    const handleLine = (line) => {
      if (line === '') {
        eventType = 'message';
        return;
      }
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
        return;
      }
      if (line.startsWith('data:')) {
        const raw = line.slice(5).trim();
        if (!raw) return;
        try {
          onEvent?.(eventType, JSON.parse(raw));
        } catch {
          /* skip malformed frame */
        }
      }
    };

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      // eslint-disable-next-line no-cond-assign
      while ((index = buffer.indexOf('\n')) !== -1) {
        handleLine(buffer.slice(0, index).replace(/\r$/, ''));
        buffer = buffer.slice(index + 1);
      }
    };
    if (buffer.trim()) handleLine(buffer.replace(/\r$/, ''));
  })();

  return { promise, abort };
}

export default api;
