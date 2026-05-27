/**
 * APNs (Apple Push Notification service) send helper, Cloudflare Workers
 * runtime. Token-based auth per plan §4.4 — uses a .p8 ES256 key (set via
 * `wrangler secret put APNS_KEY_P8`) + key id + team id to mint a JWT, then
 * fans out to each device token registered for the target user.
 *
 * Why Web Crypto and not `jsonwebtoken`: the npm package depends on Node's
 * `crypto` module which is not available in the Workers runtime. Web Crypto
 * (`crypto.subtle.sign` with ECDSA P-256 + SHA-256) is the supported path.
 *
 * Each high-level helper (sendDepositLanded, sendLowBalance, sendReLink,
 * sendAnomaly):
 *   1. Looks up the user's `ebt_notification_prefs` row
 *   2. Returns early if the category-specific toggle is OFF
 *   3. Returns early if "now" is inside the user's quiet-hours window
 *      (defers — caller would re-enqueue at quietEnd)
 *   4. Fetches all `ebt_device_tokens` for the user
 *   5. Sends one POST per device to api.push.apple.com / api.sandbox...
 *
 * Failures are logged + swallowed (push is best-effort). The function
 * returns a per-device send report so callers / tests can assert.
 *
 * Test seam: every external surface (env, db, fetch, now-clock) is
 * dependency-injected via `ApnsSendDeps` so vitest can pin the JWT
 * algorithm + payload without hitting Apple.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../types.js";

// ─── Wire types ───────────────────────────────────────────────────────────

export type ApnsCategory = "deposit_landed" | "low_balance" | "re_link" | "anomaly" | "perk_offer";

export interface ApnsSendDeps {
  env: Env;
  /** Returns the user's prefs row, or null if none yet (treat as defaults-on). */
  fetchPrefs: (userId: string) => Promise<ApnsPrefs | null>;
  /** Returns the user's registered APNs tokens (may be empty). */
  fetchTokens: (userId: string) => Promise<string[]>;
  /** Test seam: stub fetch in unit tests; production passes globalThis.fetch. */
  fetchFn: typeof fetch;
  /** Test seam: pin the clock for quiet-hours and JWT iat. */
  now: () => Date;
}

export interface ApnsPrefs {
  deposit_on: boolean;
  low_balance_on: boolean;
  perks_on: boolean;
  recert_on: boolean;
  /** Minutes-since-midnight, recipient-local. */
  quiet_start_minutes: number;
  quiet_end_minutes: number;
}

export interface ApnsPayloadShape {
  aps: {
    alert: { title: string; body: string };
    sound: string;
    badge?: number;
    "thread-id"?: string;
  };
  category: ApnsCategory;
  /** Free-form additional data — surfaces to iOS in userInfo. */
  [extra: string]: unknown;
}

export interface ApnsSendReport {
  /** "skipped" when prefs/quiet-hours suppressed, "no-tokens" when device list is empty. */
  status: "sent" | "skipped" | "no-tokens" | "not-configured" | "failed";
  attempts: number;
  successes: number;
  /** Reason if status !== "sent" — propagated to logs. */
  reason?: string;
}

// ─── JWT signer (Web Crypto, ES256) ───────────────────────────────────────

/**
 * APNs JWTs are ES256 over header.body. They're valid up to ~60 minutes.
 * We cache the signed token per (kid, teamId) for 50 minutes to stay
 * comfortably under Apple's window; the Workers isolate may be recycled
 * between requests so this is a best-effort optimization, not a guarantee.
 */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function buildApnsJwt(args: {
  keyP8: string;
  keyId: string;
  teamId: string;
  now: Date;
}): Promise<string> {
  const cacheKey = `${args.keyId}:${args.teamId}`;
  const cached = tokenCache.get(cacheKey);
  const nowMs = args.now.getTime();
  if (cached && cached.expiresAt > nowMs) {
    return cached.token;
  }

  const iat = Math.floor(nowMs / 1000);
  const header = { alg: "ES256", kid: args.keyId, typ: "JWT" };
  const payload = { iss: args.teamId, iat };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const cryptoKey = await importP8(args.keyP8);
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const sigB64 = base64urlBytes(new Uint8Array(sigBuf));
  const token = `${signingInput}.${sigB64}`;

  tokenCache.set(cacheKey, { token, expiresAt: nowMs + 50 * 60 * 1000 });
  return token;
}

