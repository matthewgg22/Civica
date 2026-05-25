import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../lib/supabase.js", () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from "../../lib/supabase.js";
import partnerPnlRouter from "./partner-pnl.js";
import {
  TEST_ENV,
  APPLICANT,
  OPERATOR,
  makeMultiTableDbClient,
  buildTestApp,
} from "../../test/helpers.js";

afterEach(() => vi.resetAllMocks());

describe("GET /ops/partner-pnl", () => {
  it("rejects non-operator with 403", async () => {
    const app = buildTestApp(partnerPnlRouter, "/", APPLICANT);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it("returns zeroed P&L when no events exist", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeMultiTableDbClient({
      partner_offer_events_aggregate: { data: [], error: null },
      ebt_card_aggregates_v: { data: { total_balance_cents: 0, active_tracker_count: 0 }, error: null },
    }));
    const app = buildTestApp(partnerPnlRouter, "/", OPERATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      impressions: number; clicks: number; conversions: number;
      revenue_cents: number; saved_cents: number;
      revenue_per_active_tracker_cents: number; redistribution_pct: number;
    };
    expect(body.impressions).toBe(0);
    expect(body.clicks).toBe(0);
    expect(body.revenue_cents).toBe(0);
    expect(body.redistribution_pct).toBe(0);
  });

  it("computes impressions, revenue, saved, and redistribution % from events", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeMultiTableDbClient({
      partner_offer_events_aggregate: {
        data: [
          { offer_id: "o1", event_type: "impression", revenue_cents: 5 },
          { offer_id: "o1", event_type: "impression", revenue_cents: 5 },
          { offer_id: "o2", event_type: "impression", revenue_cents: 10 },
          { offer_id: "o1", event_type: "click",      revenue_cents: 50 },
        ],
        error: null,
      },
      partner_offers: {
        data: [
          { offer_id: "o1", expected_savings_cents: 200 },
          { offer_id: "o2", expected_savings_cents: 100 },
        ],
        error: null,
      },
      ebt_card_aggregates_v: { data: { total_balance_cents: 0, active_tracker_count: 100 }, error: null },
    }));
    const app = buildTestApp(partnerPnlRouter, "/", OPERATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      impressions: number; clicks: number;
      revenue_cents: number; saved_cents: number;
      revenue_per_active_tracker_cents: number;
      redistribution_pct: number;
      footer: string;
    };
    expect(body.impressions).toBe(3);
    expect(body.clicks).toBe(1);
    expect(body.revenue_cents).toBe(70); // 5+5+10+50
    expect(body.saved_cents).toBe(500);
    expect(body.revenue_per_active_tracker_cents).toBe(1);
    expect(body.redistribution_pct).toBeCloseTo(87.7, 1);
    expect(body.footer).toMatch(/impression/i);
  });
});
