import { describe, it, expect } from "vitest";
import { statePolicyFor } from "./states";
import { computeBenefit } from "../benefit-calc";
import type { Facts } from "../facts";

// New York (issue #731, closing the corpus-vs-engine gap tracked in #732).
// Source: packages/demeter-engine/src/states/ny/{pack,supplements}.json,
// verified 2026-08-07 (7/7 cross-check, 86/94 refute-gate claims confirmed).
//
// This state is a documented SIMPLIFICATION, not a full port — NY's real
// policy has three BBCE income tiers and regional SUAs that this schema
// cannot express in one scalar/one set. Every test below pins the CHOSEN
// simplification and its direction of error explicitly, the same discipline
// tranche1-states.test.ts uses for PA's null SUA and FL/PA's modified
// drug-felony bans — so a later reader finds an asserted, intentional limit,
// not a silent gap.

const ASOF = new Date("2026-08-11");

describe("New York — BBCE screens at the DEFAULT 130% tier only (200%/150% not modeled)", () => {
  it("bbce_threshold_pct is 130 — the general tier, same accepted-limitation shape as GA/IL", () => {
    const p = statePolicyFor("NY");
    expect(p.bbce).toBe(true);
    expect(p.bbce_threshold_pct).toBe(130);
    expect(p.bbce_fpl_basis).toBe("federal_fiscal_year");
  });

  it("asset test is waived for the categorically-eligible majority", () => {
    expect(statePolicyFor("NY").asset_waiver).toBe(true);
  });

  it("uses the 48-state allotment table", () => {
    expect(statePolicyFor("NY").allotment_tier).toBe("48");
  });
});

describe("New York SUA — Rest-of-State values, NOT NYC or Nassau-Suffolk", () => {
  it("pins the Rest-of-State dollar figures (GIS 25DC059, eff. 10/1/2025)", () => {
    const p = statePolicyFor("NY");
    expect(p.sua_by_tier).not.toBeNull();
    expect(p.sua_by_tier!.HCSUA.toNumber()).toBe(877);
    expect(p.sua_by_tier!.LUA.toNumber()).toBe(355);
    expect(p.sua_by_tier!.phone.toNumber()).toBe(32);
  });

  it("computes a real shelter deduction off the Rest-of-State HCSUA", () => {
    const facts = {
      household: [{ member_id: "m1", role: "head", age: 40, work_class: "gen_work_subject" }],
      income: [{ member: "m1", type: "wages", amount: 1000, anticipation: "averaged" }],
      shelter: { rent: 900, sua_tier: "HCSUA", sua_amount: 0, internet: 0, homeless_deduction: false },
      deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
      assets: 0,
      cat_elig: "NPA",
    } as unknown as Facts;
    const r = computeBenefit(facts, "NY", ASOF);
    expect(r.trace.state_sua_value).toBe(877);
  });

  it("does NOT accidentally match NYC's ($1,062) or Nassau-Suffolk's ($988) higher values", () => {
    // The whole point of the simplification comment in states.ts: this
    // engine will UNDER-compute the shelter deduction for NYC/Nassau-Suffolk
    // households. Pinning the wrong-region values here would silently hide
    // a regression that "fixes" this into an equally-wrong different number.
    const p = statePolicyFor("NY");
    expect(p.sua_by_tier!.HCSUA.toNumber()).not.toBe(1062);
    expect(p.sua_by_tier!.HCSUA.toNumber()).not.toBe(988);
  });
});

describe("New York unsourced/simplified axes stay honest", () => {
  it("drug-felony ban is a full opt-out — false, consistent with IL/NV/MA in this file", () => {
    // Corroborated by multiple independent secondary sources, NOT verified
    // against a primary OTDA source this pass — the NY corpus pack itself
    // never addressed this topic. See the states.ts NY block comment.
    expect(statePolicyFor("NY").drug_felony_ban).toBe(false);
  });

  it("ABAWD waiver flag is false — statewide operation since 3/1/2026, only 2 reservations exempt", () => {
    // Unlike CA's/MI's `true` (a meaningful fraction of counties genuinely
    // waived, so the permissive fallback matters), NY's waived area is two
    // tiny reservations out of 58 districts — `false` is the correct
    // general-case default, not a fail-open guess.
    expect(statePolicyFor("NY").abawd_waiver_avail).toBe(false);
  });

  it("RMP is true — New York is on USDA FNA's own Restaurant Meals Program state list", () => {
    expect(statePolicyFor("NY").rmp_operated).toBe(true);
  });
});
