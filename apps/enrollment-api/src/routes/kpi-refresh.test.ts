import { describe, it, expect, vi, afterEach } from "vitest";

// Mock the shared refresh so the route test covers auth + wiring without Supabase.
vi.mock("../cron/kpi-snapshot.js", () => ({
  refreshKpiSnapshot: vi.fn(),
}));

import { refreshKpiSnapshot } from "../cron/kpi-snapshot.js";
import { kpiRefreshRouter } from "./kpi-refresh.js";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { TEST_ENV } from "../test/helpers.js";
import type { Env } from "../types.js";

afterEach(() => vi.resetAllMocks());

const PATH = "/internal/kpi-snapshot/refresh";
const SECRET = "test-kpi-refresh-secret-abc";

function buildApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route(PATH, kpiRefreshRouter);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: "Internal server error" }, 500);
  });
  return app;
}

function envWith(secret?: string): Env {
  return { ...TEST_ENV, KPI_REFRESH_SECRET: secret } as Env;
}

describe("POST /internal/kpi-snapshot/refresh", () => {
  it("503 when the secret is not configured (trigger dark)", async () => {
    const res = await buildApp().request(PATH, { method: "POST" }, envWith(undefined));
    expect(res.status).toBe(503);
    expect(refreshKpiSnapshot).not.toHaveBeenCalled();
  });

  it("401 when the bearer token is missing", async () => {
    const res = await buildApp().request(PATH, { method: "POST" }, envWith(SECRET));
    expect(res.status).toBe(401);
    expect(refreshKpiSnapshot).not.toHaveBeenCalled();
  });

  it("401 when the bearer token is wrong", async () => {
    const res = await buildApp().request(
      PATH,
      { method: "POST", headers: { Authorization: "Bearer nope" } },
      envWith(SECRET),
    );
    expect(res.status).toBe(401);
    expect(refreshKpiSnapshot).not.toHaveBeenCalled();
  });

  it("200 + result when the bearer token matches; calls the shared refresh once", async () => {
    const fakeResult = {
      rows_written: 6,
      clean_packet_rate: null,
      total_scored: 0,
      measured_per_n: 0,
      qc_n: 0,
      county_n: 0,
      computed_at: "2026-06-04T19:00:00.000Z",
    };
    vi.mocked(refreshKpiSnapshot).mockResolvedValue(fakeResult);

    const res = await buildApp().request(
      PATH,
      { method: "POST", headers: { Authorization: `Bearer ${SECRET}` } },
      envWith(SECRET),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, ...fakeResult });
    expect(refreshKpiSnapshot).toHaveBeenCalledTimes(1);
  });
});
