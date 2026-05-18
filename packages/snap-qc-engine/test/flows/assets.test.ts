import { describe, expect, it } from "vitest";
import { qcEngine } from "../../src/index.js";
import type { AssetItem } from "../../src/schemas.js";

const bank = (balance: number): AssetItem => ({
  type: "bank_account",
  description: "Sandbox Checking",
  stated_value: balance,
  exempt: false,
  countable_value: balance,
  verification_method: "plaid_balance",
});

describe("assets flow", () => {
  it("CA → not_applicable regardless of total", async () => {
    const result = await qcEngine.evaluate({
      flow: "assets",
      state: "CA",
      inputs: {
        applicant_name: "Alex",
        state_code: "CA",
        assets: [bank(50000)],
      },
    });
    if (result.evidence_package.flow === "assets") {
      expect(result.evidence_package.asset_test_result).toBe("not_applicable");
    }
  });

  it("MA → pass under standard limit, strong score when fully verified", async () => {
    const result = await qcEngine.evaluate({
      flow: "assets",
      state: "MA",
      inputs: {
        applicant_name: "Jordan",
        state_code: "MA",
        assets: [bank(2000)],
      },
    });
    expect(result.defensibility_score).toBe("strong");
    if (result.evidence_package.flow === "assets") {
      expect(result.evidence_package.asset_test_result).toBe("pass");
      expect(result.evidence_package.asset_limit_usd).toBe(2750);
    }
  });

  it("MA → fail over limit raises critical warning", async () => {
    const result = await qcEngine.evaluate({
      flow: "assets",
      state: "MA",
      inputs: {
        applicant_name: "Jordan",
        state_code: "MA",
        assets: [bank(3000)],
      },
    });
    expect(result.defensibility_score).toBe("weak");
    expect(
      result.warnings.some((w) => w.code === "assets.over_limit" && w.severity === "critical"),
    ).toBe(true);
  });

  it("elderly/disabled raises MA limit to $4,250", async () => {
    const result = await qcEngine.evaluate({
      flow: "assets",
      state: "MA",
      inputs: {
        applicant_name: "Jordan",
        state_code: "MA",
        assets: [bank(3500)],
        elderly_or_disabled: true,
      },
    });
    if (result.evidence_package.flow === "assets") {
      expect(result.evidence_package.asset_limit_usd).toBe(4250);
      expect(result.evidence_package.asset_test_result).toBe("pass");
    }
  });
});
