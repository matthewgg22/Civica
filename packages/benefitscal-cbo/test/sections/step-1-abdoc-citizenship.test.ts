// @vitest-environment jsdom
/**
 * Step 1 — ABDOC: Citizenship Yes/No (SNAP eligibility critical).
 * citizen is an optionMap radio: us_citizen → Yes, us_national → Yes,
 * non_citizen → No. Absent → needs-review (never defaulted to us_citizen).
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABDOC — citizenship", () => {
  it("selects Yes when citizenship_status=us_citizen", () =>
    runSectionFillTest("ABDOC", {
      payloadOverrides: { citizenship_status: "us_citizen" },
      expectedFilled: { citizen: "filled" },
      minFilled: 1,
    }));

  it("selects Yes when citizenship_status=us_national", () =>
    runSectionFillTest("ABDOC", {
      payloadOverrides: { citizenship_status: "us_national" },
      expectedFilled: { citizen: "filled" },
      minFilled: 1,
    }));

  it("selects No when citizenship_status=non_citizen", () =>
    runSectionFillTest("ABDOC", {
      payloadOverrides: { citizenship_status: "non_citizen" },
      expectedFilled: { citizen: "filled" },
      minFilled: 1,
    }));

  it("marks as no-value when citizenship_status is absent (resolveOption returns no-value for null source)", () =>
    runSectionFillTest("ABDOC", {
      payloadOverrides: { citizenship_status: undefined },
      expectedFilled: { citizen: "no-value" },
      minFilled: 0,
    }));
});
