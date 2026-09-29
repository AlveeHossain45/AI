/**
 * Dual datastore:
 *  - Prisma/PostgreSQL when DATABASE_URL is reachable
 *  - In-memory fallback for development/demo mode (clearly labelled, non-persistent)
 *
 * Repositories call into this module so business logic never touches Prisma directly.
 */
import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { memory } from './memory.js';

let prisma = null;
let mode = 'memory';

export const dbMode = () => mode;
export const isPostgres = () => mode === 'postgres';
export const isMemory = () => mode === 'memory';
export const getPrisma = () => prisma;

export async function initDatabase () {
  if (config.db.url) {
    try {
      prisma = new PrismaClient({ log: ['warn', 'error'] });
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$connect();
      mode = 'postgres';
      logger.info('Database: PostgreSQL connected');
      await ensureVectorSupport();
      return mode;
    } catch (error) {
      logger.warn('Database: PostgreSQL unavailable, falling back to in-memory store (development only).');
      logger.debug(error.message);
      try { await prisma?.$disconnect(); } catch { /* ignore */ }
      prisma = null;
    }
  } else {
    logger.warn('Database: DATABASE_URL not set, running with the in-memory store (development only).');
  }
  if (config.isProduction) {
    throw new Error('DATABASE_URL must point to a reachable PostgreSQL database in production.');
  }
  mode = 'memory';
  return mode;
}

/** pgvector extension + ANN index are created idempotently when needed. */
async function ensureVectorSupport () {
  if (config.vector.provider !== 'pgvector' || !prisma) return;
  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS embeddings_vector_hnsw ON embeddings USING hnsw (vector vector_cosine_ops)'
    );
    logger.info('Vector store: pgvector ready');
  } catch (error) {
    logger.warn(`Vector store: pgvector bootstrap failed (${error.message}). Falling back to memory vector store.`);
    config.vector.provider = 'memory';
  }
}

export async function disconnectDatabase () {
  if (prisma) {
    try { await prisma.$disconnect(); } catch { /* ignore */ }
  }
}

export { memory };
export default { initDatabase, disconnectDatabase, dbMode, isPostgres, isMemory, getPrisma, memory };
