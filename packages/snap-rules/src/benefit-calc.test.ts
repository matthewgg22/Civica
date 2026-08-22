// Regression tests for benefit-calc edge cases.
//
// #436: composeBenefit must not throw when policy.sua_by_tier is null AND
// facts.shelter.sua_tier === "none" (the household claims no SUA
// contribution). Before the fix, every TX/KS fixture row with sua_tier:
// "none" produced a "composer threw: SUA not authored for state TX" —
// one engine bug hit by 63 fixture rows.

import { describe, it, expect } from "vitest";
import { computeBenefit } from "./benefit-calc";
import { composeVerdict } from "./verdict";
import type { Facts } from "./facts";

function baseFacts(suaTier: Facts["shelter"]["sua_tier"]): Facts {
  return {
    household: [
      { member_id: "m1", age: 35, role: "head", immigration: "citizen", work_class: "gen_work_subject" },
    ],
    income: [{ member: "m1", type: "wages", amount: 1000, anticipation: "averaged" }],
    shelter: { rent: 500, sua_tier: suaTier, sua_amount: 0, internet: 0, homeless_deduction: false },
    deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
    assets: 100,
    cat_elig: "NPA",
  };
}

const ASOF = new Date("2026-06-01");

describe("computeBenefit — SUA-not-authored regression (#436)", () => {
  it("TX household with sua_tier='none' computes without throw", () => {
    const facts = baseFacts("none");
    expect(() => computeBenefit(facts, "TX", ASOF)).not.toThrow();
    const r = computeBenefit(facts, "TX", ASOF);
    expect(r.trace.state_sua_value).toBe(0);
    expect(r.monthly_benefit).toBeGreaterThanOrEqual(0);
    expect(r.excess_shelter_deduction).toBeGreaterThanOrEqual(0);
  });

  it("PA household with sua_tier='none' computes without throw", () => {
    const facts = baseFacts("none");
    expect(() => computeBenefit(facts, "PA", ASOF)).not.toThrow();
    const r = computeBenefit(facts, "PA", ASOF);
    expect(r.trace.state_sua_value).toBe(0);
  });

  it("PA household with sua_tier='HCSUA' still throws (engine invariant)", () => {
    // Composer must SKIP before reaching computeBenefit for this case; if
    // any caller reaches here directly with non-"none" tier on an
    // unauthored state, the throw is the correct fail-loud signal.
    //
    // This case has moved exemplars three times as states got authored:
    // TX (until #607), then KS (until #607's follow-through), then FL
    // (until #619 sourced FL/IL/OH — 2026-08-09). PA remains a genuine,
    // logged verification gap (see its comment in states.ts) and is the
    // current exemplar.
    const facts = baseFacts("HCSUA");
    expect(() => computeBenefit(facts, "PA", ASOF)).toThrow(/SUA not authored for state PA/);
  });

  it("TX with sua_tier='HCSUA' now COMPUTES — its standards are authored (#607)", () => {
    const facts = baseFacts("HCSUA");
    expect(() => computeBenefit(facts, "TX", ASOF)).not.toThrow();
    const r = computeBenefit(facts, "TX", ASOF);
    expect(r.trace.state_sua_value).toBe(445); // TWH A-1429 heating/cooling SUA
  });

  it("KS with sua_tier='HCSUA' now COMPUTES — KEESM §7226 is authored (#607)", () => {
    const facts = baseFacts("HCSUA");
    expect(() => computeBenefit(facts, "KS", ASOF)).not.toThrow();
    const r = computeBenefit(facts, "KS", ASOF);
    expect(r.trace.state_sua_value).toBe(469); // KEESM §7226 heating/cooling standard
  });

  it("AK with sua_tier='HCSUA' now COMPUTES — Central region is authored (#607)", () => {
    const facts = baseFacts("HCSUA");
    expect(() => computeBenefit(facts, "AK", ASOF)).not.toThrow();
    const r = computeBenefit(facts, "AK", ASOF);
    expect(r.trace.state_sua_value).toBe(625); // FSP 77, Central utility region heating standard
  });

  it("composeVerdict on TX + sua_tier='none' returns APPROVE (no throw, no SKIP)", () => {
    const facts = baseFacts("none");
    const result = composeVerdict(facts, "TX", ASOF);
    expect(result.not_implemented_surfaces).toBeUndefined();
    expect(result.verdict).toBe("APPROVE");
    expect(typeof result.benefit).toBe("number");
  });

  it("composeVerdict on PA + sua_tier='HCSUA' still SKIPs cleanly", () => {
    // Same re-pointing as above: PA is now the unauthored exemplar.
    const facts = baseFacts("HCSUA");
    const result = composeVerdict(facts, "PA", ASOF);
    expect(result.not_implemented_surfaces).toContain("shelter.sua.HCSUA");
  });

  it("composeVerdict on TX + sua_tier='HCSUA' no longer SKIPs", () => {
    const facts = baseFacts("HCSUA");
    const result = composeVerdict(facts, "TX", ASOF);
    expect(result.not_implemented_surfaces).toBeUndefined();
  });

  it("composeVerdict on KS + sua_tier='HCSUA' no longer SKIPs", () => {
    const facts = baseFacts("HCSUA");
    const result = composeVerdict(facts, "KS", ASOF);
    expect(result.not_implemented_surfaces).toBeUndefined();
  });

  it("composeVerdict on AK + sua_tier='HCSUA' no longer SKIPs", () => {
    const facts = baseFacts("HCSUA");
    const result = composeVerdict(facts, "AK", ASOF);
    expect(result.not_implemented_surfaces).toBeUndefined();
  });
});

