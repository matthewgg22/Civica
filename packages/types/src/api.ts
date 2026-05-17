import { z } from "zod";

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export function paginatedResponse<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    total: z.number().int().min(0),
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
  });
}

export const SignedUploadUrlResponseSchema = z.object({
  upload_url: z.string().url(),
  storage_path: z.string(),
  expires_at: z.string().datetime(),
});
export type SignedUploadUrlResponse = z.infer<typeof SignedUploadUrlResponseSchema>;
