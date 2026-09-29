/**
 * File controller: upload, list, metadata, raw image preview, delete.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import config from '../config/index.js';
import { asyncHandler } from '../utils/crypto.js';
import { notFound, badRequest, serviceUnavailable } from '../utils/errors.js';
import documentRepo from '../repositories/documentRepo.js';
import { getVectorStore } from '../providers/vector/index.js';
import { createDocumentRecord, processDocument } from '../services/rag/ingestService.js';
import { isImageFile } from '../services/rag/extractors.js';
import logger from '../utils/logger.js';

const serialize = (doc) => ({
  id: doc.id,
  filename: doc.filename,
  mimeType: doc.mimeType,
  sizeBytes: doc.sizeBytes,
  status: doc.status,
  error: doc.error || null,
  pageCount: doc.pageCount,
  charCount: doc.charCount,
  chunkCount: doc.chunkCount,
  createdAt: doc.createdAt,
  isImage: isImageFile(doc.mimeType, doc.filename),
});

export const fileController = {
  upload: asyncHandler(async (req, res) => {
    const files = req.files || [];
    if (!files.length) throw badRequest('No files were uploaded.');

    const records = [];
    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      const record = await createDocumentRecord(req.user, file);
      records.push(record);
      // Process in the background; clients poll status via GET /api/files.
      // eslint-disable-next-line no-await-in-loop
      await processDocument(record.id).catch((error) => logger.error(`Ingest failed: ${error.message}`));
    }

    const refreshed = [];
    for (const record of records) {
      // eslint-disable-next-line no-await-in-loop
      refreshed.push(await documentRepo.findById(record.id, req.user.id) || record);
    }
    res.status(201).json({ documents: refreshed.map(serialize) });
  }),

  list: asyncHandler(async (req, res) => {
    const { rows, total } = await documentRepo.listByUser(req.user.id, {
      limit: Math.min(Number(req.query.limit) || 50, 200),
      offset: Number(req.query.offset) || 0,
    });
    res.json({ documents: rows.map(serialize), total });
  }),

  get: asyncHandler(async (req, res) => {
    const document = await documentRepo.findById(req.params.id, req.user.id);
    if (!document) throw notFound('File not found.');
    const { chunks, ...meta } = document;
    void chunks;
    res.json({ document: serialize(meta) });
  }),

  /** Serve image previews for the chat UI (owner only). */
  raw: asyncHandler(async (req, res) => {
    const document = await documentRepo.findById(req.params.id, req.user.id);
    if (!document) throw notFound('File not found.');
    if (!isImageFile(document.mimeType, document.filename)) throw badRequest('This file is not an image.');
    const filePath = path.join(config.storage.root, document.storagePath);
    const buffer = await fs.readFile(filePath).catch(() => null);
    if (!buffer) throw notFound('File content no longer exists.');
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(buffer);
  }),

  remove: asyncHandler(async (req, res) => {
    const document = await documentRepo.findById(req.params.id, req.user.id);
    if (!document) throw notFound('File not found.');
    await getVectorStore().removeDocument(document.id).catch(() => {});
    const removed = await documentRepo.remove(document.id, req.user.id);
    if (!removed) throw notFound('File not found.');
    await fs.unlink(path.join(config.storage.root, document.storagePath)).catch(() => {});
    res.json({ ok: true });
  }),

  unavailable: asyncHandler(async () => {
    throw serviceUnavailable();
  }),
};

export default fileController;
