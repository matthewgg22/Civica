// /screen/saved — the conversations list.
//
// Owner, 2026-08-26: "when i hit saved, it goes to very poor designed
// conversation tab that is very AI". Three things made it read that way, and
// each was a rule this product already had written down:
//
//   1. NO CHROME. A bare heading on white, reached from a rail that carries
//      the brand and every control, and offering no route back to the one
//      thing the page is about. Landing here was landing nowhere.
//   2. THE WRONG FACE. `.saved` set the SANS at its root, so the intro and
//      the empty state — body copy — rendered in the label face, against
//      DEMETER-DESIGN §4 ("body copy → the serif; buttons, eyebrows,
//      badges → the sans").
//   3. A CENTRED CARD IN AN EMPTY VIEWPORT. Centred text in a bordered box
//      with a rounded-rect button floating in white space.
//
// These pin the fixes, and the copy parity that a fourth language quietly
// breaks.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");
const page = readFileSync(join(__dirname, "..", "app", "screen", "saved", "page.tsx"), "utf8");
const rule = (sel: string) =>
  css.match(new RegExp(`^${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[^}]*\\}`, "m"))?.[0] ?? "";

describe("the page speaks in Demeter's voice", () => {
  it("sets the SERIF at the root, not the label face", () => {
    const root = rule(".saved");
    expect(root, ".saved is declared").not.toBe("");
    expect(root).toMatch(/font-family:\s*var\(--demeter-font-display\)/);
    // Every serif site must carry its CJK fallback or Chinese silently drops
    // to a system default mid-paragraph (DEMETER-DESIGN §4).
    expect(root).toContain("--demeter-font-serif-cjk");
  });

  it("keeps the sans for the things that really are labels", () => {
    // The distinction is the whole point of taking the grey off the prose:
    // --demeter-muted is for labels, and the row's state-and-date line is one.
    const meta = rule(".saved__meta");
    expect(meta).toMatch(/font-family:\s*var\(--demeter-font-sans\)/);
    expect(meta).toMatch(/color:\s*var\(--demeter-muted\)/);
    // Buttons are label-face too.
    for (const sel of [".saved__open", ".saved__delete", ".saved__empty-cta", ".saved__back"]) {
      expect(rule(sel), sel).toMatch(/font-family:\s*var\(--demeter-font-sans\)/);
    }
  });

  it("takes the grey off the page's actual prose", () => {
    for (const sel of [".saved__intro", ".saved__empty-body"]) {
      expect(rule(sel), sel).not.toMatch(/color:\s*var\(--demeter-muted\)/);
      expect(rule(sel), sel).toMatch(/color:\s*var\(--demeter-ink\)/);
    }
  });
});

describe("the empty list is not an event", () => {
  it("is neither centred nor boxed", () => {
    const empty = rule(".saved__empty");
    expect(empty, ".saved__empty is declared").not.toBe("");
    expect(empty, "centred text was the generated-empty-state tell").not.toMatch(/text-align:\s*center/);
    expect(empty, "and so was the floating bordered card").not.toMatch(/border:\s*1px/);
  });

  it("offers its action as the pill the rest of the product uses", () => {
    for (const sel of [".saved__empty-cta", ".saved__open", ".saved__delete"]) {
      expect(rule(sel), sel).toMatch(/border-radius:\s*var\(--demeter-radius-pill\)/);
    }
  });

  it("no longer tells anyone to press a button that saves for them now", () => {
    // Auto-save landed the same day. Copy instructing a manual "Save this
    // conversation" would be describing a product that no longer exists.
    expect(page).not.toContain("Save this conversation");
    expect(page).toContain("kept here");
  });
});

describe("there is a way back", () => {
  it("carries the brand and a return to the chat", () => {
    expect(page).toContain("saved__brand");
    expect(page).toContain("DemeterMark");
    expect(page).toContain("saved__back");
    expect(rule(".saved__top"), ".saved__top is declared").not.toBe("");
  });

  it("has the return label in every language the page ships", () => {
    // A copy table with a missing key renders `undefined` to a reader in that
    // language — the failure mode that parity tests exist for.
    const langs = page.match(/^  (en|es|vi|zh): \{$/gm) ?? [];
    expect(langs.length, "four language blocks").toBe(4);
    expect((page.match(/^    back: "/gm) ?? []).length, "one `back` per language").toBe(4);
  });
});
