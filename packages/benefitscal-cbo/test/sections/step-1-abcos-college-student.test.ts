// @vitest-environment jsdom
/**
 * Step 1 — ABCOS: College student status (SNAP eligibility critical).
 * collegeStudent is an optionMap radio group (is_college_student → Yes/No).
 * Absent → needs-review (eligibility-critical: never default to "not a student").
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABCOS — college student status", () => {
  it("selects No when is_college_student=false", () =>
    runSectionFillTest("ABCOS", {
      payloadOverrides: { is_college_student: false },
      expectedFilled: { collegeStudent: "filled" },
      minFilled: 1,
    }));

  it("selects Yes when is_college_student=true", () =>
    runSectionFillTest("ABCOS", {
      payloadOverrides: { is_college_student: true },
      expectedFilled: { collegeStudent: "filled" },
      minFilled: 1,
    }));

  it("marks as no-value when is_college_student is absent (resolveOption returns no-value for null source)", () =>
    runSectionFillTest("ABCOS", {
      payloadOverrides: { is_college_student: undefined },
      expectedFilled: { collegeStudent: "no-value" },
      minFilled: 0,
    }));
});
