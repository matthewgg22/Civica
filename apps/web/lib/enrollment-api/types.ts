// Mirror of Civica/Features/SNAP/Enrollment/EnrollmentModels.swift.
// Keep field names + enum values byte-identical to the Swift source so the
// gateway sees the same wire format from iOS and web. When updating either
// side, update the other in the same PR.

// MARK: - Packet status

// The 8 safe status labels from enrollment-api/src/routes/packets.ts.
// Never add "approved" / "denied" / "eligible" — those are state agency
// determinations and the gateway will reject them.
export const PACKET_STATUS = {
  draft: "Draft",
  submittedForReview: "Submitted for Review",
  needsDocuments: "Needs Documents",
  needsApplicantClarification: "Needs Applicant Clarification",
  inNavigatorReview: "In Navigator Review",
  readyForHandoff: "Ready for Handoff",
  handedOff: "Handed Off",
  closed: "Closed",
} as const;

export type PacketStatus = (typeof PACKET_STATUS)[keyof typeof PACKET_STATUS];

export function isActionableStatus(status: PacketStatus): boolean {
  return status === PACKET_STATUS.needsDocuments
    || status === PACKET_STATUS.needsApplicantClarification;
}

export type EnrollmentPacket = {
  id: string;
  status: PacketStatus;
  state_code: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  notes_for_applicant: string | null;
};

// MARK: - Document

// Mirror of EnrollmentDocumentKind.swift. Wire values must match.
export const DOCUMENT_KIND = {
  paystub: "paystub",
  photoId: "photo_id",
  lease: "lease",
  utilityBill: "utility_bill",
  bankStatement: "bank_statement",
  taxReturn: "tax_return",
  benefitLetter: "benefit_letter",
  other: "other",
} as const;

export type DocumentKind = (typeof DOCUMENT_KIND)[keyof typeof DOCUMENT_KIND];

// UI display order — most-requested first. Mirrors iOS `orderedCases`.
export const DOCUMENT_KIND_ORDER: DocumentKind[] = [
  DOCUMENT_KIND.photoId,
  DOCUMENT_KIND.paystub,
  DOCUMENT_KIND.utilityBill,
  DOCUMENT_KIND.lease,
  DOCUMENT_KIND.bankStatement,
  DOCUMENT_KIND.taxReturn,
  DOCUMENT_KIND.benefitLetter,
  DOCUMENT_KIND.other,
];

// uploaded → classifying → extracting → awaiting_confirmation
//   → confirmed (navigator approved) OR rejected (navigator rejected)
export const DOCUMENT_PROCESSING_STATUS = {
  uploaded: "uploaded",
  classifying: "classifying",
  extracting: "extracting",
  awaitingConfirmation: "awaiting_confirmation",
  confirmed: "confirmed",
  rejected: "rejected",
} as const;

export type DocumentProcessingStatus =
  (typeof DOCUMENT_PROCESSING_STATUS)[keyof typeof DOCUMENT_PROCESSING_STATUS];

export type EnrollmentDocument = {
  document_id: string;
  packet_id: string;
  applicant_id: string;
  storage_path: string;
  original_filename: string | null;
  document_kind: DocumentKind | null;
  processing_status: DocumentProcessingStatus;
  on_device_quality_passed: boolean;
  uploaded_at: string;
};

// MARK: - Inbox item (navigator → applicant missing-item requests)

export type EnrollmentInboxItem = {
  id: string;
  packet_id: string;
  prompt: string;
  created_at: string;
  resolved: boolean;
};

// MARK: - Error risk

export type ErrorRiskTier = "high" | "medium" | "low" | "incomplete";

export type ErrorRiskResult = {
  tier: ErrorRiskTier;
  score: number | null;
  factors: string[];
  engine_version: string;
};
