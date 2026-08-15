import { describe, it, expect } from "vitest";
import { statePolicyFor } from "./states";
import { computeBenefit } from "../benefit-calc";
import type { Facts } from "../facts";

// Nevada (issue #719, second of the six-state gap tracked in #732 — NY was
// first, #733). Source: packages/demeter-engine/src/states/nv/
// {pack,supplements}.json, verified 2026-08-11 (adversarial refute pass, 2
// corrections applied — a vehicle-valuation misreading and a secondary-source
// drug-felony trap, both caught before drafting).
//
// Unlike NY, Nevada is a clean schema fit: flat 200% BBCE (no tiers) and a
// 4-tier SUA ladder where 3 of 4 tiers map directly onto HCSUA/LUA/phone.

const ASOF = new Date("2026-08-11");

describe("Nevada — flat 200% BBCE, no tiering", () => {
  it("bbce_threshold_pct is 200 (not 165/130 — NV doesn't tier like IL/GA)", () => {
    const p = statePolicyFor("NV", ASOF);
    expect(p.bbce).toBe(true);
    expect(p.bbce_threshold_pct).toBe(200);
    expect(p.bbce_fpl_basis).toBe("federal_fiscal_year");
  });

  it("asset test is waived for categorically eligible households", () => {
    expect(statePolicyFor("NV", ASOF).asset_waiver).toBe(true);
  });

  it("uses the 48-state allotment table", () => {
    expect(statePolicyFor("NV", ASOF).allotment_tier).toBe("48");
  });
});

describe("Nevada SUA — SUA→HCSUA, LUA→LUA, TUA→phone map directly; IUA has no slot", () => {
  it("pins the 3 mapped tiers (E&P MS A-660.5.1.1 / C-210.3, eff. 10/1/2025)", () => {
    const p = statePolicyFor("NV", ASOF);
    expect(p.sua_by_tier).not.toBeNull();
    expect(p.sua_by_tier!.HCSUA.toNumber()).toBe(446);
    expect(p.sua_by_tier!.LUA.toNumber()).toBe(361);
    expect(p.sua_by_tier!.phone.toNumber()).toBe(52);
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
    const r = computeBenefit(facts, "NV", ASOF);
    expect(r.trace.state_sua_value).toBe(446);
  });

  it("the 4th tier (IUA $77, exactly one non-telephone utility) is NOT quietly encoded anywhere", () => {
    // Nevada's IUA doesn't fit HCSUA/LUA/phone/none — a household billed for
    // exactly one non-telephone utility falls through to NONE and loses the
    // deduction under this engine, the same documented gap as IL's Single
    // Utility and OH's Single SUA. Pinning that none of the 3 mapped tiers
    // was accidentally set to 77 catches a future "helpful" mis-mapping.
    const p = statePolicyFor("NV", ASOF);
    expect(p.sua_by_tier!.HCSUA.toNumber()).not.toBe(77);
    expect(p.sua_by_tier!.LUA.toNumber()).not.toBe(77);
    expect(p.sua_by_tier!.phone.toNumber()).not.toBe(77);
  });
});

describe("Nevada unsourced/simplified axes stay honest", () => {
  it("drug-felony ban is a VERIFIED full opt-out — false, confirmed against primary NRS text", () => {
    // NRS 422A.345, checked directly against leg.state.nv.us after an
    // initial secondary source described a now-repealed (pre-2021) treatment
    // condition as current policy. See the states.ts NV block comment.
    expect(statePolicyFor("NV", ASOF).drug_felony_ban).toBe(false);
  });

  it("ABAWD waiver flag is true — 12 real waived areas exist post-statewide-expiration", () => {
    // Unlike NY (2 tiny reservations, `false`), Nevada's post-2/1/2026
    // waived-area list is 11 Tribal/Reservation areas plus Mineral County —
    // substantial enough that `true` follows CA's/MI's "wrongly denying food
    // is the worse error" reasoning rather than NY's "essentially unwaived"
    // one. No per-area lookup exists, so this boolean governs every NV
    // household, not just an unknown-area fallback.
    expect(statePolicyFor("NV", ASOF).abawd_waiver_avail).toBe(true);
  });

  it("RMP is false — Nevada is confirmed absent from USDA FNA's own RMP state list", () => {
    expect(statePolicyFor("NV", ASOF).rmp_operated).toBe(false);
  });
});
