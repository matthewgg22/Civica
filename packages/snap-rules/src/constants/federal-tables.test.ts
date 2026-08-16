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

// #858: VI's real max-allotment table is genuinely elevated (~28.5-28.9%
// above the 48-contiguous table at every household size, per USVI DHS's
// own FY2026 table) — but, UNLIKE AK, it is a single FLAT table with no
// zone/county axis at all. These tests confirm the new state === "VI"
// branch and, critically, that every other state (including AK, whose
// branch sits right next to VI's in the same functions) is unaffected.
describe("maxAllotmentFor — VI flat table (#858)", () => {
  it("VI's real max allotment, HH1-8 — verbatim from USVI DHS's FY2026 table", () => {
    expect(maxAllotmentFor(1, FY26, "VI").toNumber()).toBe(383);
    expect(maxAllotmentFor(2, FY26, "VI").toNumber()).toBe(703);
    expect(maxAllotmentFor(3, FY26, "VI").toNumber()).toBe(1009);
    expect(maxAllotmentFor(4, FY26, "VI").toNumber()).toBe(1278);
    expect(maxAllotmentFor(5, FY26, "VI").toNumber()).toBe(1521);
    expect(maxAllotmentFor(6, FY26, "VI").toNumber()).toBe(1827);
    expect(maxAllotmentFor(7, FY26, "VI").toNumber()).toBe(2019);
    expect(maxAllotmentFor(8, FY26, "VI").toNumber()).toBe(2300);
  });

  it("a countyFips passed alongside VI changes nothing — VI's table has no zone/county axis", () => {
    expect(maxAllotmentFor(1, FY26, "VI", "02020").toNumber()).toBe(383); // 02020 is Anchorage, AK — must be ignored for VI
    expect(maxAllotmentFor(1, FY26, "VI", undefined).toNumber()).toBe(383);
  });

  it("HH9 (beyond the published HH8 table) extrapolates via VI's own each-additional figure ($281)", () => {
    expect(maxAllotmentFor(9, FY26, "VI").toNumber()).toBe(2300 + 281);
  });

  it("is strictly higher than the 48-contiguous table at every household size (VI can only loosen, never tighten, benefit ceilings)", () => {
    for (let size = 1; size <= 8; size++) {
      const vi = maxAllotmentFor(size, FY26, "VI").toNumber();
      const contiguous = maxAllotmentFor(size, FY26, "TX").toNumber();
      expect(vi, `HH${size}`).toBeGreaterThan(contiguous);
    }
  });

  it("AK's branch is unaffected by VI's addition — Anchorage (02020, Urban) still $385", () => {
    expect(maxAllotmentFor(1, FY26, "AK", "02020").toNumber()).toBe(385);
  });
});

describe("minimumBenefitFor — VI flat table (#858)", () => {
  it("VI's real minimum allotment is $31 (vs. the $24 federal default)", () => {
    expect(minimumBenefitFor(FY26, "VI").toNumber()).toBe(31);
  });

  it("a countyFips passed alongside VI changes nothing", () => {
    expect(minimumBenefitFor(FY26, "VI", "02050").toNumber()).toBe(31); // 02050 is Bethel, AK — must be ignored for VI
  });

  it("AK's branch is unaffected by VI's addition — Bethel (02050, Rural II) still $48", () => {
    expect(minimumBenefitFor(FY26, "AK", "02050").toNumber()).toBe(48);
  });
});
