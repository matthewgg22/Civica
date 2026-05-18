import { describe, expect, it } from "vitest";
import { qcEngine, determineSuaTier, ENGINE_VERSION } from "../../src/index.js";
import type { StateCode, UtilityIntake } from "../../src/schemas.js";

const intake = (
  paid: Partial<UtilityIntake["utilities_paid_by_applicant"]>,
  state: StateCode = "CA",
): UtilityIntake => ({
  state_code: state,
  landlord_pays_any: false,
  utilities_paid_by_applicant: {
    heat_gas: false,
    electricity: false,
    cooling: false,
    water: false,
    phone_internet: false,
    none: false,
    ...paid,
  },
});

describe("utility-sua flow", () => {
  it("returns full SUA tier when CA applicant pays heat", () => {
    expect(determineSuaTier(intake({ heat_gas: true }))).toBe("full");
  });

  it("api_confirmed basis → strong defensibility", async () => {
    const result = await qcEngine.evaluate({
      flow: "utility-sua",
      state: "CA",
      inputs: {
        applicant_name: "Alex",
        service_address: "1421 Mission St",
        intake: intake({ heat_gas: true }),
        accounts: [
          {
            utility: "PG&E",
            account_holder_name: "Alex",
            service_address: "1421 Mission St",
            account_status: "active",
            utility_type: "electric",
            source: "utilityapi_sandbox",
          },
        ],
        name_match: true,
      },
    });
    expect(result.defensibility_score).toBe("strong");
    expect(result.engine_version).toBe(ENGINE_VERSION);
    expect(result.evidence_package.flow).toBe("utility");
    if (result.evidence_package.flow === "utility") {
      expect(result.evidence_package.basis).toBe("api_confirmed");
    }
  });

  it("conflicting basis → weak + warning", async () => {
    const result = await qcEngine.evaluate({
      flow: "utility-sua",
      state: "CA",
      inputs: {
        applicant_name: "Alex",
        service_address: "1421 Mission St",
        intake: intake({ heat_gas: true }),
        accounts: [
          {
            utility: "PG&E",
            account_holder_name: "Maria Landlord",
            service_address: "1421 Mission St",
            account_status: "active",
            utility_type: "electric",
            source: "utilityapi_sandbox",
          },
        ],
        name_match: false,
      },
    });
    expect(result.defensibility_score).toBe("weak");
    expect(result.warnings.some((w) => w.code === "utility.account_holder_mismatch")).toBe(true);
  });
});
