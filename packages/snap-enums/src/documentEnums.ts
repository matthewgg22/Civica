import { z } from "zod";

// Document type enum — mirrors the document_type CHECK constraint in
// supabase/migrations. If you add a value here, add it to the migration too.
export const DocumentTypeSchema = z.enum([
  "photo_id",
  "paystub",
  "utility_bill",
  "bank_statement",
  "tax_return",
  "social_security_card",
  "birth_certificate",
  "lease_agreement",
  "other",
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

// Document processing status — mirrors the processing_status CHECK constraint
// in supabase/migrations. The flow is:
//   uploaded → classifying → extracting → awaiting_confirmation
//     → confirmed (navigator approved) OR rejected (navigator rejected)
export const DocumentStatusSchema = z.enum([
  "uploaded",
  "classifying",
  "extracting",
  "awaiting_confirmation",
  "confirmed",
  "rejected",
]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

// Set helpers — useful for downstream consumers that want to ask
// "is this status pre-review?" or "is this terminal?"
export const PRE_REVIEW_STATUSES = new Set<DocumentStatus>([
  "uploaded",
  "classifying",
  "extracting",
]);
export const REVIEW_READY_STATUSES = new Set<DocumentStatus>([
  "awaiting_confirmation",
]);
export const TERMINAL_STATUSES = new Set<DocumentStatus>([
  "confirmed",
  "rejected",
]);
