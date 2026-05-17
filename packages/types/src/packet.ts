import { z } from "zod";
import { ExtractionFieldSchema } from "./extraction.js";

// These enums mirror the DB values for fixtures / API validation.
// Canonical source of truth for the 8-state workflow lives in
// packages/snap-enums (to be created) and supabase migrations.
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

export const SupportedStateSchema = z.enum(["CA", "MA"]);
export type SupportedState = z.infer<typeof SupportedStateSchema>;

export const PacketStatusSchema = z.enum([
  "draft",
  "in_progress",
  "ready_for_review",
  "submitted",
  "archived",
]);
export type PacketStatus = z.infer<typeof PacketStatusSchema>;

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  packet_id: z.string().uuid(),
  type: DocumentTypeSchema,
  status: DocumentStatusSchema,
  storage_path: z.string(),
  file_name: z.string(),
  file_size_bytes: z.number().int().positive(),
  mime_type: z.string(),
  extraction_fields: z.array(ExtractionFieldSchema).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Document = z.infer<typeof DocumentSchema>;

export const PacketSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  state: SupportedStateSchema,
  status: PacketStatusSchema,
  readiness_score: z.number().min(0).max(100).nullable(),
  documents: z.array(DocumentSchema).optional(),
  navigator_id: z.string().uuid().nullable(),
  submitted_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Packet = z.infer<typeof PacketSchema>;

export const CreatePacketInputSchema = z.object({
  state: SupportedStateSchema,
});
export type CreatePacketInput = z.infer<typeof CreatePacketInputSchema>;

export const UploadDocumentInputSchema = z.object({
  packet_id: z.string().uuid(),
  type: DocumentTypeSchema,
  file_name: z.string().min(1),
  file_size_bytes: z.number().int().positive(),
  mime_type: z.string().min(1),
});
export type UploadDocumentInput = z.infer<typeof UploadDocumentInputSchema>;
