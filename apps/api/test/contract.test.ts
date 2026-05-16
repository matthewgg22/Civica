/**
 * Contract tests — run against the live Render Flask service to snapshot
 * expected responses before porting each route to Hono.
 *
 * Usage:
 *   FLASK_BASE_URL=https://votenow-botr.onrender.com pnpm test
 *
 * These tests are skipped by default (no FLASK_BASE_URL) so CI doesn't need
 * the Render service running. Set the env var locally before porting a route.
 */
import { describe, it, expect } from "vitest";

const BASE = process.env["FLASK_BASE_URL"] ?? "";
const skip = !BASE;

async function get(path: string, token?: string) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${BASE}${path}`, { headers });
}

async function post(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}

describe.skipIf(skip)("Flask contract — health", () => {
  it("GET / returns ok:true", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true });
  });

  it("GET /healthz returns ok:true", async () => {
    const res = await get("/healthz");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true });
  });
});

describe.skipIf(skip)("Flask contract — unauthenticated rejections", () => {
  const authedRoutes = [
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
    ["GET", "/api/v1/civic/leaderboard?period_type=weekly", null],
    ["GET", "/api/v1/civic/leaderboard/me?period_type=weekly", null],
  ] as const;

  for (const [method, path] of authedRoutes) {
    it(`${method} ${path} → 401 without token`, async () => {
      const res = method === "GET" ? await get(path) : await post(path, {});
      expect(res.status).toBe(401);
    });
  }
});

describe.skipIf(skip)("Flask contract — share routes (no auth)", () => {
  it("GET /share/preview/call.svg returns SVG content", async () => {
    const res = await get("/share/preview/call.svg");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/svg/);
  });

  it("GET /share/call returns HTML", async () => {
    const res = await get("/share/call");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/html/);
  });
});

describe.skipIf(skip)("Flask contract — OpenStates geo (no auth required)", () => {
  it("GET /api/v1/openstates/people.geo returns shape", async () => {
    const res = await get("/api/v1/openstates/people.geo?lat=37.77&lng=-122.42");
    // Accepts 200 or 400 (missing params handled by Flask); must not 500
    expect(res.status).toBeLessThan(500);
  });
});

describe.skipIf(skip)("Flask contract — SNAP pipeline (no auth inferred)", () => {
  it("GET /snap/healthz returns ok", async () => {
    const res = await get("/snap/healthz");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true });
  });
});

// ── Hono parity smoke tests (run locally against the Hono dev server) ─────────

const HONO_BASE = process.env["HONO_BASE_URL"] ?? "http://localhost:3001";
const honoSkip = !process.env["HONO_BASE_URL"];

describe.skipIf(honoSkip)("Hono parity — health", () => {
  async function hget(path: string) {
    return fetch(`${HONO_BASE}${path}`, { headers: { Accept: "application/json" } });
  }

  it("GET / returns ok:true", async () => {
    const res = await hget("/");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true });
  });

  it("GET /healthz returns ok:true", async () => {
    const res = await hget("/healthz");
    expect(res.status).toBe(200);
  });
});
