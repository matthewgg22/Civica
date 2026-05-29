// OAuth 2.0 Device Authorization Grant (RFC 8628) client — Civica Submitter.
//
// Issue #317 (V1-8, BenefitsCal bridge epic #308). Part 3 of 3: the extension
// client that consumes the part-1 enrollment-api endpoints. This module owns:
//   - the device-flow protocol (authorize → poll → token, plus refresh), and
//   - token storage in chrome.storage.SESSION (in-memory, cleared on browser
//     restart — the secure posture the #317 review assumed; re-connecting once
//     per browser session is acceptable and intentional).
//
// SECURITY: tokens and the user_code are NEVER logged. Tokens live ONLY in
// chrome.storage.session, never chrome.storage.local (which persists to disk).
//
// The endpoints live under the gateway's /v1/enrollment/oauth/device subtree
// (see apps/enrollment-api/src/index.ts → publicDeviceRouter). The base URL is
// the same `civica.baseUrl` the rest of the extension uses (config.ts).

import { readConfig } from "../config";

// RFC 8628 device_code grant type identifier (must match the backend).
const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

// ---------------------------------------------------------------------------
// Wire shapes (mirror apps/enrollment-api/src/routes/oauth.ts exactly)
// ---------------------------------------------------------------------------

/** POST /oauth/device/authorize success body. */
export interface DeviceAuthorization {
  device_code: string;
  user_code: string;
  verification_uri: string;
  /** A URI that pre-fills the user_code (?user_code=…) — what the popup opens. */
  verification_uri_complete: string;
  /** Seconds until the device_code expires. */
  expires_in: number;
  /** Seconds the client SHOULD wait between token polls. */
  interval: number;
}

/** POST /oauth/device/token success body (device_code grant + refresh grant). */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  /** Seconds until the access_token expires. */
  expires_in: number;
}

/** RFC 6749 §5.2 OAuth error body (HTTP 400 + { error }). */
type OAuthErrorCode =
  | "authorization_pending"
  | "slow_down"
  | "expired_token"
  | "access_denied"
  | "invalid_grant"
  | "invalid_request"
  | "unsupported_grant_type"
  | string;

/** A poll/refresh that failed terminally (expired/denied/network). */
export class DeviceFlowError extends Error {
  constructor(
    /** A stable code the popup switches on for its error state. */
    readonly code: "expired" | "denied" | "network" | "server" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "DeviceFlowError";
  }
}

// ---------------------------------------------------------------------------
// Endpoint helpers
// ---------------------------------------------------------------------------

function trimBase(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

function authorizeUrl(baseUrl: string): string {
  return `${trimBase(baseUrl)}/v1/enrollment/oauth/device/authorize`;
}

function tokenUrl(baseUrl: string): string {
  return `${trimBase(baseUrl)}/v1/enrollment/oauth/device/token`;
}

/** Read the OAuth `error` code from a 400 body, if present. */
function oauthErrorCode(body: unknown): OAuthErrorCode | null {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error: unknown }).error;
    if (typeof e === "string") return e;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. Authorize
// ---------------------------------------------------------------------------

/**
 * POST /oauth/device/authorize — no auth. Starts a fresh device authorization
 * and returns the user_code + verification URIs for the popup to display.
 */
export async function startDeviceAuthorization(
  baseUrl?: string,
): Promise<DeviceAuthorization> {
  const base = baseUrl ?? (await readConfig()).baseUrl;
  let res: Response;
  try {
    res = await fetch(authorizeUrl(base), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      // Body is optional for the backend, but POST with an explicit empty JSON
      // object avoids any "missing content-type" edge in middleware.
      body: "{}",
    });
  } catch (err) {
    throw new DeviceFlowError(
      "network",
      err instanceof Error ? err.message : "network error",
    );
  }

  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new DeviceFlowError("server", `authorize failed (HTTP ${res.status})`);
  }
  if (!isDeviceAuthorization(body)) {
    throw new DeviceFlowError("server", "authorize returned an unexpected shape");
  }
  return body;
}

function isDeviceAuthorization(v: unknown): v is DeviceAuthorization {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.device_code === "string" &&
    typeof o.user_code === "string" &&
    typeof o.verification_uri === "string" &&
    typeof o.verification_uri_complete === "string" &&
    typeof o.expires_in === "number" &&
    typeof o.interval === "number"
  );
}

