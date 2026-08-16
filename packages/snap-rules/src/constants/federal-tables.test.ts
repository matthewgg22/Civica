// #814: maxAllotmentFor / minimumBenefitFor gained optional state/countyFips
// params so Alaska's real zone-based figures can be used instead of the
// single 48-contiguous national table. These tests focus on the NEW
// AK-aware branch and, critically, confirm every OTHER state's behavior is
// byte-identical to before — see the "non-AK regression" describe block.

import { describe, it, expect } from "vitest";
import { maxAllotmentFor, minimumBenefitFor, fplMonthly } from "./federal-tables";

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

// #861: HI's and GU's real max-allotment tables are ALSO genuinely elevated
// (~70% and ~47% above the 48-contiguous table respectively, per USDA FNS's
// own FY2026 COLA memo) — like VI, both are single FLAT tables with no
// zone/county axis at all. These tests confirm the new state === "HI" /
// state === "GU" branches and, critically, that every other jurisdiction
// (AK/VI, whose branches sit right next to HI's/GU's in the same functions)
// is unaffected.
describe("maxAllotmentFor — HI flat table (#861)", () => {
  it("HI's real max allotment, HH1-8 — verbatim from USDA FNS's FY2026 COLA memo", () => {
    expect(maxAllotmentFor(1, FY26, "HI").toNumber()).toBe(506);
    expect(maxAllotmentFor(2, FY26, "HI").toNumber()).toBe(929);
    expect(maxAllotmentFor(3, FY26, "HI").toNumber()).toBe(1334);
    expect(maxAllotmentFor(4, FY26, "HI").toNumber()).toBe(1689);
    expect(maxAllotmentFor(5, FY26, "HI").toNumber()).toBe(2010);
    expect(maxAllotmentFor(6, FY26, "HI").toNumber()).toBe(2415);
    expect(maxAllotmentFor(7, FY26, "HI").toNumber()).toBe(2668);
    expect(maxAllotmentFor(8, FY26, "HI").toNumber()).toBe(3040);
  });

  it("a countyFips passed alongside HI changes nothing — HI's table has no zone/county axis", () => {
    expect(maxAllotmentFor(1, FY26, "HI", "02020").toNumber()).toBe(506); // 02020 is Anchorage, AK — must be ignored for HI
    expect(maxAllotmentFor(1, FY26, "HI", undefined).toNumber()).toBe(506);
  });

  it("HH9 (beyond the published HH8 table) extrapolates via HI's own each-additional figure ($371)", () => {
    expect(maxAllotmentFor(9, FY26, "HI").toNumber()).toBe(3040 + 371);
  });

  it("is strictly higher than the 48-contiguous table at every household size", () => {
    for (let size = 1; size <= 8; size++) {
      const hi = maxAllotmentFor(size, FY26, "HI").toNumber();
      const contiguous = maxAllotmentFor(size, FY26, "TX").toNumber();
      expect(hi, `HH${size}`).toBeGreaterThan(contiguous);
    }
  });

  it("AK's and VI's branches are unaffected by HI's addition", () => {
    expect(maxAllotmentFor(1, FY26, "AK", "02020").toNumber()).toBe(385);
    expect(maxAllotmentFor(1, FY26, "VI").toNumber()).toBe(383);
  });
});

describe("minimumBenefitFor — HI flat table (#861)", () => {
  it("HI's real minimum allotment is $41 (vs. the $24 federal default)", () => {
    expect(minimumBenefitFor(FY26, "HI").toNumber()).toBe(41);
  });

  it("a countyFips passed alongside HI changes nothing", () => {
    expect(minimumBenefitFor(FY26, "HI", "02050").toNumber()).toBe(41); // 02050 is Bethel, AK — must be ignored for HI
  });

  it("AK's and VI's branches are unaffected by HI's addition", () => {
    expect(minimumBenefitFor(FY26, "AK", "02050").toNumber()).toBe(48);
    expect(minimumBenefitFor(FY26, "VI").toNumber()).toBe(31);
  });
});

