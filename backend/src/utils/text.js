/**
 * Text processing helpers: HTML stripping, cleaning, token estimation,
 * snippet generation and relevance scoring used by retrieval ranking.
 */

export const estimateTokens = (text) => {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
};

/** Remove non-printable control characters (keeps tab and newline). */
export const stripControlChars = (text = '') => {
  let out = '';
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (code === 9 || code === 10) out += ch;
    else if (code < 32 || code === 127) out += ' ';
    else out += ch;
  }
  return out;
};

/** Convert arbitrary HTML into readable plain text (no DOM dependency). */
export const htmlToText = (html = '') => {
  let text = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text);
  return cleanText(text);
};

export const decodeEntities = (text = '') =>
  String(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&([a-z]+);/gi, (m, entity) => {
      const map = { apos: "'", hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
      return map[entity.toLowerCase()] ?? m;
    });

/** Normalise whitespace, strip control characters, collapse blank lines. */
export const cleanText = (text = '') =>
  stripControlChars(String(text).replace(/\r\n?/g, '\n'))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const truncate = (text = '', max = 500) => {
  const value = String(text);
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

/** Snippet centred on the first keyword match — used for search results. */
export const makeSnippet = (text = '', keywords = [], max = 320) => {
  const lower = String(text).toLowerCase();
  let index = -1;
  for (const kw of keywords) {
    const found = lower.indexOf(String(kw).toLowerCase());
    if (found !== -1 && (index === -1 || found < index)) index = found;
  }
  if (index === -1) return truncate(text, max);
  const start = Math.max(0, index - Math.floor(max / 3));
  return truncate(text.slice(start, start + max + 60), max);
};

export const tokenize = (text = '') =>
  String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);

/** Overlap score between a query and a candidate text (0..1). */
export const relevanceScore = (query = '', text = '') => {
  const queryTokens = [...new Set(tokenize(query))];
  if (!queryTokens.length || !text) return 0;
  const textTokens = new Set(tokenize(text));
  let hits = 0;
  for (const token of queryTokens) if (textTokens.has(token)) hits += 1;
  return hits / queryTokens.length;
};

/** Strip noisy markdown (images, checkboxes) and cap size for LLM context. */
export const compressForContext = (text = '', maxChars = 1200) => {
  let value = String(text)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/^\s*[-*]\s+\[[ x]\]\s*/gim, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (value.length > maxChars) value = truncate(value, maxChars);
  return value;
};

export default {
  estimateTokens,
  stripControlChars,
  htmlToText,
  cleanText,
  truncate,
  makeSnippet,
  tokenize,
  relevanceScore,
  compressForContext,
};
