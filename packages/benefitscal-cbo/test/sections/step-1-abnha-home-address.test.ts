// @vitest-environment jsdom
/**
 * Step 1 — ABNHA: Home address + homelessness radio.
 * experiencingHomelessness (optionMap → Yes/No), addressLine1, city, state, zip
 * all fill from packet. addressLine2 has no source → needs-review.
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABNHA — home address", () => {
  it("fills address fields and selects No for homelessness when is_homeless=false", () =>
    runSectionFillTest("ABNHA", {
      payloadOverrides: {
        is_homeless: false,
        address: {
          street: "123 Main St",
          city: "Oakland",
          state: "CA",
          zip: "94601",
        },
      },
      expectedFilled: {
        experiencingHomelessness: "filled",
        addressLine1: "filled",
        city: "filled",
        state: "filled",
        zip: "filled",
        addressLine2: "needs-review",
      },
      minFilled: 5,
    }));

  it("selects Yes for homelessness when is_homeless=true", () =>
    runSectionFillTest("ABNHA", {
      payloadOverrides: { is_homeless: true },
      expectedFilled: {
        experiencingHomelessness: "filled",
      },
    }));

  it("marks homelessness as no-value when is_homeless is absent (resolveOption returns no-value for null source)", () =>
    runSectionFillTest("ABNHA", {
      payloadOverrides: { is_homeless: undefined },
      expectedFilled: {
        experiencingHomelessness: "no-value",
      },
    }));
});
