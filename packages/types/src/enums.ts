import { z } from "zod";

export const PacketStatusSchema = z.enum([
  "draft",
  "in_progress",
  "ready_for_review",
  "submitted",
  "archived",
]);
export type PacketStatus = z.infer<typeof PacketStatusSchema>;

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

export const DocumentStatusSchema = z.enum([
  "pending",
  "uploading",
  "processing",
  "extracted",
  "failed",
  "rejected",
]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const OcrProviderSchema = z.enum(["on_device", "textract", "document_ai"]);
export type OcrProvider = z.infer<typeof OcrProviderSchema>;

export const UserRoleSchema = z.enum(["applicant", "navigator", "admin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const ExportFormatSchema = z.enum(["pdf", "json"]);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

export const SupportedStateSchema = z.enum(["CA", "MA"]);
export type SupportedState = z.infer<typeof SupportedStateSchema>;
