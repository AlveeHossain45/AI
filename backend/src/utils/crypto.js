import crypto from 'node:crypto';

/** Wrap async route handlers so rejected promises reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Random URL-safe token. */
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

/** SHA-256 hex digest (used to store token hashes instead of raw tokens). */
export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

/** Constant-time string comparison. */
export const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

export const uuid = () => crypto.randomUUID();

export default { asyncHandler, randomToken, sha256, safeEqual, uuid };
