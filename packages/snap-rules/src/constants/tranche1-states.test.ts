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

describe("Tranche 1 SUA — FL/IL/OH sourced, PA a logged verification gap (#619)", () => {
  it.each([
    ["FL", 426, 340, 49],
    ["IL", 546, 457, 67],
    ["OH", 766, 479, 46],
  ])("%s's authored SUA computes a real shelter deduction (HCSUA $%i)", (code, hcsua, lua, phone) => {
    const p = statePolicyFor(code);
    expect(p.sua_by_tier).not.toBeNull();
    expect(p.sua_by_tier!.HCSUA.toNumber()).toBe(hcsua);
    expect(p.sua_by_tier!.LUA.toNumber()).toBe(lua);
    expect(p.sua_by_tier!.phone.toNumber()).toBe(phone);

    const facts = {
      household: [{ member_id: "m1", role: "head", age: 40, work_class: "gen_work_subject" }],
      income: [{ member: "m1", type: "wages", amount: 1000, anticipation: "averaged" }],
      shelter: { rent: 900, sua_tier: "HCSUA", sua_amount: 0, internet: 0, homeless_deduction: false },
      deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
      assets: 0,
      cat_elig: "NPA",
    } as unknown as Facts;
    const r = computeBenefit(facts, code, ASOF);
    expect(r.trace.state_sua_value).toBe(hcsua);
  });

  it("PA has NO authored SUA — a logged verification gap, not an oversight", () => {
    expect(
      statePolicyFor("PA").sua_by_tier,
      "PA SUA stays null until a working primary source is reached (#619) — see the states.ts comment for what was tried",
    ).toBeNull();
  });

  it("PA fails LOUDLY on a shelter deduction rather than inventing one", () => {
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
    expect(() => computeBenefit(facts, "PA", ASOF)).toThrow(/SUA not authored/);
  });
});

describe("Tranche 1 unsourced axes stay honest", () => {
  it("FL/PA/OH's ABAWD waiver flag stays fail-open — still unsourced", () => {
    // A wrong `false` STRIPS a claimed waiver exemption (gates/abawd.ts reads
    // false as "we affirmatively know this area holds no waiver") and denies
    // food. Three sourcing passes have failed to produce a citable FY26
    // answer for these three, so they stay true. See the states.ts block
    // comment for why the real fix is county sets, not a boolean flip.
    for (const c of ["FL", "PA", "OH"]) {
      expect(statePolicyFor(c).abawd_waiver_avail, `${c} waiver flag`).toBe(true);
    }
  });

  it("Illinois' ABAWD waiver flag is SOURCED false — statewide waiver ended Nov 2025 (#701)", () => {
    // Not fail-open anymore: IDHS Policy Memo "End of Waiver for Time-Limited
    // SNAP Benefits..." (10/16/2025) states the waiver ends November 2025,
    // corroborated by the active fixed 3-year clock already assigning
    // countable months. See the states.ts IL block comment.
    expect(statePolicyFor("IL").abawd_waiver_avail).toBe(false);
  });

  it("Illinois RMP stays false — it runs in Cook and Franklin counties only", () => {
    // Under-claiming a real county program beats advertising it statewide.
    expect(statePolicyFor("IL").rmp_operated).toBe(false);
  });
});

// #619: every Tranche-1 felony ban is now SOURCED. The value is `false` for
// all four, but for two different reasons, and collapsing them back into one
// blanket assertion would lose the distinction — so they are asserted apart.
describe("Tranche 1 drug felony bans are sourced, not defaulted", () => {
  it("IL and OH are verified full opt-outs — false is the correct answer", () => {
    // IL: 305 ILCS 5/1-10(c) — "shall not be determined ineligible for food
    //     stamps … based upon a conviction of any felony", unconditional.
    // OH: Ohio Rev. Code 5101.84 — 21 U.S.C. 862a(a) does not apply.
    // Both read against primary statute text on 2026-08-11.
    expect(statePolicyFor("IL").drug_felony_ban).toBe("none");
    expect(statePolicyFor("OH").drug_felony_ban).toBe("none");
  });

  it("FL and PA are MODIFIED bans the boolean cannot express, so it under-claims", () => {
    // FL denies only trafficking convictions (Fla. Stat. 414.095(1), citing
    // s. 893.135); PA conditions eligibility on treatment compliance
    // (62 Pa. Stat. 432.24, primary text unverified). Setting either to true
    // would disqualify every drug-felony household in the state, including
    // the majority each statute protects — the direction of error that #608
    // forbids. Under-claiming a narrow real ban is the lesser harm.
    expect(statePolicyFor("FL").drug_felony_ban).toBe("modified");
    expect(statePolicyFor("PA").drug_felony_ban).toBe("modified");
  });
});
