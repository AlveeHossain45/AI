const COLORS = { reset: '\x1b[0m', dim: '\x1b[2m', red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', cyan: '\x1b[36m' };
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const ORDER = { debug: 10, info: 20, warn: 30, error: 40 };

function write (method, color, args) {
  if ((ORDER[method] || 0) < (ORDER[level] || 20)) return;
  const time = new Date().toISOString();
  // eslint-disable-next-line no-console
  console[method === 'debug' ? 'log' : method](`${COLORS[color]}${time} ${method.toUpperCase()}${COLORS.reset}`, ...args);
}

export const logger = {
  debug: (...args) => write('debug', 'dim', args),
  info: (...args) => write('info', 'cyan', args),
  warn: (...args) => write('warn', 'yellow', args),
  error: (...args) => write('error', 'red', args),
  // Structured single-line event log (used for analytics/debugging)
  event: (name, data = {}) => write('info', 'green', [name, JSON.stringify(data)]),
};

export default logger;
