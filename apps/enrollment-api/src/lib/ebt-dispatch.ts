/**
 * Stubs that the EBT routes call when they need the Fly scraper to do work.
 * Lane B (fly/ebt-scraper/) will define the actual webhook endpoint + payload
 * — the gateway side just signs an HMAC and POSTs.
 *
 * Until Lane B lands, dispatchScrapeRefresh() is a best-effort fire-and-forget
 * call that is safe to make from a request handler:
 *   - if EBT_SCRAPER_DISPATCH_URL is unset, returns immediately (dev/test),
 *   - if the POST fails, the call resolves with `dispatched=false` and the
 *     caller is expected to surface the stale cache regardless.
 */

import type { Env } from '../types.js';
import { makeServiceClient } from './supabase.js';

export interface ScrapeRefreshArgs {
  cardId: string;
  userId: string;
  reason: 'on_open_stale' | 'manual_refresh' | 'webhook' | 'first_link';
}

export interface ScrapeRefreshResult {
  dispatched: boolean;
  reason?: string;
}

/** Maps ebt_cards.processor enum to the Fly scraper's processor id. */
const PROCESSOR_ID_MAP: Record<string, string> = {
  ebt_ca: 'ebt-ca',
  plaid_ca: 'plaid-ca',
  fis_direct: 'fis-direct',
};

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Ask the Fly scraper to refresh a card. Fetches the card's session cookies
 * from Supabase and builds the full ScrapeRequest payload the scraper expects.
 *
 * The gateway does NOT await scrape completion; this returns as soon as the
 * dispatch POST returns, and the scraper later fans out webhook events back here.
 *
 * session_cookie_encrypted is stored as a JSON-serialised SessionCookie[] array,
 * matching the shape the iOS WKHTTPCookieStore serialises to before POST /ebt/link.
 */
export async function dispatchScrapeRefresh(
  env: Env,
  args: ScrapeRefreshArgs,
): Promise<ScrapeRefreshResult> {
  const url = env.EBT_SCRAPER_DISPATCH_URL;
  if (!url) {
    return { dispatched: false, reason: 'no_dispatch_url' };
  }
  const secret = env.EBT_SCRAPER_WEBHOOK_SECRET;
  if (!secret) {
    return { dispatched: false, reason: 'no_secret' };
  }

  // Fetch the card row so we can include session cookies in the scrape request.
  const db = makeServiceClient(env);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: card, error: cardError } = await (db.schema('snap_enrollment').from('ebt_cards' as any) as any)
    .select('id, processor, session_cookie_encrypted, session_cookie_expires_at')
    .eq('id', args.cardId)
    .single() as {
      data: {
        id: string;
        processor: string;
        session_cookie_encrypted: string;
        session_cookie_expires_at: string;
      } | null;
      error: { message: string } | null;
    };

  if (cardError || !card) {
    return { dispatched: false, reason: `card_lookup_failed: ${cardError?.message ?? 'not found'}` };
  }

  // session_cookie_encrypted is a JSON-serialised SessionCookie[] from iOS.
  let cookieHandoff: unknown[];
  try {
    cookieHandoff = JSON.parse(card.session_cookie_encrypted) as unknown[];
    if (!Array.isArray(cookieHandoff)) throw new Error('not an array');
  } catch {
    return { dispatched: false, reason: 'cookie_parse_failed' };
  }

  const processorId = PROCESSOR_ID_MAP[card.processor] ?? card.processor;

  const body = JSON.stringify({
    processor: processorId,
    cardId: card.id,
    action: 'balance',
    login: { cookieHandoff },
  });
  const sig = await hmacHex(secret, body);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Civica-Signature': `sha256=${sig}`,
      },
      body,
    });
    if (!res.ok) {
      return { dispatched: false, reason: `status_${res.status}` };
    }
    return { dispatched: true };
  } catch (err) {
    return { dispatched: false, reason: (err as Error)?.message ?? 'fetch_failed' };
  }
}

// ---------------------------------------------------------------------------
// Rate-limit (POST /ebt/refresh — 1/min/user)
// ---------------------------------------------------------------------------
//
// Workers isolate state is per-invocation in production, so this is genuinely
// best-effort. The DurableObject-backed version lands in Phase 2 once we
// confirm rate-limit semantics in metrics. For now, this prevents the
// trivial "tap-tap-tap" abuse pattern within a single isolate.

const REFRESH_RATE_LIMIT_MS = 60_000;
const refreshLastCallByUser = new Map<string, number>();

/**
 * Returns the number of ms until the next refresh is allowed, or 0 if the
 * call is allowed now. On allow, the user's clock is reset.
 */
export function checkRefreshRateLimit(userId: string, now: number = Date.now()): number {
  const last = refreshLastCallByUser.get(userId);
  if (last !== undefined && now - last < REFRESH_RATE_LIMIT_MS) {
    return REFRESH_RATE_LIMIT_MS - (now - last);
  }
  refreshLastCallByUser.set(userId, now);
  return 0;
}

/** Test-only: clear the in-memory rate-limit table between tests. */
export function _resetRateLimitForTests(): void {
  refreshLastCallByUser.clear();
}

// ---------------------------------------------------------------------------
// Balance staleness threshold (D14: > 30min → return stale=true + refresh)
// ---------------------------------------------------------------------------

export const BALANCE_STALE_THRESHOLD_MS = 30 * 60 * 1000;

export function isBalanceStale(balanceAt: string | null, now: number = Date.now()): boolean {
  if (!balanceAt) return true;
  const age = now - new Date(balanceAt).getTime();
  return age > BALANCE_STALE_THRESHOLD_MS;
}
