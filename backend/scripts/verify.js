/**
 * Verification script — run with: npm run verify --workspace backend
 *
 * 1. Imports every backend module (catches broken imports/syntax errors)
 * 2. Boots the API in memory mode on an ephemeral port
 * 3. Exercises health, auth, conversations, streaming chat, uploads,
 *    search, admin analytics and error handling
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '../src');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.ENABLE_MOCK_PROVIDERS = 'true';
process.env.AI_PROVIDER = process.env.AI_PROVIDER || 'grounded';
process.env.SEARCH_PROVIDER = process.env.SEARCH_PROVIDER || 'mock';

let passed = 0;
let failed = 0;
const results = [];

const check = (name, ok, detail = '') => {
  if (ok) { passed += 1; results.push(`  PASS  ${name}`); }
  else { failed += 1; results.push(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

function listFiles (dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

async function importAllModules () {
  const files = listFiles(srcDir);
  let errors = 0;
  for (const file of files) {
    try {
      await import(pathToFileURL(file).href);
    } catch (error) {
      errors += 1;
      results.push(`  FAIL  import ${path.relative(srcDir, file)} — ${error.message}`);
    }
  }
  check(`all ${files.length} source modules import cleanly`, errors === 0, `${errors} failed`);
}

async function readSse (response) {
  const text = await response.text();
  const events = [];
  let current = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('event:')) current = line.slice(6).trim();
    else if (line.startsWith('data:') && current) {
      try { events.push({ type: current, data: JSON.parse(line.slice(5).trim()) }); } catch { /* skip */ }
      current = null;
    }
  }
  return { events, text };
}

