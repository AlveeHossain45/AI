/**
 * Rate limiting: global, authentication and chat-specific buckets.
 * Keys are per-user when authenticated, otherwise per-IP.
 */
import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import { rateLimited } from '../utils/errors.js';

const keyFor = (req) => req.user?.id || req.ip || 'anonymous';

const sendLimited = (req, res) => {
  res.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please wait a moment and try again.',
    },
  });
};

export const globalLimiter = rateLimit({
  windowMs: config.limits.rateWindowMs,
  max: config.limits.rateMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyFor,
  handler: sendLimited,
  skip: (req) => req.path === '/api/health',
});

export const authLimiter = rateLimit({
  windowMs: config.limits.authWindowMs,
  max: config.limits.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'anonymous',
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Please wait a few minutes and try again.',
      },
    });
  },
});

export const chatLimiter = rateLimit({
  windowMs: config.limits.chatWindowMs,
  max: config.limits.chatMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyFor,
  handler: sendLimited,
});

export const uploadLimiter = rateLimit({
  windowMs: config.limits.rateWindowMs,
  max: Math.max(10, Math.floor(config.limits.rateMax / 4)),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyFor,
  handler: sendLimited,
});

export { rateLimited };
export default { globalLimiter, authLimiter, chatLimiter, uploadLimiter };
