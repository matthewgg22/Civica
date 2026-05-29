/**
 * OAuth 2.0 Device Authorization Grant (RFC 8628) — Civica Submitter extension.
 *
 * Issue #317 (V1-8, BenefitsCal bridge epic #308). Part 1 of 3: backend only.
 * The dashboard approval page and the extension client are separate PRs.
 *
 * Flow:
 *   1. Extension → POST /oauth/device/authorize        (no auth)
 *        ← { device_code, user_code, verification_uri, expires_in, interval }
 *   2. Assister opens verification_uri in the Civica dashboard, signs in, and
 *      the dashboard calls POST /oauth/device/approve   (Supabase JWT)
 *        with { user_code } → binds the pending row to the assister's org.
 *   3. Extension polls POST /oauth/device/token         (no auth)
 *        ← authorization_pending | slow_down | expired_token | access_denied
 *        ← { access_token, refresh_token, token_type, expires_in } on success
 *   4. Extension refreshes via POST /oauth/device/token grant_type=refresh_token
 *        ← rotated { access_token, refresh_token, ... }; reuse → family revoked.
 *
 * Two routers are exported because the auth boundary differs:
 *   - publicDeviceRouter  : authorize + token (no Supabase JWT; mounted before
 *                           authMiddleware, like the extension routes).
 *   - authedDeviceRouter  : approve + user_code lookup (requires a staff JWT;
 *                           mounted inside the authed /v1/enrollment subtree so
 *                           authMiddleware resolves actor.orgId for free).
 *
 * Security: see lib/device-token.ts. Codes/tokens are crypto-random and stored
 * SHA-256-hashed; refresh tokens rotate with reuse-detection; access tokens are
 * org-scoped. No plaintext secret is ever logged.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { makeServiceClient } from "../lib/supabase.js";
import { requireNavigator } from "../lib/auth.js";
import { rateLimit } from "../lib/rate-limit.js";
import {
  generateDeviceCode,
  generateUserCode,
  generateTokenSecret,
  hashUserCode,
  sha256Hex,
  DEVICE_CODE_TTL_SECONDS,
  DEVICE_POLL_INTERVAL_SECONDS,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "../lib/device-token.js";
import type { Env } from "../types.js";

// RFC 8628 device_code grant type identifier.
const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

// RFC 6749 §5.2 — OAuth errors are returned as HTTP 400 with { error: "..." }.
// authorization_pending / slow_down are RFC 8628 §3.5 additions.
function oauthError(
  c: import("hono").Context<{ Bindings: Env }>,
  error: string,
  description?: string,
  status: 400 | 401 = 400,
) {
  return c.json(description ? { error, error_description: description } : { error }, status);
}

/** verification_uri the assister opens to approve. Dashboard origin from CORS allowlist. */
function verificationUri(c: import("hono").Context<{ Bindings: Env }>): string {
  // The dashboard hosts the approval page (part 2). Prefer an explicit env
  // override; fall back to the production dashboard origin. Path is a stable
  // contract the dashboard route will implement.
  const base = c.env.EXTENSION_VERIFICATION_BASE_URL ?? "https://civica-api.vercel.app";
  return `${base.replace(/\/$/, "")}/extension/connect`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public router: /oauth/device/authorize + /oauth/device/token
// ─────────────────────────────────────────────────────────────────────────────

export const publicDeviceRouter = new Hono<{ Bindings: Env }>();

/**
 * POST /oauth/device/authorize — no auth.
 * Issues a fresh device_code + user_code and persists a pending row.
 */
publicDeviceRouter.post("/authorize", rateLimit("strict"), async (c) => {
  const deviceCode = generateDeviceCode();
  const userCode = generateUserCode();
  const [deviceCodeHash, userCodeHash] = await Promise.all([
    sha256Hex(deviceCode),
    hashUserCode(userCode),
  ]);

  const now = Date.now();
  const expiresAt = new Date(now + DEVICE_CODE_TTL_SECONDS * 1000).toISOString();

  // Loose, non-PII client hint for the approval screen + audit. Never trusted.
  const clientLabel =
    c.req.header("X-Extension-Id") ?? c.req.header("User-Agent")?.slice(0, 200) ?? null;

  const db = makeServiceClient(c.env);
  const { error } = await db
    .schema("snap_enrollment")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("extension_device_authorizations" as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      device_code_hash: deviceCodeHash,
      user_code_hash: userCodeHash,
      status: "pending",
      interval_seconds: DEVICE_POLL_INTERVAL_SECONDS,
      client_label: clientLabel,
      expires_at: expiresAt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

  if (error) throw new HTTPException(500, { message: error.message });

  // Plaintext device_code + user_code are returned exactly once, here. Never
  // logged, never persisted in the clear.
  return c.json(
    {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: verificationUri(c),
      // RFC 8628 §3.2 optional convenience: a URI the assister can open that
      // pre-fills the user_code. The dashboard page reads ?user_code=.
      verification_uri_complete: `${verificationUri(c)}?user_code=${encodeURIComponent(userCode)}`,
      expires_in: DEVICE_CODE_TTL_SECONDS,
      interval: DEVICE_POLL_INTERVAL_SECONDS,
    },
    200,
  );
});

const tokenBodySchema = z.object({
  grant_type: z.string().min(1),
  device_code: z.string().min(1).optional(),
  refresh_token: z.string().min(1).optional(),
});

/**
 * POST /oauth/device/token — no auth. Polling + refresh exchange.
 *
 * grant_type = urn:ietf:params:oauth:grant-type:device_code → poll/exchange.
 * grant_type = refresh_token                                → rotate.
 */
publicDeviceRouter.post(
  "/token",
  rateLimit("strict"),
  zValidator("json", tokenBodySchema),
  async (c) => {
    const body = c.req.valid("json");
    const db = makeServiceClient(c.env);

    if (body.grant_type === DEVICE_CODE_GRANT) {
      return handleDeviceCodeGrant(c, db, body.device_code);
    }
    if (body.grant_type === "refresh_token") {
      return handleRefreshGrant(c, db, body.refresh_token);
    }
    return oauthError(c, "unsupported_grant_type");
  },
);

// ── device_code grant (poll → exchange) ──────────────────────────────────────

async function handleDeviceCodeGrant(
  c: import("hono").Context<{ Bindings: Env }>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  deviceCode: string | undefined,
) {
  if (!deviceCode) return oauthError(c, "invalid_request", "device_code is required");

  const deviceCodeHash = await sha256Hex(deviceCode);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("extension_device_authorizations")
    .select(
      "device_auth_id, status, org_id, approved_by_staff_id, last_polled_at, interval_seconds, expires_at",
    )
    .eq("device_code_hash", deviceCodeHash)
    .maybeSingle();

  if (error) throw new HTTPException(500, { message: error.message });
  // Unknown device_code → invalid_grant (don't reveal whether it ever existed).
  if (!data) return oauthError(c, "invalid_grant");

  const row = data as {
    device_auth_id: string;
    status: string;
    org_id: string | null;
    approved_by_staff_id: string | null;
    last_polled_at: string | null;
    interval_seconds: number;
    expires_at: string;
  };

  const now = Date.now();

  // RFC 8628 §3.5 slow_down — enforced FIRST, before status, so a too-fast poll
  // always backs off regardless of approval state. On violation we bump the
  // stored interval (RFC: client SHOULD increase its polling interval by 5s).
  if (row.status === "pending" && row.last_polled_at) {
    const sinceLast = (now - new Date(row.last_polled_at).getTime()) / 1000;
    if (sinceLast < row.interval_seconds) {
      const bumped = row.interval_seconds + 5;
      await db
        .schema("snap_enrollment")
        .from("extension_device_authorizations")
        .update({ interval_seconds: bumped, last_polled_at: new Date(now).toISOString() })
        .eq("device_auth_id", row.device_auth_id);
      return oauthError(c, "slow_down");
    }
  }

  // Expiry — covers a pending row past expires_at and a row already swept to
  // 'expired'. Lazy-expire pending rows so a poll after the window is correct
  // even if the cleanup cron hasn't run.
  const isExpired = row.status === "expired" || new Date(row.expires_at).getTime() <= now;
  if (isExpired) {
    if (row.status === "pending") {
      await db
        .schema("snap_enrollment")
        .from("extension_device_authorizations")
        .update({ status: "expired", last_polled_at: new Date(now).toISOString() })
        .eq("device_auth_id", row.device_auth_id);
    }
    return oauthError(c, "expired_token");
  }

  if (row.status === "denied") return oauthError(c, "access_denied");
  // Single-use: a consumed code cannot be exchanged again.
  if (row.status === "consumed") return oauthError(c, "invalid_grant");

  if (row.status === "pending") {
    // Record the poll timestamp for the next slow_down check.
    await db
      .schema("snap_enrollment")
      .from("extension_device_authorizations")
      .update({ last_polled_at: new Date(now).toISOString() })
      .eq("device_auth_id", row.device_auth_id);
    return oauthError(c, "authorization_pending");
  }

  // status === 'approved' → consume the code FIRST, then issue tokens.
  if (!row.org_id || !row.approved_by_staff_id) {
    // Defensive: an approved row must carry org + staff. If not, treat as
    // invalid rather than minting an unscoped token.
    return oauthError(c, "invalid_grant", "approval missing org scope");
  }

  // CLAIM-THEN-ISSUE (single-use under concurrent polls): the conditional
  // update approved → consumed succeeds for exactly ONE racing request. We only
  // mint a token if WE claimed the row (the .select() returns it). A loser sees
  // no row back and returns invalid_grant — it cannot also mint a token. This
  // is the closest to atomic the Supabase JS client allows (no SQL txn).
  const { data: claimed, error: claimErr } = await db
    .schema("snap_enrollment")
    .from("extension_device_authorizations")
    .update({ status: "consumed", consumed_at: new Date(now).toISOString() })
    .eq("device_auth_id", row.device_auth_id)
    .eq("status", "approved")
    .select("device_auth_id")
    .maybeSingle();

  if (claimErr) throw new HTTPException(500, { message: claimErr.message });
  if (!claimed) {
    // Lost the race — another poll already consumed this code. Single-use holds.
    return oauthError(c, "invalid_grant");
  }

  const issued = await issueTokenFamily(db, {
    device_auth_id: row.device_auth_id,
    org_id: row.org_id,
    staff_id: row.approved_by_staff_id,
    family_id: crypto.randomUUID(),
  });

  return tokenResponse(c, issued);
}

// ── refresh_token grant (rotate + reuse-detect) ──────────────────────────────

async function handleRefreshGrant(
  c: import("hono").Context<{ Bindings: Env }>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  refreshToken: string | undefined,
) {
  if (!refreshToken) return oauthError(c, "invalid_request", "refresh_token is required");

  const refreshHash = await sha256Hex(refreshToken);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("extension_device_tokens")
    .select(
      "token_id, family_id, device_auth_id, org_id, staff_id, refresh_expires_at, rotated_at, revoked_at",
    )
    .eq("refresh_token_hash", refreshHash)
    .maybeSingle();

  if (error) throw new HTTPException(500, { message: error.message });
  if (!data) return oauthError(c, "invalid_grant");

  const row = data as {
    token_id: string;
    family_id: string;
    device_auth_id: string;
    org_id: string;
    staff_id: string;
    refresh_expires_at: string;
    rotated_at: string | null;
    revoked_at: string | null;
  };

  // Already revoked (e.g. prior reuse-detection or approval revoke).
  if (row.revoked_at) return oauthError(c, "invalid_grant");

  // REUSE DETECTION: a refresh token that has already been rotated is being
  // presented again. This is the canonical theft signal (RFC 6819 §5.2.2.3).
  // Revoke the ENTIRE family so the attacker AND the legitimate holder are cut
  // off — the legit client re-runs the device flow. Fail closed.
  if (row.rotated_at) {
    await db
      .schema("snap_enrollment")
      .from("extension_device_tokens")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_reason: "refresh_token_reuse_detected",
      })
      .eq("family_id", row.family_id)
      .is("revoked_at", null);
    return oauthError(c, "invalid_grant", "refresh token reuse detected");
  }

  if (new Date(row.refresh_expires_at).getTime() <= Date.now()) {
    return oauthError(c, "invalid_grant", "refresh token expired");
  }

  // Rotate: issue a new pair in the SAME family, then stamp the old row
  // rotated_at. Order matters — if the insert fails we have NOT invalidated the
  // caller's still-valid refresh token (no mid-rotation lockout). The tradeoff
  // is that two *concurrent* uses of the SAME refresh token could both issue
  // before either stamp lands — but that concurrency IS the reuse/theft pattern
  // we revoke on at the next presentation, and the legit extension refreshes
  // serially from one service worker, so we accept it to guarantee no lockout.
  const issued = await issueTokenFamily(db, {
    device_auth_id: row.device_auth_id,
    org_id: row.org_id,
    staff_id: row.staff_id,
    family_id: row.family_id,
  });

  await db
    .schema("snap_enrollment")
    .from("extension_device_tokens")
    .update({ rotated_at: new Date().toISOString() })
    .eq("token_id", row.token_id);

  return tokenResponse(c, issued);
}

