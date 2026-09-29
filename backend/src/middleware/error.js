/**
 * Central error handling: converts known errors to friendly JSON responses,
 * logs unknown errors server-side and never leaks stack traces to clients.
 */
import { ApiError, isApiError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

export const notFoundHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong. Please try again.';
  let details;

  if (isApiError(err)) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err?.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      code = 'FILE_TOO_LARGE';
      message = `File is too large. Maximum size is ${config.limits.maxFileMb} MB.`;
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      status = 400;
      code = 'TOO_MANY_FILES';
      message = `Too many files. Maximum is ${config.limits.maxUploadFiles} per upload.`;
    } else {
      status = 400;
      code = 'UPLOAD_ERROR';
      message = 'The file upload failed. Please try again.';
    }
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'BAD_JSON';
    message = 'The request body is not valid JSON.';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'The request payload is too large.';
  } else if (err?.code === 'P2002') {
    status = 409;
    code = 'CONFLICT';
    message = 'That record already exists.';
  } else if (err?.code === 'P2025') {
    status = 404;
    code = 'NOT_FOUND';
    message = 'Resource not found.';
  } else if (err?.code === 'ECONNREFUSED' || /Can't reach database|Connection terminated|ENOTFOUND.*postgres/i.test(err?.message || '')) {
    status = 503;
    code = 'DATABASE_UNAVAILABLE';
    message = 'The database is unavailable. Please try again shortly.';
  } else if (err instanceof ApiError) {
    status = err.status;
    code = err.code;
    message = err.message;
  }

  const logPayload = { status, code, path: req.originalUrl, method: req.method };
  if (status >= 500) logger.error(message, logPayload, err?.stack || err);
  else logger.warn(message, logPayload);

  res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(config.isDev && status >= 500 ? { debug: String(err?.message || '') } : {}),
    },
  });
};

export default errorHandler;
