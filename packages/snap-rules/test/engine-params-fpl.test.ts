import { describe, it, expect } from "vitest";
import { getEngineParams } from "../src/constants/index";
import { fplMonthly } from "../src/constants/federal-tables";

// Regression for #601. getEngineParams re-derived its FPL row with
// roundDollar() (HALF_UP) instead of reusing fplMonthly(), whose floorDollar()
// is what grossIncomeTest/netIncomeTest actually compare against and what
// reconciles with CDSS ACIN I-46-25 (FFY2026) Attachment I.
//
// The drift is only visible where annual/12 has a fractional part >= .5 —
// FY26 HH3 (2221.67) and HH6 (3596.67) — so it hid behind seven correct rows,
// then got amplified by anything scaling the base: Demeter printed the CA BBCE
// 200% screen as $4,444 at HH3 where the published table says $4,442, telling a
// household it was under a threshold the engine itself scored it over.

const ASOF = new Date("2026-08-08"); // FY26

describe("getEngineParams FPL row (#601)", () => {
  it("is identical to the canonical fplMonthly at every household size", () => {
    const p = getEngineParams("CA", ASOF);
    for (let n = 1; n <= 8; n++) {
      expect(p.fpl![String(n)], `HH${n}`).toBe(fplMonthly(n, ASOF).toNumber());
    }
  });

  it("matches the published CDSS ACIN I-46-25 monthly figures, incl. the two that drifted", () => {
    const p = getEngineParams("CA", ASOF);
    expect(p.fpl!["3"]).toBe(2221); // was 2222 under roundDollar
    expect(p.fpl!["6"]).toBe(3596); // was 3597 under roundDollar
    expect(p.fpl!["1"]).toBe(1305);
    expect(p.fpl!["4"]).toBe(2680);
  });

  it("derived income screens now agree with the published table", () => {
    const p = getEngineParams("CA", ASOF);
    const at = (n: number, pct: number) => Math.round((p.fpl![String(n)]! * pct) / 100);
    // ACIN Attachment I: HH3 BBCE-200 = $4,442; HH4 = $5,360.
    expect(at(3, 200)).toBe(4442);
    expect(at(4, 200)).toBe(5360);
    expect(at(3, 130)).toBe(2887);
    expect(at(4, 130)).toBe(3484);
  });

  it("holds for every registered state, not just CA", () => {
    for (const state of ["CA", "MA", "TX"]) {
      const p = getEngineParams(state, ASOF);
      for (let n = 1; n <= 8; n++) {
        expect(p.fpl![String(n)], `${state} HH${n}`).toBe(fplMonthly(n, ASOF).toNumber());
      }
    }
  });
});
