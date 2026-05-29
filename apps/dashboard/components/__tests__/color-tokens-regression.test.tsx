/**
 * Regression test for the DESIGN.md §8 amber-audit migration (PR3).
 *
 * Each assertion catches a specific class of reversion:
 *  - Positive-outcome surfaces (recertified bucket, mineToday notes, stage_60
 *    cadence chip) MUST stay text-amber/bg-amber.
 *  - Warning surfaces (HandoffPanel disabledReason, MissingItemRequestPanel
 *    pending, APIVerificationPanel "Flagged for review") MUST be text-warning.
 *  - Design-system-bypass components (MissedElectionsPanel,
 *    QcCategoryCoverage, ShelterAllocationPanel) MUST use the --color-amber
 *    token (bg-amber/N) not the raw Tailwind palette (bg-amber-NNN).
 *
 * The test reads source files and asserts substring presence/absence. This
 * is a deliberate "lint as test" pattern — it catches accidental
 * find-and-replace mistakes without requiring rendering.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("color tokens — DESIGN.md §8 amber audit regression", () => {
  describe("positive-outcome surfaces stay text-amber (must NOT migrate)", () => {
    it("recertified bucket in /enrollments stays text-amber", () => {
      const src = read("app/enrollments/page.tsx");
      expect(src).toMatch(/recertified:\s*\{[^}]*accent:\s*"text-amber"/);
    });

    it("mineToday.notes count on /dashboard stays text-amber", () => {
      const src = read("app/dashboard/page.tsx");
      expect(src).toMatch(/text-amber[^"]*">\{mineToday\.notes\}/);
    });

    it("stage_60 cadence chip in /enrollments stays text-amber", () => {
      const src = read("app/enrollments/page.tsx");
      expect(src).toMatch(/stage_60:\s*\{[^}]*chipFg:\s*"text-amber"/);
    });
  });

  describe("warning-context surfaces became text-warning (must migrate)", () => {
    it("HandoffPanel disabledReason uses text-warning, not text-amber", () => {
      const src = read("components/HandoffPanel.tsx");
      expect(src).toMatch(/text-warning">\{disabledReason\}/);
      expect(src).not.toMatch(/text-amber">\{disabledReason\}/);
    });

    it("MissingItemRequestPanel pending status uses bg-warning/text-warning", () => {
      const src = read("components/MissingItemRequestPanel.tsx");
      expect(src).toContain('pending: "bg-warning/15 text-warning"');
      expect(src).not.toContain('pending: "bg-amber/15 text-amber"');
    });

    it("APIVerificationPanel flagged-row warning text uses text-warning", () => {
      const src = read("components/APIVerificationPanel.tsx");
      // "Partial extraction" advisory + "Missing unit" delivery chip + flagged glyph
      expect(src).toContain("text-warning italic\">Partial extraction");
      expect(src).toContain('"deliverable-missing-unit"');
      expect(src).toContain('cls: "bg-warning/15 text-warning"');
      expect(src).toContain('<span className="text-warning text-[16px] shrink-0">⚑');
    });
  });

  describe("design-system bypasses use --color-amber token (no Tailwind palette)", () => {
    it("MissedElectionsPanel uses bg-amber/N tokens, not amber-NN palette", () => {
      const src = read("components/MissedElectionsPanel.tsx");
      expect(src).not.toMatch(/bg-amber-(50|100|200|500|700)/);
      expect(src).not.toMatch(/text-amber-(700|800)/);
      expect(src).not.toMatch(/border-amber-(200)/);
    });

    it("QcCategoryCoverage uses bg-amber/N tokens, not amber-NN palette", () => {
      const src = read("components/QcCategoryCoverage.tsx");
      expect(src).not.toMatch(/bg-amber-500\//);
      expect(src).not.toMatch(/text-amber-700/);
    });

    it("ShelterAllocationPanel uses bg-amber/N tokens, not amber-NN palette", () => {
      const src = read("components/ShelterAllocationPanel.tsx");
      expect(src).not.toMatch(/bg-amber-(50|100|200)/);
      expect(src).not.toMatch(/text-amber-(700|800)/);
      expect(src).not.toMatch(/border-amber-200/);
    });
  });

  describe("hex-literal sweep uses CSS vars or named tokens", () => {
    it("/compliance hero stats use var(--color-wheat), not #E8C547", () => {
      const src = read("app/compliance/page.tsx");
      // The hero numerals + footnote dots
      expect(src).toContain("var(--color-wheat)");
      // The only #E8C547 left should be the DESIGN.md doc-comment header
      // describing the wheat token semantically. The PILOT_STATUS_META block
      // uses var(--color-wheat) text on a dark surface (matches DESIGN.md §1).
      const inlineHexCount = (src.match(/style=\{\{[^}]*"#E8C547"/g) ?? []).length;
      expect(inlineHexCount).toBe(0);
    });

    it("globals.css declares --color-amber-dark token", () => {
      const src = read("app/globals.css");
      expect(src).toContain("--color-amber-dark: #9A5A14");
    });
  });
});
