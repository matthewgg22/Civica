// @vitest-environment jsdom
/**
 * Step 1 — ABLPR: Language preferences (all optional, no payload source).
 * All three fields have no `source` → needs-review (the assister fills them).
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABLPR — language preferences", () => {
  it("marks all language-pref selects as needs-review (no payload source)", () =>
    runSectionFillTest("ABLPR", {
      expectedFilled: {
        readLanguage: "needs-review",
        spokenLanguage: "needs-review",
        applicationLanguage: "needs-review",
      },
      minFilled: 0,
    }));
});
