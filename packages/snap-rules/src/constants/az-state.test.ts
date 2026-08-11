import { describe, it, expect } from "vitest";
import { statePolicyFor } from "./states";
import { computeBenefit } from "../benefit-calc";
import type { Facts } from "../facts";

// Arizona (issue #720, third of the six-state gap tracked in #732).
// Source: packages/demeter-engine/src/states/az/{pack,supplements}.json.
//
// AZ introduces a NEW kind of schema mismatch: its SUA/LUA are size-banded
// (1-3 vs 4+ participants) — this schema has no size dimension, so the 1-3
// band is pinned as the default, and a dedicated test proves the 4+ band's
// real (higher) figures are NOT what this file encodes.

const ASOF = new Date("2026-08-11");

describe("Arizona — flat 200% BBCE, no tiering", () => {
  it("bbce_threshold_pct is 200, asset test waived for the categorical majority", () => {
    const p = statePolicyFor("AZ");
    expect(p.bbce).toBe(true);
    expect(p.bbce_threshold_pct).toBe(200);
    expect(p.asset_waiver).toBe(true);
    expect(p.allotment_tier).toBe("48");
  });
});

describe("Arizona SUA — 1-3 participant band pinned, NOT the 4+ band", () => {
  it("pins the 1-3 band (CNAP FAA6.J.09, eff. 10/1/2025)", () => {
    const p = statePolicyFor("AZ");
    expect(p.sua_by_tier).not.toBeNull();
    expect(p.sua_by_tier!.HCSUA.toNumber()).toBe(323);
    expect(p.sua_by_tier!.LUA.toNumber()).toBe(149);
    expect(p.sua_by_tier!.phone.toNumber()).toBe(44);
  });

  it("does NOT accidentally encode the 4+ band's higher figures ($438/$201)", () => {
    const p = statePolicyFor("AZ");
    expect(p.sua_by_tier!.HCSUA.toNumber()).not.toBe(438);
    expect(p.sua_by_tier!.LUA.toNumber()).not.toBe(201);
  });

  it("computes a real shelter deduction off the pinned 1-3-band HCSUA", () => {
    const facts = {
      household: [{ member_id: "m1", role: "head", age: 40, work_class: "gen_work_subject" }],
      income: [{ member: "m1", type: "wages", amount: 1000, anticipation: "averaged" }],
      shelter: { rent: 900, sua_tier: "HCSUA", sua_amount: 0, internet: 0, homeless_deduction: false },
      deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
      assets: 0,
      cat_elig: "NPA",
    } as unknown as Facts;
    const r = computeBenefit(facts, "AZ", ASOF);
    expect(r.trace.state_sua_value).toBe(323);
  });
});

describe("Arizona unsourced/simplified axes stay honest", () => {
  it("drug-felony ban is UNDER-CLAIMED as false — AZ genuinely enforces it with a conditional removal pathway", () => {
    // A real, conditional ban (drug-testing agreement + one of five
    // treatment/compliance conditions) that this boolean cannot express —
    // same FL/PA under-claim reasoning: `true` would deny everyone who
    // qualifies for removal too. See the states.ts AZ block comment.
    expect(statePolicyFor("AZ").drug_felony_ban).toBe(false);
  });

  it("ABAWD waiver flag is true — 7 real currently-waived areas exist (Yuma County + 6 Tribal areas)", () => {
    expect(statePolicyFor("AZ").abawd_waiver_avail).toBe(true);
  });

  it("RMP is true — Arizona is one of only 9 states on USDA FNA's own RMP list", () => {
    expect(statePolicyFor("AZ").rmp_operated).toBe(true);
  });
});
