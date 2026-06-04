// @vitest-environment jsdom
/**
 * Step 1 — ABCFS: Benefits-spend authorized representative.
 * Both radios (spendRepYes / spendRepNo) have no payload source →
 * needs-review. Submitter defaults to No manually.
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABCFS — spend authorized representative", () => {
  it("marks both spend-rep radios as needs-review (no payload source)", () =>
    runSectionFillTest("ABCFS", {
      expectedFilled: {
        spendRepYes: "needs-review",
        spendRepNo: "needs-review",
      },
      minFilled: 0,
    }));
});
