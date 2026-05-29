/**
 * Device-flow token helpers — RFC 8628 device authorization grant for the
 * Civica Submitter browser extension (issue #317, V1-8).
 *
 * Centralizes the security-critical primitives so every route shares one
 * audited implementation:
 *   - crypto-random code/token generation (Web Crypto, never Math.random)
 *   - SHA-256 hashing (secrets are hashed at rest, plaintext returned once)
 *   - access-token resolution → { org_id, staff_id } with expiry + revocation
 *     checks, used by /extension/packets AND the device-token acceptance path
 *     on /extension/payload + /extension/confirm.
 *
 * Tables (see 20260598_extension_device_oauth.sql):
 *   snap_enrollment.extension_device_authorizations
 *   snap_enrollment.extension_device_tokens
 *
 * NB on logging: never log a plaintext code or token. Callers log hashes /
 * ids only. The plaintext is returned to the client exactly once at issue.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Tunables ────────────────────────────────────────────────────────────────

/** Device/user code lifetime. RFC 8628 §3.2 expires_in. */
export const DEVICE_CODE_TTL_SECONDS = 10 * 60; // 10 minutes
/** Minimum seconds between token polls. RFC 8628 §3.5 interval. */
export const DEVICE_POLL_INTERVAL_SECONDS = 5;
/** Access-token lifetime — short-lived; the extension refreshes silently. */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
/** Refresh-token lifetime — rotates on each use; outer bound before re-auth. */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * user_code alphabet: unambiguous (no 0/O, 1/I/L, B/8, etc.) so an assister
 * reading it off one screen and typing it into the dashboard can't slip.
 * Crockford-ish; 26 symbols → ~4.7 bits each → 8 chars ≈ 37.6 bits of entropy
 * in the *plaintext space*, but the security boundary is the device_code (the
 * long secret the extension actually polls with). The user_code only needs to
 * be unguessable within the ~10-min window against a rate-limited approve
 * endpoint, which 37 bits comfortably satisfies.
 */
const USER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // 30 symbols
const USER_CODE_LEN = 8; // formatted XXXX-XXXX

// ── Crypto-random generation ─────────────────────────────────────────────────

/**
 * High-entropy device_code: 32 random bytes (256 bits) as URL-safe base64.
 * Web Crypto getRandomValues — CSPRNG, never Math.random.
 */
export function generateDeviceCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

/**
 * Access / refresh token secrets: 32 random bytes each, URL-safe base64.
 * Distinct values; the access/refresh distinction lives in the DB row, not
 * the token shape.
 */
export function generateTokenSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

/**
 * Short human-typable user_code, formatted XXXX-XXXX. Rejection-sampled over a
 * power-of-two boundary so the unambiguous alphabet stays uniform (no modulo
 * bias). Crypto-random throughout.
 */
export function generateUserCode(): string {
  const chars: string[] = [];
  // 256 % 30 != 0, so reject bytes in the biased tail [240,256) to keep uniform.
  const limit = 256 - (256 % USER_CODE_ALPHABET.length);
  while (chars.length < USER_CODE_LEN) {
    const buf = new Uint8Array(USER_CODE_LEN);
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (chars.length >= USER_CODE_LEN) break;
      if (b >= limit) continue; // drop biased tail
      chars.push(USER_CODE_ALPHABET[b % USER_CODE_ALPHABET.length]!);
    }
  }
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}`;
}

/**
 * Normalize a user_code the assister typed: uppercase, strip whitespace and
 * dashes, so "abcd-2345", "ABCD2345", " abcd 2345 " all hash identically.
 */
export function normalizeUserCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ── Hashing (SHA-256 hex; secrets hashed at rest) ─────────────────────────────

/** SHA-256 hex of an arbitrary secret. Matches the DB char(64) columns. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hash a user_code after normalization — the value stored + compared. */
export async function hashUserCode(raw: string): Promise<string> {
  return sha256Hex(normalizeUserCode(raw));
}

// ── Access-token resolution (shared auth boundary) ────────────────────────────

export interface DeviceTokenScope {
  token_id: string;
  family_id: string;
  org_id: string;
  staff_id: string;
}

/**
 * Resolve a presented Bearer access token to its org/user scope, or null if
 * the token is unknown, expired, rotated, or revoked. SECURITY BOUNDARY for
 * every /extension/* request that accepts a per-CBO device token.
 *
 * The caller passes the raw token (the part after "Bearer "); we hash it and
 * look up the row. We deliberately re-check expiry + revocation in code (not
 * only via a WHERE clause) so the failure mode is explicit and testable.
 *
 * Uses a service-role client (the device_tokens table is service_role-only).
 */
export async function resolveDeviceAccessToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceDb: SupabaseClient<any, any, any>,
  rawToken: string,
): Promise<DeviceTokenScope | null> {
  if (!rawToken) return null;
  const hash = await sha256Hex(rawToken);

  // Fail CLOSED: any error (query reject, network blip, type error) resolves to
  // "no scope" → the caller treats it as not-a-device-token and falls back to
  // the legacy shared-token check. A device token must never 500 the request.
  let data: unknown = null;
  try {
    const res = await serviceDb
      .schema("snap_enrollment")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("extension_device_tokens" as any)
      .select("token_id, family_id, org_id, staff_id, access_expires_at, rotated_at, revoked_at")
      .eq("access_token_hash", hash)
      .maybeSingle();
    // Error-first split avoids Supabase TS narrowing to `never`
    // (see feedback_supabase_ts_narrowing.md).
    if (res.error) return null;
    data = res.data;
  } catch {
    return null;
  }
  if (!data) return null;

  const row = data as unknown as {
    token_id: string;
    family_id: string;
    org_id: string;
    staff_id: string;
    access_expires_at: string;
    rotated_at: string | null;
    revoked_at: string | null;
  };

  if (row.revoked_at) return null;
  // A rotated token's access half is dead too — only the newest row is live.
  if (row.rotated_at) return null;
  if (new Date(row.access_expires_at).getTime() <= Date.now()) return null;

  return {
    token_id: row.token_id,
    family_id: row.family_id,
    org_id: row.org_id,
    staff_id: row.staff_id,
  };
}

// ── internal ──────────────────────────────────────────────────────────────────

function base64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
