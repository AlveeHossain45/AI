/**
 * Server-Sent Events helpers (used for streaming chat/research responses).
 */
export function initSse (res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

export function sendEvent (res, type, data) {
  if (res.writableEnded || res.destroyed) return false;
  try {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data ?? {})}\n\n`);
    return true;
  } catch {
    return false;
  }
}

export const endSse = (res) => {
  if (!res.writableEnded) {
    try { res.end(); } catch { /* ignore */ }
  }
};

export default { initSse, sendEvent, endSse };
