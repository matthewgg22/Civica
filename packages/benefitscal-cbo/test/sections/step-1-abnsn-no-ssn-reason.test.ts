// @vitest-environment jsdom
/**
 * Step 1 — ABNSN: Why no SSN (only if ABSSN != Yes).
 * reasonForNoSsn has no payload source (no schema field for no-SSN reason) →
 * needs-review. The assister picks the reason manually.
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABNSN — no-SSN reason", () => {
  it("marks reasonForNoSsn as needs-review (no payload source)", () =>
    runSectionFillTest("ABNSN", {
      expectedFilled: { reasonForNoSsn: "needs-review" },
      minFilled: 0,
    }));
});
