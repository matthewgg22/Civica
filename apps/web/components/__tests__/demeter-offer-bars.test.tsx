// @vitest-environment jsdom
//
// The two offer bars, and the estimate panel's repeated line
// (owner, 2026-08-27).
//
// THE BARS CAN APPEAR STACKED — "Want me to gather your answers…" directly
// above "You mentioned California…" — and they read as one control when they
// agree and as a trick when they do not. The filled button was on the RIGHT in
// one and the LEFT in the other, so the same tap position meant "yes" in one
// row and "no" in the next.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "DemeterChat.tsx"), "utf8");
const worksheet = readFileSync(join(__dirname, "..", "DemeterWorksheet.tsx"), "utf8");

/** Where each bar's two buttons sit, in DOM order. */
function order(bar: "modeoffer" | "stateoffer"): string[] {
  const open = src.indexOf(`className="demeter__${bar}-actions"`);
  expect(open, `${bar} actions block`).toBeGreaterThan(-1);
  const block = src.slice(open, src.indexOf("</span>", open));
  return [...block.matchAll(new RegExp(`demeter__${bar}-(yes|no)`, "g"))].map((m) => m[1]!);
}

describe("the two offer bars agree", () => {
  it("puts decline first and the filled accept last, in both", () => {
    expect(order("modeoffer")).toEqual(["no", "yes"]);
    expect(order("stateoffer"), "the state bar still runs the other way").toEqual(["no", "yes"]);
  });

  it("means the same tap position means the same thing in both", () => {
    // The point of the above, stated as the thing that actually matters.
    expect(order("modeoffer")).toEqual(order("stateoffer"));
  });
});

describe("the estimate says it once", () => {
  it("drops the summary when it only restates the label", () => {
    // With nothing to work from the label reads "Not enough information" and
    // the summary read "Not enough yet to work out an estimate." — the same
    // sentence twice, stacked, in a panel whose job is to be scanned. The
    // list of what is still needed sits below and is the part that helps.
    expect(worksheet).toContain('classification!.outcome !== "not_enough_information" && (');
    const i = worksheet.indexOf("dmw__result-value");
    const block = worksheet.slice(i, i + 900);
    expect(block).toContain("dmw__result-summary");
    // The guard has to come BEFORE the summary, or it guards nothing.
    expect(
      block.indexOf('!== "not_enough_information"'),
      "the summary is rendered unguarded",
    ).toBeLessThan(block.indexOf("dmw__result-summary"));
  });

  it("keeps the summary for every other outcome", () => {
    // Those summaries ADD to their label; only this one repeated it.
    expect(worksheet).toContain("{classification!.summary}");
  });
});
