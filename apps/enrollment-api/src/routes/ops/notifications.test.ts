import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../lib/supabase.js", () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from "../../lib/supabase.js";
import notificationsRouter from "./notifications.js";
import {
  TEST_ENV,
  APPLICANT,
  OPERATOR,
  makeDbClient,
  buildTestApp,
} from "../../test/helpers.js";

afterEach(() => vi.resetAllMocks());

describe("GET /ops/notifications", () => {
  it("rejects non-operator with 403", async () => {
    const app = buildTestApp(notificationsRouter, "/", APPLICANT);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it("returns empty matrix when no notifications sent", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: [], error: null }));
    const app = buildTestApp(notificationsRouter, "/", OPERATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { cells: unknown[]; total_count: number; total_cost_cents: number };
    expect(body.cells).toEqual([]);
    expect(body.total_count).toBe(0);
    expect(body.total_cost_cents).toBe(0);
  });

  it("aggregates channel × category counts and costs", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({
      data: [
        { channel: "sms",   category: "deposit_alert",    cost_cents: 75 },
        { channel: "sms",   category: "deposit_alert",    cost_cents: 75 },
        { channel: "push",  category: "deposit_alert",    cost_cents: 0 },
        { channel: "email", category: "recert_reminder",  cost_cents: 4 },
      ],
      error: null,
    }));
    const app = buildTestApp(notificationsRouter, "/", OPERATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      cells: Array<{ channel: string; category: string; count: number; cost_cents: number }>;
      total_count: number;
      total_cost_cents: number;
    };
    expect(body.total_count).toBe(4);
    expect(body.total_cost_cents).toBe(154);

    const sms = body.cells.find((c) => c.channel === "sms" && c.category === "deposit_alert");
    expect(sms?.count).toBe(2);
    expect(sms?.cost_cents).toBe(150);
  });

  it("rejects non-numeric days parameter", async () => {
    const app = buildTestApp(notificationsRouter, "/", OPERATOR);
    const res = await app.request("/?days=banana", {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it("accepts days query parameter and clamps to valid range", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: [], error: null }));
    const app = buildTestApp(notificationsRouter, "/", OPERATOR);
    const res = await app.request("/?days=7", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { window_days: number };
    expect(body.window_days).toBe(7);
  });
});
