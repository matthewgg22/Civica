import { describe, it, expect } from "vitest";
import { money, OUTCOME_COPY } from "../screening-worksheet-shape";

// money() is shared between the live worksheet and the exported PDF — a
// formatting bug here would show up identically (and identically wrong)
// in both, so it's worth locking down on its own.

describe("money", () => {
  it("formats a positive amount with a thousands separator", () => {
    expect(money(1234)).toBe("$1,234");
  });

  it("formats zero without a sign", () => {
    expect(money(0)).toBe("$0");
  });

  it("formats a negative amount with a leading minus, not inside the parens", () => {
    expect(money(-150)).toBe("-$150");
  });
});

// #898 P0-2: the rail label "Needs county review" scared a real
// Massachusetts user off applying mid-conversation — "I am concerned to
// apply now since... it says needs county review" — because MA has no
// county step at all; DTA runs SNAP at the state level. Only 10 states
// are county-administered. Outcome labels must be agency-neutral.
describe("outcome labels are agency-neutral", () => {
  it("no label names a county", () => {
    for (const [key, copy] of Object.entries(OUTCOME_COPY)) {
      expect(copy.label, key).not.toMatch(/county/i);
    }
  });
});
