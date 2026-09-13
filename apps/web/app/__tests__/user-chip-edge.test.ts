// The reader's own chip has to have an edge you can actually see.
//
// It was `1px solid var(--demeter-rule)` — #E8E6E2, which is 1.25:1 against
// the white ground. The fill beside it (--demeter-tint, #F6F5F3) is 1.09:1.
// So the one element distinguishing what the PERSON said from what the product
// said was, in practice, invisible: a near-white shape on white behind a line
// nobody can see. Thickening that line was the obvious move and the wrong one
// — a wider invisible line is still invisible. The colour had to change.
//
// WCAG 1.4.11 asks 3:1 of a non-text boundary that carries meaning, and this
// one carries the whole distinction between the two voices.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "..", "globals.css"), "utf8");

function token(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1]!;
}
function luminance(hex: string): number {
  const [r, g, b] = hex.replace("#", "").match(/../g)!.map((h) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("the reader's chip is distinguishable from the product's voice", () => {
  it("edges the chip at 3:1 or better against the ground", () => {
    const edge = token("demeter-user-edge");
    const ground = token("demeter-paper");
    expect(
      ratio(edge, ground),
      `--demeter-user-edge is ${ratio(edge, ground).toFixed(2)}:1 on the ground — a boundary needs 3`,
    ).toBeGreaterThanOrEqual(3);
  });

  it("actually uses that token on the chip, not the invisible hairline", () => {
    const rule = css.match(/\.demeter__msg--user\s*\{[^}]*\}/)![0];
    expect(rule).toMatch(/border:\s*1px solid var\(--demeter-user-edge\)/);
    // The regression: the two tokens that cannot carry this boundary.
    expect(rule).not.toMatch(/border:[^;]*var\(--demeter-rule\)/);
    expect(rule).not.toMatch(/border:[^;]*var\(--demeter-rule-strong\)/);
  });

  it("keeps the chip neutral — terracotta is for actions, not the reader's words", () => {
    const rule = css.match(/\.demeter__msg--user\s*\{[^}]*\}/)![0];
    expect(rule).not.toMatch(/terracotta/);
  });

  it("leaves the product's own turn unboxed, so only one voice wears a chip", () => {
    const rule = css.match(/\.demeter__msg--assistant\s*\{[^}]*\}/)![0];
    expect(rule).toMatch(/border:\s*0/);
    expect(rule).toMatch(/background:\s*transparent/);
  });
});