// ---------------------------------------------------------------------------
// 2. Poll for token
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/**
 * One token-endpoint poll for a device_code grant. Returns:
 *   - a TokenResponse on approval,
 *   - "pending" while the assister hasn't approved yet,
 *   - "slow_down" when the backend asks us to back off,
 * and throws DeviceFlowError on expiry/denied/network/server.
 *
 * Exported for unit testing the single-step protocol; `pollForToken` drives the
 * loop.
 */
export async function pollOnce(
  baseUrl: string,
  deviceCode: string,
): Promise<TokenResponse | "pending" | "slow_down"> {
  let res: Response;
  try {
    res = await fetch(tokenUrl(baseUrl), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: DEVICE_CODE_GRANT,
        device_code: deviceCode,
      }),
    });
  } catch (err) {
    throw new DeviceFlowError(
      "network",
      err instanceof Error ? err.message : "network error",
    );
  }

  const body: unknown = await res.json().catch(() => ({}));

  if (res.ok) {
    if (isTokenResponse(body)) return body;
    throw new DeviceFlowError("server", "token endpoint returned an unexpected shape");
  }

  // RFC 6749 §5.2 / RFC 8628 §3.5 — OAuth errors are HTTP 400 + { error }.
  const code = oauthErrorCode(body);
  switch (code) {
    case "authorization_pending":
      return "pending";
    case "slow_down":
      return "slow_down";
    case "expired_token":
      throw new DeviceFlowError("expired", "The code expired. Start over.");
    case "access_denied":
      throw new DeviceFlowError("denied", "The connection was declined.");
    case "invalid_grant":
      // Unknown/consumed code — treat as expired from the user's POV (re-start).
      throw new DeviceFlowError("expired", "The code is no longer valid. Start over.");
    default:
      throw new DeviceFlowError("server", `token poll failed (HTTP ${res.status})`);
  }
}

function isTokenResponse(v: unknown): v is TokenResponse {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.access_token === "string" &&
    typeof o.refresh_token === "string" &&
    typeof o.token_type === "string" &&
    typeof o.expires_in === "number"
  );
}

export interface PollOptions {
  /** Aborts the poll loop (popup closed / user cancelled). */
  signal?: AbortSignal;
  /** Test seam: replaces the inter-poll delay (defaults to real setTimeout). */
  wait?: (ms: number) => Promise<void>;
}

/**
 * Polls POST /oauth/device/token until the assister approves (→ TokenResponse),
 * honoring the server's `interval` and backing off +5s on `slow_down`
 * (RFC 8628 §3.5). Rejects with a DeviceFlowError on expiry/denied/network, or
 * an AbortError if `signal` aborts.
 *
 * NB (MV3): we poll from the POPUP, while it's open — MV3 service workers are
 * ephemeral and cannot reliably run a multi-minute timer. The popup awaits this.
 */
export async function pollForToken(
  deviceCode: string,
  intervalSeconds: number,
  opts: PollOptions = {},
): Promise<TokenResponse> {
  const base = (await readConfig()).baseUrl;
  const wait = opts.wait ?? sleep;
  let intervalMs = Math.max(1, intervalSeconds) * 1000;

  for (;;) {
    if (opts.signal?.aborted) throw makeAbortError();
    await wait(intervalMs);
    if (opts.signal?.aborted) throw makeAbortError();

    const result = await pollOnce(base, deviceCode);
    if (result === "pending") continue;
    if (result === "slow_down") {
      // RFC 8628: client SHOULD increase its polling interval by 5 seconds.
      intervalMs += 5000;
      continue;
    }
    // TokenResponse — store and return.
    await storeTokens(result);
    return result;
  }
}

function makeAbortError(): Error {
  const e = new Error("Polling aborted");
  e.name = "AbortError";
  return e;
}

// ---------------------------------------------------------------------------
// 3. Refresh
// ---------------------------------------------------------------------------

