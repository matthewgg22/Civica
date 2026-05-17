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

// Document processing status — mirrors the processing_status CHECK constraint.
export const DocumentStatusSchema = z.enum([
  "pending",
  "uploading",
  "processing",
  "extracted",
  "failed",
  "rejected",
]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;
