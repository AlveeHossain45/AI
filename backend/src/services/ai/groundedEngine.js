/**
 * Grounded answer engine.
 *
 * Produces accurate answers *without* an LLM by combining:
 *   1. deterministic computation (math engine)
 *   2. verified code templates (hand-checked canonical examples)
 *   3. extractive synthesis over retrieved, cited sources
 *
 * Every factual statement in a synthesis answer comes from the retrieved
 * passages and carries an inline [n] citation; the UI exposes the full
 * source list in the Sources panel. Nothing is invented.
 */
import { evaluateExpression, evaluatePercent, solveQuadratic, isPercentQuestion } from './mathEngine.js';
import { matchCodeTemplates } from './codeTemplates.js';
import { tokenize, truncate, estimateTokens } from '../../utils/text.js';

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const now = new Date();
const CURRENT_DATE = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

export function classify (question) {
  const q = String(question || '').trim();
  const lower = q.toLowerCase();
  const has = (re) => re.test(lower);

  const wantsCode = has(/\b(code|snippet|example|implement|write|program|script|function|component|query|regex|algorithm)\b/)
    && has(/\b(python|javascript|typescript|java\b|c\+\+|golang|go\b|rust|sql|react|vue|node|bash|html|css|php|ruby|swift|kotlin|docker|git)\b|code|snippet|function|component|api|program|script/);
  const wantsMath = has(/\b(solve|calculate|compute|evaluate|equation|percent|percentage|what is \d|how much is)\b/)
    || /^[\d\s+\-*/^().,%×÷]+$/.test(q);
  const isNews = has(/\b(news|today|latest|current|recent|this (week|month|day)|yesterday|breaking|now)\b/);
  const isCompare = has(/\b(compare|versus|vs\.?|difference between|better than|contrast)\b/);
  const isPerson = has(/^\s*(who (was|is)|tell me about)\b/);
  const isHow = has(/^\s*how (does|do|to|can)\b/);
  const isWhy = has(/^\s*why\b/);
  const isDoc = has(/\b(summar(y|ise|ize|izing)|document|pdf|file|attachment|report|the (text|article|passage))\b/);

  let intent = 'general';
  if (wantsMath) intent = 'math';
  else if (wantsCode) intent = 'code';
  else if (isNews) intent = 'current';
  else if (isCompare) intent = 'compare';
  else if (isDoc) intent = 'document';
  else if (isPerson) intent = 'person';
  else if (isHow) intent = 'how';
  else if (isWhy) intent = 'why';

  return { intent, wantsCode, wantsMath, isNews, isCompare, isPerson, isDoc, question: q };
}

// ---------------------------------------------------------------------------
// Context parsing (sources/documents embedded in system messages)
// ---------------------------------------------------------------------------

export function parseContext (messages) {
  const systemText = messages
    .filter((message) => message.role === 'system')
    .map((message) => (typeof message.content === 'string' ? message.content : ''))
    .join('\n');

  const sources = [];
  const sourceRegex = /SOURCE \[(\d+)\]([\s\S]*?)(?=SOURCE \[\d+\]|DOCUMENT EXCERPT|$)/g;
  let match;
  // eslint-disable-next-line no-cond-assign
  while ((match = sourceRegex.exec(systemText)) !== null) {
    const body = match[2];
    const title = /^Title: (.*)$/m.exec(body)?.[1]?.trim() || 'Untitled';
    const url = /^URL: (.*)$/m.exec(body)?.[1]?.trim() || '';
    const published = /^Published: (.*)$/m.exec(body)?.[1]?.trim();
    const excerpt = /Excerpt:\n([\s\S]*)$/.exec(body)?.[1]?.trim() || '';
    sources.push({ id: Number(match[1]), title, url, publishedAt: published, content: excerpt });
  }

  const documents = [];
  const docRegex = /DOCUMENT EXCERPT (\d+) \(([^)]*)\):\n([\s\S]*?)(?=DOCUMENT EXCERPT \d+ \(|$)/g;
  // eslint-disable-next-line no-cond-assign
  while ((match = docRegex.exec(systemText)) !== null) {
    documents.push({ id: Number(match[1]), where: match[2].trim(), content: match[3].trim() });
  }

  const userMessages = messages.filter((message) => message.role === 'user');
  const question = lastText(userMessages.at(-1)?.content);
  const history = userMessages.slice(0, -1).map((message) => lastText(message.content)).filter(Boolean);

  return { sources, documents, question, history };
}