/**
 * POST /oauth/device/token grant_type=refresh_token — rotates the token family.
 * Stores the rotated pair on success. Throws DeviceFlowError on a hard failure
 * (the caller then signals "reconnect needed" and clears tokens).
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const base = (await readConfig()).baseUrl;
  let res: Response;
  try {
    res = await fetch(tokenUrl(base), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
  } catch (err) {
    throw new DeviceFlowError(
      "network",
      err instanceof Error ? err.message : "network error",
    );
  }

  const body: unknown = await res.json().catch(() => ({}));
  if (res.ok && isTokenResponse(body)) {
    await storeTokens(body);
    return body;
  }
  // Any refresh failure (invalid_grant / reuse-detected / expired) is terminal:
  // the family is gone. Clear and force a reconnect.
  await clearTokens();
  const code = oauthErrorCode(body);
  if (code === "invalid_grant") {
    throw new DeviceFlowError("invalid", "Session expired — reconnect with Civica.");
  }
  throw new DeviceFlowError("server", `refresh failed (HTTP ${res.status})`);
}

// ---------------------------------------------------------------------------
// Token storage (chrome.storage.SESSION — in-memory, cleared on restart)
// ---------------------------------------------------------------------------

export const TOKEN_STORAGE_KEY = "civica.deviceTokens";

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms at which the access token expires. */
  accessExpiresAt: number;
}

/**
 * The session storage area. chrome.storage.session is in-memory and cleared
 * when the browser fully closes — exactly the posture #317 assumed for these
 * org-scoped tokens. We resolve it lazily so importing this module never throws
 * if a (test) environment hasn't stubbed `session` yet.
 */
function sessionArea(): chrome.storage.StorageArea {
  const area = (chrome.storage as { session?: chrome.storage.StorageArea }).session;
  if (!area) {
    throw new Error("chrome.storage.session is unavailable (MV3 / Chrome 102+ required).");
  }
  return area;
}

/** Persist a freshly-issued/rotated token pair. Access expiry is computed with
 * a safety skew so we refresh slightly before the server-side expiry. */
async function storeTokens(t: TokenResponse): Promise<void> {
  const SKEW_SECONDS = 30;
  const accessExpiresAt = Date.now() + Math.max(0, t.expires_in - SKEW_SECONDS) * 1000;
  const stored: StoredTokens = {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    accessExpiresAt,
  };
  await sessionArea().set({ [TOKEN_STORAGE_KEY]: stored });
}

async function readStoredTokens(): Promise<StoredTokens | null> {
  const raw = await sessionArea().get(TOKEN_STORAGE_KEY);
  const v = raw[TOKEN_STORAGE_KEY];
  if (
    v &&
    typeof v === "object" &&
    typeof (v as StoredTokens).accessToken === "string" &&
    typeof (v as StoredTokens).refreshToken === "string" &&
    typeof (v as StoredTokens).accessExpiresAt === "number"
  ) {
    return v as StoredTokens;
  }
  return null;
}

/** True if a token pair is present in session storage (connected this session). */
export async function isConnected(): Promise<boolean> {
  return (await readStoredTokens()) !== null;
}

/**
 * Returns a usable access token, refreshing first if the stored one is expired
 * (or within the safety skew). Returns null if not connected. Throws a
 * DeviceFlowError("invalid"|"network"|"server") if a refresh was needed but
 * failed — the caller treats that as "reconnect needed".
 */
export async function getAccessToken(): Promise<string | null> {
  const stored = await readStoredTokens();
  if (!stored) return null;
  if (Date.now() < stored.accessExpiresAt) {
    return stored.accessToken;
  }
  // Expired (or about to) — rotate. refreshAccessToken stores the new pair.
  const rotated = await refreshAccessToken(stored.refreshToken);
  return rotated.access_token;
}

/**
 * Forces a refresh using the stored refresh token and returns the new access
 * token. Used by background.ts on a 401 (the server rejected an access token we
 * still believed was valid). Returns null if not connected.
 */
export async function forceRefresh(): Promise<string | null> {
  const stored = await readStoredTokens();
  if (!stored) return null;
  const rotated = await refreshAccessToken(stored.refreshToken);
  return rotated.access_token;
}

/** Disconnect: drop the token pair from session storage. */
export async function clearTokens(): Promise<void> {
  await sessionArea().remove(TOKEN_STORAGE_KEY);
}
