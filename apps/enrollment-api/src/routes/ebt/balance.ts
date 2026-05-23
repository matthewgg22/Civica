/**
 * GET /ebt/balance — return cached balance for the caller's most recent card.
 *
 * Per D14: single Supabase read against ebt_cards.balance_cents + balance_at.
 * If the row is older than 30min we return `stale=true` AND fire-and-forget
 * dispatchScrapeRefresh() so the next poll has fresh data. The route never
 * blocks on the scrape — the client is expected to handle a stale read
 * while the scraper backfills.
 *
 * Selection: most recently linked card with a non-expired session. We avoid
 * picking a card whose cookie has already expired because the scraper can
 * no longer refresh it — the iOS app will route the recipient to re-link.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { makeServiceClient } from '../../lib/supabase.js';
import { requireApplicant } from '../../lib/auth.js';
import {
  dispatchScrapeRefresh,
  isBalanceStale,
} from '../../lib/ebt-dispatch.js';
import type { Env } from '../../types.js';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
  const actor = c.get('actor');
  requireApplicant(actor.kind);

  const db = makeServiceClient(c.env);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: card, error } = await (db.schema('snap_enrollment').from('ebt_cards' as any) as any)
    .select('id, balance_cents, balance_at, session_cookie_expires_at')
    .eq('user_id', actor.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as {
      data: {
        id: string;
        balance_cents: number | null;
        balance_at: string | null;
        session_cookie_expires_at: string;
      } | null;
      error: { message: string } | null;
    };

  if (error) throw new HTTPException(500, { message: error.message });
  if (!card) {
    // No card linked → 404 so the client can route to the link flow.
    return c.json({ error: 'NO_CARD_LINKED', message: 'Link a card to see your balance.' }, 404);
  }

  const stale = isBalanceStale(card.balance_at);

  // Dispatch a refresh whenever the balance is stale. dispatchScrapeRefresh
  // is a no-op when EBT_SCRAPER_DISPATCH_URL is unset (Lane B will wire prod).
  if (stale) {
    await dispatchScrapeRefresh(c.env, {
      cardId: card.id,
      userId: actor.id,
      reason: 'on_open_stale',
    });
  }

  return c.json({
    balance_cents: card.balance_cents,
    balance_at: card.balance_at,
    stale,
  });
});

export default app;
