import type {
  AssetItem,
  AssetPackage,
  BankPaymentEvidence,
  GigIncomePackage,
  IncomeSource,
  SharedLeaseIntake,
  SharedLeasePackage,
  StateCode,
  UtilityAccount,
  UtilityIntake,
  UtilityPackage,
} from "@/types/verification";
import type { PlaidTransaction } from "@/lib/plaid";
import { STATE_SUA_RULES, determineSuaTier as determineSuaTierByState } from "@/lib/sua-rules";
import {
  INCOME_CITATIONS,
  SHELTER_CITATIONS,
  STATE_ASSET_RULES,
} from "@/lib/asset-rules";
import { grossIncomeLimitMonthly } from "@/lib/snap-calculator";

// ---------- Utility / SUA tier ----------

export { determineSuaTier } from "@/lib/sua-rules";

export function buildUtilityPackage(opts: {
  applicantName: string;
  serviceAddress: string;
  intake: UtilityIntake;
  accounts: UtilityAccount[];
  nameMatch: boolean;
}): UtilityPackage {
  const tier = determineSuaTierByState(opts.intake);
  const u = opts.intake.utilities_paid_by_applicant;
  const declaresPayingAny =
    u.heat_gas || u.electricity || u.cooling || u.water || u.phone_internet;
  const rules = STATE_SUA_RULES[opts.intake.state_code];

  let basis: UtilityPackage["basis"];
  if (opts.accounts.length === 0) {
    basis = "self_declared";
  } else if (declaresPayingAny && !opts.nameMatch) {
    basis = "conflicting";
  } else if (opts.nameMatch && declaresPayingAny) {
    basis = "api_confirmed";
  } else {
    basis = "self_declared";
  }

  const tierAmount =
    tier === "full"
      ? rules.amounts_usd.full
      : tier === "limited"
        ? rules.amounts_usd.limited
        : tier === "telephone"
          ? rules.amounts_usd.telephone
          : 0;

  return {
    flow: "utility",
    applicant_name: opts.applicantName,
    service_address: opts.serviceAddress,
    state_code: opts.intake.state_code,
    tier,
    tier_amount_usd: tierAmount,
    rule_citation: rules.citation,
    basis,
    utility_accounts_found: opts.accounts,
    name_match: opts.nameMatch,
    intake_responses: opts.intake,
    generated_at: new Date().toISOString(),
    attestation_required: basis !== "api_confirmed",
  };
}

// ---------- Shared lease ----------

