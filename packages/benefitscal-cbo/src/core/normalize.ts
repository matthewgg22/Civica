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

import type {
  BenefitsCalPayload,
  HouseholdMember,
  IncomeSource,
  Expense,
  ExpenseType,
  PayFrequency,
  MaritalStatus,
  CitizenshipStatus,
  SexAssignedAtBirth,
} from "./schemas";

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
  /** Widened to the full portal frequency superset (#497). */
  income_frequency: PayFrequency;
}

/**
 * A structured expense as produced by the QC engine or intake answers (#498).
 * Mirrors PacketIncomeSource. `expense_type`/`frequency` arrive as the schema
 * enum values; rows with an unrecognized type or negative amount are dropped.
 */
export interface PacketExpense {
  expense_type: ExpenseType;
  amount: number;
  frequency: PayFrequency;
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
  /**
   * California county NAME (e.g. "Sacramento"). Optional — intake collects it
   * for SNAPAgencyDirectory routing and the route layer reads it from the
   * `snap_packets.county` column. The portal's ordinal mapping happens at fill
   * time via the `"ca-county-ordinal"` transform (V1-3, #313).
   */
  county?: string;
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
  /**
   * Structured expenses — shelter, utilities, dependent care, court-ordered
   * support (#498). Optional: when intake collected no expense data the field
   * is omitted from the payload entirely (surfaced as needs-review, never $0).
   */
  expenses?: PacketExpense[];
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

/**
 * Resolve a boolean-ish intake answer. Treats "yes"/"true"/"1" (any case) as
 * true, "no"/"false"/"0" as false, and anything else (incl. a missing or
 * unrecognized answer) as `undefined` — the field is then OMITTED from the
 * payload so the extension surfaces it as needs-review rather than guessing.
 * Used for the Yes/No intake question backing is_college_student.
 */
function resolveBooleanAnswer(
  answers: PacketAnswer[],
  key: string,
): boolean | undefined {
  const raw = resolveAnswer(answers, key);
  if (raw === null) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === "yes" || s === "true" || s === "1") return true;
  if (s === "no" || s === "false" || s === "0") return false;
  return undefined;
}

/**
 * Derive `is_homeless` from intake. Civica's intake stores the living
 * situation under the `housing_situation` key (values like "renting",
 * "homeless", "owning"); a dedicated `is_homeless` Yes/No answer takes priority
 * when present. Returns `undefined` when intake collected NEITHER signal — the
 * field is omitted so the reviewer fills it (shelter/expedite is eligibility-
 * critical; we never default homelessness to false silently).
 */
function deriveIsHomeless(answers: PacketAnswer[]): boolean | undefined {
  const direct = resolveAnswer(answers, "is_homeless");
  if (direct !== null) {
    return resolveBooleanAnswer(answers, "is_homeless");
  }
  const housing = resolveAnswer(answers, "housing_situation");
  if (housing !== null) {
    return housing.trim().toLowerCase() === "homeless";
  }
  return undefined;
}

/**
 * Map an intake `marital_status` answer to the MaritalStatus enum. Accepts the
 * canonical enum strings directly and a few common aliases. Returns `undefined`
 * when intake has no answer OR the value is unrecognized — the field is then
 * omitted and surfaced as needs-review rather than silently defaulted.
 */
function deriveMaritalStatus(answers: PacketAnswer[]): MaritalStatus | undefined {
  const raw = resolveAnswer(answers, "marital_status");
  if (raw === null) return undefined;
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, MaritalStatus> = {
    single: "single",
    married: "married",
    divorced: "divorced",
    separated: "separated",
    widowed: "widowed",
    domestic_partner: "domestic_partner",
    registered_domestic_partner: "domestic_partner",
    common_law: "common_law",
    never_married: "never_married",
  };
  return map[s];
}

/**
 * Map an intake `citizenship_status` answer to the CitizenshipStatus enum.
 * Accepts the canonical enum strings plus the boolean-ish answer the ABDOC-style
 * "are you a U.S. citizen?" question produces ("yes" ⇒ us_citizen). Returns
 * `undefined` when intake has no answer OR the value is unrecognized — the field
 * is then omitted and surfaced as needs-review. Citizenship drives non-citizen
 * SNAP rules, so we never silently default it to us_citizen.
 */
