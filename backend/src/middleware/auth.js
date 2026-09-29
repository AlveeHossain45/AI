/**
 * Authentication middleware: JWT in httpOnly cookie (preferred) or
 * Authorization: Bearer header (API clients).
 */
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { unauthorized, forbidden, serviceUnavailable } from '../utils/errors.js';
import { asyncHandler } from '../utils/crypto.js';
import { userRepo } from '../repositories/userRepo.js';
import { isMemory } from '../db/index.js';

export function signToken (user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn,
  });
}

export function setAuthCookie (res, token) {
  res.cookie(config.auth.cookieName, token, {
    httpOnly: true,
    secure: config.auth.cookieSecure,
    sameSite: config.auth.cookieSameSite || 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie (res) {
  res.clearCookie(config.auth.cookieName, { path: '/' });
}

function extractToken (req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies?.[config.auth.cookieName]) return req.cookies[config.auth.cookieName];
  return null;
}

export async function loadUser (req) {
  const token = extractToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.auth.jwtSecret);
    const user = await userRepo.findById(payload.sub);
    if (!user || user.isSuspended) return null;
    return user;
  } catch {
    return null;
  }
}

export const attachUser = asyncHandler(async (req, res, next) => {
  req.user = await loadUser(req);
  next();
});

export const requireAuth = asyncHandler(async (req, res, next) => {
  if (isMemory() && !req.user) {
    // Still allow auth flows in memory mode (register/login create users).
  }
  const user = req.user || (await loadUser(req));
  if (!user) throw unauthorized('Please sign in to continue.');
  req.user = user;
  next();
});

export const requireAdmin = asyncHandler(async (req, res, next) => {
  const user = req.user || (await loadUser(req));
  if (!user) throw unauthorized('Please sign in to continue.');
  if (user.role !== 'ADMIN') throw forbidden('Administrator access is required.');
  req.user = user;
  next();
});

export const optionalAuth = asyncHandler(async (req, res, next) => {
  req.user = req.user || (await loadUser(req));
  next();
});

export const assertDatabaseReady = (req, res, next) => {
  void req;
  void res;
  void next;
  // Kept for clarity: repositories transparently fall back to the memory store
  // in development, so auth works even before PostgreSQL is configured.
  if (!config.db.url) return next();
  next();
};

export const assertServiceReady = () => {
  if (isMemory() && config.isProduction) throw serviceUnavailable('Database unavailable.');
};

export default { signToken, setAuthCookie, clearAuthCookie, requireAuth, requireAdmin, optionalAuth, attachUser };
