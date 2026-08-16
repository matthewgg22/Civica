import { describe, it, expect } from "vitest";
import { getEngineParams } from "../src/constants/index";
import {
  maxAllotmentFor,
  shelterCapFor,
  minimumBenefitFor,
  standardDeductionFor,
} from "../src/constants/federal-tables";

// Regression for #882. getEngineParams() built max_allotment/shelter_cap/
// min_benefit/sd straight from the 48-contiguous federal snapshot, ignoring
// `state` entirely on those four axes — even though maxAllotmentFor/
// shelterCapFor/minimumBenefitFor/standardDeductionFor all gained real
// AK/VI/HI/GU branches this session (#814/#858/#861/#866) and
// benefit-calc.ts already called them correctly with `state`. This is the
// exact #601-class drift (a params surface silently disagreeing with the
// engine's own determination) on the state axis instead of the household-
// size axis. Anything consuming getEngineParams (Demeter's live-figures
// citation block, the profile-harness's PARAMS_MISMATCH check) got the
// 48-contiguous defaults for AK/VI/HI/GU, even though benefit-calc.ts's
// actual per-household math for those four jurisdictions was already right.

const ASOF = new Date(Date.UTC(2026, 5, 1)); // FY26, matches the harness's asOf

describe("getEngineParams state-conditioning (#882)", () => {
  it.each(["AK", "VI", "HI", "GU"])(
    "%s: max_allotment agrees with maxAllotmentFor for every household size",
    (state) => {
      const p = getEngineParams(state, ASOF);
      for (let n = 1; n <= 8; n++) {
        expect(p.max_allotment![String(n)], `${state} HH${n}`).toBe(
          maxAllotmentFor(n, ASOF, state).toNumber(),
        );
      }
    },
  );

  it.each(["AK", "VI", "HI", "GU"])("%s: shelter_cap agrees with shelterCapFor", (state) => {
    const p = getEngineParams(state, ASOF);
    expect(p.shelter_cap).toBe(shelterCapFor(ASOF, state).toNumber());
  });

  it.each(["AK", "VI", "HI", "GU"])("%s: min_benefit agrees with minimumBenefitFor", (state) => {
    const p = getEngineParams(state, ASOF);
    expect(p.min_benefit).toBe(minimumBenefitFor(ASOF, state).toNumber());
  });

  it.each(["AK", "VI", "HI", "GU"])(
    "%s: sd agrees with standardDeductionFor for every household size",
    (state) => {
      const p = getEngineParams(state, ASOF);
      for (let n = 1; n <= 8; n++) {
        expect(p.sd![String(n)], `${state} HH${n}`).toBe(
          standardDeductionFor(n, ASOF, state).toNumber(),
        );
      }
    },
  );

  it("AK is genuinely elevated over the 48-contiguous default (the drift this issue caught)", () => {
    const ak = getEngineParams("AK", ASOF);
    const ca = getEngineParams("CA", ASOF); // CA never branches — 48-contiguous federal default
    expect(ak.shelter_cap!).toBeGreaterThan(ca.shelter_cap!);
    expect(ak.min_benefit!).toBeGreaterThan(ca.min_benefit!);
    expect(ak.max_allotment!["1"]).toBeGreaterThan(ca.max_allotment!["1"]);
  });

  it("VI's sd/max_allotment/shelter_cap/min_benefit are genuinely LOWER than federal at small sizes (opposite direction from AK)", () => {
    const vi = getEngineParams("VI", ASOF);
    const ca = getEngineParams("CA", ASOF);
    expect(vi.shelter_cap!).toBeLessThan(ca.shelter_cap!);
    expect(vi.sd!["1"]).toBeLessThan(ca.sd!["1"]);
  });

  it("accepts an optional countyFips for AK zone precision, same shape as maxAllotmentFor/minimumBenefitFor", () => {
    // Juneau (02110) is Urban zone; without a countyFips getEngineParams falls
    // back to Urban too — so passing Juneau's FIPS should be a no-op here,
    // proving the plumbing reaches through rather than asserting a specific
    // non-Urban zone's numbers (out of scope for this regression).
    const withoutCounty = getEngineParams("AK", ASOF);
    const withJuneau = getEngineParams("AK", ASOF, "02110");
    expect(withJuneau.max_allotment).toEqual(withoutCounty.max_allotment);
    expect(withJuneau.min_benefit).toBe(withoutCounty.min_benefit);
  });

  it("every other state's output is unaffected (asset_limit stays federally uniform, not state-conditioned)", () => {
    for (const state of ["CA", "MA", "TX", "NY"]) {
      const p = getEngineParams(state, ASOF);
      // Asset limits have no state axis in federal-tables.ts — confirms the
      // fix didn't accidentally introduce one.
      expect(p.asset_limit).toBe(3000);
      expect(p.asset_limit_ed).toBe(4500);
    }
  });

  it("#675: bbce_threshold_pct is sourced from StatePolicy, undefined for states with none authored", () => {
    expect(getEngineParams("CA", ASOF).bbce_threshold_pct).toBe(200);
    expect(getEngineParams("TX", ASOF).bbce_threshold_pct).toBe(165);
    expect(getEngineParams("AK", ASOF).bbce_threshold_pct).toBe(200); // AK adopted BBCE-200, #804, eff. 2025-07-01
    expect(getEngineParams("UT", ASOF).bbce_threshold_pct).toBeUndefined(); // UT: bbce: false, no threshold authored
  });
});
