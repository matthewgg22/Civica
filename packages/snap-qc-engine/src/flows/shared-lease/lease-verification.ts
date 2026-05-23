/**
 * Lease OCR verification — cross-checks extracted field values against
 * stated intake answers to produce a defensibility tier signal.
 *
 * Two axes of verification:
 *
 *  rent_match   — OCR-extracted monthly rent vs stated_monthly_rent from
 *                 intake. Tolerance band: max($50, 5% of stated rent).
 *
 *  name_match   — OCR-extracted leaseholder name vs stated_leaseholder_name
 *                 from intake answers. Uses layered fuzzy matching so common
 *                 variations ("M. Gonzalez" vs "Maria Gonzalez") don't flag.
 *
 * Defensibility upgrade path:
 *   weak     — mismatch on rent OR no_match on name (navigator must resolve)
 *   moderate — one axis not_extracted, or partial name + rent matches
 *   strong   — rent within tolerance AND name exact or fuzzy
 *
 * Pure logic. No I/O. Designed to run inside the OCR webhook after fields
 * are stored, with the computed result written back as synthetic
 * extraction_fields rows (civica_* keys) for the navigator review UI.
 *
 * Canonical field keys for lease documents are exported as LEASE_FIELD_KEYS.
 * Any OCR service sending results to /api/v1/webhooks/ocr should use these
 * names in the `fields[].name` payload for the verification to auto-run.
 */

// ---------------------------------------------------------------------------
// Canonical field key registry
// ---------------------------------------------------------------------------

/**
 * Canonical field_key values expected in extraction_fields rows for lease
 * documents. OCR services should map their output names to these keys.
 *
 * Keys prefixed `civica_` are Civica-computed synthetics written back to
 * extraction_fields after verification runs — they are never returned by the
 * OCR service itself.
 */
export const LEASE_FIELD_KEYS = {
  // Primary extraction targets — OCR service should return these
  MONTHLY_RENT:          "monthly_rent_usd",
  LEASEHOLDER_PRIMARY:   "leaseholder_name_primary",
  LEASEHOLDER_SECONDARY: "leaseholder_name_secondary",
  LEASE_START_DATE:      "lease_start_date",
  LEASE_END_DATE:        "lease_end_date",
  PROPERTY_ADDRESS:      "property_address",
  LANDLORD_NAME:         "landlord_name",
  // Civica-computed — written back after verifyLeaseExtraction() runs
  RENT_VERIFICATION:     "civica_rent_verification_status",
  NAME_VERIFICATION:     "civica_name_verification_status",
  DEFENSIBILITY_TIER:    "civica_defensibility_tier",
} as const;

export type LeaseFieldKey = (typeof LEASE_FIELD_KEYS)[keyof typeof LEASE_FIELD_KEYS];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RentMatch =
  | "exact"             // within $1
  | "within_tolerance"  // within max($50, 5% of stated)
  | "mismatch"          // outside tolerance — flag for navigator
  | "not_extracted";    // OCR didn't return a rent field

export type NameMatch =
  | "exact"             // normalized strings identical
  | "fuzzy"             // all tokens of shorter name appear in longer name
  | "partial"           // last name (last token) matches only
  | "no_match"          // strings share no meaningful tokens
  | "not_extracted";    // OCR didn't return a leaseholder name field

export interface ExtractionField {
  field_key: string;
  /** Raw OCR value — write-once per DB invariant. */
  original_ocr_value: string | null;
  /** Navigator-confirmed correction, if set. Verification uses this if present. */
  navigator_confirmed_value?: string | null;
  confidence: number;
}

export interface LeaseVerificationInput {
  /** All extraction_fields rows for this lease document. */
  extraction_fields: ExtractionField[];
  /** Stated monthly rent from the SNAP intake questionnaire (packet_answers). */
  stated_monthly_rent: number;
  /**
   * Stated leaseholder name from intake answers.
   * For primary tenancy this is the applicant's own name.
   * For sublease this is the name the applicant reported paying.
   * null = not provided in intake (lower confidence).
   */
  stated_leaseholder_name: string | null;
}

export interface LeaseVerificationResult {
  rent_match: RentMatch;
  name_match: NameMatch;
  /** Dollar amount extracted from the lease document, or null. */
  extracted_monthly_rent: number | null;
  /** Leaseholder name extracted from the lease document, or null. */
  extracted_leaseholder_name: string | null;
  /** extracted_monthly_rent − stated_monthly_rent; null when not extracted. */
  rent_delta_usd: number | null;
  defensibility_tier: "strong" | "moderate" | "weak";
  signals: string[];
  verified_at: string;
}

// ---------------------------------------------------------------------------
// Core verification function
// ---------------------------------------------------------------------------

