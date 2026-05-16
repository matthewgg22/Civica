/**
 * Contract + parity tests for the Civica Hono API.
 *
 * Two modes:
 *
 * 1. Hono parity (default, runs in CI):
 *    HONO_BASE_URL=http://localhost:3001 pnpm test
 *    - Health, envelope shape, auth-rejection matrix, public routes
 *    - No Supabase or OpenAI needed for auth-rejection tests
 *
 * 2. Flask contract (opt-in, verify before cutover):
 *    FLASK_BASE_URL=https://votenow-botr.onrender.com pnpm test
 *    - Snapshots Flask response shapes to confirm Hono parity
 *
 * Authenticated and data-fetching tests require:
 *    TEST_JWT=<valid supabase jwt>  (skipped otherwise)
 */
import { describe, it, expect, beforeAll } from "vitest";

const HONO = process.env["HONO_BASE_URL"] ?? "http://localhost:3001";
const FLASK = process.env["FLASK_BASE_URL"] ?? "";
const TEST_JWT = process.env["TEST_JWT"] ?? "";

const skipFlask = !FLASK;
const skipAuthed = !TEST_JWT;

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function hget(path: string, token?: string) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${HONO}${path}`, { headers });
}

async function hpost(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${HONO}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}

async function hpatch(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${HONO}${path}`, { method: "PATCH", headers, body: JSON.stringify(body) });
}

