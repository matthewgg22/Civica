import { z } from "zod";
import { ExtractionFieldSchema } from "./extraction.js";
// Canonical enum definitions live in snap-enums; imported for local schema use
// and re-exported for backwards compat with packages/fixtures and packages/ui.
import { DocumentTypeSchema, DocumentStatusSchema } from "@civica/snap-enums";
export { DocumentTypeSchema, DocumentStatusSchema } from "@civica/snap-enums";
export type { DocumentType, DocumentStatus } from "@civica/snap-enums";

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
