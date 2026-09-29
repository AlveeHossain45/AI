/**
 * Rough price tables (USD per 1M tokens) used ONLY for admin cost estimates.
 * Prices change over time — update as needed or set COST_TABLE_JSON to override.
 */

const DEFAULT_PRICES = {
  openai: {
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4.1-mini': { input: 0.4, output: 1.6 },
    'gpt-4.1': { input: 2, output: 8 },
    'gpt-4.1-nano': { input: 0.1, output: 0.4 },
    'o3-mini': { input: 1.1, output: 4.4 },
    'o4-mini': { input: 1.1, output: 4.4 },
    'text-embedding-3-small': { input: 0.02, output: 0 },
    'text-embedding-3-large': { input: 0.13, output: 0 },
    default: { input: 0.5, output: 1.5 },
  },
  anthropic: {
    'claude-3-5-haiku': { input: 0.8, output: 4 },
    'claude-3-5-sonnet': { input: 3, output: 15 },
    'claude-3-7-sonnet': { input: 3, output: 15 },
    'claude-sonnet-4': { input: 3, output: 15 },
    'claude-opus-4': { input: 15, output: 75 },
    default: { input: 3, output: 15 },
  },
  gemini: {
    'gemini-1.5-flash': { input: 0.075, output: 0.3 },
    'gemini-1.5-pro': { input: 1.25, output: 5 },
    'gemini-2.0-flash': { input: 0.1, output: 0.4 },
    'gemini-2.5-flash': { input: 0.3, output: 2.5 },
    'gemini-2.5-pro': { input: 1.25, output: 10 },
    default: { input: 0.5, output: 2 },
  },
  mock: { default: { input: 0, output: 0 } },
};

let prices = DEFAULT_PRICES;
try {
  if (process.env.COST_TABLE_JSON) prices = { ...DEFAULT_PRICES, ...JSON.parse(process.env.COST_TABLE_JSON) };
} catch {
  // keep defaults when the override is malformed
}

export const estimateCost = (provider, model = '', usage = {}) => {
  const table = prices[provider] || prices.mock || { default: { input: 0, output: 0 } };
  const modelKey = Object.keys(table).find((key) => key !== 'default' && String(model).toLowerCase().includes(key.toLowerCase()));
  const rate = table[modelKey || 'default'] || { input: 0, output: 0 };
  const prompt = usage.promptTokens || 0;
  const completion = usage.completionTokens || 0;
  return Number(((prompt / 1_000_000) * rate.input + (completion / 1_000_000) * rate.output).toFixed(6));
};

export default { estimateCost };
