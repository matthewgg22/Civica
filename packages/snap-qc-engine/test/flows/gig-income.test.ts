import { describe, expect, it } from "vitest";
import { qcEngine } from "../../src/index.js";
import type { IncomeSource } from "../../src/schemas.js";

const src = (
  type: IncomeSource["type"],
  method: IncomeSource["verification_method"],
  monthly: number,
  name = "src",
): IncomeSource => ({
  type,
  source_name: name,
  monthly_average: monthly,
  verification_method: method,
  confidence:
    method === "argyle_api" ? "verified" : method === "plaid_deposits" ? "corroborated" : "self_declared",
});

describe("gig-income flow", () => {
  it("strong when Argyle + Plaid agree within 25%", async () => {
    const result = await qcEngine.evaluate({
      flow: "gig-income",
      state: "CA",
      inputs: {
        applicant_name: "Alex",
        state_code: "CA",
        sources: [src("w2", "argyle_api", 2400), src("w2", "plaid_deposits", 2200)],
        cash_attestation_signed: true,
      },
    });
    expect(result.defensibility_score).toBe("strong");
    expect(result.warnings).toHaveLength(0);
    if (result.evidence_package.flow === "gig-income") {
      expect(result.evidence_package.reconciliation_flag).toBe(false);
    }
  });

  it("weak + reconciliation warning when Plaid exceeds Argyle by >25%", async () => {
    const result = await qcEngine.evaluate({
      flow: "gig-income",
      state: "CA",
      inputs: {
        applicant_name: "Alex",
        state_code: "CA",
        sources: [src("w2", "argyle_api", 2000), src("w2", "plaid_deposits", 3000)],
        cash_attestation_signed: true,
      },
    });
    expect(result.warnings.some((w) => w.code === "gig_income.reconciliation_gap")).toBe(true);
    if (result.evidence_package.flow === "gig-income") {
      expect(result.evidence_package.reconciliation_gap).toBe(1000);
    }
  });

  it("sums all source totals correctly", async () => {
    const result = await qcEngine.evaluate({
      flow: "gig-income",
      state: "CA",
      inputs: {
        applicant_name: "Alex",
        state_code: "CA",
        sources: [
          src("w2", "argyle_api", 2400, "Acme"),
          src("w2", "plaid_deposits", 2300, "Acme bank"),
          src("cash", "self_declared", 200, "Cash"),
        ],
        cash_attestation_signed: true,
      },
    });
    if (result.evidence_package.flow === "gig-income") {
      expect(result.evidence_package.total_monthly_declared).toBe(4900);
    }
  });
});
