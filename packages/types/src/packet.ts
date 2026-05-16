import { z } from "zod";
import { PacketStatusSchema, DocumentTypeSchema, DocumentStatusSchema, SupportedStateSchema } from "./enums.js";
import { ExtractionFieldSchema } from "./extraction.js";

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
