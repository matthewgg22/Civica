// Date normalization for the findings ledger loader.
//
// Extracted from lib/findings.ts so it can be unit-tested directly:
// findings.ts imports "server-only" and reads the filesystem at module
// load, both of which make it unimportable from a plain node test env.
// This module is pure and dependency-free.

/**
 * Normalize a frontmatter `date` value to an ISO `YYYY-MM-DD` string.
 *
 * YAML auto-coerces an unquoted `date: 2026-05-28` into a JS Date (UTC
 * midnight). A naive `String(date)` yields the locale string
 * "Thu May 28 2026 00:00:00 GMT+0000 (Coordinated Universal Time)", which
 * then breaks month grouping (`slice(0, 7)` → "Thu May"). Handle both a
 * Date object and an already-string value (quoted in frontmatter, or an
 * ISO datetime). Returns "" for anything unparseable.
 */
export function normalizeFindingDate(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "string") return v.slice(0, 10);
  return "";
}
