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
import { readFileSync } from "node:fs";
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

/**
 * Regression for the live /design-review (deployed /login) finding: form
 * inputs used border-hairline (rgba(0,0,0,0.12), ~1.2:1) which fails WCAG
 * 1.4.11 (UI component boundaries need 3:1). They now use a dedicated
 * --color-input token (rgba(0,0,0,0.45), ~3.25:1 vs the paper fill). The
 * decorative hairline is intentionally left faint and is exempt.
 */
describe("form-input border — WCAG 1.4.11 perceivable boundary", () => {
  const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

  it("globals.css defines the dedicated --color-input token", () => {
    expect(read("app/globals.css")).toContain("--color-input: rgba(0, 0, 0, 0.45)");
  });

  it("login inputs use border-input, not the faint border-hairline", () => {
    const src = read("app/login/page.tsx");
    expect(src).toContain("border border-input rounded-[3px] px-3 py-2.5 text-[15px] bg-paper");
    expect(src).not.toContain("border border-hairline rounded-[3px] px-3 py-2.5");
  });

  it("deductions form inputs use border-input, not border-hairline", () => {
    const src = read("app/tools/deductions/page.tsx");
    expect(src).toContain("border border-input rounded-[3px] px-3 py-2 text-[13px] bg-paper");
    expect(src).not.toContain("const input = \"w-full border border-hairline");
  });
});
