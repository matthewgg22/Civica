// @vitest-environment jsdom
/**
 * Step 1 — ABASX: Sex assigned at birth (optional).
 * assignedSex has no payload source (the walk didn't enumerate a schema
 * mapping for the portal's radio indices) → needs-review.
 * The assister fills this optional page.
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABASX — sex assigned at birth", () => {
  it("marks assignedSex as needs-review (no payload source; optional page)", () =>
    runSectionFillTest("ABASX", {
      expectedFilled: { assignedSex: "needs-review" },
      minFilled: 0,
    }));
});