async function fget(path: string, token?: string) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${FLASK}${path}`, { headers });
}

async function fpost(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${FLASK}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}

// Verify server is reachable before running Hono parity tests
beforeAll(async () => {
  const res = await fetch(`${HONO}/healthz`).catch(() => null);
  if (!res) {
    throw new Error(
      `Hono server not reachable at ${HONO}. ` +
      "Run `pnpm dev` in apps/api before running tests.",
    );
  }
});

// ── Hono parity: health ───────────────────────────────────────────────────────

describe("Hono — health", () => {
  it("GET / returns ok:true with service info", async () => {
    const res = await hget("/");
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toMatchObject({ ok: true });
  });

  it("GET /healthz returns ok:true", async () => {
    const res = await hget("/healthz");
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toMatchObject({ ok: true });
  });

  it("GET /snap/healthz returns ok:true", async () => {
    const res = await hget("/snap/healthz");
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toMatchObject({ ok: true });
  });

  it("GET /unknown-route returns 404 with code:not_found", async () => {
    const res = await hget("/this-route-does-not-exist-at-all");
    expect(res.status).toBe(404);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toMatchObject({ code: "not_found" });
  });
});

// ── Hono parity: auth rejection matrix ───────────────────────────────────────

describe("Hono — auth rejections (no token → 401)", () => {
  const protectedRoutes = [
    // Civic Tier A
    ["POST", "/api/v1/civic/assistant/resolve", {}],
    ["POST", "/api/issue-classify", {}],
    ["POST", "/api/issue-brief", {}],
    ["POST", "/api/v1/civic/calls/log", {}],
    ["POST", "/api/v1/civic/calls/launch", {}],
    ["POST", "/api/v1/civic/calls/confirm", {}],
    ["GET", "/api/v1/civic/history", null],
    ["GET", "/api/v1/civic/call-score/summary", null],
    ["GET", "/api/v1/civic/call-score/breakdown", null],
    ["GET", "/api/v1/civic/call-score/history", null],
    ["POST", "/api/v1/civic/call-score/recompute", {}],
    ["GET", "/api/v1/civic/leaderboard?period_type=monthly", null],
    ["GET", "/api/v1/civic/leaderboard/me?period_type=monthly", null],
    // SNAP applicant routes
    ["GET", "/api/v1/snap/packets", null],
    ["GET", "/api/v1/snap/packets/00000000-0000-0000-0000-000000000001", null],
    // Enrollment routes
    ["GET", "/v1/enrollment/packets", null],
    ["POST", "/v1/enrollment/packets", {}],
    ["GET", "/v1/enrollment/packets/00000000-0000-0000-0000-000000000001", null],
    ["PATCH", "/v1/enrollment/packets/00000000-0000-0000-0000-000000000001", {}],
  ] as const;

  for (const [method, path] of protectedRoutes) {
    it(`${method} ${path} → 401`, async () => {
      const res =
        method === "GET" ? await hget(path) :
        method === "PATCH" ? await hpatch(path, {}) :
        await hpost(path, {});
      expect(res.status).toBe(401);
    });
  }
});

// ── Hono parity: public / optional-auth routes ────────────────────────────────

describe("Hono — public routes", () => {
  it("GET /api/v1/civic/examples returns examples array", async () => {
    const res = await hget("/api/v1/civic/examples");
    // May return 200+[] if DB is a placeholder; never 404 or 5xx from routing
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("examples");
    expect(Array.isArray(json["examples"])).toBe(true);
  }, 15_000);

  it("GET /api/v1/openstates/people.geo with coords returns < 500", async () => {
    const res = await hget("/api/v1/openstates/people.geo?lat=37.77&lng=-122.42");
    expect(res.status).toBeLessThan(500);
  });

  it("GET /api/v1/openstates/people.geo missing params returns 400", async () => {
    const res = await hget("/api/v1/openstates/people.geo");
    expect(res.status).toBe(400);
  });

  it("GET /api/v1/openstates/people.geo out-of-range lat returns 400", async () => {
    const res = await hget("/api/v1/openstates/people.geo?lat=999&lng=-122.42");
    expect(res.status).toBe(400);
  });
});

// ── Hono parity: leaderboard query validation (requires auth first) ───────────
// Leaderboard uses requireAuth, so unauthenticated requests → 401 regardless
// of query params. Param validation tests live in the authenticated section.

describe("Hono — leaderboard (no auth → 401)", () => {
  it("GET /api/v1/civic/leaderboard without token → 401", async () => {
    const res = await hget("/api/v1/civic/leaderboard?period_type=monthly");
    expect(res.status).toBe(401);
  });

  it("GET /api/v1/civic/leaderboard/me without token → 401", async () => {
    const res = await hget("/api/v1/civic/leaderboard/me?period_type=monthly");
    expect(res.status).toBe(401);
  });
});

// ── Hono parity: AI route input validation (no auth) ─────────────────────────

describe("Hono — AI route input validation", () => {
  it("POST /api/issue-classify without token → 401 (not 500)", async () => {
    const res = await hpost("/api/issue-classify", { concern_text: "healthcare" });
    expect(res.status).toBe(401);
  });

  it("POST /api/issue-brief without token → 401", async () => {
    const res = await hpost("/api/issue-brief", { concern_text: "housing" });
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/civic/assistant/resolve without token → 401", async () => {
    const res = await hpost("/api/v1/civic/assistant/resolve", {
      concern_text: "affordable housing",
      selected_ask: "support HB 1234",
    });
    expect(res.status).toBe(401);
  });
});

// ── Hono parity: unported stubs return 501 ───────────────────────────────────

describe("Hono — unported Tier B/C routes return 501", () => {
  const stubs = [
    ["POST", "/api/v1/civic/script-package", {}],
    ["POST", "/api/v2/civic/mapc/interpret", {}],
  ] as const;

  for (const [method, path] of stubs) {
    it(`${method} ${path} → 501`, async () => {
      const res = await hpost(path, {});
      expect(res.status).toBe(501);
      const json = await res.json() as Record<string, unknown>;
      expect(json).toMatchObject({ code: "not_implemented" });
    });
  }
});

// ── Authenticated Hono tests (require TEST_JWT) ───────────────────────────────

describe.skipIf(skipAuthed)("Hono — authenticated civic routes (requires TEST_JWT)", () => {
  it("GET /api/v1/civic/history returns history array", async () => {
    const res = await hget("/api/v1/civic/history", TEST_JWT);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("history");
    expect(Array.isArray(json["history"])).toBe(true);
  });

  it("GET /api/v1/civic/call-score/summary returns score fields", async () => {
    const res = await hget("/api/v1/civic/call-score/summary", TEST_JWT);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("total_score");
  });

  it("GET /api/v1/civic/leaderboard missing period_type → 400", async () => {
    const res = await hget("/api/v1/civic/leaderboard", TEST_JWT);
    expect(res.status).toBe(400);
  });

  it("GET /api/v1/civic/leaderboard invalid period_type → 400", async () => {
    const res = await hget("/api/v1/civic/leaderboard?period_type=quarterly", TEST_JWT);
    expect(res.status).toBe(400);
  });

  it("GET /api/v1/civic/leaderboard?period_type=monthly returns entries", async () => {
    const res = await hget("/api/v1/civic/leaderboard?period_type=monthly", TEST_JWT);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toMatchObject({ period_type: "monthly" });
    expect(Array.isArray(json["entries"])).toBe(true);
  });

  it("GET /api/v1/civic/leaderboard/me?period_type=monthly returns rank", async () => {
    const res = await hget("/api/v1/civic/leaderboard/me?period_type=monthly", TEST_JWT);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("eligible_verified_call_count");
  });

  it("POST /api/issue-classify returns status + canonical_issue", async () => {
    const res = await hpost(
      "/api/issue-classify",
      { concern_text: "I want to support healthcare access for seniors" },
      TEST_JWT,
    );
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("status");
    expect(["ok", "needs_clarification", "refused"]).toContain(json["status"]);
    expect(json).toHaveProperty("canonical_issue");
    expect(json).toHaveProperty("confidence");
    expect(Array.isArray(json["candidate_issues"])).toBe(true);
  });

  it("POST /api/issue-classify empty text → needs_clarification", async () => {
    const res = await hpost("/api/issue-classify", { concern_text: "" }, TEST_JWT);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json["status"]).toBe("needs_clarification");
  });

  it("GET /api/v1/snap/packets returns data array", async () => {
    const res = await hget("/api/v1/snap/packets", TEST_JWT);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("data");
    expect(Array.isArray(json["data"])).toBe(true);
  });

  it("GET /v1/enrollment/packets returns array", async () => {
    const res = await hget("/v1/enrollment/packets", TEST_JWT);
    expect(res.status).toBe(200);
    const json = await res.json() as unknown;
    expect(Array.isArray(json)).toBe(true);
  });
});

// ── Flask contract tests (opt-in, run before cutover) ────────────────────────

describe.skipIf(skipFlask)("Flask contract — health", () => {
  it("GET / returns ok:true", async () => {
    const res = await fget("/");
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toMatchObject({ ok: true });
  });

  it("GET /healthz returns ok:true", async () => {
    const res = await fget("/healthz");
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toMatchObject({ ok: true });
  });
});

describe.skipIf(skipFlask)("Flask contract — auth rejections (shape parity)", () => {
  const authedRoutes = [
    ["POST", "/api/v1/civic/assistant/resolve", {}],
    ["POST", "/api/issue-classify", {}],
    ["POST", "/api/issue-brief", {}],
    ["POST", "/api/v1/civic/calls/log", {}],
    ["GET", "/api/v1/civic/history", null],
    ["GET", "/api/v1/civic/call-score/summary", null],
    ["GET", "/api/v1/civic/leaderboard?period_type=monthly", null],
    ["GET", "/api/v1/civic/leaderboard/me?period_type=monthly", null],
  ] as const;

  for (const [method, path] of authedRoutes) {
    it(`Flask ${method} ${path} → 401 (same as Hono)`, async () => {
      const res = method === "GET" ? await fget(path) : await fpost(path, {});
      expect(res.status).toBe(401);
    });
  }
});

describe.skipIf(skipFlask)("Flask contract — public routes (shape parity)", () => {
  it("GET /api/v1/civic/examples → same shape as Hono", async () => {
    const [flask, hono] = await Promise.all([
      fget("/api/v1/civic/examples").then((r) => r.json()),
      hget("/api/v1/civic/examples").then((r) => r.json()),
    ]);
    // Both must have examples array
    expect((flask as Record<string, unknown>)).toHaveProperty("examples");
    expect((hono as Record<string, unknown>)).toHaveProperty("examples");
  });

  it("GET /api/v1/openstates/people.geo → Flask and Hono agree on shape", async () => {
    const path = "/api/v1/openstates/people.geo?lat=37.77&lng=-122.42";
    const [flask, hono] = await Promise.all([
      fget(path),
      hget(path),
    ]);
    // Both should succeed or both should error — not 5xx from Hono when Flask succeeds
    if (flask.status === 200) {
      expect(hono.status).toBeLessThan(500);
    }
  });
});

describe.skipIf(skipFlask || skipAuthed)(
  "Flask contract — authenticated shape parity (requires FLASK_BASE_URL + TEST_JWT)",
  () => {
    it("GET /api/v1/civic/history same top-level shape", async () => {
      const [flask, hono] = await Promise.all([
        fget("/api/v1/civic/history", TEST_JWT).then((r) => r.json()),
        hget("/api/v1/civic/history", TEST_JWT).then((r) => r.json()),
      ]);
      expect((flask as Record<string, unknown>)).toHaveProperty("history");
      expect((hono as Record<string, unknown>)).toHaveProperty("history");
    });

    it("POST /api/issue-classify same shape", async () => {
      const body = { concern_text: "healthcare" };
      const [flask, hono] = await Promise.all([
        fpost("/api/issue-classify", body, TEST_JWT).then((r) => r.json()),
        hpost("/api/issue-classify", body, TEST_JWT).then((r) => r.json()),
      ]);
      for (const json of [flask, hono] as Record<string, unknown>[]) {
        expect(json).toHaveProperty("status");
        expect(json).toHaveProperty("canonical_issue");
      }
    });
  },
);
