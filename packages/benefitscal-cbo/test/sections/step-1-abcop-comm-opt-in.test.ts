// @vitest-environment jsdom
/**
 * Step 1 — ABCOP: Communication opt-in (all optional).
 * emailAlerts, textAlerts, tcpaAcknowledgment are all checkboxes with no
 * payload source → all needs-review. The assister opts in or out manually.
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABCOP — communication opt-in", () => {
  it("marks all comm-opt-in checkboxes as needs-review (no payload source)", () =>
    runSectionFillTest("ABCOP", {
      expectedFilled: {
        emailAlerts: "needs-review",
        textAlerts: "needs-review",
        tcpaAcknowledgment: "needs-review",
      },
      minFilled: 0,
    }));
});
