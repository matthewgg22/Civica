import { z } from "zod";
import { OcrProviderSchema } from "./enums.js";

export const BboxSchema = z.object({
  left: z.number().min(0).max(1),
  top: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
  page: z.number().int().min(0),
});
export type Bbox = z.infer<typeof BboxSchema>;

export const ExtractionFieldSchema = z.object({
  name: z.string().min(1),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  bbox: BboxSchema.optional(),
  provider: OcrProviderSchema,
  raw: z.unknown().optional(),
});
export type ExtractionField = z.infer<typeof ExtractionFieldSchema>;

export const PaystubExtractionSchema = z.object({
  employer_name: z.string().optional(),
  employee_name: z.string().optional(),
  pay_period_start: z.string().optional(),
  pay_period_end: z.string().optional(),
  pay_date: z.string().optional(),
  gross_pay: z.string().optional(),
  net_pay: z.string().optional(),
  ytd_gross: z.string().optional(),
  pay_frequency: z.string().optional(),
});
export type PaystubExtraction = z.infer<typeof PaystubExtractionSchema>;

export const GenericDocExtractionSchema = z.object({
  full_name: z.string().optional(),
  date_of_birth: z.string().optional(),
  address: z.string().optional(),
  zip_code: z.string().optional(),
  amount: z.string().optional(),
  document_date: z.string().optional(),
});
export type GenericDocExtraction = z.infer<typeof GenericDocExtractionSchema>;

export const OcrResultSchema = z.object({
  document_id: z.string().uuid(),
  provider: OcrProviderSchema,
  fields: z.array(ExtractionFieldSchema),
  raw_response: z.unknown().optional(),
  processing_ms: z.number().int().optional(),
  created_at: z.string().datetime(),
});
export type OcrResult = z.infer<typeof OcrResultSchema>;
