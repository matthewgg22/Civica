// #814: maxAllotmentFor / minimumBenefitFor gained optional state/countyFips
// params so Alaska's real zone-based figures can be used instead of the
// single 48-contiguous national table. These tests focus on the NEW
// AK-aware branch and, critically, confirm every OTHER state's behavior is
// byte-identical to before — see the "non-AK regression" describe block.

import { describe, it, expect } from "vitest";
import { maxAllotmentFor, minimumBenefitFor } from "./federal-tables";

const FY26 = new Date("2026-06-01");

describe("maxAllotmentFor — non-AK regression (#814 must not change this)", () => {
  it("48-contiguous table, no state passed at all — unchanged call shape still works", () => {
    expect(maxAllotmentFor(1, FY26).toNumber()).toBe(298);
    expect(maxAllotmentFor(4, FY26).toNumber()).toBe(994);
  });

  it("48-contiguous table, state explicitly 'TX' — identical to omitting state", () => {
    expect(maxAllotmentFor(1, FY26, "TX").toNumber()).toBe(298);
    expect(maxAllotmentFor(4, FY26, "TX").toNumber()).toBe(994);
  });

  it("HH9 extrapolation beyond the published HH8 table is unaffected for a non-AK state", () => {
    // HH8 = 1789, each-additional = 218 (FY26)
    expect(maxAllotmentFor(9, FY26, "CA").toNumber()).toBe(1789 + 218);
  });

  it("a countyFips passed alongside a non-AK state changes nothing", () => {
    expect(maxAllotmentFor(4, FY26, "TX", "02180").toNumber()).toBe(994); // 02180 is Nome, AK — must be ignored for TX
  });
});

describe("maxAllotmentFor — AK zone-based (#814)", () => {
  it("no countyFips — falls back to Urban, AK's most populous zone", () => {
    expect(maxAllotmentFor(1, FY26, "AK").toNumber()).toBe(385);
    expect(maxAllotmentFor(4, FY26, "AK").toNumber()).toBe(1285);
  });

  it("Anchorage (02020, Urban) matches the fallback exactly", () => {
    expect(maxAllotmentFor(1, FY26, "AK", "02020").toNumber()).toBe(385);
  });

  it("Copper River Census Area (02066, Rural I) uses the REAL higher figure, not Urban", () => {
    expect(maxAllotmentFor(1, FY26, "AK", "02066").toNumber()).toBe(491);
    expect(maxAllotmentFor(4, FY26, "AK", "02066").toNumber()).toBe(1639);
  });

  it("Bethel (02050, Rural II) uses the highest tier — meaningfully more than the 48-contiguous table's $994 for HH4", () => {
    const hh4 = maxAllotmentFor(4, FY26, "AK", "02050");
    expect(hh4.toNumber()).toBe(1995);
    expect(hh4.toNumber()).toBeGreaterThan(994); // the #814 bug: this used to silently return 994 for AK too
  });

  it("an unrecognized AK countyFips falls back to Urban rather than throwing", () => {
    expect(maxAllotmentFor(1, FY26, "AK", "99999").toNumber()).toBe(385);
  });

  it("HH9 (beyond the published HH8 table) extrapolates via the ZONE's own each-additional figure", () => {
    // Urban HH8=2314, add-on=282; Rural II HH8=3591, add-on=438.
    expect(maxAllotmentFor(9, FY26, "AK", "02020").toNumber()).toBe(2314 + 282);
    expect(maxAllotmentFor(9, FY26, "AK", "02050").toNumber()).toBe(3591 + 438);
  });
});

describe("minimumBenefitFor — non-AK regression and AK zone-based (#814)", () => {
  it("48-contiguous default ($24 FY26), no state passed", () => {
    expect(minimumBenefitFor(FY26).toNumber()).toBe(24);
  });

  it("48-contiguous default unaffected by an unrelated state or stray countyFips", () => {
    expect(minimumBenefitFor(FY26, "TX", "02180").toNumber()).toBe(24);
  });

  it("AK with no countyFips uses the Urban floor ($31), not the $24 federal default", () => {
    expect(minimumBenefitFor(FY26, "AK").toNumber()).toBe(31);
  });

  it("AK Rural I (Copper River, 02066) floor is $39", () => {
    expect(minimumBenefitFor(FY26, "AK", "02066").toNumber()).toBe(39);
  });

  it("AK Rural II (Bethel, 02050) floor is $48 — double the federal default", () => {
    expect(minimumBenefitFor(FY26, "AK", "02050").toNumber()).toBe(48);
  });
});
