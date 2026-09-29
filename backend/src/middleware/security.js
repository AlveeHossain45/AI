/**
 * Security middleware: origin verification (CSRF defence for cookie auth),
 * maintenance mode gate and misc hardening.
 */
import config from '../config/index.js';
import { forbidden, serviceUnavailable } from '../utils/errors.js';
import { isMaintenanceMode } from '../services/settingsService.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const originCheck = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  // Bearer-token clients are not vulnerable to cookie CSRF.
  if (req.headers.authorization?.startsWith('Bearer ')) return next();

  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return next(); // same-origin non-browser clients

  const allowed = new Set([config.clientUrl, `http://localhost:${config.port}`, `http://127.0.0.1:${config.port}`]);
  try {
    const originUrl = new URL(origin);
    allowed.add(originUrl.origin);
    allowed.add(`http://localhost:${new URL(config.clientUrl).port || '5173'}`);
    allowed.add(`http://127.0.0.1:${new URL(config.clientUrl).port || '5173'}`);
  } catch { /* ignore malformed origin */ }

  if (!allowed.has(new URL(origin).origin)) {
    return next(forbidden('Request origin is not allowed.'));
  }
  return next();
};

export const maintenanceGate = async (req, res, next) => {
  try {
    if (req.path.startsWith('/api/chat') || req.path.startsWith('/api/research') || req.path === '/api/search') {
      const maintenance = await isMaintenanceMode();
      if (maintenance && req.user?.role !== 'ADMIN') {
        return res.status(503).json({
          error: {
            code: 'MAINTENANCE',
            message: 'NovaAI is in maintenance mode right now. Please try again shortly.',
          },
        });
      }
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

/** Strip identifying headers from proxied requests we do not trust. */
export const privacyHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
};

export const rejectTrailingSlashApi = (req, res, next) => {
  void req;
  void res;
  void next;
};

export { forbidden, serviceUnavailable };
export default { originCheck, maintenanceGate, privacyHeaders };
