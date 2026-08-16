import { describe, it, expect } from "vitest";
import { statePolicyFor } from "./states";
import { computeBenefit } from "../benefit-calc";
import type { Facts } from "../facts";

// Minnesota (issue #730, sixth and last of the six-state gap tracked in
// #732; SUA gap subsequently closed by #747). Source:
// packages/demeter-engine/src/states/mn/{pack,supplements}.json plus the
// direct-PDF + EPM Appendix F sourcing chain documented in this file's own
// states.ts comment above the MN entry.

const ASOF = new Date("2026-08-11");

describe("Minnesota — flat 200% BBCE, exempt from BOTH asset and net income tests", () => {
  it("bbce_threshold_pct is 200, asset test waived for the categorical majority", () => {
    const p = statePolicyFor("MN", ASOF);
    expect(p.bbce).toBe(true);
    expect(p.bbce_threshold_pct).toBe(200);
    expect(p.asset_waiver).toBe(true);
    expect(p.allotment_tier).toBe("48");
  });
});

describe("Minnesota SUA — RESOLVED (#747): real FFY26 figures, computeBenefit no longer throws", () => {
  it("sua_by_tier carries MN's real FFY26 HCSUA/electric/phone figures", () => {
    const p = statePolicyFor("MN", ASOF);
    expect(p.sua_by_tier).not.toBeNull();
    expect(p.sua_by_tier!.HCSUA.toString()).toBe("667");
    expect(p.sua_by_tier!.LUA.toString()).toBe("235");
    expect(p.sua_by_tier!.phone.toString()).toBe("62");
    expect(p.sua_by_tier!.none.toString()).toBe("0");
  });

  it("MN now computes a real shelter deduction instead of throwing", () => {
    const facts = {
      household: [{ member_id: "m1", role: "head", age: 40, work_class: "gen_work_subject" }],
      income: [],
      shelter: { rent: 900, sua_tier: "HCSUA" },
      deductions: {},
      assets: 0,
      cat_elig: "none",
    } as unknown as Facts;
    expect(() => computeBenefit(facts, "MN", ASOF)).not.toThrow();
    const detail = computeBenefit(facts, "MN", ASOF);
    expect(detail.trace.state_sua_value).toBe(667);
  });
});

describe("Minnesota unsourced/simplified axes stay honest", () => {
  it("drug-felony ban is a CLEAN full opt-out — false, corrects a false secondary-source lifetime-ban claim", () => {
    // Unlike AZ's/WI's judgment-call `false` (a real restriction the
    // boolean can't express), MN's is a clean, unconditional finding: CM
    // 0011.27.03 explicitly bars using a failed/refused test to deny or
    // terminate benefits. Same shape as IL's/NV's entries above.
    expect(statePolicyFor("MN", ASOF).drug_felony_ban).toBe("none");
  });

  it("ABAWD waiver flag is false — the MN corpus pack's own instruction: presumptively unwaived pending confirmation", () => {
    expect(statePolicyFor("MN", ASOF).abawd_waiver_avail).toBe(false);
  });

  it("RMP is false — confirmed absent from USDA's list; proposed legislation has not been enacted", () => {
    expect(statePolicyFor("MN", ASOF).rmp_operated).toBe(false);
  });
});
