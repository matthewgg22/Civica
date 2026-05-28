import { describe, it, expect } from "vitest";
import { normalizeFindingDate } from "../findings-date";

describe("normalizeFindingDate", () => {
  // Regression: YAML coerces an unquoted `date: 2026-05-28` into a JS Date.
  // The loader used to do String(date), which rendered
  // "Thu May 28 2026 00:00:00 GMT+0000 (Coordinated Universal Time)" in the
  // UI and broke month grouping (slice(0,7) → "Thu May" → "THU MAY" header).
  it("normalizes a YAML-parsed Date (UTC midnight) to ISO YYYY-MM-DD", () => {
    const yamlDate = new Date("2026-05-28T00:00:00Z");
    expect(normalizeFindingDate(yamlDate)).toBe("2026-05-28");
  });

  it("never returns a JS Date locale string", () => {
    const out = normalizeFindingDate(new Date("2026-05-28T00:00:00Z"));
    expect(out).not.toMatch(/GMT|Coordinated Universal Time|Thu|May/);
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("passes through an already-ISO date string", () => {
    expect(normalizeFindingDate("2026-05-28")).toBe("2026-05-28");
  });

  it("truncates an ISO datetime string to the date portion", () => {
    expect(normalizeFindingDate("2026-05-28T13:45:00Z")).toBe("2026-05-28");
  });

  it("month grouping key (slice 0,7) is YYYY-MM, not 'Thu May'", () => {
    const date = normalizeFindingDate(new Date("2026-05-28T00:00:00Z"));
    expect(date.slice(0, 7)).toBe("2026-05");
  });

  it("returns empty string for unparseable / missing input", () => {
    expect(normalizeFindingDate(undefined)).toBe("");
    expect(normalizeFindingDate(null)).toBe("");
    expect(normalizeFindingDate(42)).toBe("");
    expect(normalizeFindingDate(new Date("not-a-date"))).toBe("");
  });
});
