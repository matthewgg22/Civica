import { describe, it, expect } from "vitest";
import { statePolicyFor } from "./states";
import { computeBenefit } from "../benefit-calc";
import type { Facts } from "../facts";

// Oregon (issue #728, fourth of the six-state gap tracked in #732).
// Source: packages/demeter-engine/src/states/or/{pack,supplements}.json.
//
// OR is a clean 4-tier SUA fit (like NV), needing only the same
// undermodeled-single-utility disclosure every 4-tier state in this file
// carries. Its ABAWD call is the interesting one: OR gets `false`, the
// opposite of NV's/AZ's `true`, because its real exempt areas are 5 tribal
// jurisdictions, not a meaningful fraction of its 36 counties.

const ASOF = new Date("2026-08-11");

describe("Oregon — flat 200% BBCE, no tiering", () => {
  it("bbce_threshold_pct is 200, asset test waived for the categorical majority", () => {
    const p = statePolicyFor("OR", ASOF);
    expect(p.bbce).toBe(true);
    expect(p.bbce_threshold_pct).toBe(200);
    expect(p.asset_waiver).toBe(true);
    expect(p.allotment_tier).toBe("48");
  });
});

describe("Oregon SUA — 4-tier ladder maps cleanly onto HCSUA/LUA/phone", () => {
  it("pins the mapped tiers (OAR 461-160-0420, current as of the temp-rule window)", () => {
    const p = statePolicyFor("OR", ASOF);
    expect(p.sua_by_tier).not.toBeNull();
    expect(p.sua_by_tier!.HCSUA.toNumber()).toBe(515);
    expect(p.sua_by_tier!.LUA.toNumber()).toBe(404);
    expect(p.sua_by_tier!.phone.toNumber()).toBe(81);
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
    const r = computeBenefit(facts, "OR", ASOF);
    expect(r.trace.state_sua_value).toBe(515);
  });
});

describe("Oregon unsourced/simplified axes stay honest", () => {
  it("drug-felony ban is a genuine opt-out — false, not an under-claim judgment call", () => {
    // ORS 411.119(1) is a real, currently-operative opt-out (unlike AZ's
    // conditional ban); the narrow discretionary suspension path doesn't
    // change the base-case answer for most OR drug-felony households.
    expect(statePolicyFor("OR", ASOF).drug_felony_ban).toBe("none");
  });

  it("ABAWD waiver flag is false — real exempt areas are 5 Tribal jurisdictions, not counties", () => {
    // Deliberately the OPPOSITE call from NV's/AZ's `true`: OR's real area
    // exemption is narrow enough (5 of many Tribal jurisdictions, no county
    // is waived) that `false` follows NY's reasoning, not NV's/AZ's/MI's.
    expect(statePolicyFor("OR", ASOF).abawd_waiver_avail).toBe(false);
  });

  it("RMP is false — confirmed absent from USDA's list; a pilot exists but hasn't launched", () => {
    expect(statePolicyFor("OR", ASOF).rmp_operated).toBe(false);
  });
});
