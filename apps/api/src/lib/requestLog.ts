import type { MiddlewareHandler } from 'hono';
import { logger } from './logger.js';

// Logs method, path, status, and duration only.
// Body and headers are deliberately excluded — they may contain PII or auth tokens.
export const requestLog: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  logger.info({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Date.now() - start,
  });
};
