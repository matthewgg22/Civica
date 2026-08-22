import { describe, it, expect } from "vitest";
import { determineSUATier, checkHEAPCompliance, CA_SUA_FFY2026 } from "./sua";
import { statePolicyFor } from "./constants/states";

// Regression for #882. TELEPHONE was $44, citing a fabricated "ACIN I-07-26"
// (that ACIN is dated 2026-03-02 and is about a CDSS website search widget —
// unrelated to SNAP). Live-verified 2026-08-16 against ACIN I-46-25
// (2025-09-03, the same COLA notice states.ts cites for CA's BBCE
// threshold), LA County DPSS ePolicy 63-504.39, and the LSNC "CalFresh Cost
// of Living Adjustment for Fiscal Year 2026" regulation summary — all three
// independently agree FFY2026 SUA/LUA/TUA = 663/170/20. This also asserts
// parity with constants/states.ts's CA StatePolicy.sua_by_tier, which was
// already correct at $20 — the two files must agree, and disagreed before
// this fix.
describe("CA_SUA_FFY2026 (#882)", () => {
  it("TELEPHONE is $20, matching ACIN I-46-25 (not the fabricated ACIN I-07-26's $44)", () => {
    expect(CA_SUA_FFY2026.TELEPHONE).toBe(20);
  });

  it("agrees with constants/states.ts's CA StatePolicy.sua_by_tier — the two files must not drift", () => {
    const stPol = statePolicyFor("CA", new Date(Date.UTC(2026, 5, 1)));
    expect(stPol.sua_by_tier).not.toBeNull();
    expect(CA_SUA_FFY2026.FULL).toBe(stPol.sua_by_tier!.HCSUA.toNumber());
    expect(CA_SUA_FFY2026.LIMITED).toBe(stPol.sua_by_tier!.LUA.toNumber());
    expect(CA_SUA_FFY2026.TELEPHONE).toBe(stPol.sua_by_tier!.phone.toNumber());
    expect(CA_SUA_FFY2026.NONE).toBe(stPol.sua_by_tier!.none.toNumber());
  });
});

describe("determineSUATier", () => {
  it("returns FULL when has_heating_costs=yes", () => {
    expect(determineSUATier({ has_heating_costs: "yes", has_electric_or_gas: "no", has_phone: "no" })).toBe("FULL");
  });

  it("FULL takes precedence over electric/gas", () => {
    expect(determineSUATier({ has_heating_costs: "yes", has_electric_or_gas: "yes", has_phone: "yes" })).toBe("FULL");
  });

  it("returns LIMITED when has_electric_or_gas=yes and no heating", () => {
    expect(determineSUATier({ has_heating_costs: "no", has_electric_or_gas: "yes", has_phone: "no" })).toBe("LIMITED");
  });

  it("returns TELEPHONE when only has_phone=yes", () => {
    expect(determineSUATier({ has_heating_costs: "no", has_electric_or_gas: "no", has_phone: "yes" })).toBe("TELEPHONE");
  });

  it("returns NONE when all answers are no", () => {
    expect(determineSUATier({ has_heating_costs: "no", has_electric_or_gas: "no", has_phone: "no" })).toBe("NONE");
  });

  it("returns null when has_heating_costs is missing", () => {
    expect(determineSUATier({ has_heating_costs: null, has_electric_or_gas: "yes", has_phone: "yes" })).toBeNull();
  });

  it("returns null when has_electric_or_gas is missing", () => {
    expect(determineSUATier({ has_heating_costs: "no", has_electric_or_gas: undefined, has_phone: "yes" })).toBeNull();
  });

  it("returns null when has_phone is missing", () => {
    expect(determineSUATier({ has_heating_costs: "no", has_electric_or_gas: "no", has_phone: null })).toBeNull();
  });
});

describe("checkHEAPCompliance", () => {
  it("flags when receives_heap=yes and tier=FULL (OBBBA conflict)", () => {
    const result = checkHEAPCompliance({ receives_heap: "yes", sua_tier_claimed: "FULL" });
    expect(result.heap_flag).toBe(true);
    expect(result.flag_reason).toBe("obbba_heap_change");
  });

  it("no flag when receives_heap=yes but tier is LIMITED (only FULL triggers)", () => {
    const result = checkHEAPCompliance({ receives_heap: "yes", sua_tier_claimed: "LIMITED" });
    expect(result.heap_flag).toBe(false);
    expect(result.flag_reason).toBeNull();
  });

  it("no flag when receives_heap=no and tier=FULL", () => {
    const result = checkHEAPCompliance({ receives_heap: "no", sua_tier_claimed: "FULL" });
    expect(result.heap_flag).toBe(false);
  });

  it("no flag when receives_heap is null", () => {
    const result = checkHEAPCompliance({ receives_heap: null, sua_tier_claimed: "FULL" });
    expect(result.heap_flag).toBe(false);
  });

  it("no flag when sua_tier_claimed is null", () => {
    const result = checkHEAPCompliance({ receives_heap: "yes", sua_tier_claimed: null });
    expect(result.heap_flag).toBe(false);
  });

  it("no flag for TELEPHONE tier", () => {
    const result = checkHEAPCompliance({ receives_heap: "yes", sua_tier_claimed: "TELEPHONE" });
    expect(result.heap_flag).toBe(false);
  });
});