async function importP8(p8: string): Promise<CryptoKey> {
  // Strip PEM headers + whitespace. The body is base64-encoded PKCS#8.
  const pem = p8
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = base64ToBytes(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

function base64url(input: string): string {
  return base64urlBytes(new TextEncoder().encode(input));
}

function base64urlBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── Quiet hours ──────────────────────────────────────────────────────────

/**
 * Returns true if `now` is inside the [quietStart, quietEnd) window.
 * Window may wrap midnight (e.g. 21:00 → 08:00); handle both forms.
 *
 * Caller's responsibility to convert `now` to recipient-local time before
 * passing in. For Phase 1 we use UTC-as-best-guess until the user-tz
 * column lands (tracked as a Phase-2 follow-up).
 */
export function isInsideQuietHours(args: {
  nowMinutes: number;
  quietStartMinutes: number;
  quietEndMinutes: number;
}): boolean {
  const { nowMinutes, quietStartMinutes, quietEndMinutes } = args;
  if (quietStartMinutes === quietEndMinutes) return false; // disabled
  if (quietStartMinutes < quietEndMinutes) {
    // Same-day window: [start, end).
    return nowMinutes >= quietStartMinutes && nowMinutes < quietEndMinutes;
  }
  // Wraps midnight: nowMinutes is either >= start (evening) or < end (morning).
  return nowMinutes >= quietStartMinutes || nowMinutes < quietEndMinutes;
}

function currentLocalMinutes(now: Date): number {
  // Workers runs UTC; use UTC components for Phase 1. The store-side
  // quietStart/End is also in recipient-local minutes-since-midnight,
  // so until we wire a user-tz column the comparison is approximate.
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

// ─── Core send ────────────────────────────────────────────────────────────

const DEFAULT_PREFS: ApnsPrefs = {
  deposit_on: true,
  low_balance_on: true,
  perks_on: true,
  recert_on: true,
  quiet_start_minutes: 21 * 60,
  quiet_end_minutes: 8 * 60,
};

function categoryEnabled(prefs: ApnsPrefs, category: ApnsCategory): boolean {
  switch (category) {
    case "deposit_landed": return prefs.deposit_on;
    case "low_balance":    return prefs.low_balance_on;
    case "re_link":        return true; // never muted — recipient must act
    case "anomaly":        return true; // never muted — security signal
    case "perk_offer":     return prefs.perks_on;
  }
}

async function sendToDevice(args: {
  deps: ApnsSendDeps;
  token: string;
  payload: ApnsPayloadShape;
  category: ApnsCategory;
  jwt: string;
}): Promise<boolean> {
  const env = args.deps.env;
  const host = (env.APNS_ENV === "production")
    ? "api.push.apple.com"
    : "api.sandbox.push.apple.com";
  const url = `https://${host}/3/device/${args.token}`;

  const res = await args.deps.fetchFn(url, {
    method: "POST",
    headers: {
      "authorization": `bearer ${args.jwt}`,
      "apns-topic": env.APNS_TOPIC!,
      "apns-push-type": "alert",
      "apns-priority": args.category === "anomaly" ? "10" : "5",
      "content-type": "application/json",
    },
    body: JSON.stringify(args.payload),
  });
  return res.status >= 200 && res.status < 300;
}

async function sendCategory(args: {
  deps: ApnsSendDeps;
  userId: string;
  category: ApnsCategory;
  title: string;
  body: string;
  extra?: Record<string, unknown>;
}): Promise<ApnsSendReport> {
  const { deps, userId, category, title, body, extra } = args;
  const env = deps.env;

  if (!env.APNS_KEY_P8 || !env.APNS_KEY_ID || !env.APNS_TEAM_ID || !env.APNS_TOPIC) {
    return { status: "not-configured", attempts: 0, successes: 0,
             reason: "APNS_* env vars missing" };
  }

  const prefs = (await deps.fetchPrefs(userId)) ?? DEFAULT_PREFS;

  if (!categoryEnabled(prefs, category)) {
    return { status: "skipped", attempts: 0, successes: 0,
             reason: `${category} muted by user prefs` };
  }

  const nowMinutes = currentLocalMinutes(deps.now());
  if (isInsideQuietHours({
        nowMinutes,
        quietStartMinutes: prefs.quiet_start_minutes,
        quietEndMinutes: prefs.quiet_end_minutes,
      })) {
    // Caller is expected to re-enqueue at quietEnd; we don't fire-and-forget
    // a scheduled retry here because Workers doesn't have native delayed
    // queues — that's a Cloudflare Queues responsibility.
    return { status: "skipped", attempts: 0, successes: 0,
             reason: "inside quiet hours" };
  }

  const tokens = await deps.fetchTokens(userId);
  if (tokens.length === 0) {
    return { status: "no-tokens", attempts: 0, successes: 0,
             reason: "user has no registered devices" };
  }

  const jwt = await buildApnsJwt({
    keyP8: env.APNS_KEY_P8,
    keyId: env.APNS_KEY_ID,
    teamId: env.APNS_TEAM_ID,
    now: deps.now(),
  });

  const payload: ApnsPayloadShape = {
    aps: {
      alert: { title, body },
      sound: "default",
      "thread-id": `ebt-${category}`,
    },
    category,
    ...(extra ?? {}),
  };

  let successes = 0;
  for (const token of tokens) {
    try {
      const ok = await sendToDevice({ deps, token, payload, category, jwt });
      if (ok) successes++;
    } catch {
      // swallow; push is best-effort
    }
  }
  return {
    status: successes > 0 ? "sent" : "failed",
    attempts: tokens.length,
    successes,
    ...(successes === 0 ? { reason: "all sends failed" } : {}),
  };
}

// ─── Public helpers ───────────────────────────────────────────────────────

export function sendDepositLanded(args: {
  deps: ApnsSendDeps;
  userId: string;
  amount: number;
}): Promise<ApnsSendReport> {
  const dollars = (args.amount / 100).toLocaleString("en-US", {
    style: "currency", currency: "USD",
  });
  return sendCategory({
    deps: args.deps,
    userId: args.userId,
    category: "deposit_landed",
    title: "Your CalFresh deposit landed",
    body: `${dollars} is on your card. Tap to see your new balance.`,
    extra: { amount_cents: args.amount },
  });
}

export function sendLowBalance(args: {
  deps: ApnsSendDeps;
  userId: string;
  thresholdCents: number;
}): Promise<ApnsSendReport> {
  const dollars = (args.thresholdCents / 100).toLocaleString("en-US", {
    style: "currency", currency: "USD",
  });
  return sendCategory({
    deps: args.deps,
    userId: args.userId,
    category: "low_balance",
    title: "Your CalFresh balance is low",
    body: `You're under ${dollars}. Check your next deposit date and plan your shopping.`,
    extra: { threshold_cents: args.thresholdCents },
  });
}

export function sendReLink(args: {
  deps: ApnsSendDeps;
  userId: string;
}): Promise<ApnsSendReport> {
  return sendCategory({
    deps: args.deps,
    userId: args.userId,
    category: "re_link",
    title: "Re-link your EBT card",
    body: "Your EBT session expired. Tap to reconnect and keep your balance up to date.",
  });
}

export function sendAnomaly(args: {
  deps: ApnsSendDeps;
  userId: string;
  transaction: { id: string; merchant: string; amount_cents: number };
}): Promise<ApnsSendReport> {
  return sendCategory({
    deps: args.deps,
    userId: args.userId,
    category: "anomaly",
    title: "Unusual activity on your card",
    body: `A charge at ${args.transaction.merchant} looks unusual. Tap to review it.`,
    extra: {
      transaction_id: args.transaction.id,
      merchant: args.transaction.merchant,
      amount_cents: args.transaction.amount_cents,
    },
  });
}

// ─── Offer-moment platform push (B-T12) ───────────────────────────────────
//
// Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (D6 voice).
//
// Voice template (factual-utility per D6):
//   "{Partner}, {distance}: {discount} {through_date}"
//   e.g., "Whole Foods, 0.8 mi: 15% off prepared meals through Saturday."
//
// The `offer_id` rides in the APNs payload's `extra` so the iOS push
// handler can route the tap to OfferDetailView via
// EBTPushDeepLink.perkOffer(offerId:).
//
// Distance + through-date are formatted by the CALLER — this helper just
// composes them into the body. When unknown, pass null and the phrase
// drops out entirely.
export function sendPerkOffer(args: {
  deps: ApnsSendDeps;
  userId: string;
  offerId: string;
  partnerName: string;
  /** Human-readable discount headline, e.g., "15% off prepared meals". */
  discount: string;
  /** Pre-formatted distance like "0.8 mi" or null. */
  distanceText: string | null;
  /** Pre-formatted through-date like "Saturday" or "May 31" or null. */
  throughDateText: string | null;
}): Promise<ApnsSendReport> {
  const headParts: string[] = [args.partnerName];
  if (args.distanceText) headParts.push(args.distanceText);
  const head = headParts.join(", ");
  const through = args.throughDateText ? ` through ${args.throughDateText}` : "";
  const body = `${head}: ${args.discount}${through}.`;
  return sendCategory({
    deps: args.deps,
    userId: args.userId,
    category: "perk_offer",
    title: "Deal near you",
    body,
    extra: {
      offer_id: args.offerId,
      partner_name: args.partnerName,
    },
  });
}

// ─── Shared deps factory ──────────────────────────────────────────────────
//
// Production callers (webhooks, crons) construct ApnsSendDeps from
// (env, db). Tests pass a hand-built struct with stub fetchers. The
// webhooks router was the first caller; the cron jobs (B-T7 weekly digest,
// B-T8 deposit-landed push) share the same shape, so the factory lives
// here instead of being duplicated.

export function makeApnsDeps(env: Env, db: SupabaseClient): ApnsSendDeps {
  return {
    env,
    fetchFn: globalThis.fetch.bind(globalThis),
    now: () => new Date(),
    fetchPrefs: async (userId: string): Promise<ApnsPrefs | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (db.schema('snap_enrollment').from('ebt_notification_prefs' as any) as any)
        .select('deposit_on, low_balance_on, perks_on, recert_on, quiet_start_minutes, quiet_end_minutes')
        .eq('user_id', userId)
        .maybeSingle() as { data: ApnsPrefs | null; error: { message: string } | null };
      if (error) return null;
      return data;
    },
    fetchTokens: async (userId: string): Promise<string[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (db.schema('snap_enrollment').from('ebt_device_tokens' as any) as any)
        .select('apns_token')
        .eq('user_id', userId) as { data: { apns_token: string }[] | null; error: { message: string } | null };
      if (error || !data) return [];
      return data.map((row) => row.apns_token);
    },
  };
}
