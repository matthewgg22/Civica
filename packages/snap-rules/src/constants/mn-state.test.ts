import { describe, it, expect } from "vitest";
import { statePolicyFor } from "./states";
import { computeBenefit } from "../benefit-calc";
import type { Facts } from "../facts";

// Minnesota (issue #730, sixth and last of the six-state gap tracked in
// #732). Source: packages/demeter-engine/src/states/mn/{pack,supplements}.json.
//
// MN's SUA is DELIBERATELY null, following the exact PA precedent in
// tranche1-states.test.ts: the MN corpus pack's own build could not confirm
// a current dollar figure against a primary source, so this engine fails
// loudly on a shelter deduction rather than inventing one.

const ASOF = new Date("2026-08-11");

describe("Minnesota — flat 200% BBCE, exempt from BOTH asset and net income tests", () => {
  it("bbce_threshold_pct is 200, asset test waived for the categorical majority", () => {
    const p = statePolicyFor("MN");
    expect(p.bbce).toBe(true);
    expect(p.bbce_threshold_pct).toBe(200);
    expect(p.asset_waiver).toBe(true);
    expect(p.allotment_tier).toBe("48");
  });
});

describe("Minnesota has NO authored SUA — a logged verification gap, not an oversight", () => {
  it("sua_by_tier stays null until a working primary source is reached", () => {
    expect(
      statePolicyFor("MN").sua_by_tier,
      "MN's Combined Manual utility-deduction section text was not captured this pass; both a USDA FY26 SUA PDF and a DHS page returned access-denied — see the states.ts comment for what was tried",
    ).toBeNull();
  });

  it("MN fails LOUDLY on a shelter deduction rather than inventing one", () => {
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
    expect(() => computeBenefit(facts, "MN", ASOF)).toThrow(/SUA not authored/);
  });
});

describe("Minnesota unsourced/simplified axes stay honest", () => {
  it("drug-felony ban is a CLEAN full opt-out — false, corrects a false secondary-source lifetime-ban claim", () => {
    // Unlike AZ's/WI's judgment-call `false` (a real restriction the
    // boolean can't express), MN's is a clean, unconditional finding: CM
    // 0011.27.03 explicitly bars using a failed/refused test to deny or
    // terminate benefits. Same shape as IL's/NV's entries above.
    expect(statePolicyFor("MN").drug_felony_ban).toBe(false);
  });

  it("ABAWD waiver flag is false — the MN corpus pack's own instruction: presumptively unwaived pending confirmation", () => {
    expect(statePolicyFor("MN").abawd_waiver_avail).toBe(false);
  });

  it("RMP is false — confirmed absent from USDA's list; proposed legislation has not been enacted", () => {
    expect(statePolicyFor("MN").rmp_operated).toBe(false);
  });
});