describe("maxAllotmentFor — GU flat table (#861)", () => {
  it("GU's real max allotment, HH1-8 — verbatim from USDA FNS's FY2026 COLA memo", () => {
    expect(maxAllotmentFor(1, FY26, "GU").toNumber()).toBe(439);
    expect(maxAllotmentFor(2, FY26, "GU").toNumber()).toBe(806);
    expect(maxAllotmentFor(3, FY26, "GU").toNumber()).toBe(1157);
    expect(maxAllotmentFor(4, FY26, "GU").toNumber()).toBe(1465);
    expect(maxAllotmentFor(5, FY26, "GU").toNumber()).toBe(1743);
    expect(maxAllotmentFor(6, FY26, "GU").toNumber()).toBe(2095);
    expect(maxAllotmentFor(7, FY26, "GU").toNumber()).toBe(2315);
    expect(maxAllotmentFor(8, FY26, "GU").toNumber()).toBe(2637);
  });

  it("a countyFips passed alongside GU changes nothing — GU's table has no zone/county axis", () => {
    expect(maxAllotmentFor(1, FY26, "GU", "02020").toNumber()).toBe(439);
    expect(maxAllotmentFor(1, FY26, "GU", undefined).toNumber()).toBe(439);
  });

  it("HH9 (beyond the published HH8 table) extrapolates via GU's own each-additional figure ($322)", () => {
    expect(maxAllotmentFor(9, FY26, "GU").toNumber()).toBe(2637 + 322);
  });

  it("is strictly higher than the 48-contiguous table at every household size", () => {
    for (let size = 1; size <= 8; size++) {
      const gu = maxAllotmentFor(size, FY26, "GU").toNumber();
      const contiguous = maxAllotmentFor(size, FY26, "TX").toNumber();
      expect(gu, `HH${size}`).toBeGreaterThan(contiguous);
    }
  });

  it("HI's branch is unaffected by GU's addition", () => {
    expect(maxAllotmentFor(1, FY26, "HI").toNumber()).toBe(506);
  });
});

describe("minimumBenefitFor — GU flat table (#861)", () => {
  it("GU's real minimum allotment is $35 (vs. the $24 federal default)", () => {
    expect(minimumBenefitFor(FY26, "GU").toNumber()).toBe(35);
  });

  it("a countyFips passed alongside GU changes nothing", () => {
    expect(minimumBenefitFor(FY26, "GU", "02050").toNumber()).toBe(35);
  });

  it("HI's branch is unaffected by GU's addition", () => {
    expect(minimumBenefitFor(FY26, "HI").toNumber()).toBe(41);
  });
});

// #861: HI's income-eligibility FPL guideline is ALSO genuinely elevated
// (unlike VI's, which tracks the 48-contiguous table — see states.ts's VI
// entry) — the fpl_by_region.hi slot #812 left null is now populated.
describe("fplMonthly — HI region (#861)", () => {
  it("HI's real annual guideline, ceiling-rounded — matches USDA FNS's FY2026 COLA memo's published HI net-income (100% FPL) column exactly", () => {
    expect(fplMonthly(1, FY26, "HI").toNumber()).toBe(1500);
    expect(fplMonthly(2, FY26, "HI").toNumber()).toBe(2027);
    expect(fplMonthly(3, FY26, "HI").toNumber()).toBe(2555);
    expect(fplMonthly(4, FY26, "HI").toNumber()).toBe(3082);
    expect(fplMonthly(5, FY26, "HI").toNumber()).toBe(3610);
    expect(fplMonthly(6, FY26, "HI").toNumber()).toBe(4137);
    expect(fplMonthly(7, FY26, "HI").toNumber()).toBe(4665);
    expect(fplMonthly(8, FY26, "HI").toNumber()).toBe(5192);
  });

  it("is strictly higher than the 48-contiguous table at every household size", () => {
    for (let size = 1; size <= 8; size++) {
      const hi = fplMonthly(size, FY26, "HI").toNumber();
      const contiguous = fplMonthly(size, FY26, "TX").toNumber();
      expect(hi, `HH${size}`).toBeGreaterThan(contiguous);
    }
  });

  it("GU uses the plain contiguous table — confirmed NOT elevated, unlike HI/AK", () => {
    expect(fplMonthly(1, FY26, "GU").toNumber()).toBe(fplMonthly(1, FY26, "TX").toNumber());
    expect(fplMonthly(4, FY26, "GU").toNumber()).toBe(fplMonthly(4, FY26, "TX").toNumber());
  });

  it("AK's region is unaffected by HI's addition", () => {
    expect(fplMonthly(1, FY26, "AK").toNumber()).toBe(1630);
  });
});
