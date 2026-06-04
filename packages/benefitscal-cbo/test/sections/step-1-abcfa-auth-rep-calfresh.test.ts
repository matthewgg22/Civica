// @vitest-environment jsdom
/**
 * Step 1 — ABCFA: CalFresh authorized representative.
 * Both radios (authRepYes / authRepNo) have no payload source →
 * needs-review. Submitter defaults to No manually.
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABCFA — CalFresh authorized representative", () => {
  it("marks both auth-rep radios as needs-review (no payload source)", () =>
    runSectionFillTest("ABCFA", {
      expectedFilled: {
        authRepYes: "needs-review",
        authRepNo: "needs-review",
      },
      minFilled: 0,
    }));
});
