/**
 * Regression test for the global-error.tsx stylesheet-independence invariant.
 *
 * global-error.tsx is Next.js's LAST-resort error boundary — it renders only
 * when the root layout itself throws (font load failure, top-level import
 * crash, etc.). At that point globals.css may not have loaded, so the
 * component MUST be self-contained: every color is an inline hex/rgba
 * literal, never a CSS custom property (var(--…)) that would resolve to
 * nothing without the stylesheet.
 *
 * The bug this guards against: PR3's bulk hex→token sweep (#347) swept one
 * line of global-error.tsx from "#B5511E" to "var(--color-warning)",
 * silently breaking the warning-eyebrow color whenever global-error actually
 * renders. Fixed in the follow-up; same bug class as the Satori opengraph
 * CSS-var bug (#352). This test makes the invariant enforceable so a future
 * sweep can't re-break it.
 *
 * "Lint as test" pattern: reads source, asserts on substrings. No render.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const GLOBAL_ERROR = join(__dirname, "..", "global-error.tsx");

describe("global-error.tsx stylesheet independence", () => {
  it("uses no CSS custom properties in style values (globals.css may be absent)", () => {
    const src = readFileSync(GLOBAL_ERROR, "utf8");
    // Strip line comments so the explanatory comment (which mentions
    // var(--color-warning) in prose) doesn't trip the assertion.
    const codeOnly = src
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const cssVarMatches = codeOnly.match(/var\(--[a-z-]+\)/g) ?? [];
    expect(
      cssVarMatches,
      "global-error.tsx must not reference CSS variables — it renders when " +
        "the root layout failed and globals.css may not be loaded. Use inline " +
        "hex/rgba literals instead."
    ).toEqual([]);
  });

  it("declares the warning eyebrow as an inline hex literal", () => {
    const src = readFileSync(GLOBAL_ERROR, "utf8");
    // The status eyebrow ("500 Internal Server Error") must carry the
    // warning color as a hex literal. #B5511E === --color-warning.
    expect(src).toMatch(/color:\s*"#B5511E"/);
  });
});