describe("computeBenefit — AK real per-region SUA (#631)", () => {
  function akFacts(countyFips?: string): Facts {
    const facts = baseFacts("HCSUA");
    return countyFips ? { ...facts, county_fips: countyFips } : facts;
  }

  it("no county_fips — falls back to the Central region (states.ts's AK.sua_by_tier), exactly as before #631", () => {
    const r = computeBenefit(akFacts(), "AK", ASOF);
    expect(r.trace.state_sua_value).toBe(625);
  });

  it("county_fips in Nome (Northwest, 02180) uses the REAL Northwest rate, not Central", () => {
    const r = computeBenefit(akFacts("02180"), "AK", ASOF);
    expect(r.trace.state_sua_value).toBe(1107);
    expect(r.trace.state_sua_value).not.toBe(625); // the bug #631 exists to fix
  });

  it("county_fips in Anchorage (Central, 02020) matches the fallback value — same region either way", () => {
    const r = computeBenefit(akFacts("02020"), "AK", ASOF);
    expect(r.trace.state_sua_value).toBe(625);
  });

  it("an unrecognized county_fips falls back to Central rather than throwing or zeroing", () => {
    const r = computeBenefit(akFacts("00000"), "AK", ASOF);
    expect(r.trace.state_sua_value).toBe(625);
  });

  it("county_fips for a NON-Alaska state is ignored — this precision is AK-only", () => {
    // 02180 (Nome, AK) has no meaning as a TX county; TX must use its own
    // authored SUA, not accidentally pick up AK's regional table.
    const facts = { ...baseFacts("HCSUA"), county_fips: "02180" };
    const r = computeBenefit(facts, "TX", ASOF);
    expect(r.trace.state_sua_value).toBe(445); // TX's own authored HCSUA
  });

  it("LUA and phone tiers also pick up the real region, not just HCSUA", () => {
    const heat = computeBenefit(akFacts("02180"), "AK", ASOF); // uses the HCSUA tier from akFacts
    // Build LUA/phone-tier variants directly to check the other two tiers.
    const luaFacts = { ...baseFacts("LUA"), county_fips: "02180" };
    const phoneFacts = { ...baseFacts("phone"), county_fips: "02180" };
    expect(computeBenefit(luaFacts, "AK", ASOF).trace.state_sua_value).toBe(158 + 48 + 63); // Northwest LUA
    expect(computeBenefit(phoneFacts, "AK", ASOF).trace.state_sua_value).toBe(37); // Northwest phone
    expect(heat.trace.state_sua_value).toBe(1107); // sanity: HCSUA tier still Northwest's heat figure
  });
});

