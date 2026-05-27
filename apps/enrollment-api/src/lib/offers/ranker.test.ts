import { describe, it, expect } from "vitest";
import { rank, DEFAULT_WEIGHTS } from "./ranker.js";
import type { PartnerOfferRow } from "./catalog.js";

function offer(o: Partial<PartnerOfferRow> & { offer_id: string }): PartnerOfferRow {
  return {
    name: o.offer_id,
    partner_name: "Test Partner",
    category: "groceries",
    description: null,
    county_fips_list: [],
    expected_revenue_cents: 0,
    expected_savings_cents: 100,
    start_at: null,
    end_at: null,
    tier: "standard",
    state_code: "CA",
    category_tags: [],
    merchant_id: null,
    merchant_name_normalized: null,
    ...o,
  };
}

describe("rank", () => {
  it("returns empty array for empty candidates", () => {
    expect(rank([], { txCategories: [], counties: ["06037"], useFallback: false, limit: 5 })).toEqual([]);
  });

  it("stamps valid_until at min(end_at, now+5min)", () => {
    const farFuture = new Date(Date.now() + 60 * 60_000).toISOString();
    const result = rank(
      [offer({ offer_id: "a", end_at: farFuture, expected_savings_cents: 500 })],
      { txCategories: [], counties: ["06037"], useFallback: true, limit: 5 },
    );
    expect(result).toHaveLength(1);
    const validUntilMs = new Date(result[0]!.valid_until).getTime();
    const expectedMs = Date.now() + 5 * 60_000;
    expect(Math.abs(validUntilMs - expectedMs)).toBeLessThan(2_000); // 2s tolerance
  });

  it("stamps valid_until at offer.end_at when it expires sooner than TTL", () => {
    const soon = new Date(Date.now() + 60_000).toISOString(); // 1 min from now
    const result = rank(
      [offer({ offer_id: "a", end_at: soon, expected_savings_cents: 500 })],
      { txCategories: [], counties: ["06037"], useFallback: true, limit: 5 },
    );
    expect(result[0]!.valid_until).toBe(soon);
  });

  it("ranks county-matched offers above statewide", () => {
    const candidates = [
      offer({ offer_id: "statewide", county_fips_list: [], expected_savings_cents: 100 }),
      offer({ offer_id: "in_county", county_fips_list: ["06037"], expected_savings_cents: 100 }),
    ];
    const result = rank(candidates, { txCategories: [], counties: ["06037"], useFallback: true, limit: 5 });
    expect(result[0]!.offer_id).toBe("in_county");
  });

  it("category overlap boosts score when useFallback=false", () => {
    const candidates = [
      offer({ offer_id: "no_match", category_tags: ["restaurant"], expected_savings_cents: 100 }),
      offer({ offer_id: "match", category_tags: ["groceries"], expected_savings_cents: 100 }),
    ];
    const result = rank(candidates, {
      txCategories: ["groceries"],
      counties: ["STATEWIDE"],
      useFallback: false,
      limit: 5,
    });
    expect(result[0]!.offer_id).toBe("match");
  });

  it("ignores category overlap when useFallback=true", () => {
    const candidates = [
      offer({ offer_id: "tier_top", category_tags: ["restaurant"], tier: "top", expected_savings_cents: 100 }),
      offer({ offer_id: "tier_standard_match", category_tags: ["groceries"], tier: "standard", expected_savings_cents: 100 }),
    ];
    // useFallback=true → category contribution is zero; top tier should outrank standard.
    const result = rank(candidates, {
      txCategories: [],
      counties: ["STATEWIDE"],
      useFallback: true,
      limit: 5,
    });
    expect(result[0]!.offer_id).toBe("tier_top");
  });

  it("higher expected_savings_cents wins when other factors tie", () => {
    const candidates = [
      offer({ offer_id: "small_savings", expected_savings_cents: 100 }),
      offer({ offer_id: "big_savings", expected_savings_cents: 1000 }),
    ];
    const result = rank(candidates, {
      txCategories: [],
      counties: ["STATEWIDE"],
      useFallback: true,
      limit: 5,
    });
    expect(result[0]!.offer_id).toBe("big_savings");
  });

  it("honors limit", () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      offer({ offer_id: `o${i}`, expected_savings_cents: 100 + i }),
    );
    const result = rank(candidates, {
      txCategories: [],
      counties: ["STATEWIDE"],
      useFallback: true,
      limit: 3,
    });
    expect(result).toHaveLength(3);
  });

  it("uses DEFAULT_WEIGHTS without crashing", () => {
    const result = rank([offer({ offer_id: "a" })], {
      txCategories: ["groceries"],
      counties: ["06037"],
      useFallback: false,
      limit: 5,
    });
    expect(result[0]!.score).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_WEIGHTS.w_cat + DEFAULT_WEIGHTS.w_sav + DEFAULT_WEIGHTS.w_geo + DEFAULT_WEIGHTS.w_pop).toBeCloseTo(1.0);
  });
});