function lastText (content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((part) => part?.type === 'text').map((part) => part.text || '').join(' ');
  return '';
}

// ---------------------------------------------------------------------------
// Sentence extraction
// ---------------------------------------------------------------------------

const splitSentences = (text) =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'“(—])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 40 && sentence.length <= 420);

const jaccard = (a, b) => {
  const setA = new Set(a);
  const setB = new Set(b);
  if (!setA.size || !setB.size) return 0;
  let hits = 0;
  for (const token of setA) if (setB.has(token)) hits += 1;
  return hits / (setA.size + setB.size - hits);
};

const STOPWORDS = new Set([
  'who', 'what', 'when', 'where', 'why', 'how', 'is', 'was', 'are', 'were', 'be', 'been',
  'the', 'a', 'an', 'of', 'in', 'on', 'to', 'for', 'and', 'or', 'do', 'does', 'did',
  'can', 'could', 'please', 'tell', 'me', 'about', 'that', 'this', 'it', 'with', 'from',
  // task words — they describe the question, not the subject
  'compare', 'comparison', 'difference', 'between', 'vs', 'versus', 'better', 'best',
  'way', 'ways', 'use', 'using', 'give', 'make', 'need', 'want', 'get',
]);

const contentTokens = (queryTokens) => queryTokens.filter((token) => !STOPWORDS.has(token));

/** Meta-articles (timelines, lists, categories) make poor lead sentences. */
const META_ARTICLE = /^\s*(this is a (timeline|list|category|disambiguation)|see also|the following|category:)/i;

function scoreSentences (sentences, queryTokens, { sourceScore = 0.5, prefixBonus = 0, titleTokens = [] } = {}) {
  const querySet = new Set(queryTokens);
  const titleSet = new Set(titleTokens);
  let titleBoost = 0;
  if (queryTokens.length && titleSet.size) {
    const allInTitle = queryTokens.every((token) => titleSet.has(token));
    const exact = allInTitle && titleTokens.every((token) => querySet.has(token));
    if (exact) titleBoost = 0.3;            // source IS the subject
    else if (allInTitle) titleBoost = 0.14; // subject embedded in a longer title
    else titleBoost = (queryTokens.filter((token) => titleSet.has(token)).length / queryTokens.length) * 0.1;
  }
  return sentences.map((sentence, index) => {
    const tokens = tokenize(sentence);
    if (!tokens.length) return null;
    let hits = 0;
    for (const token of querySet) if (tokens.includes(token)) hits += 1;
    const coverage = querySet.size ? hits / querySet.size : 0;
    const position = index === 0 ? 0.12 : Math.max(0, 0.06 - index * 0.01);
    const definitional = /\bis an?\b|\bis the\b|\brefers to\b|\bwas a\b|\bmeans\b/i.test(sentence) ? 0.1 : 0;
    // Definitions usually open with the subject itself: "<Subject> is ..."
    const subjectFirst = queryTokens.length
      && queryTokens.every((token) => tokens.slice(0, 8).includes(token)) ? 0.14 : 0;
    const metaPenalty = META_ARTICLE.test(sentence) ? -0.3 : 0;
    return {
      sentence,
      tokens,
      score: coverage * 0.6 + position + definitional + subjectFirst + sourceScore * 0.18 + prefixBonus + titleBoost + metaPenalty,
    };
  }).filter(Boolean);
}

