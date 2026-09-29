import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/src/config -> repo root
const repoRoot = path.resolve(__dirname, '../../../');
const backendRoot = path.resolve(__dirname, '../../');

// Load root .env first, then backend/.env (backend-specific values win).
for (const file of [path.join(repoRoot, '.env'), path.join(backendRoot, '.env')]) {
  if (fs.existsSync(file)) dotenv.config({ path: file, override: true });
}

const str = (value, fallback = '') => (value === undefined || value === null || value === '' ? fallback : String(value));
const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const nodeEnv = str(process.env.NODE_ENV, 'development');
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

export const config = {
  env: nodeEnv,
  isProduction,
  isTest,
  isDev: !isProduction && !isTest,
  port: int(process.env.PORT, 4000),
  clientUrl: str(process.env.CLIENT_URL, 'http://localhost:5173'),
  trustProxy: bool(process.env.TRUST_PROXY, false),

  db: {
    url: str(process.env.DATABASE_URL),
    // When false the app boots with a clearly-labelled in-memory datastore (dev only).
    enabled: bool(process.env.ENABLE_DATABASE, undefined) ?? Boolean(str(process.env.DATABASE_URL)),
  },

  vector: {
    provider: str(process.env.VECTOR_PROVIDER, 'memory').toLowerCase(),
    url: str(process.env.VECTOR_DATABASE_URL) || str(process.env.DATABASE_URL),
  },

  auth: {
    jwtSecret: str(process.env.JWT_SECRET, isProduction ? '' : 'novaai-dev-insecure-secret-change-me'),
    jwtExpiresIn: str(process.env.JWT_EXPIRES_IN, '7d'),
    cookieSecure: bool(process.env.COOKIE_SECURE, isProduction),
    cookieSameSite: str(process.env.COOKIE_SAMESITE, 'lax').toLowerCase(),
    cookieName: 'novaai_token',
    googleClientId: str(process.env.GOOGLE_CLIENT_ID),
    adminEmail: str(process.env.ADMIN_EMAIL, 'admin@novaai.local'),
    adminPassword: str(process.env.ADMIN_PASSWORD),
  },

  ai: {
    provider: str(process.env.AI_PROVIDER, 'grounded').toLowerCase(),
    model: str(process.env.AI_MODEL),
    openaiBaseUrl: str(process.env.OPENAI_BASE_URL),
    fastModel: str(process.env.AI_FAST_MODEL),
    strongModel: str(process.env.AI_STRONG_MODEL),
    codingModel: str(process.env.AI_CODING_MODEL),
    longContextModel: str(process.env.AI_LONG_CONTEXT_MODEL),
    openaiApiKey: str(process.env.OPENAI_API_KEY),
    anthropicApiKey: str(process.env.ANTHROPIC_API_KEY),
    geminiApiKey: str(process.env.GEMINI_API_KEY),
    temperature: Number.parseFloat(str(process.env.AI_TEMPERATURE, '0.4')),
    maxTokens: int(process.env.AI_MAX_TOKENS, 2048),
  },

  embedding: {
    provider: str(process.env.EMBEDDING_PROVIDER, 'mock').toLowerCase(),
    model: str(process.env.EMBEDDING_MODEL, 'text-embedding-3-small'),
    dimensions: int(process.env.EMBEDDING_DIMENSIONS, 1536),
  },

  search: {
    provider: str(process.env.SEARCH_PROVIDER, 'mock').toLowerCase(),
    tavilyApiKey: str(process.env.TAVILY_API_KEY),
    braveApiKey: str(process.env.BRAVE_API_KEY),
    serperApiKey: str(process.env.SERPER_API_KEY),
    googleApiKey: str(process.env.GOOGLE_SEARCH_API_KEY),
    googleCx: str(process.env.GOOGLE_SEARCH_CX),
    fallback: bool(process.env.SEARCH_FALLBACK, true),
  },

  limits: {
    maxFileMb: int(process.env.MAX_FILE_SIZE_MB, 20),
    maxUploadFiles: int(process.env.MAX_UPLOAD_FILES, 5),
    bodyLimit: str(process.env.REQUEST_BODY_LIMIT, '2mb'),
    rateWindowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
    rateMax: int(process.env.RATE_LIMIT_MAX, 300),
    authWindowMs: int(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    authMax: int(process.env.AUTH_RATE_LIMIT_MAX, 20),
    chatWindowMs: int(process.env.CHAT_RATE_LIMIT_WINDOW_MS, 60 * 1000),
    chatMax: int(process.env.CHAT_RATE_LIMIT_MAX, 20),
    streamTimeoutMs: int(process.env.STREAM_TIMEOUT_MS, 120000),
    upstreamTimeoutMs: int(process.env.UPSTREAM_TIMEOUT_MS, 30000),
    contextMaxTokens: int(process.env.CONTEXT_MAX_TOKENS, 6000),
    contextMaxMessages: int(process.env.CONTEXT_MAX_MESSAGES, 12),
    maxRetrievedChunks: int(process.env.MAX_RETRIEVED_CHUNKS, 8),
    maxSearchResults: int(process.env.MAX_SEARCH_RESULTS, 8),
  },

  research: {
    maxSubqueries: int(process.env.DEEP_RESEARCH_MAX_SUBQUERIES, 4),
    maxSearches: int(process.env.DEEP_RESEARCH_MAX_SEARCHES, 6),
    maxSources: int(process.env.DEEP_RESEARCH_MAX_SOURCES, 12),
    maxTimeMs: int(process.env.DEEP_RESEARCH_MAX_TIME_MS, 90000),
  },

  features: {
    // Mock providers are for development only and are force-disabled in production.
    enableMockProviders: bool(process.env.ENABLE_MOCK_PROVIDERS, true) && !isProduction,
    showSourcesDefault: bool(process.env.SHOW_SOURCES_DEFAULT, true),
    factCheckEnabled: bool(process.env.FACT_CHECK_ENABLED, false),
    maintenanceMode: bool(process.env.MAINTENANCE_MODE, false),
  },

  email: {
    smtpUrl: str(process.env.SMTP_URL),
    from: str(process.env.EMAIL_FROM, 'NovaAI <no-reply@novaai.local>'),
  },

  storage: {
    provider: str(process.env.STORAGE_PROVIDER, 'local').toLowerCase(),
    root: str(process.env.STORAGE_ROOT, path.join(backendRoot, 'storage')),
  },
};

if (isProduction) {
  if (!config.auth.jwtSecret || config.auth.jwtSecret === 'change-me-to-a-long-random-secret') {
    throw new Error('JWT_SECRET must be set to a strong random value in production.');
  }
}

export default config;
