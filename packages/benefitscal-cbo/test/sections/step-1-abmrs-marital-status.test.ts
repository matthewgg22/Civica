// @vitest-environment jsdom
/**
 * Step 1 — ABMRS: Marital status (optional).
 * maritalStatus is an optionMap radio group — all 8 MaritalStatusSchema values
 * have explicit entries. Absent → needs-review (never defaulted).
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABMRS — marital status", () => {
  it("selects Single radio when marital_status=single", () =>
    runSectionFillTest("ABMRS", {
      payloadOverrides: { marital_status: "single" },
      expectedFilled: { maritalStatus: "filled" },
      minFilled: 1,
    }));

  it("selects Married radio when marital_status=married", () =>
    runSectionFillTest("ABMRS", {
      payloadOverrides: { marital_status: "married" },
      expectedFilled: { maritalStatus: "filled" },
      minFilled: 1,
    }));

  it("selects Registered Domestic Partner when marital_status=domestic_partner", () =>
    runSectionFillTest("ABMRS", {
      payloadOverrides: { marital_status: "domestic_partner" },
      expectedFilled: { maritalStatus: "filled" },
      minFilled: 1,
    }));

  it("marks as no-value when marital_status is absent (resolveOption returns no-value for null source)", () =>
    runSectionFillTest("ABMRS", {
      payloadOverrides: { marital_status: undefined },
      expectedFilled: { maritalStatus: "no-value" },
      minFilled: 0,
    }));
});
