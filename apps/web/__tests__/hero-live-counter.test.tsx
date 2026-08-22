// @vitest-environment jsdom
//
// The dormant-until-true tally (approved 2026-08-21).
//
// THE HISTORY THIS GUARDS: the requested line was "Over 300 people have
// shared this question" — at a time when prod had 12 public questions and 4
// sessions EVER. That number was refused; what shipped instead is a LIVE
// count that renders only once it passes an honest floor. Until the floor is
// crossed the card simply carries no usage claim at all: dormant, not
// fabricated.
//
// Two invariants, both load-bearing:
//   1. The copy template may not contain a digit — every number on the card
//      must come from the measured count, never from copywriting.
//   2. Below the floor (and on any fetch failure) the line is ABSENT, not
//      zero-padded, not "be the first!", not a placeholder.
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { SnapOrientation } from "../components/SnapOverview";
import { PAGE_COPY } from "../lib/i18n/snap-page";
import { COUNT_FLOOR } from "../lib/live-counts";

describe("the hero tally is dormant until true", () => {
  it("renders nothing when no count is available", () => {
    const { container } = render(<SnapOrientation />);
    expect(container.querySelector(".dmex__tally")).toBeNull();
  });

  it("renders nothing below the floor", () => {
    const { container } = render(<SnapOrientation publicCount={COUNT_FLOOR - 1} />);
    expect(container.querySelector(".dmex__tally")).toBeNull();
  });

  it("renders the measured number at the floor and above", () => {
    const { container } = render(<SnapOrientation publicCount={COUNT_FLOOR} />);
    const tally = container.querySelector(".dmex__tally");
    expect(tally).toBeTruthy();
    expect(tally!.textContent).toContain(String(COUNT_FLOOR));
  });

  it("shows exactly the number it was given", () => {
    const { container } = render(<SnapOrientation publicCount={137} />);
    expect(container.querySelector(".dmex__tally")?.textContent).toContain("137");
  });

  it("the floor is high enough that the line can never understate its own smallness", () => {
    // 50 was picked with the approval: below it, "N questions answered" reads
    // as an admission, not social proof, and the card is better silent.
    expect(COUNT_FLOOR).toBeGreaterThanOrEqual(50);
  });
});

describe("the tally template carries no invented numbers", () => {
  it("exists in every language, holds the {n} slot, and contains no digits", () => {
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      const tpl = PAGE_COPY[lang].example.tally;
      expect(tpl?.trim(), lang).toBeTruthy();
      expect(tpl, `${lang} has the slot`).toContain("{n}");
      // The whole point: a copywriter (or a model) can never re-introduce
      // "Over 300" here. Digits only ever arrive through the slot.
      expect(tpl.replace("{n}", ""), `${lang} digit-free`).not.toMatch(/\d/);
    }
  });
});
