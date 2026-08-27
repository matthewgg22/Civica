// WCAG contrast, computed rather than eyeballed.
//
// This caught a real failure: --demeter-terracotta (#C0553B) on
// --demeter-paper (#F7F6F4) is 4.22:1, under the 4.5 that AA requires for
// normal text. It was the link colour, used as text in 20 rules, and had been
// live since the palette was written. Nobody sees a 4.22 — it looks fine to
// anyone whose vision is fine.
//
// The tokens are read FROM globals.css rather than restated here, so a palette
// edit is checked against the real values instead of a copy that would drift.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "..", "globals.css"), "utf8");

function token(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`token --${name} not found in globals.css`);
  return m[1]!;
}

/** Relative luminance, per WCAG 2.x. */
function luminance(hex: string): number {
  const [r, g, b] = hex
    .replace("#", "")
    .match(/../g)!
    .map((h) => {
      const v = parseInt(h, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Flatten `rgba(fg, alpha)` over an opaque background into the colour that
 *  actually reaches the eye. Contrast is a property of rendered pixels, not of
 *  the value written in the stylesheet. */
function composite(fg: string, alpha: number, bg: string): string {
  const f = fg.replace("#", "").match(/../g)!.map((h) => parseInt(h, 16));
  const b = bg.replace("#", "").match(/../g)!.map((h) => parseInt(h, 16));
  return (
    "#" +
    f
      .map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]!).toString(16).padStart(2, "0"))
      .join("")
  );
}

const PAPER = () => token("demeter-paper");
const CARD = () => token("demeter-card");

describe("Demeter palette contrast (WCAG AA)", () => {
  // 4.5:1 — normal text. Every foreground the design uses for READING, against
  // both backgrounds it can land on.
  it.each([
    ["demeter-ink", "headings and answers"],
    ["demeter-body", "running text"],
    ["demeter-muted", "labels and placeholders"],
    ["demeter-terracotta-deep", "links, marks, small text"],
  ])("%s clears 4.5:1 on paper and card (%s)", (name) => {
    const fg = token(name);
    expect(ratio(fg, PAPER()), `${name} on paper`).toBeGreaterThanOrEqual(4.5);
    expect(ratio(fg, CARD()), `${name} on card`).toBeGreaterThanOrEqual(4.5);
  });

  it("terracotta is NOT used as a text colour anywhere", () => {
    // The actual fix. terracotta is 4.22 on paper — it stays as a fill, a
    // border and a hover, and terracotta-deep does the reading. Asserted
    // against the stylesheet rather than against a number, because the number
    // passing on `card` (4.56) is exactly what made this easy to miss.
    const textUses = css.match(/(?<!border-)color:\s*var\(--demeter-terracotta\)\s*;/g) ?? [];
    expect(textUses, `terracotta used as text in ${textUses.length} rule(s)`).toHaveLength(0);
  });

  it("white on a terracotta fill still clears 4.5:1", () => {
    // Buttons. Kept honest in the other direction: if terracotta is ever
    // lightened to fix something else, the button label breaks instead.
    expect(ratio("#FFFFFF", token("demeter-terracotta"))).toBeGreaterThanOrEqual(4.5);
  });

  it("every footer alpha clears 4.5:1 once composited", () => {
    // The footer sets text with rgba() over graphite, so the effective colour
    // is a COMPOSITE — checking the source colour would be checking a value
    // that never appears on screen.
    //
    // This is not hypothetical: .dmft__org shipped at 0.45, which composites to
    // #807D7A and 3.97:1. Attribution is the least important line down there,
    // which is exactly why it got the lowest alpha and why nobody would have
    // looked. My first draft of this test approximated the composite by eye and
    // passed it — the approximation was lighter than the real value, so the
    // test was more permissive than the page.
    const GRAPHITE = "#22201E";
    // `color:` only. The footer also uses this rgba for a 0.16 divider BORDER,
    // and borders are not held to the text threshold — WCAG 1.4.11 asks 3:1 of
    // non-text contrast and exempts purely decorative rules. Matching every
    // rgba() would fail the divider for being a divider.
    const alphas = [...css.matchAll(/(?<!-)color:\s*rgba\(242,\s*239,\s*234,\s*([\d.]+)\)/g)].map(
      (m) => Number(m[1]),
    );
    expect(alphas.length, "no rgba footer colours found — did the footer change?").toBeGreaterThan(
      0,
    );
    for (const a of alphas) {
      const composited = composite("#F2EFEA", a, GRAPHITE);
      expect(ratio(composited, GRAPHITE), `alpha ${a} → ${composited}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("anything set on a wheat fill is readable on it", () => {
  // Wheat is the loudest surface in the palette and the darkest text still
  // clears it easily — ink is 9.47:1 — so a failure here means someone
  // reached for white, which is 1.68:1. That shipped for exactly one commit
  // on the back pill.
  //
  // The token rules above could not catch it: they check token-on-token
  // pairs, and #FFFFFF is not a token. This one reads the actual rules
  // instead, so it holds whatever colour someone writes.
  const WHEAT = token("demeter-wheat");

  /** Every rule body that paints a wheat background. */
  const wheatRules = [...css.matchAll(/\{([^}]*background:\s*var\(--demeter-wheat\)[^}]*)\}/g)].map(
    (m) => m[1],
  );

  it("finds the wheat controls at all", () => {
    // Without this the assertion below passes by finding nothing.
    expect(wheatRules.length).toBeGreaterThan(0);
  });

  it.each(wheatRules.map((r, i) => [i, r] as const))("wheat rule %i", (_i, rule) => {
    const m = rule.match(/(?<!-)color:\s*(#[0-9A-Fa-f]{6}|var\(--([\w-]+)\))/);
    if (!m) return; // inherits its colour; nothing asserted here
    const fg = m[2] ? token(m[2]) : m[1];
    expect(
      ratio(fg, WHEAT),
      `${fg} on wheat is ${ratio(fg, WHEAT).toFixed(2)}:1 — AA needs 4.5`,
    ).toBeGreaterThanOrEqual(4.5);
  });
});
