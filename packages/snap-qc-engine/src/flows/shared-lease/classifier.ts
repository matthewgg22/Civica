/**
 * Sublease / shared-tenancy classifier — deterministic v1.
 *
 * Today: when a lease is uploaded, the shelter-deduction path treats it as a
 * primary tenancy. About 8% of CA error surface is shared-lease cases that
 * should be routed to navigator review for shelter allocation instead of
 * auto-flowing. This module is the routing decision.
 *
 * Deterministic v1 — heuristic rules from existing intake answers + bank
 * evidence + document hints. No ML, no LLM call. Calibrated to be
 * conservative: false-positives (route a primary tenancy to navigator)
 * are mild friction; false-negatives (auto-flow a sublease) are QC errors.
 * The rule weights err toward escalation.
 *
 * v2 (planned Q4 2026 per verification-stack.ts): swap in an ML model
 * trained on lease text + intake answers. v2 will implement the same
 * `LeaseClassification` output type so callers don't change.
 *
 * Pure logic. No I/O.
 */

import type { SharedLeaseIntake, RentTransaction } from "../../schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TenancyKind =
  /** Applicant is the named tenant on a primary lease. */
  | "primary_tenancy"
  /** Applicant pays a third party who is the named leaseholder. */
  | "sublease"
  /** Multiple tenants share the unit; shelter must be allocated per-HH. */
  | "shared_tenancy"
  /** No formal lease — family rent, doubled-up, informal arrangement. */
  | "informal"
  /** Insufficient signal to classify. */
  | "indeterminate";

export type ClassifierAction =
  /** Auto-flow into the shelter deduction without escalation. */
  | "auto_flow"
  /** Route to a navigator for shelter allocation review. */
  | "navigator_review"
  /** Route to the informal-housing intake wizard (item 4). */
  | "informal_housing_intake";

export interface LeaseClassification {
  tenancy: TenancyKind;
  /** 0.0–1.0 — how sure we are about `tenancy`. */
  confidence: number;
  action: ClassifierAction;
  /** Plain-English reasons, in order of contribution. Surfaced to navigator. */
  signals: string[];
  /** Engine version that produced this classification. */
  classifier_version: string;
}

export interface LeaseClassifierInput {
  intake: SharedLeaseIntake;
  /** Applicant's legal name (for cross-referencing leaseholder_name). */
  applicant_name: string;
  /** Household size as reported on the SNAP application. */
  household_size: number;
  /** Number of distinct people named as tenants on the lease document. */
  named_tenants_on_lease: number | null;
  /** Rent transactions detected in the bank feed (if connected). */
  rent_transactions: RentTransaction[];
  /** Did the upload classify as a real lease at all, or "none"? */
  has_lease_document: boolean;
}

const CLASSIFIER_VERSION = "shared-lease-classifier@1.0.0-deterministic";

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

