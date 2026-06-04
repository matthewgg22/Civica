// @vitest-environment jsdom
/**
 * Step 1 — ABPRI: Program selection (required, critical).
 * calFresh is a constant checkbox (always true → filled).
 * applyingForSelf is a constant radio group (always Yes → filled).
 * cashAid + mediCal have no source or constant → needs-review (never checked).
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABPRI — program selection", () => {
  it("checks CalFresh (constant) and applies-for-self Yes (constant); leaves Cash Aid and Medi-Cal as needs-review", () =>
    runSectionFillTest("ABPRI", {
      expectedFilled: {
        calFresh: "filled",
        applyingForSelf: "filled",
        cashAid: "needs-review",
        mediCal: "needs-review",
      },
      minFilled: 2,
    }));
});
