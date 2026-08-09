import { describe, it, expect } from "vitest";
import { assetTest } from "./asset-test";
import { countableAssets } from "../facts";
import type { Facts } from "../facts";

// #633: 7 CFR 273.8(e)(12) excludes a tax refund/EITC from RESOURCES, not
// just income, for 12 months. isExcludedIncome() already kept it out of
// gross income; countableAssets() didn't touch the resource side at all
// until this fix — a household with a $4,000 refund sitting in an
// otherwise-under-limit account was denied on assets_over_limit in any
// state with a real (non-waived) asset test.

const member = (over: Partial<Facts["household"][number]> = {}) => ({
  member_id: "m1",
  age: 35,
  role: "head",
  living: "housed",
  ...over,
});

const facts = (over: Partial<Facts> = {}): Facts =>
  ({
    household: [member()],
    income: [],
    shelter: { rent: 0, sua_tier: "none", sua_amount: 0 },
    deductions: {},
    assets: 0,
    cat_elig: "NPA",
    ...over,
  }) as Facts;

describe("countableAssets — tax refund / EITC resource exclusion (#633)", () => {
  it("REGRESSION: the exact P65 case — $4,200 raw assets, $4,000 of it a recent refund, nets to $200", () => {
    const f = facts({
      assets: 4200,
      income: [{ member: "m1", type: "excluded_tax_refund", amount: 4000, freq: "annual" }],
    });
    expect(countableAssets(f)).toBe(200);
  });

  it("no excluded-tax-refund income line — assets pass through unchanged", () => {
    const f = facts({ assets: 4200, income: [{ member: "m1", type: "wages", amount: 1000 }] });
    expect(countableAssets(f)).toBe(4200);
  });

  it("multiple excluded_tax_refund lines sum", () => {
    const f = facts({
      assets: 5000,
      income: [
        { member: "m1", type: "excluded_tax_refund", amount: 3000 },
        { member: "m1", type: "excluded_tax_refund_eitc", amount: 1000 },
      ],
    });
    expect(countableAssets(f)).toBe(1000);
  });

  it("floors at 0 rather than going negative when the refund exceeds raw assets", () => {
    const f = facts({
      assets: 500,
      income: [{ member: "m1", type: "excluded_tax_refund", amount: 4000 }],
    });
    expect(countableAssets(f)).toBe(0);
  });

  it("a DIFFERENT excluded income type (not a tax refund) does not reduce assets — 273.8(e)(12) is refund/EITC-specific", () => {
    const f = facts({
      assets: 4200,
      income: [{ member: "m1", type: "excluded_vendor_payment", amount: 4000 }],
    });
    expect(countableAssets(f)).toBe(4200);
  });

  it("cat-elig sentinel still short-circuits to null regardless of income lines", () => {
    const f = facts({
      assets: "n/a:categorical_no_asset_test",
      income: [{ member: "m1", type: "excluded_tax_refund", amount: 4000 }],
    });
    expect(countableAssets(f)).toBeNull();
  });
});

describe("assetTest — P65 end to end (a state WITHOUT an asset waiver)", () => {
  it("passes when the refund exclusion brings countable assets under the limit", () => {
    const f = facts({
      assets: 4200,
      income: [{ member: "m1", type: "excluded_tax_refund", amount: 4000 }],
    });
    const r = assetTest(f, "KS", new Date("2026-06-01"));
    expect(r.passes).toBe(true);
    expect(r.actual).toBe(200);
  });
});