export function classifyTenancy(input: LeaseClassifierInput): LeaseClassification {
  const signals: string[] = [];

  // -------------------------------------------------------------------------
  // 1. No lease document at all → informal housing path
  // -------------------------------------------------------------------------
  if (!input.has_lease_document) {
    if (input.rent_transactions.length === 0) {
      signals.push("No lease document uploaded; no recurring rent transactions detected.");
      return {
        tenancy: "informal",
        confidence: 0.85,
        action: "informal_housing_intake",
        signals,
        classifier_version: CLASSIFIER_VERSION,
      };
    }
    signals.push("No lease document, but recurring rent transactions present — informal arrangement likely.");
    return {
      tenancy: "informal",
      confidence: 0.75,
      action: "informal_housing_intake",
      signals,
      classifier_version: CLASSIFIER_VERSION,
    };
  }

  // -------------------------------------------------------------------------
  // 2. Lease is NOT in applicant's name → sublease or shared
  // -------------------------------------------------------------------------
  if (!input.intake.lease_in_applicant_name) {
    signals.push("Lease is not in the applicant's name.");

    // If a leaseholder name is provided AND it doesn't match applicant,
    // and household size > 1, treat as shared tenancy. Otherwise sublease.
    const leaseholder = input.intake.leaseholder_name?.toLowerCase().trim();
    const applicant = input.applicant_name.toLowerCase().trim();
    const sameName =
      leaseholder &&
      applicant &&
      (leaseholder === applicant ||
        leaseholder.includes(applicant.split(" ")[0] ?? "") ||
        applicant.includes(leaseholder.split(" ")[0] ?? ""));

    if (sameName) {
      // Name overlap with leaseholder despite "lease not in applicant name" —
      // could be a typo, a different version of the name, or co-tenancy.
      signals.push("Leaseholder name overlaps with applicant; possible co-tenancy or naming inconsistency.");
      return {
        tenancy: "shared_tenancy",
        confidence: 0.6,
        action: "navigator_review",
        signals,
        classifier_version: CLASSIFIER_VERSION,
      };
    }

    if (input.intake.payment_method === "venmo_zelle" || input.intake.payment_method === "cash") {
      signals.push(`Rent paid via ${input.intake.payment_method} to non-leaseholder.`);
    }

    return {
      tenancy: "sublease",
      confidence: 0.85,
      action: "navigator_review",
      signals,
      classifier_version: CLASSIFIER_VERSION,
    };
  }

  // -------------------------------------------------------------------------
  // 3. Lease IS in applicant's name — check for shared tenancy signals
  // -------------------------------------------------------------------------
  // Multiple named tenants AND household size diverges from tenants → shared.
  if (
    input.named_tenants_on_lease != null &&
    input.named_tenants_on_lease >= 2 &&
    input.named_tenants_on_lease > input.household_size
  ) {
    signals.push(
      `Lease lists ${input.named_tenants_on_lease} tenants but SNAP household size is ${input.household_size} — shelter cost must be allocated.`,
    );
    return {
      tenancy: "shared_tenancy",
      confidence: 0.9,
      action: "navigator_review",
      signals,
      classifier_version: CLASSIFIER_VERSION,
    };
  }

  // Multiple tenants but household size matches → shared but no allocation needed
  if (
    input.named_tenants_on_lease != null &&
    input.named_tenants_on_lease >= 2 &&
    input.named_tenants_on_lease === input.household_size
  ) {
    signals.push(
      `Lease lists ${input.named_tenants_on_lease} tenants and SNAP household size matches — single SNAP household covers full lease.`,
    );
    return {
      tenancy: "primary_tenancy",
      confidence: 0.85,
      action: "auto_flow",
      signals,
      classifier_version: CLASSIFIER_VERSION,
    };
  }

  // -------------------------------------------------------------------------
  // 4. Bank evidence sanity check — rent goes to a third party?
  // -------------------------------------------------------------------------
  // If lease is in applicant name but rent transactions consistently go to a
  // counterparty that doesn't look like the named landlord, escalate.
  const suspiciousCounterparty = detectSuspiciousCounterparty(input);
  if (suspiciousCounterparty) {
    signals.push(suspiciousCounterparty);
    return {
      tenancy: "shared_tenancy",
      confidence: 0.55,
      action: "navigator_review",
      signals,
      classifier_version: CLASSIFIER_VERSION,
    };
  }

  // -------------------------------------------------------------------------
  // 5. Default: primary tenancy
  // -------------------------------------------------------------------------
  signals.push("Lease in applicant's name; no shared-tenancy indicators detected.");
  return {
    tenancy: "primary_tenancy",
    confidence: 0.9,
    action: "auto_flow",
    signals,
    classifier_version: CLASSIFIER_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Heuristic helpers
// ---------------------------------------------------------------------------

/**
 * Looks at recurring rent payments and checks if they consistently go to a
 * person-shaped counterparty (looks like a name) vs a property-mgmt-shaped
 * counterparty (LLC, Apartments, Properties, Management). Person-shaped
 * recurring rent + applicant-named lease = possible roommate splitting.
 */
function detectSuspiciousCounterparty(input: LeaseClassifierInput): string | null {
  if (input.rent_transactions.length < 2) return null;

  const counterparties = input.rent_transactions
    .map((t) => (t.counterparty ?? t.name ?? "").toLowerCase().trim())
    .filter(Boolean);

  if (counterparties.length === 0) return null;

  const corporateMarkers = ["llc", "inc", "corp", "apartments", "properties", "management", "realty", "homes", "leasing"];
  const looksCorporate = counterparties.some((c) => corporateMarkers.some((m) => c.includes(m)));
  if (looksCorporate) return null;

  // No corporate-shaped counterparty across multiple txns → probably a person
  return "Recurring rent payments go to a person-shaped counterparty (no LLC/property-mgmt markers) despite a named lease.";
}
