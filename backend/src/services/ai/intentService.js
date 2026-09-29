/**
 * Intent detection + query understanding + retrieval decision.
 *
 * Runs heuristic analysis first (fast, free, deterministic). When a real AI
 * provider is configured and LLM intent detection is enabled, the model can
 * refine the classification — but heuristics always provide a safe baseline.
 */
import config from '../../config/index.js';
import { chatWithFallback } from '../../providers/ai/index.js';
import logger from '../../utils/logger.js';
import { tokenize } from '../../utils/text.js';

export const MODES = ['AUTO', 'FAST', 'DEEP', 'DOCUMENTS', 'WEB'];

const NOW_PATTERNS = /\b(today|now|latest|current|recent|this (week|month|year)|yesterday|breaking|news|tonight|updates?|20\d\d)\b/i;
const CODE_PATTERNS = /\b(code|javascript|typescript|python|function|bug|error|api|react|vue|angular|node|regex|sql|css|html|compile|debug|implement|snippet|algorithm)\b/i;
const DOC_PATTERNS = /\b(summar(y|ise|ize)|document|pdf|file|attachment|these? (documents|files)|extract|highlights?)\b/i;
const MATH_PATTERNS = /\b(solve|equation|integral|derivative|matrix|probability|theorem|calculate|\d+\s*[+\-*/^]\s*\d+)\b/i;
const COMPLEX_PATTERNS = /\b(compare|versus|vs\.?|analyz|analyse|evaluate|research|explain in depth|step by step|architecture|trade-?offs?|pros and cons|deep)\b/i;
const CONVERSATIONAL_PATTERNS = /^\s*(hi|hello|hey|thanks|thank you|who are you|what can you do)\b/i;

/**
 * @returns {{
 *   intent: 'general'|'current'|'code'|'math'|'document'|'research'|'conversation',
 *   complexity: 'simple'|'moderate'|'complex',
 *   task: 'chat'|'code'|'summarize'|'compare'|'research'|'explain',
 *   needsWeb: boolean, needsDocuments: boolean, needsKnowledge: boolean,
 *   queries: string[], signals: string[]
 * }}
 */
export function analyzeQuestion (question, { mode = 'AUTO', hasDocuments = false, documentIds = [] } = {}) {
  const q = String(question || '').trim();
  const signals = [];
  let intent = 'general';

  if (NOW_PATTERNS.test(q)) { intent = 'current'; signals.push('time-sensitive'); }
  if (CODE_PATTERNS.test(q)) { intent = intent === 'current' ? intent : 'code'; signals.push('code'); }
  if (MATH_PATTERNS.test(q)) { intent = intent === 'current' ? intent : 'math'; signals.push('math'); }
  if (DOC_PATTERNS.test(q) && hasDocuments) { intent = 'document'; signals.push('document'); }
  if (COMPLEX_PATTERNS.test(q)) { signals.push('complex'); }
  if (CONVERSATIONAL_PATTERNS.test(q)) { intent = 'conversation'; signals.push('smalltalk'); }
  if (/\b(deep research|research mode|investigate|literature review)\b/i.test(q)) { intent = 'research'; signals.push('research'); }

  let task = 'chat';
  if (intent === 'code' || /\b(write|implement|refactor|fix)\b.*\b(code|function|script|component)\b/i.test(q)) task = 'code';
  else if (/\b(summar(y|ise|ize)|tl;?dr)\b/i.test(q)) task = 'summarize';
  else if (/\b(compare|vs\.?|versus|difference)\b/i.test(q)) task = 'compare';
  else if (intent === 'research') task = 'research';
  else if (intent !== 'conversation') task = 'explain';

  const words = q.split(/\s+/).filter(Boolean).length;
  let complexity = 'simple';
  if (words > 35 || signals.includes('complex') || intent === 'research') complexity = 'complex';
  else if (words > 12 || task !== 'chat') complexity = 'moderate';

  // --- retrieval decision -------------------------------------------------
  let needsWeb = false;
  let needsDocuments = false;
  let needsKnowledge = false;

  switch (mode) {
    case 'FAST':
      needsWeb = intent === 'current';
      needsDocuments = false;
      break;
    case 'WEB':
      needsWeb = true;
      break;
    case 'DOCUMENTS':
      needsDocuments = hasDocuments;
      break;
    case 'DEEP':
      needsWeb = true;
      needsKnowledge = true;
      needsDocuments = hasDocuments;
      break;
    default: { // AUTO
      needsWeb = intent === 'current' || signals.includes('research');
      needsKnowledge = ['general', 'research', 'math'].includes(intent) && complexity !== 'simple';
      needsDocuments = hasDocuments && (DOC_PATTERNS.test(q) || documentIds.length > 0);
      break;
    }
  }

  if (intent === 'conversation') { needsWeb = false; needsKnowledge = false; }
  if (documentIds.length && (mode === 'AUTO' || mode === 'DOCUMENTS' || mode === 'DEEP')) needsDocuments = true;

  return {
    intent,
    task,
    complexity,
    needsWeb,
    needsDocuments,
    needsKnowledge,
    signals,
    documentIds,
    queries: buildQueries(q, { intent, mode }),
  };
}

