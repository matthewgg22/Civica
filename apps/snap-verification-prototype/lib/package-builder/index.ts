// Thin adapter over @civica/snap-qc-engine. Translates the prototype's
// camelCase option bags into the engine's typed snake_case inputs so
// existing UI pages and the demo SQLite store work unchanged. All pure
// QC logic lives in the engine package.

import {
  analyzeRentTransactions as engineAnalyzeRentTransactions,
  buildAssetPackage as engineBuildAssetPackage,
  buildGigIncomePackage as engineBuildGigIncomePackage,
  buildSharedLeasePackage as engineBuildSharedLeasePackage,
  buildUtilityPackage as engineBuildUtilityPackage,
  determineSuaTier,
} from "@civica/snap-qc-engine";
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
} from "@civica/snap-qc-engine";
import type { PlaidTransaction } from "@/lib/plaid";

export { determineSuaTier };

export function buildUtilityPackage(opts: {
  applicantName: string;
  serviceAddress: string;
  intake: UtilityIntake;
  accounts: UtilityAccount[];
  nameMatch: boolean;
}): UtilityPackage {
  return engineBuildUtilityPackage({
    applicant_name: opts.applicantName,
    service_address: opts.serviceAddress,
    intake: opts.intake,
    accounts: opts.accounts,
    name_match: opts.nameMatch,
  });
}

export function analyzeRentTransactions(
  txns: PlaidTransaction[],
  statedAmount: number,
  leaseholderName: string,
): BankPaymentEvidence {
  return engineAnalyzeRentTransactions(
    txns.map((t) => ({
      transaction_id: t.transaction_id,
      date: t.date,
      amount: t.amount,
      name: t.name,
      merchant_name: t.merchant_name,
      category: t.category,
      counterparty: t.counterparty,
    })),
    statedAmount,
    leaseholderName,
  );
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
  return engineBuildSharedLeasePackage({
    applicant_name: opts.applicantName,
    state_code: opts.stateCode,
    intake: opts.intake,
    document_type: opts.documentType,
    document_filename: opts.documentFilename,
    document_upload_id: opts.documentUploadId,
    bank_evidence: opts.bankEvidence,
    address_valid: opts.addressValid,
    address_normalized: opts.addressNormalized,
  });
}

export function buildGigIncomePackage(opts: {
  applicantName: string;
  stateCode: StateCode;
  sources: IncomeSource[];
  cashAttestationSigned: boolean;
  cashLog?: { week_of: string; amount: number }[];
}): GigIncomePackage {
  return engineBuildGigIncomePackage({
    applicant_name: opts.applicantName,
    state_code: opts.stateCode,
    sources: opts.sources,
    cash_attestation_signed: opts.cashAttestationSigned,
    cash_log: opts.cashLog,
  });
}

export function buildAssetPackage(opts: {
  applicantName: string;
  stateCode: StateCode;
  assets: AssetItem[];
  elderlyOrDisabled?: boolean;
}): AssetPackage {
  return engineBuildAssetPackage({
    applicant_name: opts.applicantName,
    state_code: opts.stateCode,
    assets: opts.assets,
    elderly_or_disabled: opts.elderlyOrDisabled,
  });
}
