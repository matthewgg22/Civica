import { z } from "zod";
import { ExportFormatSchema } from "./enums.js";

export const EXPORT_DISCLAIMER =
  "This document is provided for informational purposes only to help you prepare for a SNAP application. It does not constitute a determination of program eligibility or benefits. Only the administering agency can make eligibility determinations.";

export const ExportSchema = z.object({
  id: z.string().uuid(),
  packet_id: z.string().uuid(),
  format: ExportFormatSchema,
  storage_path: z.string(),
  expires_at: z.string().datetime(),
  created_at: z.string().datetime(),
  disclaimer: z.literal(EXPORT_DISCLAIMER),
});
export type Export = z.infer<typeof ExportSchema>;

export const ExportRequestSchema = z.object({
  packet_id: z.string().uuid(),
  format: ExportFormatSchema,
});
export type ExportRequest = z.infer<typeof ExportRequestSchema>;
