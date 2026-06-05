// @vitest-environment jsdom
/**
 * Step-5 ABAPH — rent/mortgage expense detail fill (V1-5 PR5, #499).
 *
 * The auto-fillable Expenses page: amount + frequency come from the RENT
 * expense, located by scopePayloadForExpenseType("rent_or_mortgage") which
 * places the matching expense at expenses[0]. Proves the proxy picks the rent
 * row out of a mixed expenses[] array — not whatever happens to be at index 0.
 */

import { describe, it, expect } from "vitest";
import { runSectionFillTest, makePacket } from "../__fixtures__/makePacket";
import { scopePayloadForExpenseType } from "../../src/core/member-scope";

const ABAPH_DOM = `
  <label for="text1">Amount</label>
  <input id="text1" type="text" />
  <label for="dropdownoptiongroup">How often do you pay this?</label>
  <select id="dropdownoptiongroup">
    <option value="">-Select One-</option>
    <option value="01">Weekly</option>
    <option value="03">Semi-Monthly</option>
    <option value="05">Monthly</option>
  </select>
`;

const MIXED_EXPENSES = {
  expenses: [
    // Deliberately NOT rent at index 0 — proves the proxy filters by type.
    { expense_type: "dependent_care" as const, amount: 400, frequency: "monthly" as const },
    { expense_type: "rent_or_mortgage" as const, amount: 1500, frequency: "monthly" as const },
  ],
};

describe("step-5: ABAPH — rent/mortgage detail", () => {
  it("fills the RENT amount + frequency from a mixed expenses[] (not index 0)", () =>
    runSectionFillTest("ABAPH", {
      payloadOverrides: MIXED_EXPENSES,
      scopeExpenseType: "rent_or_mortgage",
      domHtml: ABAPH_DOM,
      expectedFilled: { amount: "filled", frequency: "filled" },
      expectedValues: { amount: "1500", frequency: "05" }, // rent row, "Monthly" → 05
      minFilled: 2,
    }));

  it("maps a semimonthly rent frequency (Semi-Monthly → value 03)", () =>
    runSectionFillTest("ABAPH", {
      payloadOverrides: {
        expenses: [
          { expense_type: "rent_or_mortgage" as const, amount: 800, frequency: "semimonthly" as const },
        ],
      },
      scopeExpenseType: "rent_or_mortgage",
      domHtml: ABAPH_DOM,
      expectedFilled: { amount: "filled", frequency: "filled" },
      expectedValues: { amount: "800", frequency: "03" },
    }));

  it("leaves both no-value when there's no rent expense (only other types)", () =>
    runSectionFillTest("ABAPH", {
      payloadOverrides: {
        expenses: [
          { expense_type: "dependent_care" as const, amount: 400, frequency: "monthly" as const },
        ],
      },
      scopeExpenseType: "rent_or_mortgage", // no rent → scoped to []
      domHtml: ABAPH_DOM,
      expectedFilled: { amount: "no-value", frequency: "no-value" },
    }));
});

describe("scopePayloadForExpenseType", () => {
  it("places the matching expense at expenses[0]", () => {
    const payload = makePacket(MIXED_EXPENSES);
    const scoped = scopePayloadForExpenseType(payload, "rent_or_mortgage") as {
      expenses: { expense_type: string; amount: number }[];
    };
    expect(scoped.expenses).toHaveLength(1);
    expect(scoped.expenses[0]?.expense_type).toBe("rent_or_mortgage");
    expect(scoped.expenses[0]?.amount).toBe(1500);
  });

  it("scopes to an empty array when no expense of that type exists (no bleed)", () => {
    const payload = makePacket({
      expenses: [
        { expense_type: "dependent_care" as const, amount: 400, frequency: "monthly" as const },
      ],
    });
    const scoped = scopePayloadForExpenseType(payload, "rent_or_mortgage") as {
      expenses: unknown[];
    };
    expect(scoped.expenses).toEqual([]);
  });

  it("passes through a payload with no expenses array", () => {
    const weird = { foo: "bar" };
    expect(scopePayloadForExpenseType(weird, "rent_or_mortgage")).toBe(weird);
  });
});