// ── token issuance ────────────────────────────────────────────────────────────

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
}

/**
 * Mint one access/refresh pair, persisting only the SHA-256 hashes. Returns
 * the plaintext secrets (returned to the client once, never logged/stored).
 */
async function issueTokenFamily(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  scope: { device_auth_id: string; org_id: string; staff_id: string; family_id: string },
): Promise<IssuedTokens> {
  const accessToken = generateTokenSecret();
  const refreshToken = generateTokenSecret();
  const [accessTokenHash, refreshTokenHash] = await Promise.all([
    sha256Hex(accessToken),
    sha256Hex(refreshToken),
  ]);

  const now = Date.now();
  const accessExpiresAt = new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString();
  const refreshExpiresAt = new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString();

  const { error } = await db
    .schema("snap_enrollment")
    .from("extension_device_tokens")
    .insert({
      family_id: scope.family_id,
      device_auth_id: scope.device_auth_id,
      org_id: scope.org_id,
      staff_id: scope.staff_id,
      access_token_hash: accessTokenHash,
      refresh_token_hash: refreshTokenHash,
      access_expires_at: accessExpiresAt,
      refresh_expires_at: refreshExpiresAt,
    });

  if (error) throw new HTTPException(500, { message: error.message });

  return { accessToken, refreshToken, accessExpiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

function tokenResponse(c: import("hono").Context<{ Bindings: Env }>, issued: IssuedTokens) {
  return c.json(
    {
      access_token: issued.accessToken,
      refresh_token: issued.refreshToken,
      token_type: "bearer",
      expires_in: issued.accessExpiresIn,
    },
    200,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Authed router: /oauth/device/approve + /oauth/device/lookup
// Mounted inside the authed /v1/enrollment subtree (authMiddleware resolves the
// staff actor + orgId).
// ─────────────────────────────────────────────────────────────────────────────

export const authedDeviceRouter = new Hono<{ Bindings: Env }>();

const approveBodySchema = z.object({
  user_code: z.string().min(1).max(32),
});

/**
 * GET /oauth/device/lookup?user_code=XXXX-XXXX — authenticated (staff).
 * Returns minimal, non-secret details for the approval screen to render
 * "Connect this device?" Does NOT mutate. 404 if unknown/expired.
 */
authedDeviceRouter.get("/lookup", async (c) => {
  const actor = c.get("actor");
  requireNavigator(actor.kind);

  const userCodeRaw = c.req.query("user_code");
  if (!userCodeRaw) throw new HTTPException(400, { message: "user_code is required" });

  const userCodeHash = await hashUserCode(userCodeRaw);
  const db = makeServiceClient(c.env);
  const { data, error } = await db
    .schema("snap_enrollment")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("extension_device_authorizations" as any)
    .select("device_auth_id, status, client_label, expires_at")
    .eq("user_code_hash", userCodeHash)
    .maybeSingle();

  if (error) throw new HTTPException(500, { message: error.message });
  const row = data as
    | { device_auth_id: string; status: string; client_label: string | null; expires_at: string }
    | null;
  if (!row) throw new HTTPException(404, { message: "Unknown or expired code" });
  if (row.status !== "pending" || new Date(row.expires_at).getTime() <= Date.now()) {
    throw new HTTPException(404, { message: "Code is no longer pending" });
  }

  return c.json({
    status: row.status,
    client_label: row.client_label,
    expires_at: row.expires_at,
  });
});

/**
 * POST /oauth/device/approve — authenticated (staff).
 * Binds the pending device row to the signed-in assister's org + staff id and
 * marks it approved. The dashboard approval page (part 2) calls this.
 *
 * Auth: requireNavigator (navigator | admin). A staff actor carries orgId from
 * authMiddleware (resolved from snap_enrollment.staff_users). We bind to THAT
 * org — never to anything the request body claims — so the extension can only
 * ever receive a token scoped to the approver's own CBO.
 */
authedDeviceRouter.post(
  "/approve",
  rateLimit("strict"),
  zValidator("json", approveBodySchema),
  async (c) => {
    const actor = c.get("actor");
    requireNavigator(actor.kind);

    // A staff actor MUST have an org. If somehow absent, refuse — minting an
    // unscoped approval would let the extension read with no org boundary.
    if (!actor.orgId) {
      throw new HTTPException(403, {
        message: "Your account has no organization; cannot approve a device.",
      });
    }

    const { user_code } = c.req.valid("json");
    const userCodeHash = await hashUserCode(user_code);
    const db = makeServiceClient(c.env);

    const { data, error } = await db
      .schema("snap_enrollment")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("extension_device_authorizations" as any)
      .select("device_auth_id, status, expires_at")
      .eq("user_code_hash", userCodeHash)
      .maybeSingle();

    if (error) throw new HTTPException(500, { message: error.message });
    const row = data as
      | { device_auth_id: string; status: string; expires_at: string }
      | null;
    if (!row) throw new HTTPException(404, { message: "Unknown or expired code" });

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      throw new HTTPException(410, { message: "Code has expired" });
    }
    if (row.status === "approved" || row.status === "consumed") {
      throw new HTTPException(409, { message: "Code has already been approved" });
    }
    if (row.status !== "pending") {
      throw new HTTPException(409, { message: `Code is not pending (status: ${row.status})` });
    }

    // Approve only if STILL pending (guards a concurrent approve race).
    const { data: updated, error: updateErr } = await db
      .schema("snap_enrollment")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("extension_device_authorizations" as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({
        status: "approved",
        approved_by_staff_id: actor.id,
        org_id: actor.orgId,
        approved_at: new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .eq("device_auth_id", row.device_auth_id)
      .eq("status", "pending")
      .select("device_auth_id, status")
      .maybeSingle();

    if (updateErr) throw new HTTPException(500, { message: updateErr.message });
    if (!updated) {
      // Lost the race — someone approved/denied between our read and write.
      throw new HTTPException(409, { message: "Code is no longer pending" });
    }

    return c.json({ approved: true }, 200);
  },
);

/**
 * POST /oauth/device/deny — authenticated (staff). Optional companion to
 * approve so a mistyped/unrecognized connection can be rejected; the polling
 * extension then receives access_denied. Same org-agnostic safety: denying
 * doesn't bind any scope.
 */
authedDeviceRouter.post(
  "/deny",
  rateLimit("strict"),
  zValidator("json", approveBodySchema),
  async (c) => {
    const actor = c.get("actor");
    requireNavigator(actor.kind);

    const { user_code } = c.req.valid("json");
    const userCodeHash = await hashUserCode(user_code);
    const db = makeServiceClient(c.env);

    const { data: updated, error } = await db
      .schema("snap_enrollment")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("extension_device_authorizations" as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ status: "denied" } as any)
      .eq("user_code_hash", userCodeHash)
      .eq("status", "pending")
      .select("device_auth_id")
      .maybeSingle();

    if (error) throw new HTTPException(500, { message: error.message });
    if (!updated) throw new HTTPException(404, { message: "Unknown or non-pending code" });

    return c.json({ denied: true }, 200);
  },
);
