import { describe, it, expect } from "vitest";
import {
  verifyLeaseExtraction,
  compareName,
  parseRentValue,
  LEASE_FIELD_KEYS,
  type LeaseVerificationInput,
  type ExtractionField,
} from "../../src/flows/shared-lease/lease-verification";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeField(
  key: string,
  value: string | null,
  confidence = 0.92,
): ExtractionField {
  return { field_key: key, original_ocr_value: value, confidence };
}

const baseInput: LeaseVerificationInput = {
  extraction_fields: [
    makeField(LEASE_FIELD_KEYS.MONTHLY_RENT, "1800"),
    makeField(LEASE_FIELD_KEYS.LEASEHOLDER_PRIMARY, "Maria Gonzalez"),
  ],
  stated_monthly_rent: 1800,
  stated_leaseholder_name: "Maria Gonzalez",
};

// ---------------------------------------------------------------------------
// 1. parseRentValue
// ---------------------------------------------------------------------------

describe("parseRentValue", () => {
  it("parses bare number", () => expect(parseRentValue("1800")).toBe(1800));
  it("parses currency symbol + comma", () => expect(parseRentValue("$1,800")).toBe(1800));
  it("parses with /mo suffix", () => expect(parseRentValue("$1,800/mo")).toBe(1800));
  it("parses with /month suffix", () => expect(parseRentValue("1800/month.")).toBe(1800));
  it("parses decimal", () => expect(parseRentValue("1800.00")).toBe(1800));
  it("parses USD prefix", () => expect(parseRentValue("USD1800")).toBe(1800));
  it("returns null for empty string", () => expect(parseRentValue("")).toBeNull());
  it("returns null for non-numeric", () => expect(parseRentValue("N/A")).toBeNull());
  it("returns null for zero", () => expect(parseRentValue("0")).toBeNull());
  it("returns null for absurdly large value", () => expect(parseRentValue("999999")).toBeNull());
});

// ---------------------------------------------------------------------------
// 2. compareName
// ---------------------------------------------------------------------------

describe("compareName", () => {
  it("exact match (same case)", () =>
    expect(compareName("Maria Gonzalez", "Maria Gonzalez")).toBe("exact"));

  it("exact match (case insensitive)", () =>
    expect(compareName("MARIA GONZALEZ", "Maria Gonzalez")).toBe("exact"));

  it("fuzzy — abbreviated first name", () =>
    expect(compareName("M. Gonzalez", "Maria Gonzalez")).toBe("fuzzy"));

  it("fuzzy — reversed order still resolves", () =>
    expect(compareName("Gonzalez M.", "Maria Gonzalez")).toBe("fuzzy"));

  it("fuzzy — full name vs partial name", () =>
    expect(compareName("Maria", "Maria Gonzalez")).toBe("fuzzy"));

  it("partial — last name only", () =>
    expect(compareName("Robert Gonzalez", "Maria Gonzalez")).toBe("partial"));

  it("no_match — completely different names", () =>
    expect(compareName("Robert Chen", "Maria Gonzalez")).toBe("no_match"));

  it("no_match — single token mismatch", () =>
    expect(compareName("Smith", "Jones")).toBe("no_match"));
});

// ---------------------------------------------------------------------------
// 3. verifyLeaseExtraction — rent matching
// ---------------------------------------------------------------------------

