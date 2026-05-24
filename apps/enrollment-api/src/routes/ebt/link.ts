/**
 * POST /ebt/link — link an EBT card (session-cookie handoff per D4).
 *
 * The iOS WebView (Lane C: EBTLinkWebView) opens ebt.ca.gov, the recipient
 * enters card+PIN locally, and WKHTTPCookieStore extracts the session cookie.
 * The cookie travels here; the PIN never leaves the device.
 *
 * The session cookie is encrypted at rest with pgsodium (T3): the gateway
 * calls the `encrypt_session_cookie` SECURITY DEFINER RPC before writing
 * `session_cookie_encrypted`, and `ebt-dispatch.ts` calls the matching
 * `decrypt_session_cookie` RPC immediately before handing the plaintext
 * cookie to the Fly scraper. A read-only DB breach therefore yields only
 * AEAD ciphertext, not replayable ebt.ca.gov sessions.
 *
 * Idempotency: upserting on (user_id, card_id_hash) — re-linking the same
 * card replaces the cookie and resets balance cache to NULL so the next
 * /ebt/balance call dispatches a fresh scrape via dispatchScrapeRefresh().
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { makeServiceClient } from '../../lib/supabase.js';
import { requireApplicant } from '../../lib/auth.js';
import { dispatchScrapeRefresh } from '../../lib/ebt-dispatch.js';
import { encryptSessionCookie } from '../../lib/ebt-cookie-crypto.js';
import type { Env } from '../../types.js';

const app = new Hono<{ Bindings: Env }>();

const linkBodySchema = z.object({
  /** SHA-256 hex of the 16-digit card number (computed on the device). */
  card_id_hash: z.string().min(32).max(128),
  processor: z.enum(['ebt_ca', 'plaid_ca', 'fis_direct']),
  /** Opaque session cookie captured from ebt.ca.gov via WKHTTPCookieStore. */
  session_cookie: z.string().min(1),
  /** Optional long-lived "remember me" cookie that extends the re-link window. */
  remember_cookie: z.string().optional(),
  /** ISO 8601 expiry advertised by the cookie itself. */
  expires_at: z.string().datetime(),
});

app.post('/', zValidator('json', linkBodySchema), async (c) => {
  const actor = c.get('actor');
  requireApplicant(actor.kind);

  const body = c.req.valid('json');
  const db = makeServiceClient(c.env);
  const now = new Date().toISOString();

  // Encrypt before write — single explicit site (matches the single explicit
  // decrypt site in ebt-dispatch.ts). On RPC failure we 500: storing the
  // plaintext cookie would silently break the security model T3 fixes.
  let sessionCipher: string;
  let rememberCipher: string | null = null;
  try {
    sessionCipher = await encryptSessionCookie(db, body.session_cookie);
    if (body.remember_cookie) {
      rememberCipher = await encryptSessionCookie(db, body.remember_cookie);
    }
  } catch (err) {
    throw new HTTPException(500, {
      message: `cookie encryption failed: ${(err as Error)?.message ?? 'unknown'}`,
    });
  }

  const row = {
    user_id: actor.id,
    card_id_hash: body.card_id_hash,
    processor: body.processor,
    session_cookie_encrypted: sessionCipher,
    session_cookie_expires_at: body.expires_at,
    remember_cookie_encrypted: rememberCipher,
    balance_cents: null as number | null,
    balance_at: null as string | null,
    lock_state: {} as Record<string, unknown>,
    updated_at: now,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: card, error } = await (db.schema('snap_enrollment').from('ebt_cards' as any) as any)
    .upsert(row, { onConflict: 'user_id,card_id_hash' })
    .select('id, user_id, processor, session_cookie_expires_at, last_synced_at, balance_cents, balance_at')
    .single() as {
      data: {
        id: string;
        user_id: string;
        processor: string;
        session_cookie_expires_at: string;
        last_synced_at: string | null;
        balance_cents: number | null;
        balance_at: string | null;
      } | null;
      error: { code?: string; message: string } | null;
    };

  if (error) throw new HTTPException(500, { message: error.message });
  if (!card) throw new HTTPException(500, { message: 'Failed to link card' });

  // Fire-and-forget first-link scrape so the dashboard renders fresh data
  // on the very first dashboard open (per D15 / 30d sync, 60d background).
  // We do NOT await — the iOS client should poll /ebt/balance and accept
  // stale=true while the scrape runs.
  await dispatchScrapeRefresh(c.env, {
    cardId: card.id,
    userId: actor.id,
    reason: 'first_link',
  });

  return c.json(
    {
      id: card.id,
      processor: card.processor,
      session_expires_at: card.session_cookie_expires_at,
      last_synced_at: card.last_synced_at,
      balance_cents: card.balance_cents,
      balance_at: card.balance_at,
    },
    201,
  );
});

export default app;
