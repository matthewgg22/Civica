/**
 * Regression test for the T11 contrast sweep — DESIGN.md §6.6 forbids
 * text-muted on captions <12px (fails WCAG AA at footnote sizes).
 *
 * The sweep migrated 324 instances across 88 files from text-muted to
 * text-graphite. This test asserts that no NEW class combination of
 * text-[10px] or text-[11px] together with text-muted appears in
 * dashboard source after the migration.
 *
 * Run as a source-grep "lint-as-test" pattern — the same approach used
 * by color-tokens-regression.test.tsx (DESIGN.md §8 audit).
 */
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

function grepCount(pattern: string): number {
  // grep -rnE returns non-zero exit when no matches; swallow it.
  try {
    const out = execSync(
      `grep -rnE "${pattern}" "${ROOT}/app" "${ROOT}/components" --include="*.tsx" 2>/dev/null`,
      { encoding: "utf8" }
    );
    return out.split("\n").filter((line) => line.trim().length > 0).length;
  } catch {
    return 0;
  }
}

describe("contrast — DESIGN.md §6.6 text-muted at <12px regression", () => {
  it("no line contains both text-[10px] and text-muted", () => {
    const offenders = grepCount('text-\\[10px\\]');
    if (offenders === 0) {
      // No 10px text in repo at all; nothing to assert.
      return;
    }
    // Count lines with both text-[10px] AND text-muted
    const both = execSync(
      `grep -rnE "text-\\[10px\\]" "${ROOT}/app" "${ROOT}/components" --include="*.tsx" 2>/dev/null | grep "text-muted" | grep -v "__tests__" || true`,
      { encoding: "utf8" }
    );
    const offending = both.split("\n").filter((line) => line.trim().length > 0);
    expect(
      offending,
      `Found text-muted co-located with text-[10px] (fails WCAG AA per DESIGN.md §6.6). Use text-graphite for captions <12px.`
    ).toEqual([]);
  });

  it("no line contains both text-[11px] and text-muted", () => {
    const both = execSync(
      `grep -rnE "text-\\[11px\\]" "${ROOT}/app" "${ROOT}/components" --include="*.tsx" 2>/dev/null | grep "text-muted" | grep -v "__tests__" || true`,
      { encoding: "utf8" }
    );
    const offending = both.split("\n").filter((line) => line.trim().length > 0);
    expect(
      offending,
      `Found text-muted co-located with text-[11px] (fails WCAG AA per DESIGN.md §6.6). Use text-graphite for captions <12px.`
    ).toEqual([]);
  });
});