describe("verifyLeaseExtraction — rent", () => {
  it("exact match when within $1", () => {
    const result = verifyLeaseExtraction({
      ...baseInput,
      extraction_fields: [
        makeField(LEASE_FIELD_KEYS.MONTHLY_RENT, "$1,800.00"),
        makeField(LEASE_FIELD_KEYS.LEASEHOLDER_PRIMARY, "Maria Gonzalez"),
      ],
      stated_monthly_rent: 1800,
    });
    expect(result.rent_match).toBe("exact");
    expect(result.extracted_monthly_rent).toBe(1800);
    expect(result.rent_delta_usd).toBe(0);
  });

  it("within_tolerance when delta < max($50, 5%)", () => {
    // stated 1800, extracted 1830 → delta 30 < tolerance 90
    const result = verifyLeaseExtraction({
      ...baseInput,
      extraction_fields: [
        makeField(LEASE_FIELD_KEYS.MONTHLY_RENT, "1830"),
        makeField(LEASE_FIELD_KEYS.LEASEHOLDER_PRIMARY, "Maria Gonzalez"),
      ],
      stated_monthly_rent: 1800,
    });
    expect(result.rent_match).toBe("within_tolerance");
  });

  it("mismatch when delta > tolerance", () => {
    // stated 1800, extracted 2100 → delta 300 > tolerance 90
    const result = verifyLeaseExtraction({
      ...baseInput,
      extraction_fields: [
        makeField(LEASE_FIELD_KEYS.MONTHLY_RENT, "2100"),
        makeField(LEASE_FIELD_KEYS.LEASEHOLDER_PRIMARY, "Maria Gonzalez"),
      ],
      stated_monthly_rent: 1800,
    });
    expect(result.rent_match).toBe("mismatch");
    expect(result.defensibility_tier).toBe("weak");
  });

  it("not_extracted when no rent field present", () => {
    const result = verifyLeaseExtraction({
      ...baseInput,
      extraction_fields: [
        makeField(LEASE_FIELD_KEYS.LEASEHOLDER_PRIMARY, "Maria Gonzalez"),
      ],
    });
    expect(result.rent_match).toBe("not_extracted");
    expect(result.extracted_monthly_rent).toBeNull();
    expect(result.rent_delta_usd).toBeNull();
  });

  it("uses navigator_confirmed_value over original_ocr_value when present", () => {
    // OCR misread $1800 as $1600; navigator corrected to 1800
    const result = verifyLeaseExtraction({
      ...baseInput,
      extraction_fields: [
        {
          field_key: LEASE_FIELD_KEYS.MONTHLY_RENT,
          original_ocr_value: "1600",
          navigator_confirmed_value: "1800",
          confidence: 0.65,
        },
        makeField(LEASE_FIELD_KEYS.LEASEHOLDER_PRIMARY, "Maria Gonzalez"),
      ],
      stated_monthly_rent: 1800,
    });
    expect(result.rent_match).toBe("exact");
    expect(result.extracted_monthly_rent).toBe(1800);
  });

  it("tolerance floor is $50 regardless of rent amount", () => {
    // stated 400 (low rent) — 5% = $20 but floor is $50, delta $45 < $50 → within_tolerance
    const result = verifyLeaseExtraction({
      ...baseInput,
      extraction_fields: [
        makeField(LEASE_FIELD_KEYS.MONTHLY_RENT, "445"),
        makeField(LEASE_FIELD_KEYS.LEASEHOLDER_PRIMARY, "Someone"),
      ],
      stated_monthly_rent: 400,
      stated_leaseholder_name: "Someone",
    });
    expect(result.rent_match).toBe("within_tolerance");
  });
});

// ---------------------------------------------------------------------------
// 4. verifyLeaseExtraction — name matching
// ---------------------------------------------------------------------------

describe("verifyLeaseExtraction — name", () => {
  it("exact name match", () => {
    const result = verifyLeaseExtraction(baseInput);
    expect(result.name_match).toBe("exact");
    expect(result.defensibility_tier).toBe("strong");
  });

  it("fuzzy match for abbreviated name", () => {
    const result = verifyLeaseExtraction({
      ...baseInput,
      extraction_fields: [
        makeField(LEASE_FIELD_KEYS.MONTHLY_RENT, "1800"),
        makeField(LEASE_FIELD_KEYS.LEASEHOLDER_PRIMARY, "M. Gonzalez"),
      ],
    });
    expect(result.name_match).toBe("fuzzy");
    expect(result.defensibility_tier).toBe("strong");
  });

  it("partial match for last name only", () => {
    const result = verifyLeaseExtraction({
      ...baseInput,
      extraction_fields: [
        makeField(LEASE_FIELD_KEYS.MONTHLY_RENT, "1800"),
        makeField(LEASE_FIELD_KEYS.LEASEHOLDER_PRIMARY, "J. Gonzalez"),
      ],
    });
    expect(result.name_match).toBe("partial");
    expect(result.defensibility_tier).toBe("moderate");
  });

  it("no_match gives weak tier", () => {
    const result = verifyLeaseExtraction({
      ...baseInput,
      extraction_fields: [
        makeField(LEASE_FIELD_KEYS.MONTHLY_RENT, "1800"),
        makeField(LEASE_FIELD_KEYS.LEASEHOLDER_PRIMARY, "Robert Chen"),
      ],
    });
    expect(result.name_match).toBe("no_match");
    expect(result.defensibility_tier).toBe("weak");
  });

  it("not_extracted when no name field", () => {
    const result = verifyLeaseExtraction({
      ...baseInput,
      extraction_fields: [
        makeField(LEASE_FIELD_KEYS.MONTHLY_RENT, "1800"),
      ],
    });
    expect(result.name_match).toBe("not_extracted");
    expect(result.defensibility_tier).toBe("moderate"); // one axis missing → moderate
  });

  it("not_extracted when stated leaseholder name is null", () => {
    const result = verifyLeaseExtraction({
      ...baseInput,
      stated_leaseholder_name: null,
    });
    expect(result.name_match).toBe("not_extracted");
  });
});