function deriveCitizenshipStatus(
  answers: PacketAnswer[],
): CitizenshipStatus | undefined {
  const raw = resolveAnswer(answers, "citizenship_status");
  if (raw === null) return undefined;
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, CitizenshipStatus> = {
    us_citizen: "us_citizen",
    citizen: "us_citizen",
    yes: "us_citizen",
    us_national: "us_national",
    national: "us_national",
    non_citizen: "non_citizen",
    noncitizen: "non_citizen",
    no: "non_citizen",
  };
  return map[s];
}

/**
 * Map an intake `sex_assigned_at_birth` answer to the SexAssignedAtBirth enum.
 * Returns undefined when intake didn't collect it (the portal page is optional)
 * so the optional payload field is omitted rather than guessed.
 */
function deriveSexAssignedAtBirth(
  answers: PacketAnswer[],
): SexAssignedAtBirth | undefined {
  const raw = resolveAnswer(answers, "sex_assigned_at_birth");
  if (raw === null) return undefined;
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, SexAssignedAtBirth> = {
    female: "female",
    f: "female",
    male: "male",
    m: "male",
    prefer_not_to_say: "prefer_not_to_say",
    prefer_not_to_answer: "prefer_not_to_say",
  };
  return map[s];
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
 * Portal field selectors live in selector-map.ts (`PORTAL_PAGES`), captured
 * from the live CBO portal walk; each fillable field's `source` is a dotted
 * path back into the BenefitsCalPayload this function produces.
 */
export function normalizeForPortal(input: NormalizeInput): BenefitsCalPayload {
  const {
    packet_id,
    applicant,
    answers,
    household_members,
    income_sources,
    expenses,
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

  // Map expenses (#498) — drop rows with a non-positive amount. A missing
  // `expenses` input stays undefined so the payload key is omitted (the
  // extension surfaces an absent expense section as needs-review rather than
  // assuming $0, which would wrongly suppress the excess-shelter deduction).
  const mappedExpenses: Expense[] | undefined = expenses
    ?.filter((e) => e.expense_type && e.amount >= 0)
    .map((e) => ({
      expense_type: e.expense_type,
      amount: e.amount,
      frequency: e.frequency,
    }));

  // Map documents — pass through all with URLs
  const documentUrls = documents
    .filter((d) => d.url)
    .map((d) => ({ type: d.type, url: d.url }));

  // Resolve utility allowance — default to "none" if not provided
  const utilityType = utility_allowance_type ?? "none";

  // Signature type — default to async_portal
  const sigType = client_signature_type ?? "async_portal";

  // Demographic / eligibility answers (V1-2, #312). Each is OPTIONAL and OMITTED
  // when intake has no answer — a missing eligibility field is surfaced to the
  // reviewer as needs-review, never silently defaulted (autoplan Code Quality
  // #3 + #311/V1-11). Compute once here, then spread conditionally below.
  const isHomeless = deriveIsHomeless(answers);
  const maritalStatus = deriveMaritalStatus(answers);
  const isCollegeStudent = resolveBooleanAnswer(answers, "college_student");
  const citizenshipStatus = deriveCitizenshipStatus(answers);
  const sexAssignedAtBirth = deriveSexAssignedAtBirth(answers);
  const gender = resolveAnswer(answers, "gender")?.trim();

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
      // County is optional on the schema — only include the key when intake
      // supplied a non-empty value so the optional field stays truly absent
      // (rather than undefined) on packets that didn't collect it.
      ...(applicant.county && applicant.county.trim().length > 0
        ? { county: applicant.county.trim() }
        : {}),
    },
    phone: applicant.phone,

    // Demographic / eligibility answers (V1-2, #312) — derived from intake
    // packet_answers. ALL optional: each key is only included when intake
    // actually supplied a value. A missing answer leaves the key undefined so
    // the extension surfaces it as needs-review (never silently defaulted).
    ...(isHomeless !== undefined && { is_homeless: isHomeless }),
    ...(maritalStatus !== undefined && { marital_status: maritalStatus }),
    ...(isCollegeStudent !== undefined && { is_college_student: isCollegeStudent }),
    ...(citizenshipStatus !== undefined && { citizenship_status: citizenshipStatus }),
    ...(sexAssignedAtBirth !== undefined && {
      sex_assigned_at_birth: sexAssignedAtBirth,
    }),
    ...(gender ? { gender } : {}),

    // Household
    household_members: mappedMembers,

    // Income
    income_sources: effectiveIncome,

    // Expenses (#498) — only include the key when intake supplied expense rows,
    // so an absent expense section stays truly absent (needs-review) rather than
    // an empty array that reads as "confirmed no expenses".
    ...(mappedExpenses && mappedExpenses.length > 0
      ? { expenses: mappedExpenses }
      : {}),

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
