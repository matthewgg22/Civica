// @vitest-environment jsdom
/**
 * Step 1 — info-only pages: ABCSD, ABCID, ABBID.
 * These pages have no fields (infoOnly: true). The fill loop produces
 * zero outcomes — the assister just clicks the advance button.
 * Tests confirm that runSectionFillTest handles empty field maps gracefully.
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: info-only pages — no fields to fill", () => {
  it("ABCSD (skip-and-submit upsell): zero outcomes, zero filled", () =>
    runSectionFillTest("ABCSD", {
      expectedFilled: {},
      minFilled: 0,
    }));

  it("ABCID (citizenship intro): zero outcomes, zero filled", () =>
    runSectionFillTest("ABCID", {
      expectedFilled: {},
      minFilled: 0,
    }));

  it("ABBID (background questions intro): zero outcomes, zero filled", () =>
    runSectionFillTest("ABBID", {
      expectedFilled: {},
      minFilled: 0,
    }));
});
