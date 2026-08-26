// @vitest-environment jsdom
//
// Pre-chat framing (#898 P2-6) + save-panel spacing (#898 P2-7).
//
// P2-6: the empty chat used to open with only "What would you like to know?"
// and one line about citations. A real 25-turn tester (2026-08-20) reached the
// end of a full conversation without ever having been told the two things the
// framing exists to say: that SNAP is rule-and-formula work this chat can walk
// through, and that there are TWO modes — asking to learn, versus building an
// estimate that drafts an application outline. The framing paragraph must name
// both modes BY THEIR ACTUAL LABELS, in every language, so renaming a mode
// without updating the framing fails here instead of quietly orphaning it.
//
// P2-7: the save panel's three <p> elements carried browser-default margins
// (measured live: 16.15px / 14.45px / 13.26px — three different sizes, because
// each 1em tracks its font-size) stacked on top of the panel's flex gap. The
// global reset zeroes only html/body, not p. The same tester flagged the panel
// as "visually off" — the gaps were large AND uneven. The fix is a CSS rule;
// this pins its existence so a stylesheet refactor can't silently drop it.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PackMeta } from "@civica/demeter-engine/packs";

import { DemeterChat } from "../DemeterChat";
import { T } from "../../lib/i18n/demeter-chat-copy";

const LOCALES = ["en", "es", "vi", "zh"] as const;

// jsdom has no Element.scrollTo; DemeterChat calls it on mount to follow the
// transcript. Same stub as the other DemeterChat render suites.
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

const verification = {
  verified_on: "2026-08-05",
  method: "test fixture",
  gates: "n/a",
  sources: [],
};
const STATES: PackMeta[] = [
  {
    code: "MA",
    program: "Massachusetts SNAP",
    agency: "DTA",
    adminModel: "state",
    portal: undefined,
    verified: true,
    verification,
  },
];

describe("empty-chat framing (#898 P2-6)", () => {
  afterEach(cleanup);

  it("every locale's framing names both modes by their real labels", () => {
    for (const locale of LOCALES) {
      const copy = T[locale];
      expect(copy.emptyModes?.trim(), locale).toBeTruthy();
      // The labels the toggle actually renders — if a mode is renamed, the
      // framing must follow or this fails.
      expect(copy.emptyModes, `${locale} names the ask mode`).toContain(copy.worksheet.modeAsk);
      expect(copy.emptyModes, `${locale} names the estimate mode`).toContain(
        copy.worksheet.modeEstimate,
      );
    }
  });

  it("renders in the empty state, before any message is sent", () => {
    render(<DemeterChat states={STATES} />);
    expect(screen.getByText(T.en.emptyTitle)).toBeTruthy();
    // The mode labels are wrapped for emphasis, so the sentence spans several
    // nodes — assert the paragraph's assembled text instead of a single node.
    expect(document.querySelector(".demeter__emptymodes")?.textContent).toBe(T.en.emptyModes);
  });
});

describe("save-panel paragraph margins (#898 P2-7)", () => {
  it("globals.css zeroes the UA paragraph margins inside the save panel", () => {
    const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");
    // The panel spaces its children with flex gap; UA <p> margins stacked on
    // top of it were the measured bug. Any rule that zeroes p margins scoped
    // to the panel satisfies this.
    expect(css).toMatch(/\.demeter__savepanel\s+p\s*\{[^}]*margin:\s*0/);
  });
});
