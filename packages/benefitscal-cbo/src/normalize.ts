/**
 * normalizeForPortal
 *
 * Pure function — no I/O, no side effects.
 *
 * Maps Civica's packet data model to a BenefitsCalPayload ready for review
 * by a navigator and (in Phase 2) pre-fill by the Playwright automation.
 *
 * Source data comes from the enrollment-api route which fetches:
 *   - snap_packets row (packet metadata)
 *   - packet_answers rows (question_key → applicant_answer)
 *   - uploaded_documents rows (storage paths, types)
 *   - optional QcResult from snap-qc-engine (utility SUA tier, income sources)
 *
 * Question keys referenced here are the canonical keys used by the Civica iOS
 * intake form. They match the `question_key` column of `packet_answers`.
 *
 * IMPORTANT: PII fields in Applicant (full_name, dob, address, phone) are
 * stored as Fernet ciphertext in the DB. The route layer must decrypt them
 * before calling normalizeForPortal — they arrive here as plaintext strings
 * inside the `packet` argument.
 */

import type { BenefitsCalPayload, HouseholdMember, IncomeSource } from "./schemas.js";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** A single packet_answers row, post-decryption (navigator_confirmed_value takes priority). */
export interface PacketAnswer {
  question_key: string;
  /** The value the navigator confirmed, if set; falls back to applicant_answer. */
  navigator_confirmed_value: string | null;
  applicant_answer: string | null;
}

/** An uploaded document with a resolvable storage URL. */
export interface DocumentItem {
  /** Civica document type enum (e.g. "photo_id", "paystub", "utility_bill"). */
  type: string;
  /** Supabase Storage signed URL valid for Phase 2 Playwright download. */
  url: string;
}

/**
 * A household member as collected by the Civica intake form.
 * Sourced from answers keyed `household_member_{index}_{field}`.
 */
export interface PacketHouseholdMember {
  first_name: string;
  last_name: string;
  date_of_birth: string; // YYYY-MM-DD
  relationship: string;
}

/**
 * An income source as produced by the QC engine or the intake answers.
 * Matches QcResult evidence_package income source shape.
 */
export interface PacketIncomeSource {
  income_type: string;
  income_amount: number;
  income_frequency: "monthly" | "weekly" | "biweekly" | "annual" | "irregular";
}

