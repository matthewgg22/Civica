export type VerificationFlow = "utility" | "shared-lease" | "gig-income" | "assets";

export type Confidence = "high" | "medium" | "low" | "none";

// ---------- Flow 1: Utility SUA ----------
export type SuaTier = "full" | "limited" | "telephone" | "none";

export type StateCode = "CA" | "MA";

export interface UtilityIntake {
  state_code: StateCode;
  landlord_pays_any: boolean;
  utilities_paid_by_applicant: {
    heat_gas: boolean;
    electricity: boolean;
    cooling: boolean;
    water: boolean;
    phone_internet: boolean;
    none: boolean;
  };
}

export interface UtilityAccount {
  utility: string;
  account_holder_name: string;
  service_address: string;
  account_status: "active" | "inactive";
  utility_type: "electric" | "gas" | "water" | "phone" | "internet";
  source: "utilityapi_sandbox";
}

export interface UtilityPackage {
  flow: "utility";
  applicant_name: string;
  service_address: string;
  state_code: StateCode;
  tier: SuaTier;
  tier_amount_usd: number;
  rule_citation: string;
  basis: "api_confirmed" | "self_declared" | "conflicting";
  utility_accounts_found: UtilityAccount[];
  name_match: boolean;
  intake_responses: UtilityIntake;
  generated_at: string;
  attestation_required: boolean;
}

// ---------- Flow 2: Shared Lease ----------
export interface SharedLeaseIntake {
  lease_in_applicant_name: boolean;
  leaseholder_name?: string;
  stated_monthly_rent: number;
  payment_method: "bank_transfer" | "cash" | "venmo_zelle" | "other";
  address: string;
}

export interface BankPaymentEvidence {
  match_found: boolean;
  matched_amount: number;
  frequency: "monthly" | "irregular" | "none";
  confidence: Confidence;
  months_confirmed: number;
  matched_transactions: Array<{
    date: string;
    amount: number;
    description: string;
    counterparty: string;
  }>;
}

export interface SharedLeasePackage {
  flow: "shared-lease";
  applicant_name: string;
  state_code: StateCode;
  lease_in_applicant_name: boolean;
  leaseholder_name: string;
  stated_monthly_rent: number;
  document_type: "sublease" | "landlord_letter" | "none";
  document_uploaded: boolean;
  document_filename?: string;
  document_upload_id?: string;
  bank_payment_evidence: BankPaymentEvidence;
  address_valid: boolean;
  address_normalized?: string;
  qc_defensibility_score: "strong" | "moderate" | "weak";
  regulatory_citations: string[];
  generated_at: string;
}

// ---------- Flow 3: Gig / Multi-Source Income ----------
export type IncomeSourceType = "w2" | "platform_gig" | "cash";
export type GigPlatform =
  | "doordash"
  | "uber"
  | "lyft"
  | "instacart"
  | "taskrabbit"
  | "amazon_flex"
  | "other";

export interface IncomeSource {
  type: IncomeSourceType;
  source_name: string;
  monthly_average: number;
  verification_method: "argyle_api" | "plaid_deposits" | "self_declared";
  confidence: "verified" | "corroborated" | "self_declared";
}

export interface CashWeek {
  week_of: string;
  amount: number;
}

export interface GigIncomePackage {
  flow: "gig-income";
  applicant_name: string;
  state_code: StateCode;
  income_sources: IncomeSource[];
  total_monthly_verified: number;
  total_monthly_bank_corroborated: number;
  total_monthly_self_declared_cash: number;
  total_monthly_declared: number;
  reconciliation_gap: number;
  reconciliation_flag: boolean;
  cash_attestation_signed: boolean;
  cash_log?: CashWeek[];
  // SNAP eligibility indicators (informational — final determination requires household size)
  snap_gross_income_limit_1person: number;   // 130% FPL for 1-person HH (most conservative reference)
  snap_bbce_applies: boolean;                // true for CA (BBCE waives gross income + asset tests)
  regulatory_citations: string[];
  generated_at: string;
}

// ---------- Flow 4: Asset / Resource verification ----------
export type AssetType =
  | "vehicle"
  | "bank_account"
  | "retirement"
  | "real_property"
  | "other_liquid";

export interface AssetItem {
  type: AssetType;
  description: string;
  stated_value: number;
  exempt: boolean;
  exemption_reason?: "primary_transport" | "home" | "retirement_excluded" | "income_producing";
  countable_value: number;
  verification_method: "plaid_balance" | "self_declared" | "document_upload";
}

export interface AssetPackage {
  flow: "assets";
  applicant_name: string;
  state_code: StateCode;
  assets: AssetItem[];
  total_countable_assets: number;
  asset_limit_usd: number;
  asset_test_applies: boolean;
  asset_test_result: "pass" | "fail" | "not_applicable";
  regulatory_citations: string[];
  generated_at: string;
}

export type VerificationPackage =
  | UtilityPackage
  | SharedLeasePackage
  | GigIncomePackage
  | AssetPackage;

export interface StoredPackage {
  id: string;
  flow: VerificationFlow;
  applicant_name: string;
  created_at: string;
  package: VerificationPackage;
}
