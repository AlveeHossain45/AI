/** URL helpers: validation, domain extraction, dedup keys, authority boosts. */

const BLOCKED_PROTOCOLS = new Set(['javascript:', 'data:', 'file:', 'vbscript:']);

export const isSafeHttpUrl = (raw) => {
  try {
    const url = new URL(String(raw));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (BLOCKED_PROTOCOLS.has(url.protocol)) return false;
    return Boolean(url.hostname) && url.hostname.includes('.');
  } catch {
    return false;
  }
};

export const getDomain = (raw) => {
  try {
    return new URL(String(raw)).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

/** Stable dedup key: canonical URL without tracking params/fragments. */
export const canonicalUrl = (raw) => {
  try {
    const url = new URL(String(raw));
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref|source|spm)/i.test(key)) url.searchParams.delete(key);
    }
    const normalized = `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}${url.search}`;
    return normalized.toLowerCase();
  } catch {
    return String(raw).toLowerCase();
  }
};

/** Heuristic quality/authority boost per domain (retrieval ranking). */
const AUTHORITY = {
  'wikipedia.org': 1.15,
  'wikidata.org': 1.1,
  'arxiv.org': 1.2,
  'nih.gov': 1.2,
  'gov.uk': 1.2,
  'who.int': 1.2,
  'europa.eu': 1.2,
  'nature.com': 1.15,
  'science.org': 1.15,
  'ieee.org': 1.15,
  'acm.org': 1.15,
  'developer.mozilla.org': 1.15,
  'docs.github.com': 1.1,
  'docs.python.org': 1.15,
  'nodejs.org': 1.1,
  'w3.org': 1.1,
  'openai.com': 1.05,
};

export const domainAuthorityBoost = (raw) => {
  const domain = getDomain(raw);
  if (!domain) return 1;
  for (const [key, boost] of Object.entries(AUTHORITY)) {
    if (domain === key || domain.endsWith(`.${key}`)) return boost;
  }
  if (/\.gov(\.[a-z]{2})?$/.test(domain)) return 1.2;
  return 1;
};

export default { isSafeHttpUrl, getDomain, canonicalUrl, domainAuthorityBoost };
