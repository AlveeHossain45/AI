/**
 * Zod validation middleware.
 * Schemas describe the whole request: z.object({ body?, query?, params? }).
 * Usage: router.post('/x', validate(schema), handler)
 */
import { badRequest } from '../utils/errors.js';

const SOURCES = ['params', 'query', 'body'];

export const validate = (schema = {}) => (req, res, next) => {
  try {
    const result = schema.safeParse({ params: req.params, query: req.query, body: req.body ?? {} });
    if (!result.success) {
      const first = result.error.issues?.[0];
      const where = first?.path?.[0];
      const label = where && SOURCES.includes(where) ? String(where) : 'request';
      const message = first ? `${label}: ${first.message}` : 'Invalid request.';
      return next(
        badRequest(
          message,
          result.error.issues.map((issue) => ({ path: issue.path.join('.') || 'request', message: issue.message }))
        )
      );
    }
    for (const source of SOURCES) {
      if (result.data?.[source] !== undefined) {
        if (source === 'query') Object.assign(req.query, result.data[source]);
        else req[source] = result.data[source];
      }
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

export default validate;