export function analyzeRentTransactions(
  txns: PlaidTransaction[],
  statedAmount: number,
  leaseholderName: string
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
    (t) => Math.abs(t.amount - statedAmount) / statedAmount <= tolerance
  );

  const dates = inRange.map((t) => new Date(t.date).getTime()).sort();
  const gaps = dates.slice(1).map((d, i) => (d - dates[i]) / (1000 * 60 * 60 * 24));
  const monthly =
    gaps.length >= 1 && gaps.every((g) => g >= 25 && g <= 35) ? "monthly" : "irregular";

  const nameLower = leaseholderName.toLowerCase();
  const nameInDesc = inRange.some((t) =>
    (t.counterparty ?? t.name).toLowerCase().includes(nameLower.split(" ")[0] ?? "")
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

export function buildSharedLeasePackage(opts: {
  applicantName: string;
  stateCode: StateCode;
  intake: SharedLeaseIntake;
  documentType: "sublease" | "landlord_letter" | "none";
  documentFilename?: string;
  documentUploadId?: string;
  bankEvidence: BankPaymentEvidence;
  addressValid: boolean;
  addressNormalized?: string;
}): SharedLeasePackage {
  const docOK = opts.documentType !== "none";
  const bankOK =
    opts.bankEvidence.confidence === "high" || opts.bankEvidence.confidence === "medium";

  let qc: SharedLeasePackage["qc_defensibility_score"];
  if (docOK && bankOK && opts.addressValid) qc = "strong";
  else if ((docOK || bankOK) && opts.addressValid) qc = "moderate";
  else qc = "weak";

  return {
    flow: "shared-lease",
    applicant_name: opts.applicantName,
    state_code: opts.stateCode,
    lease_in_applicant_name: opts.intake.lease_in_applicant_name,
    leaseholder_name: opts.intake.leaseholder_name ?? "",
    stated_monthly_rent: opts.intake.stated_monthly_rent,
    document_type: opts.documentType,
    document_uploaded: opts.documentType !== "none",
    document_filename: opts.documentFilename,
    document_upload_id: opts.documentUploadId,
    bank_payment_evidence: opts.bankEvidence,
    address_valid: opts.addressValid,
    address_normalized: opts.addressNormalized,
    qc_defensibility_score: qc,
    regulatory_citations: SHELTER_CITATIONS[opts.stateCode],
    generated_at: new Date().toISOString(),
  };
}

// ---------- Gig / income reconciliation ----------

export function buildGigIncomePackage(opts: {
  applicantName: string;
  stateCode: StateCode;
  sources: IncomeSource[];
  cashAttestationSigned: boolean;
  cashLog?: { week_of: string; amount: number }[];
}): GigIncomePackage {
  const verified = opts.sources
    .filter((s) => s.verification_method === "argyle_api")
    .reduce((sum, s) => sum + s.monthly_average, 0);

  const bankCorroborated = opts.sources
    .filter((s) => s.verification_method === "plaid_deposits")
    .reduce((sum, s) => sum + s.monthly_average, 0);

  const selfCash = opts.sources
    .filter((s) => s.type === "cash")
    .reduce((sum, s) => sum + s.monthly_average, 0);

  const declared = verified + bankCorroborated + selfCash;
  const gap = Math.round((bankCorroborated - verified) * 100) / 100;
  const reconciliation_flag =
    verified > 0 && Math.abs(gap) / Math.max(verified, 1) > 0.25;

  return {
    flow: "gig-income",
    applicant_name: opts.applicantName,
    state_code: opts.stateCode,
    income_sources: opts.sources,
    total_monthly_verified: verified,
    total_monthly_bank_corroborated: bankCorroborated,
    total_monthly_self_declared_cash: selfCash,
    total_monthly_declared: declared,
    reconciliation_gap: gap,
    reconciliation_flag,
    cash_attestation_signed: opts.cashAttestationSigned,
    cash_log: opts.cashLog,
    snap_gross_income_limit_1person: grossIncomeLimitMonthly(1),
    snap_bbce_applies: opts.stateCode === "CA",
    regulatory_citations: INCOME_CITATIONS[opts.stateCode],
    generated_at: new Date().toISOString(),
  };
}

// ---------- Asset / resource verification ----------

export function buildAssetPackage(opts: {
  applicantName: string;
  stateCode: StateCode;
  assets: AssetItem[];
  elderlyOrDisabled?: boolean;
}): AssetPackage {
  const rules = STATE_ASSET_RULES[opts.stateCode];
  const total = opts.assets.reduce((s, a) => s + a.countable_value, 0);
  const limit = opts.elderlyOrDisabled
    ? rules.elderly_disabled_limit_usd
    : rules.standard_limit_usd;

  let result: AssetPackage["asset_test_result"];
  if (!rules.asset_test_applies) {
    result = "not_applicable";
  } else {
    result = total <= limit ? "pass" : "fail";
  }

  return {
    flow: "assets",
    applicant_name: opts.applicantName,
    state_code: opts.stateCode,
    assets: opts.assets,
    total_countable_assets: total,
    asset_limit_usd: limit,
    asset_test_applies: rules.asset_test_applies,
    asset_test_result: result,
    regulatory_citations: rules.citations,
    generated_at: new Date().toISOString(),
  };
}
