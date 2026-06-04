// @vitest-environment jsdom
/**
 * Step 1 — ABNMI: Applicant name.
 * firstName + lastName fill from packet; middleName / suffix / otherNames have
 * no payload source → needs-review.
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABNMI — applicant name", () => {
  it("fills first_name and last_name; marks middle/suffix/other as needs-review", () =>
    runSectionFillTest("ABNMI", {
      payloadOverrides: { first_name: "Maria", last_name: "Test" },
      expectedFilled: {
        firstName: "filled",
        lastName: "filled",
        middleName: "needs-review",
        suffix: "needs-review",
        otherNames: "needs-review",
      },
      minFilled: 2,
    }));

  it("marks firstName as no-value when first_name is omitted", () =>
    runSectionFillTest("ABNMI", {
      payloadOverrides: { first_name: "" as unknown as string },
      expectedFilled: {
        firstName: "no-value",
      },
    }));
});
