// @vitest-environment jsdom
/**
 * Step 1 — ABCON: Contact info (all optional).
 * mobilePhone fills from packet.phone via phone-10digit transform.
 * homePhone, altPhone, email have no source → needs-review.
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABCON — contact info", () => {
  it("fills mobilePhone via phone-10digit transform; marks other phone/email as needs-review", () =>
    runSectionFillTest("ABCON", {
      payloadOverrides: { phone: "+15105551234" },
      expectedFilled: {
        mobilePhone: "filled",
        homePhone: "needs-review",
        altPhone: "needs-review",
        email: "needs-review",
      },
      minFilled: 1,
    }));

  it("marks mobilePhone as no-value when phone is absent", () =>
    runSectionFillTest("ABCON", {
      payloadOverrides: { phone: undefined as unknown as string },
      expectedFilled: {
        mobilePhone: "no-value",
      },
    }));
});
