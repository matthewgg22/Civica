// @vitest-environment jsdom
/**
 * Step 1 — ABMAD: Mailing address differs?
 * Both mailingDiffersYes and mailingDiffersNo are individual radio fields with
 * no payload source → both needs-review. The submitter always picks No manually.
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABMAD — mailing address differs?", () => {
  it("marks both radios as needs-review (no payload source; assister picks No)", () =>
    runSectionFillTest("ABMAD", {
      expectedFilled: {
        mailingDiffersYes: "needs-review",
        mailingDiffersNo: "needs-review",
      },
      minFilled: 0,
    }));
});
