import { describe, it, expect } from "vitest";
import { STATE_ASSET_RULES } from "./index";
import { buildAssetPackage } from "@/lib/package-builder";
import type { AssetItem } from "@/types/verification";

// ---------- STATE_ASSET_RULES table ----------

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

// ---------- buildAssetPackage ----------

const bankAsset = (balance: number): AssetItem => ({
  type: "bank_account",
  description: "Sandbox Checking",
  stated_value: balance,
  exempt: false,
  countable_value: balance,
  verification_method: "plaid_balance",
});

const vehicleExempt: AssetItem = {
  type: "vehicle",
  description: "2018 Honda Civic",
  stated_value: 12000,
  exempt: true,
  exemption_reason: "primary_transport",
  countable_value: 0,
  verification_method: "self_declared",
};

const retirementExempt: AssetItem = {
  type: "retirement",
  description: "401(k)",
  stated_value: 45000,
  exempt: true,
  exemption_reason: "retirement_excluded",
  countable_value: 0,
  verification_method: "self_declared",
};

describe("buildAssetPackage — CA (no asset test)", () => {
  it("result is not_applicable regardless of asset total", () => {
    const pkg = buildAssetPackage({
      applicantName: "Alex",
      stateCode: "CA",
      assets: [bankAsset(50000)],
    });
    expect(pkg.asset_test_result).toBe("not_applicable");
    expect(pkg.asset_test_applies).toBe(false);
  });

  it("total_countable_assets still sums correctly for informational purposes", () => {
    const pkg = buildAssetPackage({
      applicantName: "Alex",
      stateCode: "CA",
      assets: [bankAsset(1000), bankAsset(500)],
    });
    expect(pkg.total_countable_assets).toBe(1500);
  });

  it("exempt assets do not count toward total", () => {
    const pkg = buildAssetPackage({
      applicantName: "Alex",
      stateCode: "CA",
      assets: [bankAsset(800), vehicleExempt, retirementExempt],
    });
    expect(pkg.total_countable_assets).toBe(800);
  });

  it("includes CA regulatory citations", () => {
    const pkg = buildAssetPackage({ applicantName: "Alex", stateCode: "CA", assets: [] });
    expect(pkg.regulatory_citations.some((c) => c.includes("SB 1090"))).toBe(true);
  });
});

describe("buildAssetPackage — MA (asset test applies)", () => {
  it("passes when countable assets are below the standard limit", () => {
    const pkg = buildAssetPackage({
      applicantName: "Jordan",
      stateCode: "MA",
      assets: [bankAsset(2000)],
    });
    expect(pkg.asset_test_result).toBe("pass");
    expect(pkg.asset_limit_usd).toBe(2750);
  });

  it("fails when countable assets exceed the standard limit", () => {
    const pkg = buildAssetPackage({
      applicantName: "Jordan",
      stateCode: "MA",
      assets: [bankAsset(3000)],
    });
    expect(pkg.asset_test_result).toBe("fail");
    expect(pkg.total_countable_assets).toBe(3000);
  });

  it("passes at exactly the standard limit", () => {
    const pkg = buildAssetPackage({
      applicantName: "Jordan",
      stateCode: "MA",
      assets: [bankAsset(2750)],
    });
    expect(pkg.asset_test_result).toBe("pass");
  });

  it("uses the higher elderly/disabled limit when flag is set", () => {
    const pkg = buildAssetPackage({
      applicantName: "Jordan",
      stateCode: "MA",
      assets: [bankAsset(3500)],
      elderlyOrDisabled: true,
    });
    expect(pkg.asset_limit_usd).toBe(4250);
    expect(pkg.asset_test_result).toBe("pass");
  });

  it("fails with elderly limit when assets exceed $4,250", () => {
    const pkg = buildAssetPackage({
      applicantName: "Jordan",
      stateCode: "MA",
      assets: [bankAsset(5000)],
      elderlyOrDisabled: true,
    });
    expect(pkg.asset_test_result).toBe("fail");
  });

  it("exempt vehicle and retirement do not push total over limit", () => {
    const pkg = buildAssetPackage({
      applicantName: "Jordan",
      stateCode: "MA",
      assets: [bankAsset(2000), vehicleExempt, retirementExempt],
    });
    expect(pkg.total_countable_assets).toBe(2000);
    expect(pkg.asset_test_result).toBe("pass");
  });

  it("non-exempt vehicle equity is countable", () => {
    const nonExemptVehicle: AssetItem = {
      type: "vehicle",
      description: "Second car",
      stated_value: 8000,
      exempt: false,
      countable_value: 3350, // 8000 - 4650 federal equity threshold
      verification_method: "self_declared",
    };
    const pkg = buildAssetPackage({
      applicantName: "Jordan",
      stateCode: "MA",
      assets: [bankAsset(500), nonExemptVehicle],
    });
    expect(pkg.total_countable_assets).toBe(3850);
    expect(pkg.asset_test_result).toBe("fail");
  });
});
