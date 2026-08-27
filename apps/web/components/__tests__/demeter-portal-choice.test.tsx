// @vitest-environment jsdom
//
// The "Apply at …" button (owner, 2026-08-27): "long named states look off;
// also if there are two different ones the chatbot should ask which one you
// are".
//
// New York read:
//   Apply at myBenefits.ny.gov (statewide EXCEPT NYC; NYC uses ACCESS HRA) →
//
// TWO FAULTS, AND THE PACK ALREADY NAMED BOTH. The portal shape documents
// `name` as "MODEL-FACING; may carry a trailing annotation. Show `short`" and
// `note` as "the only warning on the row — New York's portal does not cover
// NYC. Never drop it." The chat showed `name` and dropped `note`: it put the
// warning inside a button, which is where nobody reads one, and made the
// label long enough to wrap.
//
// And a second portal is not an annotation. Roughly eight million people live
// in New York City; asserting the statewide portal and burying "except NYC"
// hands all of them the wrong form. That is a question, so it gets asked.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

const src = readFileSync(join(__dirname, "..", "DemeterChat.tsx"), "utf8");
const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");

describe("the button shows a name, not an annotation", () => {
  it("builds the label from `short`", () => {
    const i = src.indexOf("const cta = (label: string, url: string) =>");
    expect(i, "the cta builder").toBeGreaterThan(-1);
    expect(src).toContain("cta(pack.portal.short, pack.portal.url)");
    expect(src, "the model-facing field is back in the button").not.toContain(
      '.replace("{portal}", pack.portal.name)',
    );
  });

  it("still renders the annotation, just not inside the button", () => {
    // "Never drop it" is the pack's own instruction.
    expect(src).toContain("pack.portal.note ? [`_${pack.portal.note}_`] : []");
  });
});

describe("two portals are a question", () => {
  it("New York carries its second one as data, not as prose in a label", () => {
    const ny = VERIFIED_STATES.find((s) => s.code === "NY")!;
    expect(ny.portal, "NY has a portal").toBeTruthy();
    const alt = ny.portal!.alternate;
    expect(alt, "NY's NYC portal is not modelled").toBeTruthy();
    expect(alt!.short).toBe("ACCESS HRA");
    expect(alt!.url).toMatch(/^https:\/\//);
    // Both halves of the choice have to name who they are for, or the
    // question cannot be answered by the person reading it.
    expect(alt!.when.trim().length).toBeGreaterThan(0);
    expect(alt!.otherwise.trim().length).toBeGreaterThan(0);
    // And the primary's own label stays a name.
    expect(ny.portal!.short).toBe("myBenefits.ny.gov");
  });

  it("asks, and offers both, rather than asserting one", () => {
    expect(src).toContain("t.portalTwo.replace(\"{state}\", name)");
    expect(src).toContain("cta(alt.short, alt.url)");
    expect(src, "the alternate's condition is shown").toContain("`**${alt.when}**`");
    expect(src, "the primary's condition is shown").toContain("`**${alt.otherwise}**`");
  });

  it("has the question in every language", () => {
    const copy = readFileSync(
      join(__dirname, "..", "..", "lib", "i18n", "demeter-chat-copy.ts"),
      "utf8",
    );
    expect((copy.match(/^\s*portalTwo: "/gm) ?? []).length, "one per language").toBe(4);
    // A copy table with a missing key renders `undefined` to that reader.
    expect((copy.match(/^\s*portalLead: "/gm) ?? []).length).toBe(4);
  });

  it("leaves single-portal states alone", () => {
    // Only NY should be answering a question nobody else has.
    const withAlt = VERIFIED_STATES.filter((s) => s.portal?.alternate).map((s) => s.code);
    expect(withAlt).toEqual(["NY"]);
  });
});

describe("the button survives a long label", () => {
  it("does not lay the arrow out as a flex sibling", () => {
    // As a flex row the label and the arrow were two ITEMS, so a wrapped
    // label left the arrow centred against the whole two-line block — out at
    // the right edge, level with neither line.
    const rule = css.match(/^\.demeter__gocta\s*\{[^}]*\}/m)?.[0] ?? "";
    expect(rule, ".demeter__gocta is declared").not.toBe("");
    expect(rule, "the arrow is a flex sibling again").not.toMatch(/display:\s*inline-flex/);
    expect(rule).toMatch(/display:\s*inline-block/);
    // Vertical padding, so a second line has somewhere to go.
    expect(rule).toMatch(/padding:\s*0\.\d+rem/);
    expect(rule).toMatch(/max-width:\s*100%/);
  });
});