describe("computeBenefit — AK real zone-based max allotment (#814)", () => {
  // Zero income + zero rent/SUA isolates max_allotment_for_household_size:
  // net income lands at exactly $0, so 30%-of-net is $0 and
  // monthly_benefit === the zone's raw max allotment for that household
  // size, with no other deduction math obscuring the comparison.
  function zeroIncomeHousehold(size: number, countyFips?: string): Facts {
    const household: Facts["household"] = Array.from({ length: size }, (_, i) => ({
      member_id: `m${i + 1}`,
      age: 35,
      role: i === 0 ? "head" : "member",
      immigration: "citizen",
      work_class: "gen_work_subject",
    }));
    return {
      household,
      income: [],
      shelter: { rent: 0, sua_tier: "none", sua_amount: 0, internet: 0, homeless_deduction: false },
      deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
      assets: 0,
      cat_elig: "NPA",
      ...(countyFips ? { county_fips: countyFips } : {}),
    };
  }

  it("before #814 this silently returned the 48-contiguous $994 HH4 max for AK too — now returns AK's real Urban figure", () => {
    const r = computeBenefit(zeroIncomeHousehold(4), "AK", ASOF); // no county_fips — Urban fallback
    expect(r.max_allotment_for_household_size).toBe(1285);
    expect(r.monthly_benefit).toBe(1285);
    expect(r.max_allotment_for_household_size).toBeGreaterThan(994); // the #814 bug
  });

  it("Anchorage (02020, Urban) matches the no-county fallback exactly", () => {
    const r = computeBenefit(zeroIncomeHousehold(4, "02020"), "AK", ASOF);
    expect(r.max_allotment_for_household_size).toBe(1285);
    expect(r.monthly_benefit).toBe(1285);
  });

  it("Copper River Census Area (02066, Rural I) computes a higher benefit than Urban for the identical household", () => {
    const r = computeBenefit(zeroIncomeHousehold(4, "02066"), "AK", ASOF);
    expect(r.max_allotment_for_household_size).toBe(1639);
    expect(r.monthly_benefit).toBe(1639);
  });

  it("Bethel (02050, Rural II) computes the highest tier's benefit for the identical household", () => {
    const r = computeBenefit(zeroIncomeHousehold(4, "02050"), "AK", ASOF);
    expect(r.max_allotment_for_household_size).toBe(1995);
    expect(r.monthly_benefit).toBe(1995);
  });

  it("a non-AK state with an AK-shaped countyFips is unaffected — this precision is AK-only", () => {
    const r = computeBenefit(zeroIncomeHousehold(4, "02050"), "TX", ASOF);
    expect(r.max_allotment_for_household_size).toBe(994); // TX's own 48-contiguous figure, not Bethel's
  });

  it("AK's own zone-based minimum-benefit floor applies for HH1-2, not the $24 federal default", () => {
    // A household of 1 with heavy deductions can land benefit below the
    // minimum-benefit floor; the floor should be the AK ZONE's floor.
    const facts: Facts = {
      ...zeroIncomeHousehold(1, "02050"), // Bethel, Rural II — $48 floor
      income: [{ member: "m1", type: "wages", amount: 50, anticipation: "averaged" }],
    };
    const r = computeBenefit(facts, "AK", ASOF);
    expect(r.monthly_benefit).toBeGreaterThanOrEqual(48);
  });
});
