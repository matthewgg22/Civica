// @vitest-environment jsdom
/**
 * Step 1 — ABSSN: SSN existence question.
 * ssnExistence uses presenceOf=ssn_last4 → clicks Yes when ssn_last4 is present.
 * When absent: needs-review (absent option intentionally omitted — the field
 * is eligibility-relevant and requires human judgment for No vs "don't have it").
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABSSN — SSN existence", () => {
  it("selects Yes when ssn_last4 is present in the packet", () =>
    runSectionFillTest("ABSSN", {
      payloadOverrides: { ssn_last4: "4321" },
      expectedFilled: { ssnExistence: "filled" },
      minFilled: 1,
    }));

  it("marks as needs-review when ssn_last4 is absent (absent option omitted by design)", () =>
    runSectionFillTest("ABSSN", {
      payloadOverrides: { ssn_last4: undefined as unknown as string },
      expectedFilled: { ssnExistence: "needs-review" },
      minFilled: 0,
    }));
});
