// Anchor-coverage tests for the expanded zip-to-county seed (TODO-6).
//
// Asserts that every CA county (58) and every MA county (14) has at least
// one anchor ZIP in the table, so the fast path covers the full county
// space even when individual ZIPs miss. The lookup names must also match
// the agency-directory's canonical county names exactly, or the join
// downstream breaks silently.

import { describe, expect, it } from "vitest";
import zipTable from "../src/fips/data/zip-to-county.json" with { type: "json" };

interface Entry {
  fips: string;
  county_name: string;
}

const ENTRIES = Object.entries(zipTable).filter(
  ([k]) => !k.startsWith("_"),
) as Array<[string, Entry]>;

const CA_COUNTY_FIPS = new Set(
  Array.from({ length: 58 }, (_, i) => `06${String(i * 2 + 1).padStart(3, "0")}`),
);
const MA_COUNTY_FIPS = new Set([
  "25001", "25003", "25005", "25007", "25009", "25011", "25013",
  "25015", "25017", "25019", "25021", "25023", "25025", "25027",
]);

describe("zip-to-county anchor coverage", () => {
  it("covers all 58 CA counties with at least one anchor ZIP", () => {
    const covered = new Set(
      ENTRIES.filter(([, v]) => v.fips.startsWith("06")).map(([, v]) => v.fips),
    );
    const missing = [...CA_COUNTY_FIPS].filter((f) => !covered.has(f));
    expect(missing, `missing CA counties: ${missing.join(", ")}`).toEqual([]);
  });

  it("covers all 14 MA counties with at least one anchor ZIP", () => {
    const covered = new Set(
      ENTRIES.filter(([, v]) => v.fips.startsWith("25")).map(([, v]) => v.fips),
    );
    const missing = [...MA_COUNTY_FIPS].filter((f) => !covered.has(f));
    expect(missing, `missing MA counties: ${missing.join(", ")}`).toEqual([]);
  });

  it("every entry uses a 5-digit FIPS string", () => {
    for (const [zip, entry] of ENTRIES) {
      expect(entry.fips, `entry for ZIP ${zip}`).toMatch(/^\d{5}$/);
    }
  });

  it("every entry uses a 5-digit ZIP key", () => {
    for (const [zip] of ENTRIES) {
      expect(zip).toMatch(/^\d{5}$/);
    }
  });

  it("every entry's FIPS state prefix matches CA (06) or MA (25)", () => {
    for (const [zip, entry] of ENTRIES) {
      const state = entry.fips.slice(0, 2);
      expect(state, `ZIP ${zip}`).toMatch(/^(06|25)$/);
    }
  });

  it("county_name is consistent for any FIPS that appears in multiple ZIP entries", () => {
    const byFips = new Map<string, Set<string>>();
    for (const [, v] of ENTRIES) {
      const set = byFips.get(v.fips) ?? new Set<string>();
      set.add(v.county_name);
      byFips.set(v.fips, set);
    }
    for (const [fips, names] of byFips) {
      expect(names.size, `inconsistent names for FIPS ${fips}: ${[...names].join(" / ")}`).toBe(1);
    }
  });
});
