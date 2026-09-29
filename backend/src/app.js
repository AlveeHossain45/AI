/**
 * Express application assembly.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';

import config from './config/index.js';
import apiRouter from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { originCheck, maintenanceGate, privacyHeaders } from './middleware/security.js';
import { attachUser } from './middleware/auth.js';
import { dbMode } from './db/index.js';
import { getAiProvider } from './providers/ai/index.js';
import { getSearchProvider } from './providers/search/index.js';
import logger from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, '../../frontend/dist');

const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];

export function createApp () {
  const app = express();

  app.set('trust proxy', config.trustProxy ? 1 : false);
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: false, // API serves JSON; the SPA ships its own headers
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(
    cors({
      origin (origin, callback) {
        if (!origin) return callback(null, true);
        const allowed = new Set([config.clientUrl, ...DEV_ORIGINS]);
        callback(null, allowed.has(origin));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );
  app.use(compression());
  app.use(express.json({ limit: config.limits.bodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: config.limits.bodyLimit }));
  app.use(cookieParser());
  app.use(privacyHeaders);
  app.use(attachUser);

  // Health / status (no auth, excluded from rate limiting)
  app.get('/api/health', (req, res) => {
    void req;
    let ai = null;
    let search = null;
    try { ai = getAiProvider().name; } catch { ai = null; }
    try { search = getSearchProvider()?.name || null; } catch { search = null; }
    res.json({
      status: 'ok',
      name: 'NovaAI',
      version: '1.0.0',
      env: config.env,
      uptimeSec: Math.round(process.uptime()),
      database: dbMode(),
      providers: { ai, search },
      demo: ai === 'mock',
      time: new Date().toISOString(),
    });
  });

  app.use('/api', globalLimiter);
  app.use(originCheck);
  app.use(maintenanceGate);
  app.use('/api', apiRouter);
  app.use('/api', notFoundHandler);

  // Serve the built frontend when present (single-server production deploy).
  if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist, { maxAge: '1h', index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else if (config.isProduction) {
    logger.warn('Frontend build not found — API-only mode. Run `npm run build` to serve the UI.');
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