async function runApiSmoke () {
  const { initDatabase } = await import(pathToFileURL(path.join(srcDir, 'db/index.js')).href);
  await initDatabase();
  const { createApp } = await import(pathToFileURL(path.join(srcDir, 'app.js')).href);
  const app = createApp();

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookies = {};

  const req = async (method, url, { body, headers = {}, raw = false } = {}) => {
    const response = await fetch(`${base}${url}`, {
      method,
      headers: {
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(Object.keys(cookies).length ? { Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
        ...headers,
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    const setCookie = response.headers.getSetCookie?.() || [];
    for (const cookie of setCookie) {
      const [pair] = cookie.split(';');
      const [name, value] = pair.split('=');
      cookies[name] = value;
    }
    if (raw) return response;
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = null; }
    return { status: response.status, json, text };
  };

  try {
    // Health
    const health = await req('GET', '/api/health');
    check('GET /api/health', health.status === 200 && health.json?.status === 'ok');

    // Registration + validation
    const email = `smoke-${Date.now()}@example.com`;
    const register = await req('POST', '/api/auth/register', { body: { email, password: 'SmokeTest123', name: 'Smoke' } });
    check('POST /api/auth/register', register.status === 201 && Boolean(register.json?.token));

    const badRegister = await req('POST', '/api/auth/register', { body: { email: 'x', password: '1' } });
    check('register validation rejects bad input', badRegister.status === 400);

    const me = await req('GET', '/api/auth/me');
    check('GET /api/auth/me', me.status === 200 && me.json?.user?.email === email);

    // Conversation lifecycle
    const conversation = await req('POST', '/api/conversations', { body: {} });
    check('POST /api/conversations', conversation.status === 201 && Boolean(conversation.json?.conversation?.id));
    const conversationId = conversation.json?.conversation?.id;

    const list = await req('GET', '/api/conversations');
    check('GET /api/conversations', list.status === 200 && Array.isArray(list.json?.conversations));

    // Streaming chat
    const streamResponse = await req('POST', '/api/chat/stream', {
      body: { conversationId, message: 'What is quantum computing?', mode: 'AUTO' },
      raw: true,
    });
    check('POST /api/chat/stream returns SSE', streamResponse.status === 200 && (streamResponse.headers.get('content-type') || '').includes('text/event-stream'));
    const { events } = await readSse(streamResponse);
    const types = events.map((event) => event.type);
    check('stream emits meta/sources/delta/done', types.includes('meta') && types.includes('delta') && types.includes('done'), `got: ${[...new Set(types)].join(',')}`);
    const done = events.find((event) => event.type === 'done');
    check('streamed answer persisted', Boolean(done?.data?.assistantMessageId));

    // Conversation detail contains both messages
    const detail = await req('GET', `/api/conversations/${conversationId}`);
    check('conversation contains user + assistant messages', (detail.json?.messages?.length || 0) >= 2);

    // Non-streaming chat
    const chat = await req('POST', '/api/chat', { body: { conversationId, message: 'Explain JavaScript promises briefly.' } });
    check('POST /api/chat (json)', chat.status === 200 && typeof chat.json?.answer === 'string' && chat.json.answer.length > 20);

    // Upload + RAG ingestion
    const form = new FormData();
    form.append('files', new Blob(['NovaAI RAG smoke test document. It contains the phrase purple elephant protocol.'], { type: 'text/plain' }), 'smoke.txt');
    const upload = await req('POST', '/api/files', { body: form });
    check('POST /api/files upload', upload.status === 201 && upload.json?.documents?.[0]?.status === 'READY', JSON.stringify(upload.json || upload.text).slice(0, 200));
    const fileId = upload.json?.documents?.[0]?.id;

    const files = await req('GET', '/api/files');
    check('GET /api/files', files.status === 200 && files.json?.documents?.length >= 1);

    if (fileId) {
      const ragChat = await req('POST', '/api/chat', { body: { conversationId, message: 'Summarize the uploaded document.', mode: 'DOCUMENTS', documentIds: [fileId] } });
      check('RAG chat with document', ragChat.status === 200 && typeof ragChat.json?.answer === 'string');
    }

    // Search (mock + knowledge fallback)
    const search = await req('POST', '/api/search', { body: { query: 'quantum computing basics', mode: 'WEB', limit: 5 } });
    check('POST /api/search', search.status === 200 && Array.isArray(search.json?.sources));

    // Research endpoint
    const research = await req('POST', '/api/research', { body: { question: 'Current state of solid state batteries' } });
    check('POST /api/research', research.status === 200 && Array.isArray(research.json?.sources));

    // Preferences
    const prefs = await req('PATCH', '/api/user/settings', { body: { theme: 'dark' } });
    check('PATCH /api/user/settings', prefs.status === 200 && prefs.json?.preferences?.theme === 'dark');

    // Feedback
    const assistantMessageId = done?.data?.assistantMessageId;
    if (assistantMessageId) {
      const feedback = await req('POST', '/api/feedback', { body: { messageId: assistantMessageId, rating: 'LIKE' } });
      check('POST /api/feedback', feedback.status === 201);
    }

    // Admin guard (regular user must be rejected)
    const forbiddenAdmin = await req('GET', '/api/admin/analytics');
    check('admin endpoint rejects non-admin', forbiddenAdmin.status === 403);

    // Promote to admin and check analytics
    const { userRepo } = await import(pathToFileURL(path.join(srcDir, 'repositories/userRepo.js')).href);
    const user = await userRepo.findByEmail(email);
    await userRepo.update(user.id, { role: 'ADMIN' });
    const analytics = await req('GET', '/api/admin/analytics');
    check('GET /api/admin/analytics', analytics.status === 200 && typeof analytics.json?.ai?.requests === 'number');
    const adminSystem = await req('GET', '/api/admin/system');
    check('GET /api/admin/system', adminSystem.status === 200 && Boolean(adminSystem.json?.database));

    // Error handling
    const notFound = await req('GET', '/api/does-not-exist');
    check('404 handler returns JSON error', notFound.status === 404 && Boolean(notFound.json?.error?.code));
    const noAuth = await req('GET', '/api/conversations', { headers: { Cookie: '' } });
    void noAuth;
    const unauthorized = await fetch(`${base}/api/conversations`, { headers: { Cookie: 'novaai_token=invalid' } });
    check('invalid token rejected', unauthorized.status === 401);

    // Export
    const exported = await req('GET', `/api/conversations/${conversationId}/export?format=md`);
    check('export conversation (md)', exported.status === 200 && String(exported.text).includes('NovaAI'));

    // Delete conversation
    const removed = await req('DELETE', `/api/conversations/${conversationId}`);
    check('DELETE /api/conversations/:id', removed.status === 200 && removed.json?.ok === true);
  } catch (error) {
    check('API smoke test run', false, error.message);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main () {
  console.log('NovaAI backend verification\n');
  await importAllModules();
  await runApiSmoke();

  console.log(results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error('Verification crashed:', error);
  process.exit(1);
});
