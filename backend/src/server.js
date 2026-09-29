/**
 * Server entry point: database bootstrap + HTTP server + graceful shutdown.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import config from './config/index.js';
import logger from './utils/logger.js';
import { initDatabase, disconnectDatabase, dbMode } from './db/index.js';
import { createApp } from './app.js';
import { getEmbeddingProvider } from './providers/embeddings/index.js';

async function main () {
  const mode = await initDatabase();
  const app = createApp();

  // Bind with explicit error handling so port conflicts show guidance, not a stack trace.
  let server;
  try {
    server = await new Promise((resolve, reject) => {
      const instance = app.listen(config.port, () => resolve(instance));
      instance.once('error', reject);
    });
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      logger.error(
        `Port ${config.port} is already in use. Stop the other process ` +
        `(Windows: Get-NetTCPConnection -LocalPort ${config.port} | ForEach-Object { Stop-Process -Id $_.OwningProcess }) ` +
        `or start with a different port: PORT=4001 npm run dev`
      );
      process.exit(1);
    }
    logger.error('Failed to start HTTP server', error);
    process.exit(1);
  }

  logger.info(`NovaAI API listening on http://localhost:${config.port} (${config.env}, db=${mode})`);
  if (mode === 'memory') {
    logger.warn('Running with the in-memory datastore: data is not persisted. Configure DATABASE_URL for production.');
  }
  try {
    const embedder = getEmbeddingProvider();
    logger.info(`Embeddings: ${embedder.name} (${embedder.model}, ${embedder.dimensions}d)`);
  } catch (error) {
    logger.warn(`Embeddings unavailable: ${error.message}`);
  }

  // Streaming responses must not be cut off by default timeouts.
  server.requestTimeout = config.limits.streamTimeoutMs + 60_000;
  server.headersTimeout = 65_000;

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', reason));
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    process.exit(1);
  });
}

// Only start the HTTP server when executed directly (not when imported by tests/tools).
const invokedDirectly = Boolean(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href);
if (invokedDirectly) {
  main().catch((error) => {
    logger.error('Failed to start NovaAI backend', error);
    process.exit(1);
  });
}
