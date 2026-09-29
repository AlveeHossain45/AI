/**
 * In-memory datastore used when PostgreSQL is not configured/reachable.
 * Development/demo only: data is lost on restart and the API clearly logs this mode.
 * Repositories expose the same behaviour for both backends.
 */
import crypto from 'node:crypto';

class MemTable {
  constructor (name) {
    this.name = name;
    this.rows = new Map();
  }

  insert (data) {
    const now = new Date();
    const row = {
      id: data.id || crypto.randomUUID(),
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      ...data,
    };
    if (!row.id) row.id = crypto.randomUUID();
    this.rows.set(row.id, row);
    return { ...row };
  }

  get (id) {
    const row = this.rows.get(id);
    return row ? { ...row } : null;
  }

  find (predicate) {
    for (const row of this.rows.values()) if (predicate(row)) return { ...row };
    return null;
  }

  filter (predicate) {
    const out = [];
    for (const row of this.rows.values()) if (predicate(row)) out.push({ ...row });
    return out;
  }

  all () {
    return [...this.rows.values()].map((row) => ({ ...row }));
  }

  update (id, patch) {
    const row = this.rows.get(id);
    if (!row) return null;
    Object.assign(row, patch, { updatedAt: new Date() });
    return { ...row };
  }

  remove (id) {
    return this.rows.delete(id);
  }

  removeWhere (predicate) {
    let removed = 0;
    for (const [id, row] of [...this.rows.entries()]) {
      if (predicate(row)) {
        this.rows.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  count (predicate) {
    if (!predicate) return this.rows.size;
    let n = 0;
    for (const row of this.rows.values()) if (predicate(row)) n += 1;
    return n;
  }

  clear () {
    this.rows.clear();
  }
}

export const memory = {
  users: new MemTable('users'),
  folders: new MemTable('folders'),
  conversations: new MemTable('conversations'),
  messages: new MemTable('messages'),
  documents: new MemTable('documents'),
  documentChunks: new MemTable('document_chunks'),
  embeddings: new MemTable('embeddings'), // vector payload kept in `vector` (number[])
  searchQueries: new MemTable('search_queries'),
  searchResults: new MemTable('search_results'),
  apiUsage: new MemTable('api_usage'),
  feedback: new MemTable('feedback'),
  settings: new MemTable('settings'),
  verificationTokens: new MemTable('verification_tokens'),

  clearAll () {
    for (const table of Object.values(this)) {
      if (table instanceof MemTable) table.clear();
    }
  },
};

export const cosineSimilarity = (a, b) => {
  if (!a?.length || !b?.length || a.length !== b.length) return -1;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

export default memory;
