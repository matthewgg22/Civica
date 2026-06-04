// @vitest-environment jsdom
/**
 * Step 1 — ABDIS: Disability accommodation (optional).
 * All four radios are individual (non-group) with no payload source →
 * all needs-review. The assister picks Yes/No for each question.
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABDIS — disability accommodation", () => {
  it("marks all disability radios as needs-review (no payload source)", () =>
    runSectionFillTest("ABDIS", {
      expectedFilled: {
        needHelpYes: "needs-review",
        needHelpNo: "needs-review",
        deafOrHardOfHearingYes: "needs-review",
        deafOrHardOfHearingNo: "needs-review",
      },
      minFilled: 0,
    }));
});
