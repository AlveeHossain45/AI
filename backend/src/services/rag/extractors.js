/**
 * Text extraction for uploaded documents.
 * Supports: PDF, DOCX, TXT, Markdown, CSV, JSON (+ any UTF-8 text file).
 * OCR for scanned PDFs requires an OCR service; when unavailable we return a
 * clear error instead of guessing at image content.
 */
import mammoth from 'mammoth';
import { badRequest, unsupportedMedia } from '../../utils/errors.js';
import { cleanText } from '../../utils/text.js';

const SUPPORTED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/octet-stream',
]);

const SUPPORTED_EXT = ['.pdf', '.docx', '.txt', '.md', '.markdown', '.csv', '.json', '.log', '.text'];

export const isSupportedDocument = (mimetype = '', filename = '') =>
  SUPPORTED_MIME.has(mimetype) || SUPPORTED_EXT.some((ext) => filename.toLowerCase().endsWith(ext));

export const isImageFile = (mimetype = '', filename = '') =>
  mimetype.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(filename);

export async function extractDocumentText (buffer, { mimetype = '', filename = '' } = {}) {
  const lower = filename.toLowerCase();

  if (mimetype === 'application/pdf' || lower.endsWith('.pdf')) {
    return extractPdf(buffer, filename);
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lower.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    const text = cleanText(result.value);
    if (!text) throw badRequest('We could not extract text from this DOCX file.');
    return { text, pageCount: null };
  }
  if (mimetype === 'application/json' || lower.endsWith('.json')) {
    try {
      const parsed = JSON.parse(buffer.toString('utf8'));
      const text = cleanText(JSON.stringify(parsed, null, 2));
      return { text, pageCount: null };
    } catch {
      throw badRequest('The JSON file could not be parsed.');
    }
  }
  if (SUPPORTED_MIME.has(mimetype) || SUPPORTED_EXT.some((ext) => lower.endsWith(ext))) {
    const text = cleanText(buffer.toString('utf8'));
    if (!text) throw badRequest('The file appears to be empty or is not valid UTF-8 text.');
    return { text, pageCount: null };
  }

  // Last resort: try decoding as text for unknown-but-likely-text types.
  if (mimetype.startsWith('text/')) {
    const text = cleanText(buffer.toString('utf8'));
    if (text) return { text, pageCount: null };
  }
  throw unsupportedMedia(
    `Unsupported file type "${mimetype || 'unknown'}". Supported: PDF, DOCX, TXT, Markdown, CSV, JSON.`
  );
}

async function extractPdf (buffer, filename) {
  let pdfParse;
  try {
    ({ default: pdfParse } = await import('pdf-parse'));
  } catch {
    throw badRequest('PDF support is unavailable in this deployment.');
  }
  try {
    const result = await pdfParse(buffer);
    const text = cleanText(result.text || '');
    if (!text) {
      throw badRequest(
        `"${filename}" contains no extractable text. It may be a scanned PDF — enable OCR (see README) or upload a text-based PDF.`
      );
    }
    return { text, pageCount: result.numpages || null };
  } catch (error) {
    if (error?.code === 'BAD_REQUEST' || error?.status === 400) throw error;
    throw badRequest(`We could not read this PDF: ${String(error.message).slice(0, 140)}`);
  }
}

export default { extractDocumentText, isSupportedDocument, isImageFile };
