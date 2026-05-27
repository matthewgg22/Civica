import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import meOffersRouter from "./me-offers.js";
import {
  TEST_ENV,
  APPLICANT,
  NAVIGATOR,
  makeMultiTableDbClient,
  buildTestApp,
} from "../test/helpers.js";
import * as supabase from "../lib/supabase.js";
import type { Env, Variables } from "../types.js";

// Default partner_offer row used by /me/offers/:id tests.
const SAMPLE_OFFER = {
  offer_id: "11111111-1111-1111-1111-111111111111",
  name: "Whole Foods 15% off prepared meals",
  partner_name: "Whole Foods",
  category: "groceries",
  description: null,
  county_fips_list: ["06037"],
  expected_revenue_cents: 50,
  expected_savings_cents: 750,
  start_at: null,
  end_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  tier: "top",
  state_code: "CA",
  category_tags: ["groceries"],
  merchant_id: "wholefoods_94110",
};

const SAMPLE_TX = [{ category: "groceries" }, { category: "farmers_market" }];

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockServiceClient(byTable: Record<string, { data: unknown; error: unknown }>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.spyOn(supabase, "makeServiceClient").mockReturnValue(makeMultiTableDbClient(byTable) as any);
}

describe("GET /me/offers", () => {
  it("returns ranked offers for an applicant in a state-matching county", async () => {
    mockServiceClient({
      distress_flags: { data: [], error: null }, // not distressed
      partner_offers: { data: [SAMPLE_OFFER], error: null },
      ebt_transactions: { data: SAMPLE_TX, error: null },
    });
    const app = buildTestApp(meOffersRouter as Hono<{ Bindings: Env; Variables: Variables }>, "/me/offers", APPLICANT);
    const res = await app.request("/me/offers?packet_county=06037&state_code=CA", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown> & { offers?: Array<Record<string, any>>; free_resources?: any; meta?: any; offer?: any; status?: string; redemption_id?: string; total_savings_cents?: number; savings_cents?: number; capped?: boolean };
    expect(body.offers).toHaveLength(1);
    expect(body.offers![0]!.offer_id).toBe(SAMPLE_OFFER.offer_id);
    expect(body.offers![0]!.valid_until).toBeTypeOf("string");
    expect(body.free_resources).toBeNull();
    expect(body.meta.state_code).toBe("CA");
  });

  it("returns free_resources (no offers) when user has an active distress flag", async () => {
    mockServiceClient({
      distress_flags: { data: [{ flag_id: "f1" }], error: null },
      partner_offers: { data: [SAMPLE_OFFER], error: null },
    });
    const app = buildTestApp(meOffersRouter as Hono<{ Bindings: Env; Variables: Variables }>, "/me/offers", APPLICANT);
    const res = await app.request("/me/offers?packet_county=06037", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown> & { offers?: Array<Record<string, any>>; free_resources?: any; meta?: any; offer?: any; status?: string; redemption_id?: string; total_savings_cents?: number; savings_cents?: number; capped?: boolean };
    expect(body.offers).toEqual([]);
    expect(Array.isArray(body.free_resources)).toBe(true);
    expect(body.free_resources.length).toBeGreaterThan(0);
    expect(body.free_resources[0]).toHaveProperty("title_en");
    expect(body.free_resources[0]).toHaveProperty("title_es");
    expect(body.meta.state_code).toBe("CA");
  });

  it("falls back to statewide for pre-packet users (no county)", async () => {
    const statewideOffer = { ...SAMPLE_OFFER, offer_id: "22222222-2222-2222-2222-222222222222", county_fips_list: [] };
    mockServiceClient({
      distress_flags: { data: [], error: null },
      partner_offers: { data: [statewideOffer], error: null },
      ebt_transactions: { data: [], error: null },
    });
    const app = buildTestApp(meOffersRouter as Hono<{ Bindings: Env; Variables: Variables }>, "/me/offers", APPLICANT);
    const res = await app.request("/me/offers", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown> & { offers?: Array<Record<string, any>>; free_resources?: any; meta?: any; offer?: any; status?: string; redemption_id?: string; total_savings_cents?: number; savings_cents?: number; capped?: boolean };
    expect(body.offers).toHaveLength(1);
  });

  it("allows non-applicant authenticated actors (navigator)", async () => {
    mockServiceClient({
      distress_flags: { data: [], error: null },
      partner_offers: { data: [SAMPLE_OFFER], error: null },
      ebt_transactions: { data: [], error: null },
    });
    const app = buildTestApp(meOffersRouter as Hono<{ Bindings: Env; Variables: Variables }>, "/me/offers", NAVIGATOR);
    const res = await app.request("/me/offers?packet_county=06037", {}, TEST_ENV);
    expect(res.status).toBe(200);
  });
});

describe("GET /me/offers/:id", () => {
  it("returns OK with the offer when active and within window", async () => {
    mockServiceClient({
      distress_flags: { data: [], error: null },
      partner_offers: { data: SAMPLE_OFFER, error: null },
    });
    const app = buildTestApp(meOffersRouter as Hono<{ Bindings: Env; Variables: Variables }>, "/me/offers", APPLICANT);
    const res = await app.request(`/me/offers/${SAMPLE_OFFER.offer_id}`, {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown> & { offers?: Array<Record<string, any>>; free_resources?: any; meta?: any; offer?: any; status?: string; redemption_id?: string; total_savings_cents?: number; savings_cents?: number; capped?: boolean };
    expect(body.status).toBe("OK");
    expect(body.offer.offer_id).toBe(SAMPLE_OFFER.offer_id);
  });

  it("returns 410 OFFER_SUPPRESSED when user becomes distressed mid-flow", async () => {
    mockServiceClient({
      distress_flags: { data: [{ flag_id: "f1" }], error: null },
      partner_offers: { data: SAMPLE_OFFER, error: null },
    });
    const app = buildTestApp(meOffersRouter as Hono<{ Bindings: Env; Variables: Variables }>, "/me/offers", APPLICANT);
    const res = await app.request(`/me/offers/${SAMPLE_OFFER.offer_id}`, {}, TEST_ENV);
    expect(res.status).toBe(410);
    const body = (await res.json()) as Record<string, unknown> & { offers?: Array<Record<string, any>>; free_resources?: any; meta?: any; offer?: any; status?: string; redemption_id?: string; total_savings_cents?: number; savings_cents?: number; capped?: boolean };
    expect(body.status).toBe("OFFER_SUPPRESSED");
  });

  it("returns 410 OFFER_EXPIRED when end_at has lapsed since list fetch", async () => {
    const expired = { ...SAMPLE_OFFER, end_at: new Date(Date.now() - 60_000).toISOString() };
    mockServiceClient({
      distress_flags: { data: [], error: null },
      partner_offers: { data: expired, error: null },
    });
    const app = buildTestApp(meOffersRouter as Hono<{ Bindings: Env; Variables: Variables }>, "/me/offers", APPLICANT);
    const res = await app.request(`/me/offers/${SAMPLE_OFFER.offer_id}`, {}, TEST_ENV);
    expect(res.status).toBe(410);
    const body = (await res.json()) as Record<string, unknown> & { offers?: Array<Record<string, any>>; free_resources?: any; meta?: any; offer?: any; status?: string; redemption_id?: string; total_savings_cents?: number; savings_cents?: number; capped?: boolean };
    expect(body.status).toBe("OFFER_EXPIRED");
  });

  it("returns 410 OFFER_EXPIRED when catalog has no matching active row", async () => {
    mockServiceClient({
      distress_flags: { data: [], error: null },
      partner_offers: { data: null, error: null },
    });
    const app = buildTestApp(meOffersRouter as Hono<{ Bindings: Env; Variables: Variables }>, "/me/offers", APPLICANT);
    const res = await app.request(`/me/offers/${SAMPLE_OFFER.offer_id}`, {}, TEST_ENV);
    expect(res.status).toBe(410);
  });

  it("rejects malformed offer ids", async () => {
    const app = buildTestApp(meOffersRouter as Hono<{ Bindings: Env; Variables: Variables }>, "/me/offers", APPLICANT);
    const res = await app.request("/me/offers/not-a-uuid", {}, TEST_ENV);
    expect(res.status).toBe(400);
  });
});

describe("POST /me/offers/events", () => {
  it("writes county-bucketed impression event with revenue copied from catalog", async () => {
    mockServiceClient({
      distress_flags: { data: [], error: null },
      partner_offers: { data: { expected_revenue_cents: 50 }, error: null },
      partner_offer_events_aggregate: { data: null, error: null },
    });
    const app = buildTestApp(meOffersRouter as Hono<{ Bindings: Env; Variables: Variables }>, "/me/offers", APPLICANT);
    const res = await app.request(
      "/me/offers/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer_id: SAMPLE_OFFER.offer_id,
          event_type: "impression",
          county_fips: "06037",
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown> & { offers?: Array<Record<string, any>>; free_resources?: any; meta?: any; offer?: any; status?: string; redemption_id?: string; total_savings_cents?: number; savings_cents?: number; capped?: boolean };
    expect(body.status).toBe("ok");
  });

  it("silently no-ops when user is distressed (race-condition fix)", async () => {
    mockServiceClient({
      distress_flags: { data: [{ flag_id: "f1" }], error: null },
    });
    const app = buildTestApp(meOffersRouter as Hono<{ Bindings: Env; Variables: Variables }>, "/me/offers", APPLICANT);
    const res = await app.request(
      "/me/offers/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer_id: SAMPLE_OFFER.offer_id,
          event_type: "click",
          county_fips: "06037",
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200); // appears successful to the user
  });

  it("rejects invalid event_type", async () => {
    const app = buildTestApp(meOffersRouter as Hono<{ Bindings: Env; Variables: Variables }>, "/me/offers", APPLICANT);
    const res = await app.request(
      "/me/offers/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: SAMPLE_OFFER.offer_id, event_type: "fake" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it("uses 00000 sentinel for missing/invalid county_fips", async () => {
    const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(supabase, "makeServiceClient").mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === "distress_flags") {
            // Reuse the makeQueryBuilder shape — return non-empty for tracking.
            const qb = {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockReturnThis(),
              insert: vi.fn().mockResolvedValue({ data: null, error: null }),
              then: (res: (v: unknown) => unknown) =>
                Promise.resolve({ data: [], error: null }).then(res),
            };
            return qb;
          }
          if (table === "partner_offers") {
            const qb = {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { expected_revenue_cents: 75 }, error: null }),
            };
            return qb;
          }
          // partner_offer_events_aggregate
          return { insert: insertSpy };
        }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = buildTestApp(meOffersRouter as Hono<{ Bindings: Env; Variables: Variables }>, "/me/offers", APPLICANT);
    const res = await app.request(
      "/me/offers/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: SAMPLE_OFFER.offer_id, event_type: "impression", county_fips: null }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ county_fips: "00000", event_type: "impression", revenue_cents: 75 }),
    );
  });
});
