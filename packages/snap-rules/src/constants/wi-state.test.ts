import { describe, it, expect } from "vitest";
import { statePolicyFor } from "./states";
import { computeBenefit } from "../benefit-calc";
import type { Facts } from "../facts";

// Wisconsin (issue #729, fifth of the six-state gap tracked in #732).
// Source: packages/demeter-engine/src/states/wi/{pack,supplements}.json.
//
// WI carries the most severe SUA-schema mismatch in this file: 7 real tiers,
// only 3 map onto this schema's 4 slots. Four separate standards (EUA, WUA,
// FUA, TUA) have no slot at all — a materially bigger gap than any other
// state's single-tier gap, worth its own dedicated test.

const ASOF = new Date("2026-08-11");

describe("Wisconsin — flat 200% BBCE (EBD's no-gross-limit exception not modeled)", () => {
  it("bbce_threshold_pct is 200, asset test waived for the categorical majority", () => {
    const p = statePolicyFor("WI");
    expect(p.bbce).toBe(true);
    expect(p.bbce_threshold_pct).toBe(200);
    expect(p.asset_waiver).toBe(true);
    expect(p.allotment_tier).toBe("48");
  });
});

describe("Wisconsin SUA — only 3 of 7 real tiers have a schema slot", () => {
  it("pins the 3 mapped tiers (FSH 4.6.7.3 / 8.1.3, eff. 10/1/2025)", () => {
    const p = statePolicyFor("WI");
    expect(p.sua_by_tier).not.toBeNull();
    expect(p.sua_by_tier!.HCSUA.toNumber()).toBe(553);
    expect(p.sua_by_tier!.LUA.toNumber()).toBe(385);
    expect(p.sua_by_tier!.phone.toNumber()).toBe(31);
  });

  it("the 4 unmapped tiers (EUA $155, WUA $106, FUA $48, TUA $28) are not quietly encoded anywhere", () => {
    // A WI household billed for exactly one of these four utilities gets no
    // deduction under this engine at all — the biggest single-tier loss in
    // this file. Pinning that none of the 3 mapped slots holds one of these
    // 4 values catches a future mis-mapping, not just documents the gap.
    const p = statePolicyFor("WI");
    const mapped = [p.sua_by_tier!.HCSUA.toNumber(), p.sua_by_tier!.LUA.toNumber(), p.sua_by_tier!.phone.toNumber()];
    for (const unmapped of [155, 106, 48, 28]) {
      expect(mapped).not.toContain(unmapped);
    }
  });

  it("computes a real shelter deduction off the mapped HCSUA", () => {
    const facts = {
      household: [{ member_id: "m1", role: "head", age: 40, work_class: "gen_work_subject" }],
      income: [{ member: "m1", type: "wages", amount: 1000, anticipation: "averaged" }],
      shelter: { rent: 900, sua_tier: "HCSUA", sua_amount: 0, internet: 0, homeless_deduction: false },
      deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
      assets: 0,
      cat_elig: "NPA",
    } as unknown as Facts;
    const r = computeBenefit(facts, "WI", ASOF);
    expect(r.trace.state_sua_value).toBe(553);
  });
});

describe("Wisconsin unsourced/simplified axes stay honest", () => {
  it("drug-felony ban is UNDER-CLAIMED as false — WI genuinely sanctions on a failed one-time test", () => {
    // A time-boxed (5-year), test-conditional 12-month sanction the boolean
    // can't express — same under-claim reasoning as AZ's/FL's/PA's entries:
    // most affected people (conviction 5+ years old, or a passed test) face
    // no restriction, so `true` would wrongly deny that majority.
    expect(statePolicyFor("WI").drug_felony_ban).toBe(false);
  });

  it("ABAWD waiver flag is false — the WI corpus pack found NO confirmed currently-waived county", () => {
    expect(statePolicyFor("WI").abawd_waiver_avail).toBe(false);
  });

  it("RMP is false — confirmed absent from USDA's list via direct curl, not an AI-summarized fetch", () => {
    expect(statePolicyFor("WI").rmp_operated).toBe(false);
  });
});
