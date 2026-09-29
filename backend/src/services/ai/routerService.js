/**
 * Smart model routing: maps task characteristics to a configured model.
 * All model names come from environment settings — nothing is hard-coded
 * for a specific provider, so any provider/model combination works.
 */
import config from '../../config/index.js';

/**
 * @param {{intent?:string, complexity?:string, task?:string, mode?:string, contextTokens?:number}} profile
 * @returns {{model: string|null, reason: string}}
 */
export function routeModel (profile = {}) {
  const { complexity = 'simple', task = 'chat', mode = 'AUTO', contextTokens = 0, intent = 'general' } = profile;
  const strongThreshold = Math.max(config.limits.contextMaxTokens * 0.75, 4000);

  if (mode === 'DEEP' || intent === 'research') {
    if (config.ai.strongModel) return { model: config.ai.strongModel, reason: 'deep-research' };
  }
  if (contextTokens > strongThreshold && config.ai.longContextModel) {
    return { model: config.ai.longContextModel, reason: 'long-context' };
  }
  if (task === 'code' && config.ai.codingModel) {
    return { model: config.ai.codingModel, reason: 'coding' };
  }
  if (complexity === 'complex' && config.ai.strongModel) {
    return { model: config.ai.strongModel, reason: 'complex-reasoning' };
  }
  if (complexity === 'simple' && config.ai.fastModel) {
    return { model: config.ai.fastModel, reason: 'fast' };
  }
  if (config.ai.model) return { model: config.ai.model, reason: 'default' };
  return { model: null, reason: 'provider-default' };
}

/** Simple output-shape guidance per task. */
export function answerStyleFor (task) {
  switch (task) {
    case 'code':
      return 'Prefer precise code blocks with a short explanation before and after. Mention language and any edge cases.';
    case 'summarize':
      return 'Produce a concise summary: 2-4 sentence overview, then key points as a bullet list.';
    case 'compare':
      return 'Use a comparison table followed by a short recommendation and the main trade-offs.';
    case 'research':
      return 'Produce a structured report: short executive summary, findings with citations, contradictions/uncertainty, and takeaways.';
    default:
      return 'Answer directly and clearly. Use short sections and lists when they improve readability.';
  }
}

export default { routeModel, answerStyleFor };