/** Strips question scaffolding so searches get the core subject. */
export function coreQuery (question) {
  let value = String(question || '').trim();
  const patterns = [
    /^\s*(?:please\s+|kindly\s+)?(?:can you\s+|could you\s+|would you\s+|will you\s+)?/i,
    /^(?:tell me\s+|explain\s+|describe\s+|define\s+|give me\s+|show me\s+|find\s+|search (?:for\s+)?|look up\s+|information about\s+|let me know about\s+)/i,
    /^(?:what(?:'s| is| are| was| were)?|who(?:'s| is| was| were)?|when(?:'s| is| was)?|where(?:'s| is| was)?|why(?:'s| is| was)?|how(?:'s| does| do| did| to| can)?|which(?:'s| is| was)?)\s+/i,
    /^(?:the|a|an|some)\s+/i,
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of patterns) {
      const next = value.replace(pattern, '');
      if (next !== value) {
        value = next;
        changed = true;
      }
    }
  }
  value = value.replace(/[?.!,]+$/g, '').replace(/\s+(for me|please)\s*$/i, '').trim();
  if (value.split(/\s+/).length < 2 || value.length < 3) return String(question || '').replace(/[?]+$/g, '').trim();
  return value;
}

/** Build optimized search queries (core subject + rewrites for specific intents). */
export function buildQueries (question, { intent = 'general', mode = 'AUTO' } = {}) {
  const base = coreQuery(question);
  const queries = [base || String(question).slice(0, 160)];

  if (intent === 'current') {
    const year = new Date().getFullYear();
    queries.push(`${base} ${year} news`);
  }
  if (mode === 'DEEP') {
    const tokens = tokenize(base).slice(0, 6).join(' ');
    if (tokens && tokens.toLowerCase() !== base.toLowerCase()) queries.push(tokens);
    queries.push(`${base} overview`);
  }
  return [...new Set(queries.filter(Boolean))].slice(0, config.research.maxSubqueries);
}

/**
 * Optional LLM-assisted classification (enabled with INTENT_DETECTION=llm).
 * Falls back to heuristics on any failure.
 */
export async function refineIntentWithLlm (question, baseline, { signal } = {}) {
  if (process.env.INTENT_DETECTION !== 'llm') return baseline;
  try {
    const { result } = await chatWithFallback(
      [
        {
          role: 'user',
          content:
            'Classify this question. Respond with JSON only: {"intent":"general|current|code|math|document|research|conversation",' +
            '"complexity":"simple|moderate|complex","needsWeb":boolean,"needsDocuments":boolean}. ' +
            `Question: ${JSON.stringify(String(question).slice(0, 800))}`,
        },
      ],
      { json: true, maxTokens: 200, temperature: 0, signal }
    );
    const match = result.content.match(/\{[\s\S]*\}/);
    if (!match) return baseline;
    const parsed = JSON.parse(match[0]);
    return {
      ...baseline,
      intent: typeof parsed.intent === 'string' ? parsed.intent : baseline.intent,
      complexity: typeof parsed.complexity === 'string' ? parsed.complexity : baseline.complexity,
      needsWeb: typeof parsed.needsWeb === 'boolean' ? parsed.needsWeb : baseline.needsWeb,
      needsDocuments: typeof parsed.needsDocuments === 'boolean' ? parsed.needsDocuments : baseline.needsDocuments,
      signals: [...new Set([...baseline.signals, 'llm-classified'])],
    };
  } catch (error) {
    logger.debug(`LLM intent refinement failed: ${error.message}`);
    return baseline;
  }
}

export const isResearchMode = (mode) => mode === 'DEEP';
export default { analyzeQuestion, buildQueries, refineIntentWithLlm, MODES };
