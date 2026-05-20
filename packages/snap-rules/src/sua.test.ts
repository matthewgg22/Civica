import { describe, it, expect } from "vitest";
import { determineSUATier, checkHEAPCompliance } from "./sua";

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
