// CSS invariants that shipped broken and were only found by looking.
//
// jsdom does not apply stylesheets, so no render test can catch these. What a
// test CAN do is read globals.css and assert the specific rules whose absence
// produced a visible defect. Narrow on purpose: this is not a linter, it is a
// list of mistakes already made.
//
// The pattern behind all of them: a rule written for one component, left in
// place when that component changed, silently combining with its replacement.
// CSS merges declarations rather than replacing rules, so a stale rule is
// invisible in the source and obvious on screen.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "..", "globals.css"), "utf8");

/** The declarations inside a rule, for the FIRST block matching a selector. */
function ruleBody(selector: string): string {
  const i = css.indexOf(`\n${selector} {`);
  if (i === -1) throw new Error(`no rule for ${selector}`);
  return css.slice(i, css.indexOf("}", i));
}

describe("Demeter CSS invariants", () => {
  it("the language wrapper draws no pill of its own", () => {
    // It carried border + radius + padding from when the control was a
    // <button>. The <select> inside draws its own, so the control shipped with
    // two concentric terracotta rings.
    const body = ruleBody(".demeter__lang");
    expect(body).not.toMatch(/border:/);
    expect(body).not.toMatch(/border-radius:/);
  });

  it("the language select is not wearing the accent colour", () => {
    // Terracotta is for CTAs, links and the mark. A language switcher styled
    // like a primary button competes with the button that starts a
    // conversation. Hover may use it — that means "interactive", not "act here".
    const body = ruleBody(".demeter__lang-select");
    expect(body).not.toMatch(/color:\s*var\(--demeter-terracotta\)/);
    expect(body).not.toMatch(/border:[^;]*--demeter-terracotta\)/);
  });

  it("the entry card does not re-declare its wrapper's chrome", () => {
    // .dmpage__chat already carries background, border, radius and shadow. When
    // .dment added them too, the result was a card inside an identical card —
    // the same defect as the language pill, introduced in the very commit that
    // fixed it, and invisible until rendered.
    const body = ruleBody(".dment");
    for (const prop of ["background:", "border:", "border-radius:", "box-shadow:"]) {
      expect(body, `.dment re-declares ${prop}`).not.toContain(prop);
    }
    // And the wrapper still has them, so this is a division of labour rather
    // than the chrome having gone missing entirely.
    expect(ruleBody(".dmpage__chat")).toContain("box-shadow:");
  });

  it("every uppercase label is heavier than the body text it introduces", () => {
    // The whole set rendered at weight 400 above 16.5px serif body — also
    // weight 400 — so a definition TERM read lighter than its definition. The
    // fix is one grouped rule; this asserts it still covers the classes that
    // were wrong, since adding a label and forgetting the list is silent.
    const i = css.indexOf("THE LABEL RECIPE");
    expect(i, "the label recipe block is gone").toBeGreaterThan(-1);
    const block = css.slice(i, css.indexOf("}", i));
    for (const sel of [
      ".dmo__eyebrow",
      ".dmx__eyebrow",
      ".dmx__def dt",
      ".dmx__trustrow dt",
      ".dmw__eyebrow",
      ".dmw__result-label",
    ]) {
      expect(block, `${sel} missing from the label recipe`).toContain(sel);
    }
    expect(block).toMatch(/font-weight:\s*600/);
  });

  it("message motion exists and is reducible", () => {
    // There were no message animations at all, which is why sending read as a
    // state swap. Motion added is motion that must be droppable.
    expect(css).toContain("@keyframes dmMsgIn");
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    const reduced = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(reduced).toContain(".demeter__msg");
  });
});
