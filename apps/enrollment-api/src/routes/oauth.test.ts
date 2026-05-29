/**
 * Device-flow (RFC 8628) backend tests — issue #317 part 1.
 *
 * Strategy: a STATEFUL in-memory fake of the two device tables
 * (extension_device_authorizations, extension_device_tokens) that implements
 * the exact Supabase chain methods the routes call (insert / select+eq+
 * maybeSingle / update+eq+[eq]+select+maybeSingle / order). A static
 * data-in/out mock can't exercise rotation, reuse-detection, single-use, or
 * slow_down because those depend on rows mutating between calls — so we fake
 * the store and assert on real control flow.
 *
 * The public authorize/token endpoints take no auth; approve/lookup/deny use
 * buildTestApp to inject a staff actor (NAVIGATOR carries orgId 'org-001').
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/supabase.js", () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { makeServiceClient } from "../lib/supabase.js";
import { publicDeviceRouter, authedDeviceRouter } from "./oauth.js";
import { TEST_ENV, NAVIGATOR, APPLICANT, buildTestApp, JSON_HEADERS } from "../test/helpers.js";
import { sha256Hex, hashUserCode } from "../lib/device-token.js";
import type { Env } from "../types.js";

const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

// Typed json() — res.json() is Promise<unknown>; this keeps property access tidy.
async function body(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stateful in-memory fake of the device tables.
// ─────────────────────────────────────────────────────────────────────────────

interface AuthRow {
  device_auth_id: string;
  device_code_hash: string;
  user_code_hash: string;
  status: string;
  approved_by_staff_id: string | null;
  org_id: string | null;
  last_polled_at: string | null;
  interval_seconds: number;
  client_label: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  approved_at: string | null;
  consumed_at: string | null;
}

interface TokenRow {
  token_id: string;
  family_id: string;
  device_auth_id: string;
  org_id: string;
  staff_id: string;
  access_token_hash: string;
  refresh_token_hash: string;
  access_expires_at: string;
  refresh_expires_at: string;
  rotated_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
}

class FakeStore {
  auths: AuthRow[] = [];
  tokens: TokenRow[] = [];
  private seq = 0;
  id(prefix: string) {
    this.seq += 1;
    return `${prefix}-${this.seq.toString().padStart(4, "0")}`;
  }
}

// Builds a Supabase-shaped client backed by the FakeStore. Only the chains the
// device-flow routes actually use are implemented; anything else throws so a
// drift in the route surfaces loudly instead of silently passing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeFakeClient(store: FakeStore): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function tableApi(table: string): any {
    const rows = (): Array<Record<string, unknown>> =>
      table === "extension_device_authorizations"
        ? (store.auths as unknown as Array<Record<string, unknown>>)
        : (store.tokens as unknown as Array<Record<string, unknown>>);

    return {
      // INSERT — assign defaults the DB would, push, return { error: null }.
      insert(values: Record<string, unknown>) {
        if (table === "extension_device_authorizations") {
          const now = new Date().toISOString();
          store.auths.push({
            device_auth_id: store.id("auth"),
            device_code_hash: values.device_code_hash as string,
            user_code_hash: values.user_code_hash as string,
            status: (values.status as string) ?? "pending",
            approved_by_staff_id: (values.approved_by_staff_id as string) ?? null,
            org_id: (values.org_id as string) ?? null,
            last_polled_at: null,
            interval_seconds: (values.interval_seconds as number) ?? 5,
            client_label: (values.client_label as string) ?? null,
            created_at: now,
            updated_at: now,
            expires_at: values.expires_at as string,
            approved_at: null,
            consumed_at: null,
          });
        } else {
          store.tokens.push({
            token_id: store.id("token"),
            family_id: values.family_id as string,
            device_auth_id: values.device_auth_id as string,
            org_id: values.org_id as string,
            staff_id: values.staff_id as string,
            access_token_hash: values.access_token_hash as string,
            refresh_token_hash: values.refresh_token_hash as string,
            access_expires_at: values.access_expires_at as string,
            refresh_expires_at: values.refresh_expires_at as string,
            rotated_at: null,
            revoked_at: null,
            revoked_reason: null,
            created_at: new Date().toISOString(),
          });
        }
        return Promise.resolve({ data: null, error: null });
      },

      // SELECT … .eq().[eq()].maybeSingle()  OR  .in().order() (thenable list)
      select(_cols: string) {
        const filters: Array<(r: Record<string, unknown>) => boolean> = [];
        const builder = {
          eq(col: string, val: unknown) {
            filters.push((r) => r[col] === val);
            return builder;
          },
          in(col: string, vals: unknown[]) {
            filters.push((r) => vals.includes(r[col]));
            return builder;
          },
          is(col: string, val: unknown) {
            filters.push((r) => (r[col] ?? null) === val);
            return builder;
          },
          order() {
            return builder;
          },
          maybeSingle() {
            const match = rows().find((r) => filters.every((f) => f(r))) ?? null;
            return Promise.resolve({ data: match ? { ...match } : null, error: null });
          },
          // thenable for list reads (.order() … await)
          then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
            const matched = rows()
              .filter((r) => filters.every((f) => f(r)))
              .map((r) => ({ ...r }));
            return Promise.resolve({ data: matched, error: null }).then(res, rej);
          },
        };
        return builder;
      },

      // UPDATE … .eq().[eq()/.is()].[select().maybeSingle()]
      update(patch: Record<string, unknown>) {
        const filters: Array<(r: Record<string, unknown>) => boolean> = [];
        let selecting = false;
        const apply = () => {
          const matched = rows().filter((r) => filters.every((f) => f(r)));
          for (const r of matched) Object.assign(r, patch);
          return matched;
        };
        const builder = {
          eq(col: string, val: unknown) {
            filters.push((r) => r[col] === val);
            return builder;
          },
          is(col: string, val: unknown) {
            filters.push((r) => (r[col] ?? null) === val);
            return builder;
          },
          select() {
            selecting = true;
            return builder;
          },
          maybeSingle() {
            const matched = apply();
            return Promise.resolve({
              data: matched[0] ? { ...matched[0] } : null,
              error: null,
            });
          },
          // bare update (no .select()) is awaited directly
          then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
            const matched = apply();
            const data = selecting ? matched.map((r) => ({ ...r })) : null;
            return Promise.resolve({ data, error: null }).then(res, rej);
          },
        };
        return builder;
      },
    };
  }

  return {
    schema: vi.fn().mockReturnValue({ from: vi.fn((table: string) => tableApi(table)) }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// App builders
// ─────────────────────────────────────────────────────────────────────────────

function buildPublicApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/oauth/device", publicDeviceRouter);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: "Internal server error" }, 500);
  });
  return app;
}

// authed app: buildTestApp injects the actor (NAVIGATOR has orgId 'org-001').
function buildApproveApp(actor = NAVIGATOR) {
  const app = buildTestApp(authedDeviceRouter, "/oauth/device", actor);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: "Internal server error" }, 500);
  });
  return app;
}

// ─────────────────────────────────────────────────────────────────────────────

let store: FakeStore;

beforeEach(() => {
  store = new FakeStore();
  vi.mocked(makeServiceClient).mockImplementation(() => makeFakeClient(store));
});
afterEach(() => vi.resetAllMocks());

// Helper: run authorize and return the parsed body.
async function authorize(): Promise<{
  device_code: string;
  user_code: string;
  expires_in: number;
  interval: number;
  verification_uri: string;
}> {
  const app = buildPublicApp();
  const res = await app.request("/oauth/device/authorize", { method: "POST" }, TEST_ENV);
  expect(res.status).toBe(200);
  return res.json();
}

async function poll(device_code: string) {
  const app = buildPublicApp();
  return app.request(
    "/oauth/device/token",
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ grant_type: DEVICE_GRANT, device_code }),
    },
    TEST_ENV,
  );
}

async function refresh(refresh_token: string) {
  const app = buildPublicApp();
  return app.request(
    "/oauth/device/token",
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ grant_type: "refresh_token", refresh_token }),
    },
    TEST_ENV,
  );
}

async function approve(user_code: string, actor = NAVIGATOR) {
  const app = buildApproveApp(actor);
  return app.request(
    "/oauth/device/approve",
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ user_code }) },
    TEST_ENV,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// authorize
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /oauth/device/authorize", () => {
  it("issues a device_code, user_code, verification_uri, expiry, and interval", async () => {
    const body = await authorize();
    expect(typeof body.device_code).toBe("string");
    expect(body.device_code.length).toBeGreaterThanOrEqual(40); // 32 bytes b64url
    expect(body.user_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/); // unambiguous alphabet
    expect(body.expires_in).toBe(600);
    expect(body.interval).toBe(5);
    expect(body.verification_uri).toContain("/extension/connect");
  });

  it("persists a pending row with HASHED codes (never plaintext)", async () => {
    const body = await authorize();
    expect(store.auths).toHaveLength(1);
    const row = store.auths[0]!;
    expect(row.status).toBe("pending");
    // The stored hashes match SHA-256 of the issued plaintext — and are NOT the
    // plaintext itself.
    expect(row.device_code_hash).toBe(await sha256Hex(body.device_code));
    expect(row.user_code_hash).toBe(await hashUserCode(body.user_code));
    expect(row.device_code_hash).not.toBe(body.device_code);
    expect(row.device_code_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates distinct device_codes across calls (CSPRNG, not constant)", async () => {
    const a = await authorize();
    const b = await authorize();
    expect(a.device_code).not.toBe(b.device_code);
    expect(a.user_code).not.toBe(b.user_code);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// token — poll lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /oauth/device/token — device_code grant", () => {
  it("returns authorization_pending while unapproved", async () => {
    const { device_code } = await authorize();
    const res = await poll(device_code);
    expect(res.status).toBe(400);
    expect((await body(res)).error).toBe("authorization_pending");
  });

  it("returns invalid_grant for an unknown device_code", async () => {
    const res = await poll("totally-unknown-code");
    expect(res.status).toBe(400);
    expect((await body(res)).error).toBe("invalid_grant");
  });

  it("returns tokens after approval, then consumes the code (single-use)", async () => {
    const { device_code, user_code } = await authorize();

    // First poll → pending (also stamps last_polled_at).
    expect((await body(await poll(device_code))).error).toBe("authorization_pending");

    // Approve from the dashboard (staff actor, org-001).
    const approveRes = await approve(user_code);
    expect(approveRes.status).toBe(200);
    expect((await body(approveRes)).approved).toBe(true);

    // Wait past the poll interval so slow_down doesn't fire, then poll → tokens.
    const row = store.auths[0]!;
    row.last_polled_at = new Date(Date.now() - 10_000).toISOString();

    const tokenRes = await poll(device_code);
    expect(tokenRes.status).toBe(200);
    const tok = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
    };
    expect(tok.token_type).toBe("bearer");
    expect(tok.expires_in).toBe(3600);
    expect(typeof tok.access_token).toBe("string");
    expect(typeof tok.refresh_token).toBe("string");

    // Token row persisted with HASHED secrets + org/staff scope.
    expect(store.tokens).toHaveLength(1);
    const tr = store.tokens[0]!;
    expect(tr.org_id).toBe("org-001");
    expect(tr.staff_id).toBe(NAVIGATOR.id);
    expect(tr.access_token_hash).toBe(await sha256Hex(tok.access_token));
    expect(tr.access_token_hash).not.toBe(tok.access_token);

    // The auth row is consumed (single-use).
    expect(store.auths[0]!.status).toBe("consumed");

    // Re-polling a consumed code fails (cannot mint a second token).
    store.auths[0]!.last_polled_at = new Date(Date.now() - 10_000).toISOString();
    const replay = await poll(device_code);
    expect(replay.status).toBe(400);
    expect((await body(replay)).error).toBe("invalid_grant");
    expect(store.tokens).toHaveLength(1); // no second token minted
  });

  it("mints at most ONE token family even when two approved polls race (claim-then-issue)", async () => {
    const { device_code, user_code } = await authorize();
    await poll(device_code); // pending + stamp
    await approve(user_code);
    store.auths[0]!.last_polled_at = new Date(Date.now() - 10_000).toISOString();

    // Two concurrent post-approval polls. Only one may claim approved→consumed
    // and mint a token; the other must get invalid_grant. Single-use holds.
    const [a, b] = await Promise.all([poll(device_code), poll(device_code)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 400]);
    expect(store.tokens).toHaveLength(1); // exactly one family minted
    expect(store.auths[0]!.status).toBe("consumed");
  });

  it("returns slow_down when polled faster than the interval", async () => {
    const { device_code } = await authorize();
    // First poll stamps last_polled_at = now.
    await poll(device_code);
    // Immediate second poll is within the 5s interval → slow_down + bump.
    const res = await poll(device_code);
    expect(res.status).toBe(400);
    expect((await body(res)).error).toBe("slow_down");
    expect(store.auths[0]!.interval_seconds).toBe(10); // bumped 5 → 10
  });

  it("returns expired_token once the code is past expiry and marks it expired", async () => {
    const { device_code } = await authorize();
    // Force expiry into the past.
    store.auths[0]!.expires_at = new Date(Date.now() - 1000).toISOString();
    const res = await poll(device_code);
    expect(res.status).toBe(400);
    expect((await body(res)).error).toBe("expired_token");
    expect(store.auths[0]!.status).toBe("expired");
  });

  it("returns access_denied after the dashboard denies the code", async () => {
    const { device_code, user_code } = await authorize();
    const app = buildApproveApp();
    const denyRes = await app.request(
      "/oauth/device/deny",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ user_code }) },
      TEST_ENV,
    );
    expect(denyRes.status).toBe(200);

    const res = await poll(device_code);
    expect(res.status).toBe(400);
    expect((await body(res)).error).toBe("access_denied");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// refresh — rotation + reuse detection
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /oauth/device/token — refresh_token grant", () => {
  // Issues a real token pair via the full flow, returns the plaintext pair.
  async function issuePair() {
    const { device_code, user_code } = await authorize();
    await poll(device_code); // pending + stamp
    await approve(user_code);
    store.auths[0]!.last_polled_at = new Date(Date.now() - 10_000).toISOString();
    const tokenRes = await poll(device_code);
    return (await tokenRes.json()) as { access_token: string; refresh_token: string };
  }

  it("rotates: issues a new pair and invalidates the old refresh token", async () => {
    const first = await issuePair();
    expect(store.tokens).toHaveLength(1);

    const res = await refresh(first.refresh_token);
    expect(res.status).toBe(200);
    const second = (await res.json()) as { access_token: string; refresh_token: string };

    // New pair, distinct secrets, same family.
    expect(second.refresh_token).not.toBe(first.refresh_token);
    expect(second.access_token).not.toBe(first.access_token);
    expect(store.tokens).toHaveLength(2);
    expect(store.tokens[0]!.family_id).toBe(store.tokens[1]!.family_id);

    // Old row is marked rotated.
    expect(store.tokens[0]!.rotated_at).not.toBeNull();
  });

  it("detects refresh-token REUSE and revokes the entire family", async () => {
    const first = await issuePair();
    // Legitimate rotation.
    const res1 = await refresh(first.refresh_token);
    expect(res1.status).toBe(200);
    const second = (await res1.json()) as { refresh_token: string };

    // Attacker (or a confused client) reuses the OLD, already-rotated refresh.
    const reuseRes = await refresh(first.refresh_token);
    expect(reuseRes.status).toBe(400);
    expect((await body(reuseRes)).error).toBe("invalid_grant");

    // EVERY token in the family is now revoked — including the legit second
    // pair. Fail-closed: the real user must re-run the device flow.
    expect(store.tokens.every((t) => t.revoked_at !== null)).toBe(true);
    expect(store.tokens.some((t) => t.revoked_reason === "refresh_token_reuse_detected")).toBe(
      true,
    );

    // The freshly-rotated (now-revoked) refresh token also no longer works.
    const afterRevoke = await refresh(second.refresh_token);
    expect(afterRevoke.status).toBe(400);
    expect((await body(afterRevoke)).error).toBe("invalid_grant");
  });

  it("rejects an unknown refresh token with invalid_grant", async () => {
    const res = await refresh("nope-not-a-real-refresh");
    expect(res.status).toBe(400);
    expect((await body(res)).error).toBe("invalid_grant");
  });

  it("rejects an unsupported grant_type", async () => {
    const app = buildPublicApp();
    const res = await app.request(
      "/oauth/device/token",
      {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ grant_type: "password" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
    expect((await body(res)).error).toBe("unsupported_grant_type");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// approve / lookup / deny — auth + binding
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /oauth/device/approve", () => {
  it("binds the pending row to the approving staff's org + id", async () => {
    const { user_code } = await authorize();
    const res = await approve(user_code);
    expect(res.status).toBe(200);
    const row = store.auths[0]!;
    expect(row.status).toBe("approved");
    expect(row.org_id).toBe("org-001");
    expect(row.approved_by_staff_id).toBe(NAVIGATOR.id);
  });

  it("rejects an applicant actor (navigator/admin only)", async () => {
    const { user_code } = await authorize();
    const res = await approve(user_code, APPLICANT);
    expect(res.status).toBe(403);
    // Unchanged — still pending, not bound.
    expect(store.auths[0]!.status).toBe("pending");
  });

  it("returns 404 for an unknown user_code", async () => {
    await authorize();
    const res = await approve("ZZZZ-ZZZZ");
    expect(res.status).toBe(404);
  });

  it("returns 409 when the code is already approved (idempotency guard)", async () => {
    const { user_code } = await authorize();
    expect((await approve(user_code)).status).toBe(200);
    const second = await approve(user_code);
    expect(second.status).toBe(409);
  });

  it("returns 410 when the code has expired", async () => {
    const { user_code } = await authorize();
    store.auths[0]!.expires_at = new Date(Date.now() - 1000).toISOString();
    const res = await approve(user_code);
    expect(res.status).toBe(410);
  });

  it("normalizes the typed user_code (case + dash insensitive)", async () => {
    const { user_code } = await authorize();
    // Lowercase + stripped dash should still match the stored hash.
    const messy = user_code.toLowerCase().replace("-", "");
    const res = await approve(messy);
    expect(res.status).toBe(200);
    expect(store.auths[0]!.status).toBe("approved");
  });
});

describe("GET /oauth/device/lookup", () => {
  it("returns non-secret details for a pending code", async () => {
    const { user_code } = await authorize();
    const app = buildApproveApp();
    const res = await app.request(
      `/oauth/device/lookup?user_code=${encodeURIComponent(user_code)}`,
      { method: "GET" },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("pending");
  });

  it("404s for an unknown code", async () => {
    const app = buildApproveApp();
    const res = await app.request("/oauth/device/lookup?user_code=ZZZZ-ZZZZ", { method: "GET" }, TEST_ENV);
    expect(res.status).toBe(404);
  });
});
