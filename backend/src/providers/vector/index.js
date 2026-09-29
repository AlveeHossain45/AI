/**
 * Vector store abstraction.
 *
 * Implementations:
 *   - pgvector (PostgreSQL + pgvector extension) — production
 *   - memory   (in-process cosine search)         — development/demo
 *
 * The pipeline only talks to this interface, so another backend
 * (Qdrant, Supabase, pgvector-server, ...) can be added without
 * touching services.
 */
import config from '../../config/index.js';
import documentRepo from '../../repositories/documentRepo.js';
import { isPostgres } from '../../db/index.js';

class PgVectorStore {
  constructor () {
    this.name = 'pgvector';
  }

  async isAvailable () {
    return isPostgres();
  }

  async upsertChunks (entries) {
    return documentRepo.createEmbeddings(entries);
  }

  async search (userId, vector, options) {
    return documentRepo.similaritySearch(userId, vector, options);
  }

  async removeDocument (documentId) {
    // Chunks cascade to embeddings via FK constraints in Postgres.
    void documentId;
    return true;
  }
}

class MemoryVectorStore {
  constructor () {
    this.name = 'memory';
  }

  async isAvailable () {
    return true;
  }

  async upsertChunks (entries) {
    return documentRepo.createEmbeddings(entries);
  }

  async search (userId, vector, options) {
    return documentRepo.similaritySearch(userId, vector, options);
  }

  async removeDocument () {
    return true;
  }
}

let store = null;

export function getVectorStore () {
  if (store) return store;
  if (config.vector.provider === 'pgvector' && isPostgres()) store = new PgVectorStore();
  else store = new MemoryVectorStore();
  return store;
}

export function resetVectorStore () {
  store = null;
}

export const vectorStoreInfo = () => getVectorStore().name;
export default { getVectorStore, resetVectorStore, vectorStoreInfo };
