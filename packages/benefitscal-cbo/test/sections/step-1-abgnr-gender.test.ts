// @vitest-environment jsdom
/**
 * Step 1 — ABGNR: Gender identity (optional).
 * genderIdentity has no payload source (7 portal options not fully enumerated
 * in the walk; free-string gender schema field has no optionMap) → needs-review.
 * The assister fills this optional page.
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABGNR — gender identity", () => {
  it("marks genderIdentity as needs-review (no payload source; optional page)", () =>
    runSectionFillTest("ABGNR", {
      expectedFilled: { genderIdentity: "needs-review" },
      minFilled: 0,
    }));
});
