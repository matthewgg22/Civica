import { SHELTER_CITATIONS } from "@civica/snap-calculator";
import type {
  BankPaymentEvidence,
  Citation,
  Defensibility,
  DefensibilityFactor,
  RentTransaction,
  SharedLeaseInput,
  SharedLeasePackage,
  Warning,
} from "../../schemas.js";

export interface SharedLeaseEvaluationOptions {
  now?: () => string;
}

export interface SharedLeaseEvaluationResult {
  evidence_package: SharedLeasePackage;
  defensibility_score: Defensibility;
  defensibility_factors: DefensibilityFactor[];
  citations: Citation[];
  warnings: Warning[];
}

export function analyzeRentTransactions(
  txns: RentTransaction[],
  statedAmount: number,
  leaseholderName: string,
): BankPaymentEvidence {
  if (txns.length === 0) {
    return {
      match_found: false,
      matched_amount: 0,
      frequency: "none",
      confidence: "none",
      months_confirmed: 0,
      matched_transactions: [],
    };
  }

  const tolerance = 0.15;
  const inRange = txns.filter(
    (t) => Math.abs(t.amount - statedAmount) / statedAmount <= tolerance,
  );

  const dates = inRange.map((t) => new Date(t.date).getTime()).sort();
  const gaps = dates.slice(1).map((d, i) => (d - dates[i]!) / (1000 * 60 * 60 * 24));
  const monthly =
    gaps.length >= 1 && gaps.every((g) => g >= 25 && g <= 35) ? "monthly" : "irregular";

  const nameLower = leaseholderName.toLowerCase();
  const nameInDesc = inRange.some((t) =>
    (t.counterparty ?? t.name).toLowerCase().includes(nameLower.split(" ")[0] ?? ""),
  );

  let confidence: BankPaymentEvidence["confidence"];
  if (inRange.length >= 3 && monthly === "monthly" && nameInDesc) confidence = "high";
  else if (inRange.length >= 2 && nameInDesc) confidence = "medium";
  else if (inRange.length >= 1) confidence = "low";
  else confidence = "none";

  const avg =
    inRange.length === 0
      ? 0
      : Math.round((inRange.reduce((s, t) => s + t.amount, 0) / inRange.length) * 100) / 100;

  return {
    match_found: inRange.length > 0,
    matched_amount: avg,
    frequency: monthly,
    confidence,
    months_confirmed: inRange.length,
    matched_transactions: inRange.map((t) => ({
      date: t.date,
      amount: t.amount,
      description: t.name,
      counterparty: t.counterparty ?? "",
    })),
  };
}

export function buildSharedLeasePackage(
  input: SharedLeaseInput,
  options: SharedLeaseEvaluationOptions = {},
): SharedLeasePackage {
  const now = options.now ?? (() => new Date().toISOString());

  const docOK = input.document_type !== "none";
  const bankOK =
    input.bank_evidence.confidence === "high" ||
    input.bank_evidence.confidence === "medium";

  let qc: Defensibility;
  if (docOK && bankOK && input.address_valid) qc = "strong";
  else if ((docOK || bankOK) && input.address_valid) qc = "moderate";
  else qc = "weak";

  return {
    flow: "shared-lease",
    applicant_name: input.applicant_name,
    state_code: input.state_code,
    lease_in_applicant_name: input.intake.lease_in_applicant_name,
    leaseholder_name: input.intake.leaseholder_name ?? "",
    stated_monthly_rent: input.intake.stated_monthly_rent,
    document_type: input.document_type,
    document_uploaded: input.document_type !== "none",
    document_filename: input.document_filename,
    document_upload_id: input.document_upload_id,
    bank_payment_evidence: input.bank_evidence,
    address_valid: input.address_valid,
    address_normalized: input.address_normalized,
    qc_defensibility_score: qc,
    regulatory_citations: SHELTER_CITATIONS[input.state_code],
    generated_at: now(),
  };
}

export function evaluateSharedLease(
  input: SharedLeaseInput,
  options: SharedLeaseEvaluationOptions = {},
): SharedLeaseEvaluationResult {
  const pkg = buildSharedLeasePackage(input, options);

  const factors: DefensibilityFactor[] = [];
  const warnings: Warning[] = [];

  if (pkg.document_uploaded) {
    factors.push({
      name: "lease_document_uploaded",
      weight: "positive",
      detail: `Document type: ${pkg.document_type}`,
    });
  } else {
    factors.push({
      name: "no_lease_document",
      weight: "negative",
      detail: "No sublease or landlord letter on file",
    });
  }

  const conf = pkg.bank_payment_evidence.confidence;
  if (conf === "high") {
    factors.push({
      name: "bank_payment_pattern_high",
      weight: "positive",
      detail: `${pkg.bank_payment_evidence.months_confirmed} matching monthly transfers to leaseholder`,
    });
  } else if (conf === "medium") {
    factors.push({
      name: "bank_payment_pattern_medium",
      weight: "positive",
      detail: "Some matching transfers found",
    });
  } else if (conf === "low") {
    factors.push({
      name: "bank_payment_pattern_low",
      weight: "neutral",
      detail: "Limited bank evidence; no leaseholder name in description",
    });
  } else {
    factors.push({
      name: "no_bank_evidence",
      weight: "negative",
      detail: "No matching rent transactions",
    });
  }

  if (!pkg.address_valid) {
    factors.push({
      name: "address_invalid",
      weight: "negative",
      detail: "USPS could not validate the service address",
    });
    warnings.push({
      code: "shared_lease.address_invalid",
      severity: "warning",
      message: "Service address failed USPS validation",
    });
  }

  const citations: Citation[] = pkg.regulatory_citations.map((reference) => ({
    authority: reference.startsWith("7 CFR")
      ? "7 CFR Part 273"
      : pkg.state_code === "CA"
        ? "CA CDSS"
        : "MA DTA",
    reference,
  }));

  return {
    evidence_package: pkg,
    defensibility_score: pkg.qc_defensibility_score,
    defensibility_factors: factors,
    citations,
    warnings,
  };
}
