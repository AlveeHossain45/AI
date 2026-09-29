/**
 * Chunking: splits cleaned text into overlapping, paragraph-aware chunks
 * sized for embedding + retrieval.
 */
import { estimateTokens } from '../../utils/text.js';

/**
 * @param {string} text
 * @param {{chunkSize?: number, overlap?: number}} options chunk size in characters
 * @returns {{idx:number, content:string, tokenCount:number, pageNumber:number|null}[]}
 */
export function chunkText (text, { chunkSize = 1400, overlap = 200 } = {}) {
  const source = String(text || '').trim();
  if (!source) return [];

  const paragraphs = source.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = '';

  const flush = () => {
    const value = current.trim();
    if (value) {
      chunks.push({ idx: chunks.length, content: value, tokenCount: estimateTokens(value), pageNumber: null });
    }
    current = '';
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > chunkSize) {
      // Hard-split very large paragraphs on sentence boundaries.
      flush();
      let cursor = 0;
      while (cursor < paragraph.length) {
        let end = Math.min(cursor + chunkSize, paragraph.length);
        if (end < paragraph.length) {
          const sentenceBreak = paragraph.lastIndexOf('. ', end);
          if (sentenceBreak > cursor + chunkSize * 0.5) end = sentenceBreak + 1;
        }
        const slice = paragraph.slice(cursor, end).trim();
        if (slice) chunks.push({ idx: chunks.length, content: slice, tokenCount: estimateTokens(slice), pageNumber: null });
        cursor = Math.max(end - overlap, cursor + 1);
      }
      continue;
    }
    if (current.length + paragraph.length + 2 > chunkSize) {
      flush();
      if (overlap > 0 && chunks.length) {
        const previous = chunks[chunks.length - 1].content;
        current = `${previous.slice(-overlap)}\n\n`;
      }
    }
    current += `${paragraph}\n\n`;
  }
  flush();

  return chunks.map((chunk, index) => ({ ...chunk, idx: index }));
}

export default chunkText;
