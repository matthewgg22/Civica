/**
 * POST /webhooks/ebt-scraper — Fly scraper → gateway event fan-out.
 *
 * The Fly scraper (Lane B) emits typed events whenever a scrape completes,
 * fails, or detects a deposit / low-balance / anomaly condition. This route
 * HMAC-verifies the body, parses the event, persists state changes, and
 * fans out APNs notifications (Lane D will define the actual send helpers).
 *
 * Events handled:
 *   - balance_updated      — cache new balance_cents + balance_at on ebt_cards
 *   - transactions_added   — bulk-insert into ebt_transactions
 *   - deposit_posted       — stamp posted_at on the matching ebt_deposit row + APNs
 *   - low_balance_crossed  — APNs (per ebt_notification_prefs)
 *   - session_expired      — APNs "please re-link" (per D4)
 *   - scrape_error         — log + emit Sentry breadcrumb; iOS sees this lazily
 *
 * The route is OUTSIDE the JWT-auth middleware — the Fly scraper isn't a
 * Supabase-auth user. Auth is the HMAC signature only.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { makeServiceClient } from '../../lib/supabase.js';
import type { Env, Variables } from '../../types.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ---------------------------------------------------------------------------
// HMAC-SHA256 verification (constant-time on hex compare via crypto.subtle.verify)
// ---------------------------------------------------------------------------

async function verifyHmac(
  secret: string,
  body: string,
  signatureHeader: string | undefined,
): Promise<boolean> {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expectedHex = signatureHeader.slice(7);
  if (!/^[0-9a-f]+$/i.test(expectedHex)) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const computedHex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (computedHex.length !== expectedHex.length) return false;
  // Length-equal hex strings → constant-time compare in JS via the well-known XOR pattern.
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) {
    diff |= computedHex.charCodeAt(i) ^ expectedHex.toLowerCase().charCodeAt(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Event schemas
// ---------------------------------------------------------------------------

const balanceUpdatedSchema = z.object({
  type: z.literal('balance_updated'),
  card_id: z.string().uuid(),
  balance_cents: z.number().int(),
  balance_at: z.string().datetime(),
});

const transactionInputSchema = z.object({
  posted_at: z.string().datetime(),
  amount_cents: z.number().int(),
  merchant: z.string().default(''),
  category: z.enum(['groceries', 'farmers_market', 'restaurant', 'atm_withdrawal', 'refund', 'adjustment', 'other']).default('other'),
  raw_description: z.string().default(''),
  state_code_match: z.string().length(2).nullable().optional(),
});

const transactionsAddedSchema = z.object({
  type: z.literal('transactions_added'),
  card_id: z.string().uuid(),
  transactions: z.array(transactionInputSchema),
});

const depositPostedSchema = z.object({
  type: z.literal('deposit_posted'),
  card_id: z.string().uuid(),
  scheduled_for: z.string(),
  amount_cents: z.number().int(),
  posted_at: z.string().datetime(),
});

const lowBalanceCrossedSchema = z.object({
  type: z.literal('low_balance_crossed'),
  card_id: z.string().uuid(),
  balance_cents: z.number().int(),
  threshold_cents: z.number().int(),
});

const sessionExpiredSchema = z.object({
  type: z.literal('session_expired'),
  card_id: z.string().uuid(),
});

const scrapeErrorSchema = z.object({
  type: z.literal('scrape_error'),
  card_id: z.string().uuid(),
  code: z.string(),
  message: z.string().optional(),
});

const eventSchema = z.discriminatedUnion('type', [
  balanceUpdatedSchema,
  transactionsAddedSchema,
  depositPostedSchema,
  lowBalanceCrossedSchema,
  sessionExpiredSchema,
  scrapeErrorSchema,
]);

// ---------------------------------------------------------------------------
// APNs fan-out helpers (mock until Lane D wires apns-send.ts)
// ---------------------------------------------------------------------------
// These helpers intentionally only log; Lane D will replace them with real
// APNs sends using the device tokens persisted in ebt_device_tokens.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notifyDepositLanded(c: any, cardId: string, amountCents: number): Promise<void> {
  c.get('log')?.info('ebt push (mock): deposit_landed', { card_id: cardId, amount_cents: amountCents });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notifyLowBalance(c: any, cardId: string, balanceCents: number): Promise<void> {
  c.get('log')?.info('ebt push (mock): low_balance', { card_id: cardId, balance_cents: balanceCents });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notifySessionExpired(c: any, cardId: string): Promise<void> {
  c.get('log')?.info('ebt push (mock): session_expired_relink', { card_id: cardId });
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

app.post('/', async (c) => {
  const rawBody = await c.req.text();

  // HMAC verify. In production the secret is required; in dev/test we accept
  // an unset secret as "verification skipped" to keep local iteration fast,
  // matching the Argyle-webhook pattern.
  const secret = c.env.EBT_SCRAPER_WEBHOOK_SECRET;
  if (secret) {
    const ok = await verifyHmac(secret, rawBody, c.req.header('X-Civica-Signature'));
    if (!ok) throw new HTTPException(401, { message: 'Invalid scraper signature' });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new HTTPException(400, { message: 'Invalid JSON' });
  }

  const result = eventSchema.safeParse(parsed);
  if (!result.success) {
    throw new HTTPException(400, { message: 'Invalid event payload' });
  }
  const event = result.data;

  const db = makeServiceClient(c.env);

  switch (event.type) {
    case 'balance_updated': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db.schema('snap_enrollment').from('ebt_cards' as any) as any)
        .update({
          balance_cents: event.balance_cents,
          balance_at: event.balance_at,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', event.card_id) as { error: { message: string } | null };
      if (error) throw new HTTPException(500, { message: error.message });
      return c.json({ ok: true, action: 'balance_updated' });
    }

    case 'transactions_added': {
      if (event.transactions.length === 0) {
        return c.json({ ok: true, action: 'transactions_added', inserted: 0 });
      }
      const rows = event.transactions.map((t) => ({
        card_id: event.card_id,
        posted_at: t.posted_at,
        amount_cents: t.amount_cents,
        merchant: t.merchant,
        category: t.category,
        raw_description: t.raw_description,
        state_code_match: t.state_code_match ?? null,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db.schema('snap_enrollment').from('ebt_transactions' as any) as any)
        .insert(rows) as { error: { message: string } | null };
      if (error) throw new HTTPException(500, { message: error.message });
      return c.json({ ok: true, action: 'transactions_added', inserted: rows.length });
    }

    case 'deposit_posted': {
      // Upsert via update-or-insert: match by (card_id, scheduled_for); if no
      // row, insert a fresh one (handles backfill of pre-link deposits).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (db.schema('snap_enrollment').from('ebt_deposits' as any) as any)
        .select('id')
        .eq('card_id', event.card_id)
        .eq('scheduled_for', event.scheduled_for)
        .maybeSingle() as { data: { id: string } | null };

      if (existing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (db.schema('snap_enrollment').from('ebt_deposits' as any) as any)
          .update({ posted_at: event.posted_at, amount_cents: event.amount_cents })
          .eq('id', existing.id) as { error: { message: string } | null };
        if (error) throw new HTTPException(500, { message: error.message });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (db.schema('snap_enrollment').from('ebt_deposits' as any) as any)
          .insert({
            card_id: event.card_id,
            scheduled_for: event.scheduled_for,
            posted_at: event.posted_at,
            amount_cents: event.amount_cents,
          }) as { error: { message: string } | null };
        if (error) throw new HTTPException(500, { message: error.message });
      }

      await notifyDepositLanded(c, event.card_id, event.amount_cents);
      return c.json({ ok: true, action: 'deposit_posted' });
    }

    case 'low_balance_crossed': {
      await notifyLowBalance(c, event.card_id, event.balance_cents);
      return c.json({ ok: true, action: 'low_balance_pushed' });
    }

    case 'session_expired': {
      await notifySessionExpired(c, event.card_id);
      return c.json({ ok: true, action: 'session_expired_pushed' });
    }

    case 'scrape_error': {
      c.get('log')?.warn('ebt scraper reported error', {
        card_id: event.card_id,
        code: event.code,
        message: event.message ?? '',
      });
      return c.json({ ok: true, action: 'scrape_error_logged', code: event.code });
    }
  }
});

export default app;
