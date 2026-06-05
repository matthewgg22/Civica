// @vitest-environment jsdom
/**
 * Step-4 ABEIC — employment income detail fill (V1-5 PR5, #499).
 *
 * The one auto-fillable Income page: wage amount → income_sources[0].income_amount,
 * pay frequency → income_sources[0].income_frequency mapped to the portal option
 * text via the snap-pay-frequency transform + fillSelect's text fallback.
 * Employer fields have no Civica source → needs-review.
 *
 * Uses an explicit DOM (domHtml) because the frequency <select>'s option values
 * weren't captured by the walk — the fill resolves by option text.
 */

import { describe, it, expect } from "vitest";
import { runSectionFillTest } from "../__fixtures__/makePacket";

const ABEIC_DOM = `
  <label for="payAmount">Amount</label>
  <input id="payAmount" type="text" />
  <label for="oftenPaid">How often are you paid?</label>
  <select id="oftenPaid">
    <option value="">-Select One-</option>
    <option value="01">Weekly</option>
    <option value="02">Bi-Weekly</option>
    <option value="03">Semi-Monthly</option>
    <option value="05">Monthly</option>
    <option value="10">Hourly</option>
  </select>
`;

describe("step-4: ABEIC — employment income detail", () => {
  it("fills wage amount + monthly frequency from income_sources[0]", () =>
    runSectionFillTest("ABEIC", {
      payloadOverrides: {
        income_sources: [
          { income_type: "wages", income_amount: 1800, income_frequency: "monthly" },
        ],
      },
      domHtml: ABEIC_DOM,
      expectedFilled: { payAmount: "filled", oftenPaid: "filled" },
      expectedValues: { payAmount: "1800", oftenPaid: "05" }, // "Monthly" → value 05
      minFilled: 2,
    }));

  it("maps a non-monthly frequency (semimonthly → Semi-Monthly → value 03)", () =>
    runSectionFillTest("ABEIC", {
      payloadOverrides: {
        income_sources: [
          { income_type: "wages", income_amount: 950, income_frequency: "semimonthly" },
        ],
      },
      domHtml: ABEIC_DOM,
      expectedFilled: { payAmount: "filled", oftenPaid: "filled" },
      expectedValues: { payAmount: "950", oftenPaid: "03" },
    }));

  it("leaves frequency needs-review for 'irregular' (no portal option)", () =>
    runSectionFillTest("ABEIC", {
      payloadOverrides: {
        income_sources: [
          { income_type: "wages", income_amount: 500, income_frequency: "irregular" },
        ],
      },
      domHtml: ABEIC_DOM,
      expectedFilled: { payAmount: "filled", oftenPaid: "needs-review" },
      expectedValues: { payAmount: "500" },
    }));

  it("leaves both needs-review/no-value when there's no income source", () =>
    runSectionFillTest("ABEIC", {
      payloadOverrides: { income_sources: [] },
      domHtml: ABEIC_DOM,
      expectedFilled: { payAmount: "no-value", oftenPaid: "no-value" },
    }));
});
