import { describe, it, expect } from "vitest";
import { statePolicyFor } from "./states";
import { computeBenefit } from "../benefit-calc";
import type { Facts } from "../facts";

// Tranche 1 (docs/plans/state-coverage-framework-2026-08.md): FL, IL, PA, OH.
//
// Half of this suite pins what the FNS BBCE chart (June 2026) actually says.
// The other half pins what we DON'T know — because the failure mode for a
// partially-sourced state is someone later reading a fail-open default as a
// finding and quoting it to an applicant.

const ASOF = new Date("2026-08-08");

describe("Tranche 1 income screens (FNS BBCE chart, June 2026)", () => {
  it.each([
    ["FL", 200],
    ["IL", 165],
    ["PA", 200],
    ["OH", 130],
  ])("%s screens at %i%% FPL", (code, pct) => {
    const p = statePolicyFor(code);
    expect(p.bbce).toBe(true);
    expect(p.bbce_threshold_pct).toBe(pct);
    expect(p.asset_waiver).toBe(true); // "No limit on assets" for all four
  });

  it("BBCE is not a synonym for 200% — OH waives assets at the federal 130%", () => {
    // Same archetype as Georgia: categorical eligibility that drops the asset
    // test without raising the income screen. Anyone assuming BBCE ⇒ 200%
    // would over-approve every Ohio household between 130% and 200% FPL.
    expect(statePolicyFor("OH").bbce_threshold_pct).toBe(130);
    expect(statePolicyFor("OH").asset_waiver).toBe(true);
    expect(statePolicyFor("IL").bbce_threshold_pct).toBe(165);
  });

  it("all four use the 48-state allotment table", () => {
    for (const c of ["FL", "IL", "PA", "OH"]) {
      expect(statePolicyFor(c).allotment_tier).toBe("48");
    }
  });
});

describe("Tranche 1 unsourced axes stay honest", () => {
  it.each(["FL", "IL", "PA", "OH"])(
    "%s has NO authored SUA — utility standards were not sourced",
    (code) => {
      expect(
        statePolicyFor(code).sua_by_tier,
        `${code} SUA must stay null until its published utility table is sourced (#619)`,
      ).toBeNull();
    },
  );

  it.each(["FL", "IL", "PA", "OH"])(
    "%s fails LOUDLY on a shelter deduction rather than inventing one",
    (code) => {
      const facts = {
        household: [{ member_id: "m1", role: "head", age: 40, work_class: "gen_work_subject" }],
        income: [],
        shelter: { rent: 900, sua_tier: "HCSUA" },
        deductions: {},
        assets: 0,
        cat_elig: "none",
      } as unknown as Facts;
      // The #436 invariant: an unauthored SUA must throw, never silently
      // substitute zero or another state's value.
      expect(() => computeBenefit(facts, code, ASOF)).toThrow(/SUA not authored/);
    },
  );

  it("fail-open flags err toward eligibility, never toward denial", () => {
    // These are defaults pending sourcing, not findings. Both directions
    // matter: a wrong `false` on the waiver flag would strip an ABAWD
    // exemption (#608), and a wrong `true` on the felony ban would
    // disqualify someone outright.
    for (const c of ["FL", "IL", "PA", "OH"]) {
      expect(statePolicyFor(c).abawd_waiver_avail, `${c} waiver flag`).toBe(true);
      expect(statePolicyFor(c).drug_felony_ban, `${c} felony ban`).toBe(false);
    }
  });

  it("Illinois RMP stays false — it runs in Cook and Franklin counties only", () => {
    // Under-claiming a real county program beats advertising it statewide.
    expect(statePolicyFor("IL").rmp_operated).toBe(false);
  });
});
