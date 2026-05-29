/**
 * Tests for the fill-value transforms (`src/core/transforms.ts`, V1-3 #313).
 *
 * Two pure transforms back the registry the extension's fill loop consults:
 *   - resolveCountyOrdinal: CA county NAME → 2-digit alphabetical ordinal
 *     (the portal's `select#county` option value). null for unknown counties.
 *   - formatPhone10Digit: E.164 / loosely-formatted phone → bare 10 digits.
 *
 * The county test is driven off the SAME `CA_COUNTY_ORDINALS` map the selector
 * map exposes, so every one of the 58 counties is asserted to resolve to its
 * own ordinal (round-trip), independent of how the ordinals are computed.
 */

import { describe, it, expect } from "vitest";
import {
  resolveCountyOrdinal,
  formatPhone10Digit,
  TRANSFORMS,
} from "../../src/core/transforms";
import { CA_COUNTY_ORDINALS } from "../../src/core/selector-map";

describe("resolveCountyOrdinal — all 58 CA counties", () => {
  it("resolves every CA county name to its own ordinal", () => {
    const entries = Object.entries(CA_COUNTY_ORDINALS);
    expect(entries.length).toBe(58);
    for (const [name, ordinal] of entries) {
      expect(resolveCountyOrdinal(name), `${name} → ${ordinal}`).toBe(ordinal);
    }
  });

  it("maps the SELECTORS.md anchors (Alameda='01', Sacramento='34')", () => {
    expect(resolveCountyOrdinal("Alameda")).toBe("01");
    expect(resolveCountyOrdinal("Sacramento")).toBe("34");
    // Last alphabetical county.
    expect(resolveCountyOrdinal("Yuba")).toBe("58");
  });
});

describe("resolveCountyOrdinal — normalization", () => {
  it("is case-insensitive", () => {
    expect(resolveCountyOrdinal("sacramento")).toBe("34");
    expect(resolveCountyOrdinal("SACRAMENTO")).toBe("34");
    expect(resolveCountyOrdinal("sAcRaMeNtO")).toBe("34");
  });

  it("strips a trailing ' County' suffix", () => {
    expect(resolveCountyOrdinal("Sacramento County")).toBe("34");
    expect(resolveCountyOrdinal("sacramento county")).toBe("34");
    expect(resolveCountyOrdinal("Los Angeles County")).toBe(
      CA_COUNTY_ORDINALS["Los Angeles"],
    );
  });

  it("trims surrounding whitespace and collapses internal runs", () => {
    expect(resolveCountyOrdinal("  Sacramento  ")).toBe("34");
    expect(resolveCountyOrdinal("San  Diego")).toBe(
      CA_COUNTY_ORDINALS["San Diego"],
    );
    expect(resolveCountyOrdinal("  San Diego County  ")).toBe(
      CA_COUNTY_ORDINALS["San Diego"],
    );
  });

  it("handles multi-word counties with the suffix", () => {
    expect(resolveCountyOrdinal("Contra Costa County")).toBe(
      CA_COUNTY_ORDINALS["Contra Costa"],
    );
    expect(resolveCountyOrdinal("san luis obispo")).toBe(
      CA_COUNTY_ORDINALS["San Luis Obispo"],
    );
  });
});

describe("resolveCountyOrdinal — unknown → null", () => {
  it("returns null for a non-CA county", () => {
    expect(resolveCountyOrdinal("Cook")).toBeNull();
    expect(resolveCountyOrdinal("Maricopa County")).toBeNull();
  });

  it("returns null for empty / whitespace-only input", () => {
    expect(resolveCountyOrdinal("")).toBeNull();
    expect(resolveCountyOrdinal("   ")).toBeNull();
  });

  it("does not match the word 'County' alone", () => {
    expect(resolveCountyOrdinal("County")).toBeNull();
  });

  it("returns null for a non-string input", () => {
    // @ts-expect-error — guarding the runtime contract for untyped callers.
    expect(resolveCountyOrdinal(undefined)).toBeNull();
    // @ts-expect-error
    expect(resolveCountyOrdinal(null)).toBeNull();
  });
});

describe("formatPhone10Digit", () => {
  it("strips a +1 country code to 10 digits (the headline case)", () => {
    expect(formatPhone10Digit("+15551234567")).toBe("5551234567");
  });

  it("strips a leading 1 with no plus (11 digits)", () => {
    expect(formatPhone10Digit("15551234567")).toBe("5551234567");
  });

  it("leaves a bare 10-digit number unchanged", () => {
    expect(formatPhone10Digit("5551234567")).toBe("5551234567");
  });

  it("strips punctuation / spaces from a formatted number", () => {
    expect(formatPhone10Digit("(555) 123-4567")).toBe("5551234567");
    expect(formatPhone10Digit("+1 (555) 123-4567")).toBe("5551234567");
    expect(formatPhone10Digit("555.123.4567")).toBe("5551234567");
  });

  it("returns the surviving digits for an odd-length input (no crash)", () => {
    // Not a valid US number; we surface the digits rather than dropping it.
    expect(formatPhone10Digit("+44 20 7946 0958")).toBe("442079460958");
    expect(formatPhone10Digit("12345")).toBe("12345");
  });

  it("returns empty string for a non-string / empty input", () => {
    expect(formatPhone10Digit("")).toBe("");
    // @ts-expect-error — runtime guard for untyped callers.
    expect(formatPhone10Digit(undefined)).toBe("");
  });
});

describe("TRANSFORMS registry", () => {
  it("exposes the ca-county-ordinal and phone-10digit transforms", () => {
    expect(typeof TRANSFORMS["ca-county-ordinal"]).toBe("function");
    expect(typeof TRANSFORMS["phone-10digit"]).toBe("function");
  });

  it("ca-county-ordinal delegates to resolveCountyOrdinal (null on unknown)", () => {
    expect(TRANSFORMS["ca-county-ordinal"]?.("Sacramento County")).toBe("34");
    expect(TRANSFORMS["ca-county-ordinal"]?.("Nowhere")).toBeNull();
  });

  it("phone-10digit delegates to formatPhone10Digit", () => {
    expect(TRANSFORMS["phone-10digit"]?.("+15551234567")).toBe("5551234567");
  });

  it("has no other transform names (guards selector-map references)", () => {
    expect(Object.keys(TRANSFORMS).sort()).toEqual([
      "ca-county-ordinal",
      "phone-10digit",
    ]);
  });
});
