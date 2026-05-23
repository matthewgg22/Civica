/**
 * EBT routes — mounted under /v1/enrollment/ebt/* by the parent app.
 *
 * Per §16.1 (DX1): one file per route under apps/enrollment-api/src/routes/ebt/.
 * `mountEbt(app)` registers every child route onto a parent (sub)app supplied
 * by the caller. The webhooks route mounts at the app root (not under /ebt/*)
 * because Fly scraper POSTs land at /webhooks/ebt-scraper.
 *
 *   mountEbt(api):              registers authed /ebt/* routes (Lane A + Lane D)
 *   mountEbtWebhooks(app):      registers /webhooks/ebt-scraper at the app root
 *
 * Phases 2/3 will add receipts.ts, perks.ts, referrals.ts here. Append one
 * `app.route('/<name>', router)` line inside mountEbt and one import above.
 */

import type { Hono } from 'hono';
import linkRouter from './link.js';
import balanceRouter from './balance.js';
import transactionsRouter from './transactions.js';
import refreshRouter from './refresh.js';
import depositCalendarRouter from './deposit-calendar.js';
import lockRouter from './lock.js';
import webhooksRouter from './webhooks.js';
import notificationsRouter from './notifications.js';

/**
 * Mounts every authed /ebt/* route onto the provided (authed) parent app.
 *
 * Param type is intentionally `Hono<any>` — Hono apps with extra Variables
 * still match the structural shape, and we don't want this helper to leak
 * the parent's full env type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountEbt(app: Hono<any>): void {
  app.route('/link', linkRouter);
  app.route('/balance', balanceRouter);
  app.route('/transactions', transactionsRouter);
  app.route('/refresh', refreshRouter);
  app.route('/deposit-calendar', depositCalendarRouter);
  app.route('/lock', lockRouter);
  // Lane D (T10) — notifications register + prefs
  app.route('/notifications', notificationsRouter);
}

/**
 * Mounts /webhooks/ebt-scraper at the provided (no-auth) app root.
 *
 * Mirrors the Argyle webhook pattern: HMAC verification inside the route,
 * no JWT middleware. The Fly scraper is not a Supabase-auth user.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountEbtWebhooks(app: Hono<any>): void {
  app.route('/webhooks/ebt-scraper', webhooksRouter);
}

export {
  linkRouter,
  balanceRouter,
  transactionsRouter,
  refreshRouter,
  depositCalendarRouter,
  lockRouter,
  webhooksRouter,
  notificationsRouter,
};
