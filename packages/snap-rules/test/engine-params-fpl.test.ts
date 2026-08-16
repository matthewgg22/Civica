import { describe, it, expect } from "vitest";
import { getEngineParams } from "../src/constants/index";
import { fplMonthly } from "../src/constants/federal-tables";

// Regression for #601. getEngineParams re-derived its FPL row with
// roundDollar() (HALF_UP) instead of reusing fplMonthly(), whose floorDollar()
// is what grossIncomeTest/netIncomeTest actually compare against.
//
// The drift is only visible where annual/12 has a fractional part >= .5 —
// FY26 HH3 and HH6 — so it hid behind seven correct rows, then got amplified
// by anything scaling the base: Demeter printed the CA BBCE 200% screen a
// few dollars off from what the engine itself scored a household against.
//
// #869/#868: the FY26 base constant this file's expected numbers were
// originally pinned against ($15,660) was itself wrong (should be $15,650
// per 90 FR 5917 — #869). With the constant corrected, this file's figures
// no longer match CDSS ACIN I-46-25 (FFY2026) Attachment I at ANY household
// size — floor($15,650-based annual/12) is uniformly $1 lower than ACIN's
// (and FNS's own) published monthly FPL at every size. That mismatch is a
// SEPARATE, wider, not-yet-authorized question (#868: is `floor` even the
// right convention for the contiguous table, same question #818 raised for
// AK) — NOT fixed here. The values below are pinned to what the corrected-
// constant engine, with its EXISTING floor convention, actually computes —
// i.e. this test guards engine-internal consistency (getEngineParams agrees
// with fplMonthly/the gates), not an external ACIN/FNS table match. See
// #868 for the full reconciliation showing `ceiling` would match ACIN/FNS
// exactly instead.

const ASOF = new Date("2026-08-08"); // FY26

describe("getEngineParams FPL row (#601)", () => {
  it("is identical to the canonical fplMonthly at every household size", () => {
    const p = getEngineParams("CA", ASOF);
    for (let n = 1; n <= 8; n++) {
      expect(p.fpl![String(n)], `HH${n}`).toBe(fplMonthly(n, ASOF, "CA").toNumber());
    }
  });

  it("reflects the #869-corrected $15,650 base constant (floor convention unchanged)", () => {
    const p = getEngineParams("CA", ASOF);
    // #868: these are $1 BELOW CDSS ACIN I-46-25's published monthly FPL at
    // every size (ACIN/FNS: 1305/1763/2221/2680/3138/3596/4055/4513) — a
    // known, documented, NOT-yet-authorized-to-fix residual of the `floor`
    // convention, not a new bug in this constant correction.
    expect(p.fpl!["1"]).toBe(1304);
    expect(p.fpl!["3"]).toBe(2220);
    expect(p.fpl!["4"]).toBe(2679);
    expect(p.fpl!["6"]).toBe(3595);
  });

  it("derived income screens (engine-internal consistency, not an ACIN/FNS match — see #868)", () => {
    const p = getEngineParams("CA", ASOF);
    const at = (n: number, pct: number) => Math.round((p.fpl![String(n)]! * pct) / 100);
    // ACIN Attachment I published figures are HH3 BBCE-200 = $4,442; HH4 =
    // $5,360 — this test does NOT assert those; it asserts what the
    // corrected-constant + floor engine actually derives (#868's documented
    // residual: $2 below ACIN at HH3/HH4 BBCE-200).
    expect(at(3, 200)).toBe(4440);
    expect(at(4, 200)).toBe(5358);
    expect(at(3, 130)).toBe(2886);
    expect(at(4, 130)).toBe(3483);
  });

  it("holds for every registered state, not just CA", () => {
    for (const state of ["CA", "MA", "TX", "AK"]) {
      const p = getEngineParams(state, ASOF);
      for (let n = 1; n <= 8; n++) {
        expect(p.fpl![String(n)], `${state} HH${n}`).toBe(fplMonthly(n, ASOF, state).toNumber());
      }
    }
  });
});
