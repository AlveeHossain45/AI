/**
 * AI provider registry with graceful fallback.
 *
 * Resolution order:
 *   1. configured provider (AI_PROVIDER) when its credentials exist
 *   2. any other credential-backed provider
 *   3. GroundedProvider — a real retrieval-synthesis engine (no key needed)
 *   4. MockAIProvider — clearly-labelled stub (development only)
 *   5. friendly 503 error
 */
import config from '../../config/index.js';
import { serviceUnavailable } from '../../utils/errors.js';
import logger from '../../utils/logger.js';
import { OpenAiProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GeminiProvider } from './gemini.js';
import { GroundedProvider } from './grounded.js';
import { MockAiProvider } from './mock.js';

const registry = {
  openai: new OpenAiProvider(),
  anthropic: new AnthropicProvider(),
  gemini: new GeminiProvider(),
};

export const groundedProvider = new GroundedProvider();
export const mockProvider = new MockAiProvider();

const GENERATIVE = new Set(['openai', 'anthropic', 'gemini']);

let resolved = null;
let resolvedName = null;

export const availableAiProviders = () =>
  [
    ...Object.values(registry).filter((provider) => provider.isAvailable()),
    groundedProvider,
    ...(mockProvider.isAvailable() ? [mockProvider] : []),
  ].map((provider) => ({ id: provider.name, label: provider.label }));

/** Returns the best AI provider instance given current configuration. */
export function getAiProvider () {
  if (resolved) return resolved;

  if (config.ai.provider === 'mock') {
    if (mockProvider.isAvailable()) {
      resolved = mockProvider;
      resolvedName = resolved.name;
      return resolved;
    }
    logger.warn('AI_PROVIDER=mock requested but mock providers are disabled; using the grounded engine.');
  }

  const preferred = registry[config.ai.provider];
  if (preferred?.isAvailable()) {
    resolved = preferred;
  } else {
    if (config.ai.provider !== 'mock' && config.ai.provider !== 'grounded' && registry[config.ai.provider]) {
      logger.warn(`AI provider "${config.ai.provider}" is not configured (missing API key). Trying fallbacks.`);
    }
    const fallback = Object.values(registry).find((provider) => provider.isAvailable());
    if (fallback) {
      resolved = fallback;
    } else {
      // Real answers without any LLM key: retrieval + verified templates.
      resolved = groundedProvider;
      logger.info('AI: using the grounded answer engine (retrieval + verified templates; no LLM key configured).');
    }
  }
  resolvedName = resolved.name;
  return resolved;
}

/** True when a credential-backed generative model will answer. */
export function isGenerativeAiAvailable () {
  const provider = getAiProvider();
  return GENERATIVE.has(provider.name);
}

export const getAiProviderById = (name) => {
  if (name === 'grounded') return groundedProvider;
  if (name === 'mock') return mockProvider;
  return registry[String(name).toLowerCase()] || null;
};
export const activeAiProviderName = () => resolvedName || config.ai.provider;

/** Reset cached provider (used by admin settings updates and tests). */
export function resetAiProvider () {
  resolved = null;
  resolvedName = null;
}

/**
 * Run a non-chat completion with fallback across configured providers.
 * Returns { result, provider } of the first provider that succeeds.
 */
export async function chatWithFallback (messages, options = {}) {
  const chain = [];
  const primary = getAiProvider();
  chain.push(primary);
  for (const provider of Object.values(registry)) {
    if (provider !== primary && provider.isAvailable()) chain.push(provider);
  }
  if (!chain.includes(groundedProvider)) chain.push(groundedProvider);

  let lastError = null;
  for (const provider of chain) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await provider.chat(messages, options);
      return { result, provider: provider.name };
    } catch (error) {
      lastError = error;
      logger.warn(`AI provider ${provider.name} failed, trying next: ${error.message}`);
    }
  }
  throw lastError || serviceUnavailable('AI provider unavailable.');
}

export default {
  getAiProvider,
  getAiProviderById,
  availableAiProviders,
  resetAiProvider,
  chatWithFallback,
  activeAiProviderName,
  isGenerativeAiAvailable,
};