function pickTop (scored, { limit = 8, seen = [], minScore = 0.18 } = {}) {
  const chosen = [];
  const seenTokens = seen.map((entry) => entry.tokens);
  for (const entry of [...scored].sort((a, b) => b.score - a.score)) {
    if (entry.score < minScore && chosen.length >= 2) continue;
    if (chosen.some((existing) => jaccard(existing.tokens, entry.tokens) > 0.55)) continue;
    if (seenTokens.some((tokens) => jaccard(tokens, entry.tokens) > 0.6)) continue;
    chosen.push(entry);
    if (chosen.length >= limit) break;
  }
  return chosen;
}

// ---------------------------------------------------------------------------
// Answer builders
// ---------------------------------------------------------------------------

function buildMathAnswer (question) {
  const cleaned = String(question)
    .replace(/^\s*(?:please\s+)?(?:what(?:'s| is| are)?|how much is|calculate|compute|evaluate|solve|find)\s+/i, '')
    .replace(/[?=]+\s*$/, '')
    .trim();

  const quadratic = solveQuadratic(cleaned) || solveQuadratic(question);
  if (quadratic) {
    const lines = [
      '**Result**',
      '',
      quadratic.discriminant < 0
        ? `No real solutions (complex roots: \`${quadratic.roots[0]}\`, \`${quadratic.roots[1]}\`).`
        : quadratic.roots.length === 1 || Math.abs(Number(quadratic.roots[0]) - Number(quadratic.roots[1])) < 1e-12
          ? `x = ${quadratic.roots[0]}`
          : `x₁ = ${quadratic.roots[0]}, x₂ = ${quadratic.roots[1]}`,
      '',
      '**Steps**',
      '',
      ...quadratic.steps.map((step, index) => `${index + 1}. ${step}`),
    ];
    return { content: lines.join('\n'), strategy: 'math.quadratic' };
  }

  if (isPercentQuestion(cleaned) || isPercentQuestion(question)) {
    const value = evaluatePercent(cleaned) ?? evaluatePercent(question);
    if (value !== null) {
      return {
        content: `**Result:** \`${value}\`\n\n**Steps:**\n\n1. Convert the percentage to a decimal: divide by 100.\n2. Multiply by the base amount.\n3. Result = ${Number(value.toFixed(6))}.`,
        strategy: 'math.percent',
      };
    }
  }

  const expressionMatch = question.match(/(?:what(?:'s| is)|calculate|compute|evaluate|how much is)?\s*([0-9a-zA-Z_+\-*/^%().,\s]+?)\s*(?:=|\?|$)/i);
  const candidate = expressionMatch?.[1] || question;
  const value = evaluateExpression(candidate);
  if (value !== null && /[+\-*/^%×÷]|\d+\s*x\s*\d+/.test(candidate)) {
    const rounded = Number.isInteger(value) ? value : Number(value.toFixed(8));
    return {
      content: `**Result:** \`${rounded}\`\n\n**Work:**\n\n\`\`\`\n${String(candidate).trim()} = ${rounded}\n\`\`\`\n\nOrder of operations used: parentheses → exponents → multiplication/division → addition/subtraction.`,
      strategy: 'math.expression',
    };
  }
  return null;
}

function buildCodeAnswer (question, sources) {
  const templates = matchCodeTemplates(question, { limit: 2 });
  if (!templates.length) return null;

  const parts = [];
  const [primary, secondary] = templates;

  parts.push(`### ${primary.title}`);
  parts.push('');
  parts.push('```' + languageTag(primary) + '\n' + primary.code + '\n```');
  parts.push('');
  parts.push('**Why this works**');
  parts.push('');
  primary.notes.forEach((note) => parts.push(`- ${note}`));

  if (secondary) {
    parts.push('');
    parts.push(`<details><summary>Related example: ${secondary.title}</summary>`);
    parts.push('');
    parts.push('```' + languageTag(secondary) + '\n' + secondary.code + '\n```');
    parts.push('');
    secondary.notes.forEach((note) => parts.push(`- ${note}`));
    parts.push('');
    parts.push('</details>');
  }

  const webRefs = sources
    .filter((source) => source.url && /(stackoverflow|mdn|developer\.mozilla|github|w3schools|docs\.)/i.test(source.url))
    .slice(0, 3);
  if (webRefs.length) {
    parts.push('');
    parts.push('**Further reading**');
    parts.push('');
    webRefs.forEach((source) => parts.push(`- [${truncate(source.title, 110)}](${source.url})`));
  }

  return { content: parts.join('\n'), strategy: 'code.template' };
}

const languageTag = (template) => {
  const first = template.languages[0];
  const map = { javascript: 'javascript', python: 'python', sql: 'sql', css: 'css', vue: 'html', react: 'jsx', typescript: 'typescript', git: 'bash', docker: 'dockerfile' };
  return map[first] || (first === 'docker' ? 'dockerfile' : 'text');
};

function buildDocumentAnswer (question, documents, history) {
  if (!documents.length) return null;
  const corpus = documents.map((doc) => ({ ...doc }));
  const queryTokens = contentTokens([...new Set(tokenize(`${question} ${history.at(-1) || ''}`))]);

  const scored = [];
  for (const doc of corpus) {
    const sentences = splitSentences(doc.content);
    const local = scoreSentences(sentences, queryTokens, { sourceScore: 0.7 });
    local.forEach((entry, index) => scored.push({ ...entry, where: doc.where, index }));
  }
  if (!scored.length) {
    const fallback = truncate(corpus[0].content, 1400);
    return { content: `**Document excerpt**\n\n${fallback}`, strategy: 'documents.fallback' };
  }

  const lead = pickTop(scored, { limit: 2, minScore: 0.1 });
  const points = pickTop(scored, { limit: 6, seen: lead, minScore: 0.22 });

  const parts = [];
  parts.push('**Summary**');
  parts.push('');
  parts.push(lead.map((entry) => entry.sentence).join(' '));
  if (points.length) {
    parts.push('');
    parts.push('**Key points**');
    parts.push('');
    const seenPhrases = new Set();
    for (const entry of points) {
      const key = entry.sentence.slice(0, 60).toLowerCase();
      if (seenPhrases.has(key)) continue;
      seenPhrases.add(key);
      parts.push(`- ${entry.sentence} _(${entry.where})_`);
    }
  }
  return { content: parts.join('\n'), strategy: 'documents.extractive' };
}

function buildNewsAnswer (sources) {
  const news = sources
    .filter((source) => source.url)
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
    .slice(0, 8);
  if (!news.length) return null;

  const parts = ['**Recent stories I could verify right now**', ''];
  news.forEach((source, index) => {
    const domain = (() => { try { return new URL(source.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
    const meta = [source.publishedAt, domain].filter(Boolean).join(' · ');
    parts.push(`${index + 1}. **[${truncate(source.title, 120)}](${source.url})**`);
    if (source.content) parts.push(`   ${truncate(source.content, 220)}`);
    if (meta) parts.push(`   _${meta}_`);
    parts.push('');
  });
  parts.push(`_Live coverage is time-sensitive (${CURRENT_DATE}). Open a story for the full context._`);
  return { content: parts.join('\n').trim(), strategy: 'news.headlines' };
}

function buildSynthesisAnswer (question, sources, history, intent) {
  if (!sources.length) return null;

  const expandedQuery = `${question} ${(history.at(-1) || '').slice(0, 160)}`;
  const queryTokens = contentTokens([...new Set(tokenize(expandedQuery))]);
  const scored = [];
  const perSource = [];

  // For "who is X" questions, restrict to sources whose title IS the subject
  // (drops "Hans Albert Einstein", "Einstein College of Medicine", ...).
  let pool = sources;
  if (intent === 'person' && queryTokens.length) {
    const key = [...queryTokens].sort().join(' ');
    const exactTitleSources = sources.filter((source) => {
      const titleTokens = contentTokens(tokenize(source.title));
      return titleTokens.length && [...titleTokens].sort().join(' ') === key;
    });
    if (exactTitleSources.length) pool = exactTitleSources;
  }

  // Drop one-line entity cards ("X. company from Y.") when full articles exist —
  // they otherwise outrank real content through sheer term overlap.
  const substantive = pool.filter((source) => (source.content || '').length >= 240);
  if (substantive.length >= 2) pool = substantive;

  for (const source of pool) {
    const sentences = splitSentences(source.content);
    const titleTokens = contentTokens(tokenize(source.title));
    const local = scoreSentences(sentences, queryTokens, { sourceScore: source.score ?? 0.5, titleTokens });
    local.forEach((entry) => scored.push({ ...entry, sourceId: source.id, source }));
    perSource.push({ source, sentences });
  }
  if (!scored.length) {
    // Fall back to source snippets when content is too short to split.
    const snippets = sources.slice(0, 4).filter((source) => source.content || snippetFallback(source));
    if (!snippets.length) return null;
    const parts = ['**Answer**', ''];
    snippets.forEach((source) => parts.push(`- ${truncate(source.content || source.title, 300)} [${source.id}]`));
    return { content: parts.join('\n'), strategy: 'synthesis.snippets' };
  }

  const lead = pickTop(scored, { limit: 2, minScore: 0.12 });
  const keyPoints = pickTop(scored, { limit: 6, seen: lead, minScore: 0.24 });
  const details = pickTop(scored, { limit: 4, seen: [...lead, ...keyPoints], minScore: 0.3 });
  // Safety net: never emit an empty "Short answer".
  if (!lead.length && keyPoints.length) lead.push(...keyPoints.splice(0, 2));

  const cite = (entry) => `${entry.sentence} [${entry.sourceId}]`;
  const parts = [];

  if (intent === 'compare') {
    const entities = extractCompareEntities(question);
    parts.push('**Short answer**');
    parts.push('');
    parts.push(lead.map(cite).join(' '));
    if (entities) {
      const entityRe = entities.map((entity) => new RegExp(`\\b${escapeRegExp(entity)}\\b`, 'i'));
      // Prefer sentences FROM the entity's own article (title match) over
      // incidental mentions in unrelated disambiguation entries.
      const fromEntitySource = (entry) => entityRe.some((re) => re.test(entry.source?.title || ''));
      const column = (entityIndex) => {
        const entity = entities[entityIndex];
        const entityRe = new RegExp(`\\b${escapeRegExp(entity)}\\b`, 'i');
        const entityLeads = (title) => title.toLowerCase().startsWith(entity.toLowerCase());
        const own = scored
          .filter((entry) => entityRe.test(entry.source?.title || ''))
          .filter((entry) => !['list', 'timeline', 'disambiguation'].some((word) => (entry.source?.title || '').toLowerCase().includes(word)))
          // Prefer articles actually ABOUT the entity: title leads with it, or
          // it is a long-form article (drops "Saturn Vue" one-liner cards).
          .filter((entry) => entityLeads(entry.source?.title || '') || (entry.source?.content || '').length >= 400)
          .map((entry) => ({ ...entry, score: entry.score + (entityLeads(entry.source?.title || '') ? 0.25 : 0) }))
          .sort((a, b) => b.score - a.score);
        const anyOwn = scored
          .filter((entry) => entityRe.test(entry.source?.title || ''))
          .sort((a, b) => b.score - a.score);
        const fallback = scored.filter((entry) => entityRe.test(entry.sentence)).sort((a, b) => b.score - a.score);
        const chosen = own.length ? own : (anyOwn.length ? anyOwn : fallback);
        return pickTop(chosen, { limit: 3, minScore: 0.1 });
      };
      const firstPoints = column(0);
      const secondPoints = column(1);
      const shared = keyPoints.filter((entry) => !fromEntitySource(entry)).slice(0, 3);
      if (firstPoints.length || secondPoints.length) {
        parts.push('');
        parts.push('**Side by side**');
        parts.push('');
        parts.push(`| ${truncate(entities[0], 30)} | ${truncate(entities[1], 30)} |`);
        parts.push('|---|---|');
        const rows = Math.max(firstPoints.length, secondPoints.length);
        for (let index = 0; index < rows; index += 1) {
          const left = firstPoints[index] ? truncate(firstPoints[index].sentence, 140) : '—';
          const right = secondPoints[index] ? truncate(secondPoints[index].sentence, 140) : '—';
          parts.push(`| ${left} | ${right} |`);
        }
        if (shared.length) {
          parts.push('');
          parts.push('**Common ground**');
          parts.push('');
          for (const entry of shared) parts.push(`- ${cite(entry)}`);
        }
      }
    }
  } else {
    parts.push('**Short answer**');
    parts.push('');
    parts.push(lead.map(cite).join(' '));
  }

  if (keyPoints.length) {
    parts.push('');
    parts.push('**Key points**');
    parts.push('');
    for (const entry of keyPoints) parts.push(`- ${cite(entry)}`);
  }

  if (details.length && intent !== 'news') {
    parts.push('');
    parts.push('**More detail**');
    parts.push('');
    for (const entry of details) parts.push(cite(entry));
  }

  if (intent === 'person') {
    const used = new Set([...lead, ...keyPoints, ...details].map((entry) => entry.sentence));
    const dates = scored
      .map((entry) => entry.sentence)
      .filter((sentence) => !used.has(sentence))
      .filter((sentence) => /\b(born|died|18\d\d|19\d\d|20\d\d)\b/i.test(sentence))
      .slice(0, 3);
    if (dates.length) {
      parts.push('');
      parts.push('**Key facts**');
      parts.push('');
      for (const sentence of [...new Set(dates)].slice(0, 3)) {
        const source = scored.find((entry) => entry.sentence === sentence);
        parts.push(`- ${sentence}${source ? ` [${source.sourceId}]` : ''}`);
      }
    }
  }

  parts.push('');
  parts.push(`_Compiled from ${new Set(lead.concat(keyPoints, details).map((entry) => entry.sourceId)).size} cited source(s) — open **Sources** for links._`);

  return { content: parts.join('\n').trim(), strategy: 'synthesis.extractive' };
}

const snippetFallback = (source) => source.title;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function extractCompareEntities (question) {
  const match = String(question).match(/compare\s+(.+?)\s+(?:and|vs\.?|versus)\s+(.+?)(?:\?|$)/i)
    || String(question).match(/(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:\?|$)/i)
    || String(question).match(/difference between\s+(.+?)\s+and\s+(.+?)(?:\?|$)/i);
  if (!match) return null;
  const clean = (value) => value.replace(/[?.!,]/g, '').trim().split(/\s+/).slice(0, 3).join(' ');
  return [clean(match[1]), clean(match[2])];
}

function buildGreetingAnswer (question) {
  const q = String(question).toLowerCase().trim();
  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(q)) {
    return {
      content: [
        'Hello! I am **NovaAI** — ask me anything: explanations, comparisons, code, math, documents or current topics.',
        '',
        '- Need **live information**? I search open sources and cite them.',
        '- Need **code**? You get complete, runnable examples.',
        '- Have a **PDF / DOCX / CSV**? Upload it and ask questions about it.',
      ].join('\n'),
      strategy: 'greeting',
    };
  }
  if (/who are you|what can you do|what are you/.test(q)) {
    return {
      content: [
        'I am **NovaAI**, an answer engine that combines model knowledge with live retrieval:',
        '',
        '1. **Understand** your question (intent, complexity, mode).',
        '2. **Retrieve** from open sources — Wikipedia, Wikidata, DuckDuckGo, Stack Overflow, MDN, arXiv and more — or from your uploaded documents.',
        '3. **Rank & synthesise** an answer with inline citations [n] and a Sources panel.',
        '4. **Route** to the strongest available model when AI keys are configured.',
        '',
        'Try: *"Explain JavaScript promises"*, *"What happened in tech news today?"*, *"Solve 12x² + 7x − 10 = 0"* or upload a document and ask about it.',
      ].join('\n'),
      strategy: 'greeting',
    };
  }
  return null;
}

const OFFLINE_FALLBACK = (question) => [
  `I could not verify an answer to **${truncate(String(question), 120)}** from the available sources just now.`,
  '',
  'That happens when external knowledge services are unreachable from this server (offline environment or network restrictions). What I will not do is invent an answer.',
  '',
  '**Ways to get a full answer:**',
  '',
  '- Configure a search key (`SEARCH_PROVIDER=tavily|brave|serper`) for live web results.',
  '- Configure an AI key (`AI_PROVIDER=openai|anthropic|gemini`) for generative synthesis.',
  '- Check connectivity: the open-source connectors (Wikipedia, DuckDuckGo, Stack Overflow) need outbound HTTPS access.',
].join('\n');

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * @returns {{content: string, strategy: string, sourcesUsed: number}}
 */
export function buildGroundedAnswer ({ question, sources = [], documents = [], history = [], mode = 'AUTO' }) {
  const classification = classify(question);

  // 1) greeting / meta questions (no retrieval needed)
  const greeting = buildGreetingAnswer(question);
  if (greeting) return { ...greeting, sourcesUsed: 0 };

  // Guarantee stable citation ids even when callers pass raw retrieval results.
  const withIds = (list) => list.map((item, index) => ({ ...item, id: item.id ?? index + 1 }));
  const usableSources = withIds(sources.filter((source) => !source.synthetic));
  const indexedDocuments = withIds(documents);

  // 2) math — computed, exact
  if (classification.wantsMath || isPercentQuestion(question)) {
    const math = buildMathAnswer(question);
    if (math) return { ...math, sourcesUsed: usableSources.length };
  }

  // 3) uploaded documents (RAG) — exclusive when the user asked about them
  //    or explicitly chose DOCUMENTS mode; otherwise normal synthesis applies.
  const docWanted = indexedDocuments.length && (mode === 'DOCUMENTS' || classification.isDoc);
  if (docWanted) {
    const docAnswer = buildDocumentAnswer(question, indexedDocuments, history);
    if (docAnswer) return { ...docAnswer, sourcesUsed: indexedDocuments.length };
  }

  // 4) code — verified templates (+ references from web sources)
  if (classification.wantsCode) {
    const codeAnswer = buildCodeAnswer(question, usableSources);
    if (codeAnswer) return { ...codeAnswer, sourcesUsed: usableSources.length };
  }

  // 5) news / current topics
  if (classification.isNews) {
    const news = buildNewsAnswer(usableSources);
    if (news) return { ...news, sourcesUsed: usableSources.length };
  }

  // 6) general extractive synthesis over cited sources
  const synthesis = buildSynthesisAnswer(question, usableSources, history, classification.intent);
  if (synthesis) return { ...synthesis, sourcesUsed: usableSources.length };

  // 7) honest fallback (never fabricate)
  return { content: OFFLINE_FALLBACK(question), strategy: 'fallback', sourcesUsed: 0 };
}

/** Rough token estimate used for logging/limits. */
export const estimateAnswerTokens = (content) => estimateTokens(content);

export default { buildGroundedAnswer, classify, parseContext, contentTokens, extractCompareEntities, CURRENT_DATE };
export { contentTokens };
