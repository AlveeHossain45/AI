/**
 * Document ingestion pipeline:
 * upload → extract → clean → chunk → embed → vector store.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import documentRepo from '../../repositories/documentRepo.js';
import { getEmbeddingProvider } from '../../providers/embeddings/index.js';
import { getVectorStore } from '../../providers/vector/index.js';
import { extractDocumentText, isSupportedDocument, isImageFile } from './extractors.js';
import { chunkText } from './chunker.js';
import { sha256 } from '../../utils/crypto.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { estimateTokens } from '../../utils/text.js';

const MAX_CHUNK_CHARS = 1600;

export async function createDocumentRecord (user, file) {
  if (!file) throw badRequest('No file was provided.');
  if (!isSupportedDocument(file.mimetype, file.filename) && !isImageFile(file.mimetype, file.filename)) {
    throw badRequest('Unsupported file type. Upload PDF, DOCX, TXT, Markdown, CSV or JSON (images are supported in chat).');
  }
  const record = await documentRepo.create({
    userId: user.id,
    filename: file.filename,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storagePath: path.relative(config.storage.root, file.path),
    status: isImageFile(file.mimetype, file.filename) ? 'READY' : 'PROCESSING',
    charCount: isImageFile(file.mimetype, file.filename) ? 0 : null,
  });
  return record;
}

/** Run extraction + embedding; safe to fire-and-forget with error logging. */
export async function processDocument (documentId) {
  const started = Date.now();
  const document = await documentRepo.findById(documentId);
  if (!document) return null;
  if (isImageFile(document.mimeType, document.filename)) {
    await documentRepo.update(documentId, { status: 'READY', chunkCount: 0, charCount: 0 });
    return document;
  }

  try {
    const buffer = await fs.readFile(path.join(config.storage.root, document.storagePath));
    const { text, pageCount } = await extractDocumentText(buffer, { mimetype: document.mimeType, filename: document.filename });
    if (!text) throw badRequest('No extractable text found in this file.');

    const chunks = chunkText(text, { chunkSize: MAX_CHUNK_CHARS, overlap: 180 });
    if (!chunks.length) throw badRequest('The document produced no retrievable content.');

    // Persist chunks first so we have IDs for embeddings.
    await documentRepo.createChunks(documentId, chunks);
    const stored = await documentRepo.findById(documentId);
    const storedChunks = stored?.chunks || [];

    const embedder = getEmbeddingProvider();
    const vectors = await embedder.embed(chunks.map((chunk) => chunk.content));
    const entries = chunks.map((chunk, index) => {
      const storedChunk = storedChunks[index];
      return {
        chunkId: storedChunk.id,
        documentId,
        model: embedder.model,
        dimensions: embedder.dimensions,
        vector: vectors[index],
        contentHash: sha256(chunk.content),
      };
    });
    await getVectorStore().upsertChunks(entries);

    const updated = await documentRepo.update(documentId, {
      status: 'READY',
      charCount: text.length,
      pageCount: pageCount || undefined,
      chunkCount: chunks.length,
      error: null,
    });
    logger.event('document.ready', { documentId, chunks: chunks.length, ms: Date.now() - started });
    return updated;
  } catch (error) {
    logger.error(`Document processing failed (${documentId}): ${error.message}`);
    await documentRepo.update(documentId, { status: 'FAILED', error: String(error.message).slice(0, 300) }).catch(() => {});
    return null;
  }
}

/**
 * Retrieve relevant chunks for a query (RAG).
 * Returns [] when there is no query, no documents or no embeddings.
 */
export async function retrieveDocumentContext (userId, query, { documentIds = null, topK = config.limits.maxRetrievedChunks } = {}) {
  if (!query || !userId) return [];
  const { rows } = await documentRepo.listByUser(userId, { limit: 500 });
  const ready = rows.filter((doc) => doc.status === 'READY' && doc.chunkCount > 0);
  const scoped = documentIds?.length ? ready.filter((doc) => documentIds.includes(doc.id)) : ready;
  if (!scoped.length) return [];

  const embedder = getEmbeddingProvider();
  const [vector] = await embedder.embed([query]);
  const results = await getVectorStore().search(userId, vector, {
    topK,
    documentIds: scoped.map((doc) => doc.id),
  });

  return results
    .filter((row) => row.score > 0.05 || rows.length <= 3) // near-even mock vectors still surface context
    .map((row) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      filename: row.filename,
      score: row.score,
      pageNumber: row.pageNumber,
      content: row.content,
      tokenCount: estimateTokens(row.content),
    }));
}

export default { createDocumentRecord, processDocument, retrieveDocumentContext };
