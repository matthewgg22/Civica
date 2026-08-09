import { describe, it, expect } from "vitest";
import { money } from "../screening-worksheet-shape";

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
