import { z } from "zod";

// ---------- Shared primitives ----------

export const StateCodeSchema = z.enum(["CA", "MA"]);
export type StateCode = z.infer<typeof StateCodeSchema>;

export const ConfidenceSchema = z.enum(["high", "medium", "low", "none"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const FlowKindSchema = z.enum([
  "utility-sua",
  "shared-lease",
  "gig-income",
  "assets",
]);
export type FlowKind = z.infer<typeof FlowKindSchema>;

export const DefensibilitySchema = z.enum(["strong", "moderate", "weak"]);
export type Defensibility = z.infer<typeof DefensibilitySchema>;

// ---------- Utility SUA ----------

export const SuaTierSchema = z.enum(["full", "limited", "telephone", "none"]);
export type SuaTier = z.infer<typeof SuaTierSchema>;

export const UtilityIntakeSchema = z.object({
  state_code: StateCodeSchema,
  landlord_pays_any: z.boolean(),
  utilities_paid_by_applicant: z.object({
    heat_gas: z.boolean(),
    electricity: z.boolean(),
    cooling: z.boolean(),
    water: z.boolean(),
    phone_internet: z.boolean(),
    none: z.boolean(),
  }),
});
export type UtilityIntake = z.infer<typeof UtilityIntakeSchema>;

export const UtilityAccountSchema = z.object({
  utility: z.string(),
  account_holder_name: z.string(),
  service_address: z.string(),
  account_status: z.enum(["active", "inactive"]),
  utility_type: z.enum(["electric", "gas", "water", "phone", "internet"]),
  source: z.literal("utilityapi_sandbox"),
});
export type UtilityAccount = z.infer<typeof UtilityAccountSchema>;

export const UtilitySuaInputSchema = z.object({
  applicant_name: z.string(),
  service_address: z.string(),
  intake: UtilityIntakeSchema,
  accounts: z.array(UtilityAccountSchema),
  name_match: z.boolean(),
});
export type UtilitySuaInput = z.infer<typeof UtilitySuaInputSchema>;

export const UtilityPackageSchema = z.object({
  flow: z.literal("utility"),
  applicant_name: z.string(),
  service_address: z.string(),
  state_code: StateCodeSchema,
  tier: SuaTierSchema,
  tier_amount_usd: z.number(),
  rule_citation: z.string(),
  basis: z.enum(["api_confirmed", "self_declared", "conflicting"]),
  utility_accounts_found: z.array(UtilityAccountSchema),
  name_match: z.boolean(),
  intake_responses: UtilityIntakeSchema,
  generated_at: z.string(),
  attestation_required: z.boolean(),
});
export type UtilityPackage = z.infer<typeof UtilityPackageSchema>;

// ---------- Shared Lease ----------

export const SharedLeaseIntakeSchema = z.object({
  lease_in_applicant_name: z.boolean(),
  leaseholder_name: z.string().optional(),
  stated_monthly_rent: z.number(),
  payment_method: z.enum(["bank_transfer", "cash", "venmo_zelle", "other"]),
  address: z.string(),
});
export type SharedLeaseIntake = z.infer<typeof SharedLeaseIntakeSchema>;

export const RentTransactionSchema = z.object({
  transaction_id: z.string(),
  date: z.string(),
  amount: z.number(),
  name: z.string(),
  merchant_name: z.string().optional(),
  category: z.array(z.string()).optional(),
  counterparty: z.string().optional(),
});
export type RentTransaction = z.infer<typeof RentTransactionSchema>;

export const BankPaymentEvidenceSchema = z.object({
  match_found: z.boolean(),
  matched_amount: z.number(),
  frequency: z.enum(["monthly", "irregular", "none"]),
  confidence: ConfidenceSchema,
  months_confirmed: z.number(),
  matched_transactions: z.array(
    z.object({
      date: z.string(),
      amount: z.number(),
      description: z.string(),
      counterparty: z.string(),
    }),
  ),
});
export type BankPaymentEvidence = z.infer<typeof BankPaymentEvidenceSchema>;

export const SharedLeaseInputSchema = z.object({
  applicant_name: z.string(),
  state_code: StateCodeSchema,
  intake: SharedLeaseIntakeSchema,
  document_type: z.enum(["sublease", "landlord_letter", "none"]),
  document_filename: z.string().optional(),
  document_upload_id: z.string().optional(),
  bank_evidence: BankPaymentEvidenceSchema,
  address_valid: z.boolean(),
  address_normalized: z.string().optional(),
});
export type SharedLeaseInput = z.infer<typeof SharedLeaseInputSchema>;

export const SharedLeasePackageSchema = z.object({
  flow: z.literal("shared-lease"),
  applicant_name: z.string(),
  state_code: StateCodeSchema,
  lease_in_applicant_name: z.boolean(),
  leaseholder_name: z.string(),
  stated_monthly_rent: z.number(),
  document_type: z.enum(["sublease", "landlord_letter", "none"]),
  document_uploaded: z.boolean(),
  document_filename: z.string().optional(),
  document_upload_id: z.string().optional(),
  bank_payment_evidence: BankPaymentEvidenceSchema,
  address_valid: z.boolean(),
  address_normalized: z.string().optional(),
  qc_defensibility_score: DefensibilitySchema,
  regulatory_citations: z.array(z.string()),
  generated_at: z.string(),
});
export type SharedLeasePackage = z.infer<typeof SharedLeasePackageSchema>;

// ---------- Gig Income ----------

export const IncomeSourceTypeSchema = z.enum(["w2", "platform_gig", "cash"]);
export type IncomeSourceType = z.infer<typeof IncomeSourceTypeSchema>;

export const IncomeSourceSchema = z.object({
  type: IncomeSourceTypeSchema,
  source_name: z.string(),
  monthly_average: z.number(),
  verification_method: z.enum(["argyle_api", "plaid_deposits", "self_declared"]),
  confidence: z.enum(["verified", "corroborated", "self_declared"]),
});
export type IncomeSource = z.infer<typeof IncomeSourceSchema>;

export const CashWeekSchema = z.object({
  week_of: z.string(),
  amount: z.number(),
});
export type CashWeek = z.infer<typeof CashWeekSchema>;

export const GigIncomeInputSchema = z.object({
  applicant_name: z.string(),
  state_code: StateCodeSchema,
  sources: z.array(IncomeSourceSchema),
  cash_attestation_signed: z.boolean(),
  cash_log: z.array(CashWeekSchema).optional(),
});
export type GigIncomeInput = z.infer<typeof GigIncomeInputSchema>;

export const GigIncomePackageSchema = z.object({
  flow: z.literal("gig-income"),
  applicant_name: z.string(),
  state_code: StateCodeSchema,
  income_sources: z.array(IncomeSourceSchema),
  total_monthly_verified: z.number(),
  total_monthly_bank_corroborated: z.number(),
  total_monthly_self_declared_cash: z.number(),
  total_monthly_declared: z.number(),
  reconciliation_gap: z.number(),
  reconciliation_flag: z.boolean(),
  cash_attestation_signed: z.boolean(),
  cash_log: z.array(CashWeekSchema).optional(),
  snap_gross_income_limit_1person: z.number(),
  snap_bbce_applies: z.boolean(),
  regulatory_citations: z.array(z.string()),
  generated_at: z.string(),
});
export type GigIncomePackage = z.infer<typeof GigIncomePackageSchema>;

// ---------- Assets ----------

export const AssetTypeSchema = z.enum([
  "vehicle",
  "bank_account",
  "retirement",
  "real_property",
  "other_liquid",
]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetItemSchema = z.object({
  type: AssetTypeSchema,
  description: z.string(),
  stated_value: z.number(),
  exempt: z.boolean(),
  exemption_reason: z
    .enum(["primary_transport", "home", "retirement_excluded", "income_producing"])
    .optional(),
  countable_value: z.number(),
  verification_method: z.enum(["plaid_balance", "self_declared", "document_upload"]),
});
export type AssetItem = z.infer<typeof AssetItemSchema>;

export const AssetsInputSchema = z.object({
  applicant_name: z.string(),
  state_code: StateCodeSchema,
  assets: z.array(AssetItemSchema),
  elderly_or_disabled: z.boolean().optional(),
});
export type AssetsInput = z.infer<typeof AssetsInputSchema>;

export const AssetPackageSchema = z.object({
  flow: z.literal("assets"),
  applicant_name: z.string(),
  state_code: StateCodeSchema,
  assets: z.array(AssetItemSchema),
  total_countable_assets: z.number(),
  asset_limit_usd: z.number(),
  asset_test_applies: z.boolean(),
  asset_test_result: z.enum(["pass", "fail", "not_applicable"]),
  regulatory_citations: z.array(z.string()),
  generated_at: z.string(),
});
export type AssetPackage = z.infer<typeof AssetPackageSchema>;

// ---------- Evidence package union ----------

export const EvidencePackageSchema = z.discriminatedUnion("flow", [
  UtilityPackageSchema,
  SharedLeasePackageSchema,
  GigIncomePackageSchema,
  AssetPackageSchema,
]);
export type EvidencePackage = z.infer<typeof EvidencePackageSchema>;

// ---------- QcResult envelope ----------

export const CitationSchema = z.object({
  authority: z.string(),
  reference: z.string(),
  url: z.string().optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const DefensibilityFactorSchema = z.object({
  name: z.string(),
  weight: z.enum(["positive", "negative", "neutral"]),
  detail: z.string(),
});
export type DefensibilityFactor = z.infer<typeof DefensibilityFactorSchema>;

export const WarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
});
export type Warning = z.infer<typeof WarningSchema>;

export const QcResultSchema = z.object({
  flow: FlowKindSchema,
  state: StateCodeSchema,
  defensibility_score: DefensibilitySchema,
  defensibility_factors: z.array(DefensibilityFactorSchema),
  evidence_package: EvidencePackageSchema,
  citations: z.array(CitationSchema),
  warnings: z.array(WarningSchema),
  computed_at: z.string(),
  engine_version: z.string(),
});
export type QcResult = z.infer<typeof QcResultSchema>;

// ---------- Flow-input dispatch ----------

export type FlowInput<F extends FlowKind> = F extends "utility-sua"
  ? UtilitySuaInput
  : F extends "shared-lease"
    ? SharedLeaseInput
    : F extends "gig-income"
      ? GigIncomeInput
      : F extends "assets"
        ? AssetsInput
        : never;

export type EvaluateRequest<F extends FlowKind = FlowKind> = {
  flow: F;
  state: StateCode;
  inputs: FlowInput<F>;
};
