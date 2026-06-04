// @vitest-environment jsdom
/**
 * Step 1 — ABRDT: Date of birth (required).
 * dateOfBirth is a date-password field; fills from packet.date_of_birth
 * with ISO→MM/DD/YYYY normalization.
 */
import { describe, it } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

describe("step-1: ABRDT — date of birth", () => {
  it("fills dateOfBirth from date_of_birth (ISO → MM/DD/YYYY)", () =>
    runSectionFillTest("ABRDT", {
      payloadOverrides: { date_of_birth: "1985-03-15" },
      expectedFilled: { dateOfBirth: "filled" },
      minFilled: 1,
    }));

  it("marks as no-value when date_of_birth is absent", () =>
    runSectionFillTest("ABRDT", {
      payloadOverrides: { date_of_birth: "" as unknown as string },
      expectedFilled: { dateOfBirth: "no-value" },
    }));
});
