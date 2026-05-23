/**
 * POST /ebt/refresh — recipient-initiated balance refresh.
 *
 * Rate-limited to 1 call per minute per user via an in-isolate map
 * (`checkRefreshRateLimit`). Beyond that limit we return 429 with a
 * Retry-After header. The DurableObject-backed rate limiter lands in
 * Phase 2 once we have metrics on burst patterns.
 *
 * On allow: dispatches a scrape to the Fly scraper (Lane B) and returns
 * 202 Accepted. The route never blocks on the scrape; the client should
 * poll /ebt/balance for the fresh data.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { makeServiceClient } from '../../lib/supabase.js';
import { requireApplicant } from '../../lib/auth.js';
import {
  checkRefreshRateLimit,
  dispatchScrapeRefresh,
} from '../../lib/ebt-dispatch.js';
import type { Env } from '../../types.js';

const app = new Hono<{ Bindings: Env }>();

app.post('/', async (c) => {
  const actor = c.get('actor');
  requireApplicant(actor.kind);

  const retryAfterMs = checkRefreshRateLimit(actor.id);
  if (retryAfterMs > 0) {
    const retryAfter = Math.ceil(retryAfterMs / 1000);
    return c.json(
      { error: 'RATE_LIMITED', message: 'Too many refresh requests. Please wait.', retry_after_seconds: retryAfter },
      429,
      { 'Retry-After': String(retryAfter) },
    );
  }

  const db = makeServiceClient(c.env);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: card, error } = await (db.schema('snap_enrollment').from('ebt_cards' as any) as any)
    .select('id')
    .eq('user_id', actor.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { id: string } | null; error: { message: string } | null };

  if (error) throw new HTTPException(500, { message: error.message });
  if (!card) {
    return c.json({ error: 'NO_CARD_LINKED', message: 'Link a card to refresh.' }, 404);
  }

  const result = await dispatchScrapeRefresh(c.env, {
    cardId: card.id,
    userId: actor.id,
    reason: 'manual_refresh',
  });

  return c.json(
    { dispatched: result.dispatched, reason: result.reason ?? null },
    202,
  );
});

export default app;