export function verifyLeaseExtraction(
  input: LeaseVerificationInput,
  now: () => string = () => new Date().toISOString(),
): LeaseVerificationResult {
  const signals: string[] = [];

  // ── Rent ──────────────────────────────────────────────────────────────────
  const rentField = pickField(input.extraction_fields, LEASE_FIELD_KEYS.MONTHLY_RENT);
  const extractedRentRaw = rentField
    ? (rentField.navigator_confirmed_value ?? rentField.original_ocr_value)
    : null;
  const extractedRent = parseRentValue(extractedRentRaw);

  let rentMatch: RentMatch;
  let rentDelta: number | null = null;

  if (extractedRent === null) {
    rentMatch = "not_extracted";
    signals.push("Monthly rent not extracted from lease document.");
  } else {
    rentDelta = Math.round((extractedRent - input.stated_monthly_rent) * 100) / 100;
    const absDelta = Math.abs(rentDelta);
    const tolerance = Math.max(50, input.stated_monthly_rent * 0.05);

    if (absDelta <= 1) {
      rentMatch = "exact";
      signals.push(`Rent exact match: extracted $${extractedRent} = stated $${input.stated_monthly_rent}.`);
    } else if (absDelta <= tolerance) {
      rentMatch = "within_tolerance";
      signals.push(
        `Rent within tolerance: extracted $${extractedRent}, stated $${input.stated_monthly_rent} ` +
        `(delta $${absDelta.toFixed(0)}, tolerance $${tolerance.toFixed(0)}).`,
      );
    } else {
      rentMatch = "mismatch";
      signals.push(
        `Rent mismatch: extracted $${extractedRent}, stated $${input.stated_monthly_rent} ` +
        `(delta $${rentDelta > 0 ? "+" : ""}${rentDelta.toFixed(0)} — outside $${tolerance.toFixed(0)} tolerance). ` +
        "Navigator review required.",
      );
    }
  }

  // ── Name ──────────────────────────────────────────────────────────────────
  const nameField = pickField(input.extraction_fields, LEASE_FIELD_KEYS.LEASEHOLDER_PRIMARY);
  const extractedNameRaw = nameField
    ? (nameField.navigator_confirmed_value ?? nameField.original_ocr_value)
    : null;
  const extractedName = extractedNameRaw?.trim() || null;

  let nameMatch: NameMatch;

  if (!extractedName) {
    nameMatch = "not_extracted";
    signals.push("Leaseholder name not extracted from lease document.");
  } else if (!input.stated_leaseholder_name) {
    nameMatch = "not_extracted";
    signals.push("No stated leaseholder name in intake to compare against.");
  } else {
    nameMatch = compareName(extractedName, input.stated_leaseholder_name);
    switch (nameMatch) {
      case "exact":
        signals.push(`Name exact match: "${extractedName}" = stated "${input.stated_leaseholder_name}".`);
        break;
      case "fuzzy":
        signals.push(
          `Name fuzzy match: "${extractedName}" vs stated "${input.stated_leaseholder_name}" — ` +
          "consistent with abbreviation or partial name form.",
        );
        break;
      case "partial":
        signals.push(
          `Name partial match (last name only): "${extractedName}" vs stated "${input.stated_leaseholder_name}". ` +
          "Navigator should confirm.",
        );
        break;
      case "no_match":
        signals.push(
          `Name mismatch: extracted "${extractedName}" does not match stated "${input.stated_leaseholder_name}". ` +
          "Navigator review required.",
        );
        break;
    }
  }

  // ── Defensibility tier ────────────────────────────────────────────────────
  const defensibility_tier = deriveDefensibility(rentMatch, nameMatch);

  return {
    rent_match: rentMatch,
    name_match: nameMatch,
    extracted_monthly_rent: extractedRent,
    extracted_leaseholder_name: extractedName,
    rent_delta_usd: rentDelta,
    defensibility_tier,
    signals,
    verified_at: now(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick the best available value for a field_key: prefer navigator-confirmed. */
function pickField(
  fields: ExtractionField[],
  key: string,
): ExtractionField | null {
  return fields.find((f) => f.field_key === key) ?? null;
}

/**
 * Parse a rent value from a raw OCR string.
 * Handles: "$1,800", "1800.00", "1,800/mo", "USD 1800", "1 800".
 */
export function parseRentValue(raw: string | null): number | null {
  if (!raw) return null;
  // Strip currency symbols, commas, spaces, /mo, /month suffix
  const cleaned = raw
    .replace(/[£€$¥]/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/\/mo(nth)?\.?$/i, "")
    .replace(/usd/i, "")
    .trim();
  const n = parseFloat(cleaned);
  if (isNaN(n) || n <= 0 || n > 50000) return null; // sanity bounds
  return Math.round(n * 100) / 100;
}

/**
 * Layered fuzzy name comparison.
 * Normalizes both names (lowercase, trim, collapse whitespace, strip periods)
 * then applies four tiers of matching.
 */
export function compareName(extracted: string, stated: string): NameMatch {
  const norm = (s: string) =>
    s.toLowerCase().replace(/\./g, " ").replace(/\s+/g, " ").trim();

  const a = norm(extracted);
  const b = norm(stated);

  if (a === b) return "exact";

  const tokensA = a.split(" ").filter(Boolean);
  const tokensB = b.split(" ").filter(Boolean);

  // Fuzzy: all tokens of the shorter name are substrings in the longer name.
  // Handles "M. Gonzalez" vs "Maria Gonzalez" — "m" is prefix of "maria",
  // "gonzalez" is exact match.
  const [shorter, longer] =
    tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  const allTokensMatch = shorter.every((token) =>
    longer.some((lt) => lt.startsWith(token) || token.startsWith(lt)),
  );
  if (allTokensMatch && shorter.length >= 1) return "fuzzy";

  // Partial: last tokens match (last name).
  const lastA = tokensA[tokensA.length - 1] ?? "";
  const lastB = tokensB[tokensB.length - 1] ?? "";
  if (lastA && lastB && lastA === lastB) return "partial";

  return "no_match";
}

function deriveDefensibility(
  rentMatch: RentMatch,
  nameMatch: NameMatch,
): "strong" | "moderate" | "weak" {
  // Strong: both axes positive
  if (
    (rentMatch === "exact" || rentMatch === "within_tolerance") &&
    (nameMatch === "exact" || nameMatch === "fuzzy")
  ) {
    return "strong";
  }

  // Weak: definitive mismatch on either axis
  if (rentMatch === "mismatch" || nameMatch === "no_match") {
    return "weak";
  }

  // Moderate: partial name match, or one axis not_extracted
  return "moderate";
}
