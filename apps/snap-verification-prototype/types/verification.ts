// Re-export canonical types from @civica/snap-qc-engine.
//
// The QC engine package owns the source of truth for verification
// inputs, intermediate evidence shapes, and the QcResult envelope.
// Local-only types (StoredPackage, GigPlatform, VerificationPackage
// union) stay here because they are concerns of the SQLite demo store
// and the platform-specific Argyle adapter, not the engine.

export type {
  StateCode,
  SuaTier,
  Confidence,
  UtilityIntake,
  UtilityAccount,
  UtilityPackage,
  SharedLeaseIntake,
  BankPaymentEvidence,
  SharedLeasePackage,
  IncomeSourceType,
  IncomeSource,
  CashWeek,
  GigIncomePackage,
  AssetType,
  AssetItem,
  AssetPackage,
} from "@civica/snap-qc-engine";

import type {
  UtilityPackage,
  SharedLeasePackage,
  GigIncomePackage,
  AssetPackage,
} from "@civica/snap-qc-engine";

export type VerificationFlow = "utility" | "shared-lease" | "gig-income" | "assets";

export type GigPlatform =
  | "doordash"
  | "uber"
  | "lyft"
  | "instacart"
  | "taskrabbit"
  | "amazon_flex"
  | "other";

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
