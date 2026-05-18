// TEMPORARY — remove before merging. Used to verify Sentry wiring on staging.
// Enable by setting SENTRY_CHECK_ENABLED=1 in fly secrets, then remove after confirming event.
import { Hono } from 'hono';

export const debugRouter = new Hono();

debugRouter.get('/debug/sentry-check', () => {
  throw new Error('Sentry check: intentional test error from civica-api');
});
