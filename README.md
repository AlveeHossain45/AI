# NovaAI — Premium AI Answer Engine

**Ask Anything. Understand Everything.**

NovaAI is a production-oriented, full-stack AI answer engine: a modern chat assistant, a search
interface and a private knowledge base in one application. It does **not** blindly answer from model
knowledge — every question runs through an intent, retrieval, ranking, routing and verification
pipeline, and the answer cites whatever sources were actually used.

- **Frontend:** React 18 + Vite + Tailwind CSS (light / dark / system themes, mobile-first)
- **Backend:** Node.js + Express + Prisma + PostgreSQL (with a dev-only in-memory fallback)
- **AI:** Grounded answer engine (no key required) · OpenAI · Anthropic · Google Gemini · OpenAI-compatible endpoints · clearly-labelled mock
- **Search:** Tavily · Brave · Serper · Google Programmable Search (with fallback) + keyless knowledge connectors
- **RAG:** PDF / DOCX / TXT / Markdown / CSV / JSON → chunk → embed → pgvector (or memory) → retrieve

---

## Screenshots

> **Placeholder** — capture the app and save images under `screenshots/`, then replace the paths below.

```md
![Answer view](screenshots/answer-view.png)
![Knowledge base](screenshots/knowledge-base.png)
```

---

## Table of contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Tech stack](#tech-stack)
4. [Installation](#installation)
5. [Environment variables](#environment-variables)
6. [Database setup](#database-setup)
7. [Vector database setup](#vector-database-setup)
8. [AI provider setup](#ai-provider-setup)
9. [Search provider setup](#search-provider-setup)
10. [Development](#development)
11. [Production build](#production-build)
12. [Deployment](#deployment)
13. [Security notes](#security-notes)
14. [API documentation](#api-documentation)
15. [Grounded mode vs. demo mode](#grounded-mode-vs-demo-mode)
16. [Troubleshooting](#troubleshooting)

---

## Features

**Core**

- **Grounded answer engine**: works out of the box with zero API keys — retrieves free open sources, then synthesises cited, structured answers (including exact math and verified code examples); never fabricates facts
- Natural-language questions with automatic intent detection (general / current / code / math / document / research)
- Retrieval decision per question: model knowledge, web search, knowledge connectors, uploaded documents, or a combination
- Real-time streaming answers (Server-Sent Events over fetch) with stop / regenerate / edit
- Five search modes: **Auto · Fast · Deep search · Documents · Web**
- Deep research agent with hard budgets (max subqueries, searches, sources, time) and contradiction-aware synthesis
- Optional fact-checking layer (claim extraction, evidence check, uncertainty statement — never fabricated citations)
- Conversation memory: windowing + optional AI summarisation, folders, search, rename, export (MD / TXT / JSON)

**Knowledge**

- Web search provider abstraction: `TavilySearchProvider`, `BraveSearchProvider`, `SerperSearchProvider`, `GoogleSearchProvider` with graceful fallback
- Keyless knowledge connectors: Wikipedia, Wikidata, DuckDuckGo, Stack Overflow, MDN, Hacker News, arXiv, Crossref, OpenAlex, PubMed, Open Library, Project Gutenberg (official public APIs only — no scraping)
- RAG pipeline: upload → extract → clean → chunk → embed → vector store → similarity search → grounded answer
- Deduplication, relevance scoring, domain authority boost, blocked-domain filtering, context compression
- Audited retrieval: every search query/result is persisted (`search_queries`, `search_results`)

**Product**

- Premium ChatGPT-style UI with an original design: glass panels, smooth motion, careful typography
- Light / dark / system theme, mobile drawer sidebar, touch-friendly controls
- Markdown answers: headings, lists, tables, syntax-highlighted code with copy button, KaTeX math, quotes, links
- Answer actions: copy, regenerate, edit, like, dislike, share, read aloud (Web Speech API)
- Optional "Sources & details" disclosure (admin/user-toggleable) that never misrepresents where data came from
- Voice input (microphone dictation) and text-to-speech
- Drag & drop, paste and picker file uploads with image previews
- Keyboard shortcuts: `Enter` send · `Shift+Enter` newline · `Ctrl/⌘+K` search conversations
- Landing page, auth (signup / login / forgot / reset / email verification / optional Google OAuth)
- Admin dashboard: users, AI requests, tokens, estimated cost, latency, error rate, provider/model usage, global settings, maintenance mode
- Analytics that track usage, not message content

---

## Architecture

```
+----------------------------------------------------------------------+
| Frontend (React + Vite)                                              |
|  Landing · Auth · Chat (streaming) · Settings · Admin                |
|  fetch + SSE parser · optimistic UI · theme + auth contexts          |
+-------------------------------+--------------------------------------+
                                | HTTPS / JSON + text/event-stream
+-------------------------------v--------------------------------------+
| Express API                                                          |
|  security (helmet, CORS, origin check, rate limits, zod validation)  |
|  controllers -> services -> repositories (Prisma or in-memory)       |
|                                                                      |
|  +---------------------- AI pipeline ----------------------+         |
|  | question -> intent -> retrieval decision                |         |
|  |   +- web search (provider chain + fallback)             |         |
|  |   +- knowledge connectors (parallel, keyless)           |         |
|  |   +- RAG (embed query -> vector search -> chunks)       |         |
|  | -> dedupe/rank/clean -> context builder (token budget)  |         |
|  | -> smart model routing -> LLM stream -> citation clean  |         |
|  | -> optional fact-check -> persistence + usage analytics |         |
|  +----------------------------------------------------------+         |
|                                                                      |
| Providers: AI (grounded/openai/anthropic/gemini/mock)               |
|            search (tavily/brave/serper/mock)                          |
|            embeddings (openai/mock) · vector (pgvector/memory)       |
+----------------+----------------------------+------------------------+
                 |                            |
         PostgreSQL + pgvector          Storage (uploads/)
        users conversations messages     PDF DOCX TXT MD CSV JSON
        documents document_chunks        images for vision input
        embeddings
        search_queries search_results api_usage
        feedback settings verification_tokens
```

Key design rules:

- **Providers are pluggable interfaces** — nothing is hard-wired to one vendor; configuration comes from env vars.
- **Business logic lives in `services/`**, HTTP concerns in `controllers/`, SQL in `repositories/`.
- **Secrets never leave the server.** The browser only ever sees public configuration flags.

### Folder structure

```
novaai/
├── backend/
│   ├── prisma/schema.prisma         # PostgreSQL schema (all tables)
│   ├── prisma/seed.js               # admin user + default settings
│   ├── scripts/verify.js            # module import + API smoke tests
│   └── src/
│       ├── app.js  server.js        # express assembly + bootstrap
│       ├── config/                  # env parsing (single source of truth)
│       ├── middleware/              # auth, rate limits, security, validate, upload, errors
│       ├── controllers/             # HTTP layer only
│       ├── services/
│       │   ├── ai/                  # pipeline, intent, routing, retrieval, memory,
│       │   │                        # research agent, fact-check, prompts, context
│       │   └── rag/                 # extractors, chunker, ingest
│       ├── providers/
│       │   ├── ai/                  # openai, anthropic, gemini, mock (+ fallback)
│       │   ├── search/              # tavily, brave, serper, mock (+ fallback)
│       │   ├── knowledge/           # wikipedia, wikidata, arxiv, crossref, ...
│       │   ├── embeddings/          # openai, mock
│       │   └── vector/              # pgvector, memory
│       ├── repositories/            # users, conversations, documents, usage, settings
│       ├── validators/              # zod schemas
│       └── utils/                   # errors, http+SSE, text, url, pricing, logger
├── frontend/
│   └── src/
│       ├── components/              # Sidebar, chat UI, ui primitives
│       ├── pages/                   # Landing, Chat, Settings, Admin, auth/*
│       ├── layouts/ context/ hooks/ api/ services/ styles/
├── .env.example
├── package.json                     # npm workspaces + root scripts
└── README.md
```

---

## Tech stack

| Layer    | Choice |
|----------|--------|
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 6, Framer Motion, Lucide icons, react-markdown + remark-gfm/remark-math + rehype-katex/rehype-highlight |
| Backend  | Node.js 20+, Express 4, Zod, Helmet, CORS, express-rate-limit, cookie-parser, JWT (jsonwebtoken), bcryptjs, multer, compression, nodemailer (optional SMTP) |
| Database | PostgreSQL via Prisma ORM |
| Vectors  | pgvector (production) or in-process cosine store (development) |
| Documents| pdf-parse (PDF), mammoth (DOCX), native parsers (TXT/MD/CSV/JSON) |
| Transport| REST + Server-Sent Events (`text/event-stream`) over fetch |
| Testing  | `backend/scripts/verify.js` — imports every module and runs an end-to-end API smoke test |

---

## Installation

Requirements: **Node.js 20+**, npm 9+, and (for production) a PostgreSQL database.

```bash
git clone <your-repo-url> novaai
cd novaai

# 1. install all workspaces (backend + frontend)
npm install

# 2. configure the environment
cp .env.example .env       # Windows: copy .env.example .env
#    -> edit .env (at minimum set JWT_SECRET for production)
#    -> works immediately with zero API keys via the grounded engine

# 3. (optional) create the database schema — see "Database setup"
npm run prisma:migrate

# 4. development (backend :4000 + frontend :5173 with proxy)
npm run dev

# 5. production build
npm run build              # builds frontend -> frontend/dist
npm start                  # backend serves API + built SPA on :4000
```

Without a database the backend starts in **memory mode** (clearly logged, development only) so the
whole product works before PostgreSQL is provisioned.

### Root scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | backend (`--watch`) + Vite dev server together |
| `npm run build` | production build of the frontend |
| `npm start` | start the backend (serves `frontend/dist` if present) |
| `npm run prisma:generate` / `prisma:migrate` / `prisma:validate` | Prisma tooling |
| `npm run seed` | create the admin user + default settings |
| `npm run verify` | backend module import check + API smoke tests |

---

## Environment variables

All configuration lives in a single `.env` at the repository root (never commit it — `.gitignore`
already excludes it). Full annotated copy: [`.env.example`](.env.example).

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `production` enables strict checks (JWT required, mocks disabled) |
| `PORT` | `4000` | API port |
| `CLIENT_URL` | `http://localhost:5173` | Frontend origin for CORS + email links |
| `TRUST_PROXY` | `false` | Set `true` behind nginx / Render / Railway |
| `DATABASE_URL` | — | PostgreSQL connection string; missing means memory mode (dev only) |
| `VECTOR_PROVIDER` | `memory` | `pgvector` or `memory` |
| `VECTOR_DATABASE_URL` | falls back to `DATABASE_URL` | Separate vector DB endpoint if needed |
| `JWT_SECRET` | dev default | **Required** in production (32+ random bytes) |
| `JWT_EXPIRES_IN` | `7d` | Session lifetime |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | `false` / `lax` | Use `true` / `none` for split-domain deployments |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@novaai.local` / `ChangeMe123!` | Used by `npm run seed` |
| `GOOGLE_CLIENT_ID` | — | Enables Google sign-in |
| `AI_PROVIDER` | `grounded` | `grounded` (keyless answer engine), `openai`, `anthropic`, `gemini` or `mock` |
| `AI_MODEL`, `AI_FAST_MODEL`, `AI_STRONG_MODEL`, `AI_CODING_MODEL`, `AI_LONG_CONTEXT_MODEL` | — | Smart routing targets |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | — | Provider credentials (server-side only) |
| `OPENAI_BASE_URL` | OpenAI official | Any OpenAI-compatible endpoint (Ollama, vLLM, OpenRouter, ...) |
| `EMBEDDING_PROVIDER` | `mock` | `openai` or `mock`; see also `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` |
| `SEARCH_PROVIDER` | `mock` | `tavily`, `brave`, `serper`, `google` or `mock` |
| `TAVILY_API_KEY` / `BRAVE_API_KEY` / `SERPER_API_KEY` | — | Search credentials |
| `GOOGLE_SEARCH_API_KEY` / `GOOGLE_SEARCH_CX` | — | Google Programmable Search credentials |
| `SEARCH_FALLBACK` | `true` | Try other configured providers when one fails |
| `MAX_FILE_SIZE_MB` / `MAX_UPLOAD_FILES` | `20` / `5` | Upload limits |
| `RATE_LIMIT_*`, `AUTH_RATE_LIMIT_*`, `CHAT_RATE_LIMIT_*` | see file | Per-window request caps |
| `CONTEXT_MAX_TOKENS`, `CONTEXT_MAX_MESSAGES`, `MAX_RETRIEVED_CHUNKS`, `MAX_SEARCH_RESULTS` | `6000 / 12 / 8 / 8` | Context budgets |
| `DEEP_RESEARCH_MAX_SUBQUERIES/SEARCHES/SOURCES/TIME_MS` | `4 / 6 / 12 / 90000` | Research agent budgets |
| `FACT_CHECK_ENABLED` | `false` | Verification layer (needs a live AI provider) |
| `SHOW_SOURCES_DEFAULT` | `true` | Default visibility of the Sources disclosure |
| `ENABLE_MOCK_PROVIDERS` | `true` | Mock providers (**force-disabled in production**) |
| `MAINTENANCE_MODE` | `false` | Blocks new chat/research requests (admins bypass) |
| `SMTP_URL` / `EMAIL_FROM` | — | Outbound email; without SMTP, links are logged (dev) |

---

## Database setup

### Local PostgreSQL

```bash
createdb novaai
# then in .env:
DATABASE_URL=postgresql://postgres:password@localhost:5432/novaai
```

### Create the schema

```bash
npm run prisma:generate      # generate the Prisma client
npm run prisma:migrate       # create tables (dev; writes a migration)
# production:
npm run prisma:deploy        # apply committed migrations
npm run seed                 # create the admin user + default settings
```

The schema (see `backend/prisma/schema.prisma`) contains:

| Table | Purpose |
|-------|---------|
| `users` | accounts, roles (`USER`/`ADMIN`), verification state |
| `folders` | conversation folders / projects |
| `conversations` | `id, user_id, title, summary, folder_id, created_at, updated_at` |
| `messages` | `id, conversation_id, role (USER/ASSISTANT/SYSTEM), content, metadata, created_at` |
| `documents` | uploaded files, processing status, chunk counts |
| `document_chunks` | extracted text chunks with page numbers |
| `embeddings` | pgvector `vector` column, model, dimensions, content hash |
| `search_queries` / `search_results` | retrieval audit trail (provider, latency, ranking) |
| `api_usage` | tokens, latency, status, estimated cost per request |
| `feedback` | like / dislike per assistant message |
| `settings` | admin global settings + per-user preferences |
| `verification_tokens` | hashed email-verify / password-reset tokens |

### Managed databases

Any managed PostgreSQL works — set `DATABASE_URL` and run `npm run prisma:deploy`:

- **Neon** — `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`
- **Supabase** — Project Settings → Connection string (Session mode for migrations)
- **Railway / Render / Aiven / Fly Postgres** — copy the internal URL

---

## Vector database setup

NovaAI talks to vectors through the `VectorStore` interface
(`backend/src/providers/vector/index.js`), so the backend can be swapped without touching the pipeline.

### Option A — pgvector (production default)

```sql
-- usually run once, as a superuser:
CREATE EXTENSION IF NOT EXISTS vector;
```

```env
VECTOR_PROVIDER=pgvector
DATABASE_URL=postgresql://...
```

On boot NovaAI creates the cosine ANN index if missing:

```sql
CREATE INDEX IF NOT EXISTS embeddings_vector_hnsw
  ON embeddings USING hnsw (vector vector_cosine_ops);
```

Works on any PostgreSQL 13+ with the `pgvector` extension (Neon and Supabase both offer it; on
Supabase: *Database → Extensions → vector → Enable*).

### Option B — memory store (development)

```env
VECTOR_PROVIDER=memory
```

Pure in-process cosine search — zero setup, data lost on restart. Automatically used when no
database is configured.

### Option C — dedicated vector service

Implement the same interface (`upsertChunks`, `search`, `removeDocument`) for Qdrant or a
pgvector server in `providers/vector/` and select it in `getVectorStore()`. Embedding dimensions
are configurable via `EMBEDDING_DIMENSIONS` — keep them consistent for a given dataset.

---

## AI provider setup

### Grounded engine (default — no API key required)

```env
AI_PROVIDER=grounded
```

NovaAI's built-in answer engine for deployments without (or before) LLM keys:

1. Retrieves the question's subject from free open sources (see connectors below)
   — the AUTO pipeline forces retrieval whenever the grounded engine is active;
2. **Math** is *computed* exactly (expressions, percentages, quadratics with steps);
3. **Code** requests are served from a library of verified, runnable templates
   (JS, Python, React, Vue, Node, SQL, CSS, TypeScript, Docker, Git, ...),
   supplemented with Stack Overflow / MDN references when reachable;
4. **Everything else** is an extractive synthesis: ranked sentences from the
   retrieved passages, deduplicated, structured (short answer → key points →
   detail), with inline `[n]` citations and a Sources panel;
5. If nothing can be verified, it says so honestly instead of inventing an answer.

Answers are labelled with a **Grounded** badge, and every factual statement links
to its source. Retrieval itself happens silently in AUTO mode — the user just
sees the answer and its citations.

### Generative models (optional)

OpenAI:

```env
AI_PROVIDER=openai            # openai | anthropic | gemini | mock
AI_MODEL=gpt-4o-mini          # optional default model
AI_FAST_MODEL=gpt-4.1-nano    # simple questions
AI_STRONG_MODEL=gpt-4o        # complex reasoning / deep research
AI_CODING_MODEL=gpt-4.1       # code tasks
AI_LONG_CONTEXT_MODEL=gpt-4.1 # large documents
OPENAI_API_KEY=sk-...
```

Anthropic:

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-3-5-haiku-latest
```

Google Gemini:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=AIza...
AI_MODEL=gemini-2.0-flash
```

Local / open models (Ollama, LM Studio, vLLM, OpenRouter — anything OpenAI-compatible):

```env
AI_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama          # often ignored by local servers
AI_MODEL=llama3.1
```

Notes:

- If the configured provider's key is missing, NovaAI falls back to any other configured provider,
  then to the **grounded engine**, then (development only) to the labelled mock.
- Embeddings are configured separately: `EMBEDDING_PROVIDER=openai` + `OPENAI_API_KEY` for real
  vectors; `mock` uses a deterministic local hash embedding so RAG works offline.
  **Change `EMBEDDING_PROVIDER` / `EMBEDDING_MODEL` only on an empty vector store** — vectors from
  different models are not comparable.

---

## Search provider setup

```env
SEARCH_PROVIDER=tavily         # tavily | brave | serper | google | mock
TAVILY_API_KEY=tvly-...
BRAVE_API_KEY=BSA...
SERPER_API_KEY=...
# Google Programmable Search:
# GOOGLE_SEARCH_API_KEY=...
# GOOGLE_SEARCH_CX=...
SEARCH_FALLBACK=true           # try other configured providers when one fails
```

Behaviour:

1. The preferred provider executes the query.
2. On failure (or too few results) other **configured** providers are tried.
3. Regardless of keys, keyless knowledge connectors run in parallel:
   **DuckDuckGo Instant Answers, Wikipedia, Wikidata, Stack Overflow, MDN,
   Hacker News**, plus arXiv, Crossref, OpenAlex, PubMed, Open Library and
   Gutenberg (official APIs, respectful usage). Connectors self-select by query
   type — Stack Overflow for code, Hacker News for "today/latest" questions,
   scholarly APIs for research queries.
4. In development only, a clearly-labelled synthetic "search not configured" entry is returned when a search mode is explicitly requested without keys.

Results are deduplicated (canonical URLs), cleaned (HTML to text), scored (relevance x provider
score x domain authority), filtered by admin-blocked domains and capped by `MAX_SEARCH_RESULTS`
before they ever reach the prompt.

> NovaAI never scrapes arbitrary web pages: it uses only what the search APIs return and what the
> official knowledge APIs expose, respecting each service's terms of use.

---

## Development

```bash
npm run dev            # backend on :4000, frontend on :5173 (proxied /api)
```

- The Vite dev server proxies `/api` → `http://localhost:4000`, so cookies and SSE behave exactly
  like production (same origin).
- Works **without any API key** and **without a database**: the **grounded answer engine** answers
  from live open sources (Wikipedia, DuckDuckGo, Stack Overflow, MDN, Hacker News, ...) with inline
  citations, exact math and verified code templates; the memory datastore keeps state until you
  attach PostgreSQL.
- Add a search key (`SEARCH_PROVIDER=tavily|brave|serper|google`) for full-web results, and an AI
  key (`AI_PROVIDER=openai|anthropic|gemini`) for generative synthesis.

### Verify everything

```bash
npm run verify         # imports all backend modules + runs API smoke tests
npm run prisma:validate
npm run build          # frontend production build
```

`npm run verify` checks: health, register/login validation, conversations CRUD, SSE streaming
(`meta/sources/delta/done`), file upload + RAG ingest, search, research, feedback, preferences,
admin guards, 404/error shape, export and delete.

---

## Production build

```bash
# 1. environment
cp .env.example .env
#    NODE_ENV=production
#    JWT_SECRET=$(openssl rand -hex 64)
#    DATABASE_URL=postgresql://...     VECTOR_PROVIDER=pgvector
#    AI_PROVIDER=openai  OPENAI_API_KEY=...
#    SEARCH_PROVIDER=tavily  TAVILY_API_KEY=...
#    CLIENT_URL=https://app.example.com  COOKIE_SECURE=true  COOKIE_SAMESITE=none

# 2. database
npm run prisma:generate && npm run prisma:deploy && npm run seed

# 3. frontend
npm run build          # -> frontend/dist

# 4. API + static SPA
npm start              # backend serves both on PORT
```

In production `ENABLE_MOCK_PROVIDERS` is ignored (mocks are force-disabled) and a missing
`JWT_SECRET` aborts startup — the app will not boot with insecure defaults.

---

## Deployment

### 1) Frontend-only (Vercel / Netlify) + backend elsewhere

- Build command: `npm run build --workspace frontend`
- Output directory: `frontend/dist`
- Set `VITE_API_TARGET` at build time if the API origin differs, and set backend `CLIENT_URL` to the
  deployed frontend origin for CORS.
- Backend must use `COOKIE_SECURE=true` and `COOKIE_SAMESITE=none` so the session cookie works
  cross-site.

### 2) Single server (recommended): backend serves the SPA

**Render / Railway / Fly.io**

1. Create a PostgreSQL instance and copy its URL.
2. New Web Service → repo root → build `npm install && npm run build` → start `npm start`.
3. Environment variables: everything from `.env.example`; set `TRUST_PROXY=true`.
4. Health check path: `/api/health`.
5. First deploy: run `npx prisma migrate deploy && npm run seed` (Render: `postdeploy` release command).

**VPS (nginx + systemd)**

```nginx
server {
  listen 443 ssl http2;
  server_name app.example.com;
  # ssl_certificate ...;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    proxy_buffering off;          # required for SSE streaming
    proxy_read_timeout 300s;
  }
}
```

```ini
# /etc/systemd/system/novaai.service
[Service]
WorkingDirectory=/opt/novaai
EnvironmentFile=/opt/novaai/.env
ExecStart=/usr/bin/npm start
Restart=always
User=novaai
```

### 3) Database providers

| Provider | Notes |
|----------|-------|
| Neon | Serverless Postgres, pgvector supported; use the pooler URL at runtime |
| Supabase | Enable the `vector` extension; use session mode for migrations |
| Railway / Fly | One-click Postgres + internal URL |
| AWS RDS / Cloud SQL | Install the pgvector extension first |

### Docker (optional)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 4000
CMD ["npm", "start"]
```

---

## Security notes

- **Secrets stay server-side.** AI/search/database keys are read only in the backend; the SPA bundle
  contains no credentials. Admin endpoints expose only configuration *status* (provider names, flags).
- **Authentication:** email + password with bcrypt (cost 12), JWT signed with `JWT_SECRET`, delivered
  in an `HttpOnly` cookie (plus `Authorization: Bearer` for API clients). Password reset and email
  verification tokens are stored **hashed** with short expiry and single use. Optional Google OAuth
  verifies the ID token audience server-side.
- **CSRF:** cookie is `SameSite` (configurable), state-changing requests are origin-checked, and
  bearer-authenticated API calls bypass CSRF by design.
- **Rate limiting:** global, auth (per IP) and chat (per user) buckets via `express-rate-limit`.
- **Validation:** every body/query/params schema is validated with Zod before controllers run.
- **Uploads:** extension + MIME allow-list, executable rejection, size cap (`MAX_FILE_SIZE_MB`),
  count cap, randomised storage filenames, files served with `nosniff` and only to their owner.
- **SQL injection:** all queries go through Prisma (parameterised) or `Prisma.sql` tagged templates.
- **XSS:** React escapes output; Markdown rendering uses `rehype` plugins without `raw` HTML;
  API responses are JSON with `X-Content-Type-Options: nosniff` and restrictive frame options.
- **Errors:** stack traces are logged server-side only; clients receive friendly messages
  ("Something went wrong. Please try again.").
- **Production guards:** startup fails without `JWT_SECRET`; mock providers are hard-disabled when
  `NODE_ENV=production`.
- **Privacy:** analytics record counts, latency, tokens and model — not message content.

---

## API documentation

All endpoints are prefixed with `/api`. Authenticate with the session cookie or
`Authorization: Bearer <token>`. Errors share one shape:

```json
{ "error": { "code": "BAD_REQUEST", "message": "body: Enter a valid email address.", "details": [] } }
```

### Auth

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/auth/register` | `{ email, password, name? }` | 201, sets cookie, returns `{ user, token }` |
| POST | `/auth/login` | `{ email, password }` | Sets cookie |
| POST | `/auth/logout` | — | Clears cookie |
| GET | `/auth/me` | — | `{ user, usage }` |
| POST | `/auth/refresh` | — | New token |
| POST | `/auth/forgot-password` | `{ email }` | Always 200; `devUrl` returned when SMTP is unset |
| POST | `/auth/reset-password` | `{ token, password }` | |
| POST | `/auth/verify-email` | `{ token }` | |
| POST | `/auth/google` | `{ credential }` | Requires `GOOGLE_CLIENT_ID` |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` | Auth required |

### Chat

| Method | Path | Notes |
|--------|------|-------|
| POST | `/chat/stream` | SSE: `open`, `status`, `meta`, `sources`, `delta`, `verification`, `done`, `error` |
| POST | `/chat` | Same pipeline, single JSON response `{ answer, messageId, sources, model, ... }` |
| GET | `/chat/providers` | `{ provider, label, demo }` (no secrets) |

`POST /chat/stream` body:

```json
{ "conversationId": "uuid?", "message": "What is quantum computing?",
  "mode": "AUTO|FAST|DEEP|DOCUMENTS|WEB", "documentIds": [], "fileIds": [] }
```

Example SSE frame:

```
event: delta
data: {"text":"Quantum computing "}
```

### Conversations

| Method | Path | Notes |
|--------|------|-------|
| GET | `/conversations?search=&limit=&offset=&folderId=&includeArchived=` | List |
| POST | `/conversations` | `{ title? }` |
| GET | `/conversations/:id` | Conversation + messages |
| PATCH | `/conversations/:id` | `{ title?, folderId?, archived?, summary? }` |
| DELETE | `/conversations/:id` | |
| GET | `/conversations/:id/messages` | |
| GET | `/conversations/:id/export?format=md\|txt\|json` | Attachment download |
| GET/POST/PATCH/DELETE | `/conversations/meta/folders...` | Folder management |

### Files (RAG)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/files` | `multipart/form-data`, field `files[]`, max 5 / 20 MB each |
| GET | `/files` | List with processing status |
| GET | `/files/:id` | Metadata |
| GET | `/files/:id/raw` | Image preview (owner only) |
| DELETE | `/files/:id` | Removes file + vectors |

### Search & research

| Method | Path | Body |
|--------|------|------|
| POST | `/search` | `{ query, mode?, limit? }` → ranked sources |
| GET | `/search/recent` | User's search audit trail |
| POST | `/research` | `{ question }` → `{ findings, sources, meta }` |
| POST | `/research/stream` | SSE with `status` + `done` events |

### Feedback & preferences

| Method | Path | Body |
|--------|------|------|
| POST | `/feedback` | `{ messageId, rating: "LIKE"\|"DISLIKE", comment? }` |
| DELETE | `/feedback/:messageId` | |
| GET/PATCH | `/user/settings` | `{ theme?, mode?, showSources?, enterToSend?, speakAnswers?, analyticsOptOut? }` |
| GET | `/user/usage?days=30` | Personal usage totals |
| GET | `/user/stats` | Counts for the settings page |

### Admin (role `ADMIN`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/admin/analytics?days=30` | Users, conversations, AI usage, cost, search, feedback, settings |
| GET | `/admin/users?search=&limit=&offset=` | Includes per-user 30-day usage |
| PATCH | `/admin/users/:id` | `{ role?, isSuspended?, name? }` |
| GET/PATCH | `/admin/settings` | Global settings incl. system prompt, feature flags, limits |
| GET | `/admin/system` | Runtime status (no secrets) |
| POST | `/admin/system/reload-providers` | Re-resolve provider singletons |

### Health

`GET /api/health` → `{ status, env, uptimeSec, database, providers: { ai, search }, demo }`

---

## Grounded mode vs. demo mode

### Grounded mode (default, zero keys)

With `AI_PROVIDER=grounded` the product is fully functional before you own a single API key:

- **Real retrieval** — questions are answered from live open sources (DuckDuckGo, Wikipedia,
  Wikidata, Stack Overflow, MDN, Hacker News, arXiv, Crossref, OpenAlex, PubMed, Open Library,
  Gutenberg), cited inline and listed in the Sources panel.
- **Exact math** — arithmetic, percentages and quadratic equations are computed with steps.
- **Verified code** — code requests are served from a curated template library of canonical,
  runnable examples (promises/async, fetch, React, Vue, Node, Python, SQL, regex, Docker, Git, ...)
  plus real Stack Overflow / MDN references when reachable.
- **Honest fallbacks** — if nothing can be verified (e.g. fully offline), NovaAI says so instead of
  inventing an answer.
- Retrieval happens silently in AUTO mode; the UI shows a small **Grounded** badge and the sources.

### Demo mode (`AI_PROVIDER=mock`, development only)

- `MockAIProvider` is a clearly-labelled stub that explains configuration; it never presents itself
  as real knowledge.
- `MockSearchProvider` returns one synthetic "search not configured" entry.
- Both are **force-disabled in production** (`ENABLE_MOCK_PROVIDERS` is ignored when
  `NODE_ENV=production`).

Upgrade to generative answers with three lines in `.env`:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
SEARCH_PROVIDER=tavily
TAVILY_API_KEY=tvly-...
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Running with the in-memory datastore" warning | Set `DATABASE_URL` and run `npm run prisma:migrate`; memory mode is development-only |
| `prisma validate` fails: environment variable not found | Create `.env` from `.env.example` (Prisma reads `DATABASE_URL`) |
| `P1001` / "Can't reach database" | Check host/credentials/SSL mode; for poolers use the runtime (not migration) URL |
| pgvector errors (`type vector does not exist`) | `CREATE EXTENSION IF NOT EXISTS vector;` as superuser, or set `VECTOR_PROVIDER=memory` |
| AI answers feel shallow | You are on the grounded engine — add `AI_PROVIDER` + key for generative synthesis; add a search key for full-web coverage |
| 502/timeout from the model | Provider outage or `STREAM_TIMEOUT_MS` too low; the UI shows a friendly retry message |
| Answer says "could not verify" (grounded mode) | Server needs outbound HTTPS for the open-source connectors, or add `SEARCH_PROVIDER` + key / `AI_PROVIDER` + key |
| Empty answers with search | Set `SEARCH_PROVIDER` + key; keyless connectors (Wikipedia, DuckDuckGo, ...) still respond with citations |
| RAG answers ignore my PDF | Check `GET /api/files` — status must be `READY`; scanned PDFs need OCR (see below) |
| Streaming stops behind a proxy | Disable response buffering (`proxy_buffering off;` in nginx) and raise read timeout |
| Cookies rejected cross-domain | `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, HTTPS everywhere, correct `CLIENT_URL` |
| CORS errors in split-domain deploys | Set backend `CLIENT_URL` to the exact frontend origin |
| Email links missing | Configure `SMTP_URL`; without it links are logged to the server console and returned in dev |
| Port already in use | `PORT=4001 npm start` |
| Uploaded file type rejected | Allowed: PDF, DOCX, TXT, MD, CSV, JSON, PNG, JPEG, GIF, WEBP (no executables) |

**OCR note:** scanned PDFs contain no text layer. NovaAI reports this explicitly instead of
guessing. For OCR, pre-process files with an OCR service (Tesseract, cloud OCR) before upload or add
an extraction adapter in `backend/src/services/rag/extractors.js`.

---

## License

Private / unpublished unless otherwise stated by the repository owner.


