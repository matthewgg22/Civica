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

  it("FL household with sua_tier='none' computes without throw", () => {
    const facts = baseFacts("none");
    expect(() => computeBenefit(facts, "FL", ASOF)).not.toThrow();
    const r = computeBenefit(facts, "FL", ASOF);
    expect(r.trace.state_sua_value).toBe(0);
  });

  it("FL household with sua_tier='HCSUA' still throws (engine invariant)", () => {
    // Composer must SKIP before reaching computeBenefit for this case; if
    // any caller reaches here directly with non-"none" tier on an
    // unauthored state, the throw is the correct fail-loud signal.
    //
    // This case has moved exemplars twice as states got authored: TX (until
    // #607), then KS (until #607's follow-through — KS/AK sourced 2026-08-09).
    // FL/IL/PA/OH remain unauthored (Tranche 1, #619) and are the current
    // exemplars.
    const facts = baseFacts("HCSUA");
    expect(() => computeBenefit(facts, "FL", ASOF)).toThrow(/SUA not authored for state FL/);
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

  it("composeVerdict on FL + sua_tier='HCSUA' still SKIPs cleanly", () => {
    // Same re-pointing as above: FL is now the unauthored exemplar.
    const facts = baseFacts("HCSUA");
    const result = composeVerdict(facts, "FL", ASOF);
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