// ---------------------------------------------------------------------------
// 5. Defensibility tier matrix
// ---------------------------------------------------------------------------

describe("verifyLeaseExtraction — defensibility tier", () => {
  it("strong: exact rent + exact name", () => {
    expect(verifyLeaseExtraction(baseInput).defensibility_tier).toBe("strong");
  });

  it("strong: within_tolerance rent + fuzzy name", () => {
    const result = verifyLeaseExtraction({
      ...baseInput,
      extraction_fields: [
        makeField(LEASE_FIELD_KEYS.MONTHLY_RENT, "1820"),
        makeField(LEASE_FIELD_KEYS.LEASEHOLDER_PRIMARY, "M. Gonzalez"),
      ],
    });
    expect(result.defensibility_tier).toBe("strong");
  });

  it("moderate: rent match + partial name", () => {
    const result = verifyLeaseExtraction({
      ...baseInput,
      extraction_fields: [
        makeField(LEASE_FIELD_KEYS.MONTHLY_RENT, "1800"),
        makeField(LEASE_FIELD_KEYS.LEASEHOLDER_PRIMARY, "J. Gonzalez"),
      ],
    });
    expect(result.defensibility_tier).toBe("moderate");
  });

  it("moderate: rent within_tolerance + name not_extracted", () => {
    const result = verifyLeaseExtraction({
      ...baseInput,
      extraction_fields: [
        makeField(LEASE_FIELD_KEYS.MONTHLY_RENT, "1810"),
      ],
    });
    expect(result.defensibility_tier).toBe("moderate");
  });

  it("weak: rent mismatch (overrides good name)", () => {
    const result = verifyLeaseExtraction({
      ...baseInput,
      extraction_fields: [
        makeField(LEASE_FIELD_KEYS.MONTHLY_RENT, "2500"),
        makeField(LEASE_FIELD_KEYS.LEASEHOLDER_PRIMARY, "Maria Gonzalez"),
      ],
    });
    expect(result.defensibility_tier).toBe("weak");
  });

  it("weak: name no_match (overrides good rent)", () => {
    const result = verifyLeaseExtraction({
      ...baseInput,
      extraction_fields: [
        makeField(LEASE_FIELD_KEYS.MONTHLY_RENT, "1800"),
        makeField(LEASE_FIELD_KEYS.LEASEHOLDER_PRIMARY, "Robert Chen"),
      ],
    });
    expect(result.defensibility_tier).toBe("weak");
  });
});

// ---------------------------------------------------------------------------
// 6. Output shape
// ---------------------------------------------------------------------------

describe("verifyLeaseExtraction — output shape", () => {
  it("includes verified_at timestamp", () => {
    const fixedNow = () => "2026-05-23T12:00:00.000Z";
    const result = verifyLeaseExtraction(baseInput, fixedNow);
    expect(result.verified_at).toBe("2026-05-23T12:00:00.000Z");
  });

  it("includes at least one signal per axis", () => {
    const result = verifyLeaseExtraction(baseInput);
    expect(result.signals.length).toBeGreaterThanOrEqual(2);
    expect(result.signals.some((s) => s.includes("match"))).toBe(true);
  });
});
