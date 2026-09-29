/**
 * Application error types. Never expose stack traces to clients.
 */
export class ApiError extends Error {
  constructor (status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'Invalid request.', details) => new ApiError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Authentication required.') => new ApiError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have permission to do that.') => new ApiError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Resource not found.') => new ApiError(404, 'NOT_FOUND', message);
export const conflict = (message = 'Resource already exists.', details) => new ApiError(409, 'CONFLICT', message, details);
export const payloadTooLarge = (message = 'The payload is too large.') => new ApiError(413, 'PAYLOAD_TOO_LARGE', message);
export const unsupportedMedia = (message = 'Unsupported file type.') => new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', message);
export const rateLimited = (message = 'Too many requests. Please slow down and try again shortly.') => new ApiError(429, 'RATE_LIMITED', message);
export const serverError = (message = 'Something went wrong. Please try again.', details) => new ApiError(500, 'INTERNAL_ERROR', message, details);
export const serviceUnavailable = (message = 'Service temporarily unavailable. Please try again.', details) => new ApiError(503, 'SERVICE_UNAVAILABLE', message, details);
export const upstreamError = (message = 'The AI provider could not be reached. Please try again.', details) => new ApiError(502, 'UPSTREAM_ERROR', message, details);

export const isApiError = (err) => err instanceof ApiError;

export default ApiError;
