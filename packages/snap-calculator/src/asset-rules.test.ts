import { describe, it, expect } from "vitest";
import { STATE_ASSET_RULES, SHELTER_CITATIONS, INCOME_CITATIONS } from "./asset-rules";

describe("STATE_ASSET_RULES — CA", () => {
  const r = STATE_ASSET_RULES.CA;
  it("has no asset test (SB 1090)", () => expect(r.asset_test_applies).toBe(false));
  it("excludes primary vehicle", () => expect(r.primary_vehicle_excluded).toBe(true));
  it("excludes retirement accounts", () => expect(r.retirement_excluded).toBe(true));
  it("has a CA-specific citation", () =>
    expect(r.citations.some((c) => c.includes("SB 1090"))).toBe(true));
});

describe("STATE_ASSET_RULES — MA", () => {
  const r = STATE_ASSET_RULES.MA;
  it("applies the asset test", () => expect(r.asset_test_applies).toBe(true));
  it("standard limit is $2,750", () => expect(r.standard_limit_usd).toBe(2750));
  it("elderly/disabled limit is $4,250", () => expect(r.elderly_disabled_limit_usd).toBe(4250));
  it("excludes primary vehicle", () => expect(r.primary_vehicle_excluded).toBe(true));
  it("excludes retirement accounts", () => expect(r.retirement_excluded).toBe(true));
  it("cites 106 CMR", () =>
    expect(r.citations.some((c) => c.includes("106 CMR"))).toBe(true));
});

describe("SHELTER_CITATIONS", () => {
  it("CA cites 7 CFR 273.2(f)", () =>
    expect(SHELTER_CITATIONS.CA.some((c) => c.includes("273.2"))).toBe(true));
  it("MA cites 106 CMR", () =>
    expect(SHELTER_CITATIONS.MA.some((c) => c.includes("106 CMR"))).toBe(true));
});

describe("INCOME_CITATIONS", () => {
  it("CA cites 7 CFR 273.10(c)", () =>
    expect(INCOME_CITATIONS.CA.some((c) => c.includes("273.10"))).toBe(true));
  it("MA cites 106 CMR 363.110", () =>
    expect(INCOME_CITATIONS.MA.some((c) => c.includes("363.110"))).toBe(true));
});
