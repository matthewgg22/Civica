import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../lib/supabase.js", () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from "../../lib/supabase.js";
import placementsRouter from "./placements.js";
import {
  TEST_ENV,
  APPLICANT,
  OPERATOR,
  makeDbClient,
  buildTestApp,
} from "../../test/helpers.js";

afterEach(() => vi.resetAllMocks());

describe("GET /ops/placements", () => {
  it("rejects non-operator with 403", async () => {
    const app = buildTestApp(placementsRouter, "/", APPLICANT);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it("returns empty placements + total when no offers exist", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: [], error: null }));
    const app = buildTestApp(placementsRouter, "/", OPERATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { placements: unknown[]; total_active_offers: number };
    expect(body.placements).toEqual([]);
    expect(body.total_active_offers).toBe(0);
  });

  it("aggregates offers across counties; statewide offers bucket to STATEWIDE", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({
      data: [
        // Alameda (06001) + Sacramento (06067), groceries, $500 expected
        { offer_id: "o1", name: "A", partner_name: "P1", category: "groceries",
          county_fips_list: ["06001", "06067"], expected_revenue_cents: 500 },
        // Statewide (empty list), mobile, $1000
        { offer_id: "o2", name: "B", partner_name: "P2", category: "mobile",
          county_fips_list: [], expected_revenue_cents: 1000 },
        // Alameda again, mobile, $250
        { offer_id: "o3", name: "C", partner_name: "P3", category: "mobile",
          county_fips_list: ["06001"], expected_revenue_cents: 250 },
      ],
      error: null,
    }));
    const app = buildTestApp(placementsRouter, "/", OPERATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      placements: Array<{ county_fips: string; placement_count: number; expected_revenue_cents: number; categories: string[] }>;
      total_active_offers: number;
    };

    expect(body.total_active_offers).toBe(3);
    const byFips = Object.fromEntries(body.placements.map((p) => [p.county_fips, p]));
    expect(byFips["06001"]?.placement_count).toBe(2);
    expect(byFips["06001"]?.expected_revenue_cents).toBe(750);
    expect(byFips["06001"]?.categories).toContain("groceries");
    expect(byFips["06001"]?.categories).toContain("mobile");
    expect(byFips["06067"]?.placement_count).toBe(1);
    expect(byFips["STATEWIDE"]?.placement_count).toBe(1);
    expect(byFips["STATEWIDE"]?.expected_revenue_cents).toBe(1000);
  });

  it("returns 500 when the catalog query errors", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({
      data: null,
      error: { message: "relation partner_offers does not exist" },
    }));
    const app = buildTestApp(placementsRouter, "/", OPERATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(500);
  });
});
