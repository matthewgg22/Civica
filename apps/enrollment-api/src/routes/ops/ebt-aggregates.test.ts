import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../lib/supabase.js", () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from "../../lib/supabase.js";
import ebtAggregatesRouter from "./ebt-aggregates.js";
import {
  TEST_ENV,
  APPLICANT,
  NAVIGATOR,
  BUDDY,
  OPERATOR,
  makeDbClient,
  buildTestApp,
} from "../../test/helpers.js";

afterEach(() => vi.resetAllMocks());

describe("GET /ops/ebt-aggregates", () => {
  it("returns 403 for applicant", async () => {
    const app = buildTestApp(ebtAggregatesRouter, "/", APPLICANT);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(403);
  });
  it("returns 403 for navigator", async () => {
    const app = buildTestApp(ebtAggregatesRouter, "/", NAVIGATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(403);
  });
  it("returns 403 for buddy", async () => {
    const app = buildTestApp(ebtAggregatesRouter, "/", BUDDY);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it("returns aggregate totals for operator", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({
      data: {
        total_balance_cents: 5_432_100,
        active_tracker_count: 412,
        total_card_count: 530,
        latest_balance_at: "2026-05-25T18:00:00Z",
      },
      error: null,
    }));
    const app = buildTestApp(ebtAggregatesRouter, "/", OPERATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { total_balance_cents: number; active_tracker_count: number; freshness_label: string };
    expect(body.total_balance_cents).toBe(5_432_100);
    expect(body.active_tracker_count).toBe(412);
    expect(body.freshness_label).toMatch(/30 min/);
  });

  it("returns zeros when the view has no rows", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const app = buildTestApp(ebtAggregatesRouter, "/", OPERATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { total_balance_cents: number; active_tracker_count: number };
    expect(body.total_balance_cents).toBe(0);
    expect(body.active_tracker_count).toBe(0);
  });

  it("returns 500 when the underlying query errors", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({
      data: null,
      error: { message: "view does not exist" },
    }));
    const app = buildTestApp(ebtAggregatesRouter, "/", OPERATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(500);
  });
});
