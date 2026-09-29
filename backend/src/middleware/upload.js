/**
 * Upload middleware: multer disk storage with MIME/extension/size validation.
 * Files land in <backend>/storage/uploads with generated names.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import config from '../config/index.js';
import { badRequest, payloadTooLarge } from '../utils/errors.js';
import { isSupportedDocument, isImageFile } from '../services/rag/extractors.js';

const uploadDir = path.join(config.storage.root, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination (req, file, cb) {
    cb(null, uploadDir);
  },
  filename (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 12);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const ALLOWED_FIELDS = 10;

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: config.limits.maxFileMb * 1024 * 1024,
    files: config.limits.maxUploadFiles,
    fields: ALLOWED_FIELDS,
  },
  fileFilter (req, file, cb) {
    const ok = isSupportedDocument(file.mimetype, file.originalname) || isImageFile(file.mimetype, file.originalname);
    if (!ok) {
      return cb(badRequest(`Unsupported file type (${file.mimetype || 'unknown'}). Allowed: PDF, DOCX, TXT, Markdown, CSV, JSON, PNG, JPEG, GIF, WEBP.`));
    }
    // Defence-in-depth: reject executable/script extensions.
    if (/\.(exe|bat|cmd|sh|js|mjs|php|dll|msi|scr|com|ps1|py)$/i.test(file.originalname)) {
      return cb(badRequest('Executable or script files are not allowed.'));
    }
    return cb(null, true);
  },
});

export const ensureUploadDir = () => fs.mkdirSync(uploadDir, { recursive: true });
export const uploadDirPath = uploadDir;

export { payloadTooLarge };
export default uploadMiddleware;
