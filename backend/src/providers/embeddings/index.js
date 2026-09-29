/**
 * Embedding provider abstraction: openai (real) | mock (deterministic local).
 * The mock produces stable pseudo-random unit vectors so RAG works offline;
 * vectors are only comparable when produced by the same provider/model.
 */
import crypto from 'node:crypto';
import config from '../../config/index.js';
import { requestJson } from '../../utils/http.js';
import { upstreamError } from '../../utils/errors.js';
import { estimateTokens } from '../../utils/text.js';

/** Deterministic bag-of-words hashing embedding (dev/demo only). */
function mockEmbed (text, dimensions) {
  const vector = new Array(dimensions).fill(0);
  const tokens = String(text).toLowerCase().match(/[a-z0-9]+/g) || [];
  for (const token of tokens) {
    const digest = crypto.createHash('sha256').update(token).digest();
    for (let i = 0; i < dimensions; i += 1) {
      const byte = digest[i % digest.length];
      vector[i] += ((byte / 255) * 2 - 1) * (1 / Math.sqrt(tokens.length || 1));
    }
  }
  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm) || 1;
  return vector.map((value) => value / norm);
}

class MockEmbeddingProvider {
  constructor () {
    this.name = 'mock';
    this.model = 'novaai-hash-embedding';
    this.dimensions = config.embedding.dimensions;
  }

  isAvailable () {
    return config.features.enableMockProviders;
  }

  async embed (texts) {
    return texts.map((text) => mockEmbed(text, this.dimensions));
  }
}

class OpenAiEmbeddingProvider {
  constructor () {
    this.name = 'openai';
    this.model = config.embedding.model;
    this.dimensions = config.embedding.dimensions;
  }

  isAvailable () {
    return Boolean(config.ai.openaiApiKey);
  }

  async embed (texts) {
    const baseUrl = (config.ai.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const body = { model: this.model, input: texts };
    if (config.embedding.model.includes('text-embedding-3')) body.dimensions = this.dimensions;
    const data = await requestJson(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ai.openaiApiKey}` },
      body: JSON.stringify(body),
    });
    const rows = (data.data || []).sort((a, b) => a.index - b.index);
    return rows.map((row) => row.embedding);
  }
}

let cached = null;

export function getEmbeddingProvider () {
  if (cached) return cached;
  if (config.embedding.provider === 'openai') {
    const provider = new OpenAiEmbeddingProvider();
    if (provider.isAvailable()) {
      cached = provider;
      return cached;
    }
  }
  const mock = new MockEmbeddingProvider();
  if (mock.isAvailable()) {
    cached = mock;
    return cached;
  }
  throw upstreamError('No embedding provider is configured. Set EMBEDDING_PROVIDER and API keys.');
}

export function resetEmbeddingProvider () {
  cached = null;
}

export const embeddingInfo = () => {
  try {
    const provider = getEmbeddingProvider();
    return { provider: provider.name, model: provider.model, dimensions: provider.dimensions };
  } catch {
    return null;
  }
};

export const estimateEmbeddingTokens = estimateTokens;
export default { getEmbeddingProvider, resetEmbeddingProvider, embeddingInfo };
