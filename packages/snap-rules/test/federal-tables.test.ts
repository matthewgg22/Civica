import { describe, it, expect } from "vitest";
import { fplMonthly } from "../src/constants/federal-tables";

// #812: federal-tables.ts used to apply the single 48-contiguous+DC HHS
// poverty guideline to every state, including AK (and future HI), which
// HHS publishes SEPARATE, higher guidelines for every year in the same
// Federal Register notice. fplMonthly() now takes a `state` and selects
// the correct regional table.

const FY26 = new Date(Date.UTC(2026, 5, 1)); // 2026-06-01
const FY25 = new Date(Date.UTC(2025, 0, 1)); // 2025-01-01

describe("fplMonthly per-region FPL table (#812)", () => {
  it("preserves EXACT prior behavior for every non-AK/HI state (byte-identical regression)", () => {
    // Old formula: single 48-contiguous+DC table, floor(annual/12).
    const oldFormula = (size: number, asOf: Date): number => {
      const fy25 = asOf < new Date(Date.UTC(2025, 9, 1));
      const first = fy25 ? 15060 : 15660;
      const each = fy25 ? 5380 : 5500;
      return Math.floor((first + each * (size - 1)) / 12);
    };
    const states = [
      "CA", "MA", "TX", "WA", "GA", "FL", "IL", "PA", "OH", "MI",
      "NY", "NV", "AZ", "OR", "WI", "MN", "KS",
    ];
    const dates = [FY25, new Date(Date.UTC(2025, 8, 30)), FY26, new Date(Date.UTC(2026, 7, 15))];
    for (const state of states) {
      for (const asOf of dates) {
        for (let size = 1; size <= 10; size++) {
          expect(fplMonthly(size, asOf, state).toNumber(), `${state} HH${size} ${asOf.toISOString()}`).toBe(
            oldFormula(size, asOf),
          );
        }
      }
    }
  });

  it("uses AK's own, higher HHS guideline and its ceiling rounding convention, FY26", () => {
    // 2025 HHS Poverty Guidelines for Alaska (Federal Register Vol. 90
    // No. 11, Jan 17, 2025, 90 FR 5917): $19,550 first person, $6,880
    // each additional. AK's own published SNAP Standards table rounds
    // UP (ceiling), not down — see RegionalFplTable's doc-comment in
    // federal-tables.ts for the full reconciliation against AK's real
    // published income-standards columns.
    expect(fplMonthly(1, FY26, "AK").toNumber()).toBe(1630);
    expect(fplMonthly(2, FY26, "AK").toNumber()).toBe(2203);
    expect(fplMonthly(3, FY26, "AK").toNumber()).toBe(2776);
    expect(fplMonthly(4, FY26, "AK").toNumber()).toBe(3350);
    expect(fplMonthly(5, FY26, "AK").toNumber()).toBe(3923);
    expect(fplMonthly(6, FY26, "AK").toNumber()).toBe(4496);
    expect(fplMonthly(7, FY26, "AK").toNumber()).toBe(5070);
    expect(fplMonthly(8, FY26, "AK").toNumber()).toBe(5643);
  });

  it("AK's monthly figures, doubled, exactly reproduce AK's own published BBCE-200 column", () => {
    // AK DOH's SNAP Standards table (FSP 77, rev 09/25): BBCE-200 gross
    // limit is $3,260 for HH1, $6,700 for HH4 (packages/demeter-engine/
    // src/states/ak/supplements.json, income-and-bbce supplement).
    expect(fplMonthly(1, FY26, "AK").mul(2).toNumber()).toBe(3260);
    expect(fplMonthly(4, FY26, "AK").mul(2).toNumber()).toBe(6700);
  });

  it("is strictly higher than the 48-contiguous table at every household size (AK can only loosen, never tighten, eligibility)", () => {
    for (let size = 1; size <= 8; size++) {
      const ak = fplMonthly(size, FY26, "AK").toNumber();
      const contiguous = fplMonthly(size, FY26, "CA").toNumber();
      expect(ak, `HH${size}`).toBeGreaterThan(contiguous);
    }
  });

  it("uses AK's own guideline for FY25 too (2024 HHS Poverty Guidelines for Alaska)", () => {
    // Federal Register Vol. 89 No. 11, Jan 17, 2024, 89 FR 2962:
    // $18,810 first person, $6,730 each additional.
    expect(fplMonthly(1, FY25, "AK").toNumber()).toBe(1568); // ceil(18810/12)
    expect(fplMonthly(4, FY25, "AK").toNumber()).toBe(3250); // ceil(39000/12)
  });

  it("uses HI's own, higher HHS guideline and its ceiling rounding convention, FY26 (#861)", () => {
    // 2025 HHS Poverty Guidelines for Hawaii (Federal Register Vol. 90
    // No. 11, Jan 17, 2025, 90 FR 5917): $17,990 first person, $6,330
    // each additional. HI's own convention is ceiling, same as AK's —
    // confirmed against USDA FNS's own FY2026 COLA memo's published
    // HI-specific income-eligibility table (see federal-tables.ts's
    // fpl_by_region.hi doc-comment for the full reconciliation).
    expect(fplMonthly(1, FY26, "HI").toNumber()).toBe(1500);
    expect(fplMonthly(2, FY26, "HI").toNumber()).toBe(2027);
    expect(fplMonthly(3, FY26, "HI").toNumber()).toBe(2555);
    expect(fplMonthly(4, FY26, "HI").toNumber()).toBe(3082);
    expect(fplMonthly(5, FY26, "HI").toNumber()).toBe(3610);
    expect(fplMonthly(6, FY26, "HI").toNumber()).toBe(4137);
    expect(fplMonthly(7, FY26, "HI").toNumber()).toBe(4665);
    expect(fplMonthly(8, FY26, "HI").toNumber()).toBe(5192);
  });

  it("uses HI's own guideline for FY25 too (2024 HHS Poverty Guidelines for Hawaii, 89 FR 2961-63)", () => {
    // $17,310 first person, $6,190 each additional.
    expect(fplMonthly(1, FY25, "HI").toNumber()).toBe(1443); // ceil(17310/12)
    expect(fplMonthly(4, FY25, "HI").toNumber()).toBe(2990); // ceil(35880/12)
  });

  it("is strictly higher than the 48-contiguous table at every household size (HI can only loosen, never tighten, eligibility)", () => {
    for (let size = 1; size <= 8; size++) {
      const hi = fplMonthly(size, FY26, "HI").toNumber();
      const contiguous = fplMonthly(size, FY26, "CA").toNumber();
      expect(hi, `HH${size}`).toBeGreaterThan(contiguous);
    }
  });

  it("GU uses the plain contiguous table — confirmed NOT elevated (#861), unlike HI/AK", () => {
    expect(fplMonthly(1, FY26, "GU").toNumber()).toBe(fplMonthly(1, FY26, "CA").toNumber());
    expect(fplMonthly(4, FY26, "GU").toNumber()).toBe(fplMonthly(4, FY26, "CA").toNumber());
  });

  it("treats state lookup case-insensitively", () => {
    expect(fplMonthly(1, FY26, "ak").toNumber()).toBe(fplMonthly(1, FY26, "AK").toNumber());
  });
});
