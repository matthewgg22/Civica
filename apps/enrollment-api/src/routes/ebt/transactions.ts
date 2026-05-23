/**
 * GET /ebt/transactions?cursor=…&limit=…
 *
 * Cursor pagination over ebt_transactions. We use the (posted_at, id) tuple
 * encoded as base64 so a stable client cursor can survive identical
 * timestamps (rare but possible — e.g. backfill imports).
 *
 * Cursor format: base64( JSON({ posted_at: string, id: string }) ). Returning
 * a serialized cursor (instead of leaning on offset/limit) keeps the route
 * O(log n) on the index `idx_ebt_transactions_card_posted_at`.
 *
 * The route returns transactions for the caller's most recent card. If a
 * recipient has multiple cards (rare in CA-only Phase 1), the iOS app can
 * request `?card_id=…` to disambiguate.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { makeServiceClient } from '../../lib/supabase.js';
import { requireApplicant } from '../../lib/auth.js';
import type { Env } from '../../types.js';

const app = new Hono<{ Bindings: Env }>();

const querySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  card_id: z.string().uuid().optional(),
});

interface CursorPayload {
  posted_at: string;
  id: string;
}

function encodeCursor(p: CursorPayload): string {
  return btoa(JSON.stringify(p));
}

function decodeCursor(raw: string): CursorPayload | null {
  try {
    const decoded = JSON.parse(atob(raw)) as Partial<CursorPayload>;
    if (typeof decoded?.posted_at === 'string' && typeof decoded?.id === 'string') {
      return { posted_at: decoded.posted_at, id: decoded.id };
    }
    return null;
  } catch {
    return null;
  }
}

app.get('/', zValidator('query', querySchema), async (c) => {
  const actor = c.get('actor');
  requireApplicant(actor.kind);

  const { cursor, limit = 25, card_id } = c.req.valid('query');
  const db = makeServiceClient(c.env);

  // Resolve target card. Either the requested one (validated to belong to
  // the user) or the most-recent one.
  let resolvedCardId: string;
  if (card_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: card, error: cardErr } = await (db.schema('snap_enrollment').from('ebt_cards' as any) as any)
      .select('id')
      .eq('id', card_id)
      .eq('user_id', actor.id)
      .maybeSingle() as { data: { id: string } | null; error: { message: string } | null };

    if (cardErr) throw new HTTPException(500, { message: cardErr.message });
    if (!card) throw new HTTPException(404, { message: 'Card not found' });
    resolvedCardId = card.id;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: card, error: cardErr } = await (db.schema('snap_enrollment').from('ebt_cards' as any) as any)
      .select('id')
      .eq('user_id', actor.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { id: string } | null; error: { message: string } | null };

    if (cardErr) throw new HTTPException(500, { message: cardErr.message });
    if (!card) {
      // No card linked → return empty page so the iOS list renders gracefully.
      return c.json({ items: [], next_cursor: null });
    }
    resolvedCardId = card.id;
  }

  // Fetch one extra row to determine whether a next cursor exists.
  const fetchLimit = limit + 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = (db.schema('snap_enrollment').from('ebt_transactions' as any) as any)
    .select('id, posted_at, amount_cents, merchant, category, raw_description, state_code_match')
    .eq('card_id', resolvedCardId)
    .order('posted_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(fetchLimit);

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) throw new HTTPException(400, { message: 'Invalid cursor' });
    // Strictly less-than on (posted_at, id) — emulated as posted_at < cursor.posted_at
    // OR (posted_at == cursor.posted_at AND id < cursor.id). We approximate with
    // posted_at <= cursor.posted_at; the in-memory tie-break filters the dupes.
    q = q.lte('posted_at', decoded.posted_at);
  }

  const { data, error } = await q as {
    data: Array<{
      id: string;
      posted_at: string;
      amount_cents: number;
      merchant: string;
      category: string;
      raw_description: string;
      state_code_match: string | null;
    }> | null;
    error: { message: string } | null;
  };

  if (error) throw new HTTPException(500, { message: error.message });

  let rows = data ?? [];
  // Tie-break: if a cursor was supplied, drop everything > the cursor's id at the cursor timestamp.
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      rows = rows.filter((r) => {
        if (r.posted_at < decoded.posted_at) return true;
        if (r.posted_at === decoded.posted_at) return r.id < decoded.id;
        return false;
      });
    }
  }

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const overflow = rows[limit];
    rows = rows.slice(0, limit);
    if (overflow) {
      nextCursor = encodeCursor({ posted_at: overflow.posted_at, id: overflow.id });
    }
  }

  return c.json({ items: rows, next_cursor: nextCursor });
});

export default app;