/** Decrypted applicant personal info (PII decrypted by route before calling here). */
export interface ApplicantInfo {
  /** Full name split is done in the route; must arrive as first + last. */
  first_name: string;
  last_name: string;
  /** ISO 8601: YYYY-MM-DD */
  date_of_birth: string;
  /** Last 4 digits only — full SSN comes from document scan. */
  ssn_last4: string;
  /** E.164 phone number */
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface NormalizeInput {
  /** UUID of the snap_packets row. */
  packet_id: string;
  /** Decrypted applicant PII. */
  applicant: ApplicantInfo;
  /** All packet_answers rows for this packet (navigator_confirmed_value takes priority). */
  answers: PacketAnswer[];
  /** Household members collected during intake. */
  household_members: PacketHouseholdMember[];
  /** Income sources — may come from QC engine evidence or intake answers. */
  income_sources: PacketIncomeSource[];
  /** Uploaded documents with signed URLs from Supabase Storage. */
  documents: DocumentItem[];
  /**
   * Utility allowance tier from the QC engine UtilityPackage result.
   * "standard" maps to full SUA; "limited" to limited SUA; "telephone" to telephone-only;
   * absent or "none" means no SUA claimed.
   */
  utility_allowance_type?: "standard" | "limited" | "telephone_only" | "none";
  /**
   * Client signature type — determines which consent path was used.
   * Defaults to "async_portal" if not provided.
   */
  client_signature_type?: "in_person" | "telephonic" | "async_portal";
  /**
   * ISO 8601 datetime of telephonic consent recording.
   * Required when client_signature_type = "telephonic".
   */
  telephonic_consent_recorded_at?: string;
}

// ---------------------------------------------------------------------------
// Helper: resolve answer (navigator_confirmed_value first, then applicant_answer)
// ---------------------------------------------------------------------------

function resolveAnswer(answers: PacketAnswer[], key: string): string | null {
  const row = answers.find((a) => a.question_key === key);
  if (!row) return null;
  return row.navigator_confirmed_value ?? row.applicant_answer ?? null;
}

// ---------------------------------------------------------------------------
// normalizeForPortal
// ---------------------------------------------------------------------------

/**
 * Maps a Civica enrollment packet + QC result to a BenefitsCalPayload.
 *
 * This is a pure function — it performs no I/O and does not validate that
 * BenefitsCal will accept the resulting payload. The Phase 2 Playwright worker
 * is responsible for form-level validation during the submission flow.
 *
 * Field ID mapping is in field-map.ts. Unconfirmed field IDs are marked TODO
 * there — they will be updated once the CBO Assister account is approved.
 */
export function normalizeForPortal(input: NormalizeInput): BenefitsCalPayload {
  const {
    packet_id,
    applicant,
    answers,
    household_members,
    income_sources,
    documents,
    utility_allowance_type,
    client_signature_type,
    telephonic_consent_recorded_at,
  } = input;

  // Map household members — filter out any with missing required fields
  const mappedMembers: HouseholdMember[] = household_members
    .filter((m) => m.first_name && m.last_name && m.date_of_birth && m.relationship)
    .map((m) => ({
      first_name: m.first_name,
      last_name: m.last_name,
      date_of_birth: m.date_of_birth,
      relationship: m.relationship,
    }));

  // Map income sources — filter zero-amount or missing type
  const mappedIncome: IncomeSource[] = income_sources
    .filter((s) => s.income_type && s.income_amount >= 0)
    .map((s) => ({
      income_type: s.income_type,
      income_amount: s.income_amount,
      income_frequency: s.income_frequency,
    }));

  // If no explicit income sources, attempt to derive from packet answers.
  // Civica intake asks: "income_type", "income_amount", "income_frequency"
  // for the primary household member.
  const effectiveIncome: IncomeSource[] =
    mappedIncome.length > 0
      ? mappedIncome
      : buildIncomeFromAnswers(answers);

  // Map documents — pass through all with URLs
  const documentUrls = documents
    .filter((d) => d.url)
    .map((d) => ({ type: d.type, url: d.url }));

  // Resolve utility allowance — default to "none" if not provided
  const utilityType = utility_allowance_type ?? "none";

  // Signature type — default to async_portal
  const sigType = client_signature_type ?? "async_portal";

  const payload: BenefitsCalPayload = {
    packet_id,

    // Personal info
    first_name: applicant.first_name,
    last_name: applicant.last_name,
    date_of_birth: applicant.date_of_birth,
    ssn_last4: applicant.ssn_last4,
    address: {
      street: applicant.street,
      city: applicant.city,
      state: applicant.state,
      zip: applicant.zip,
    },
    phone: applicant.phone,

    // Household
    household_members: mappedMembers,

    // Income
    income_sources: effectiveIncome,

    // Utility
    utility_allowance_type: utilityType,

    // Documents
    document_urls: documentUrls,

    // Consent
    client_signature_type: sigType,
    ...(telephonic_consent_recorded_at !== undefined && {
      telephonic_consent_recorded_at,
    }),
  };

  return payload;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive income sources from intake answers when QC engine hasn't run yet.
 * Reads: income_type, income_amount, income_frequency question keys.
 */
function buildIncomeFromAnswers(answers: PacketAnswer[]): IncomeSource[] {
  const type = resolveAnswer(answers, "income_type");
  const amountStr = resolveAnswer(answers, "income_amount");
  const frequency = resolveAnswer(answers, "income_frequency");

  if (!type || !amountStr) return [];

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount < 0) return [];

  const validFrequencies = ["monthly", "weekly", "biweekly", "annual", "irregular"] as const;
  type Frequency = (typeof validFrequencies)[number];
  const resolvedFrequency: Frequency =
    validFrequencies.includes(frequency as Frequency)
      ? (frequency as Frequency)
      : "monthly";

  return [
    {
      income_type: type,
      income_amount: amount,
      income_frequency: resolvedFrequency,
    },
  ];
}
