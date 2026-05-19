import { z } from "zod";

// Stable identifier: lowercase ASCII letters, digits, and underscores.
// Same shape used by both registries so cross-references stay simple.
const idSchema = z.string().regex(/^[a-z0-9_]+$/);

export const BannedPhraseSchema = z
  .object({
    id: idSchema,
    phrase: z.string().min(1),
    audit_reference: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

export const RevisionStatusSchema = z.enum(["pending_signoff", "approved"]);

export const PendingCopyRevisionSchema = z
  .object({
    id: idSchema,
    surface_file: z.string().min(1),
    string_id: z.string().min(1),
    current_english: z.string().min(1),
    approved_english: z.string().min(1).nullable(),
    approved_spanish: z.string().min(1).nullable(),
    audit_reference: z.string().min(1),
    rationale: z.string().min(1),
    status: RevisionStatusSchema,
  })
  .strict();

export const BannedPhrasesFileSchema = z
  .object({
    $schema: z.string().optional(),
    entries: z.array(BannedPhraseSchema).min(1),
  })
  .strict();

// Session A — bilingual exemption description copy.
// One row per exemption-type key; consumed by both iOS (via Swift codegen
// or hand-mirrored constants) and the dashboard/web surfaces.
export const ExemptionCopySchema = z
  .object({
    id: idSchema,
    audit_reference: z.string().min(1),
    rationale: z.string().min(1),
    en: z.string().min(1),
    es: z.string().min(1),
  })
  .strict();

export const ExemptionCopyFileSchema = z
  .object({
    $schema: z.string().optional(),
    entries: z.array(ExemptionCopySchema).min(1),
  })
  .strict();

export type ExemptionCopy = z.infer<typeof ExemptionCopySchema>;

export const PendingRevisionsFileSchema = z
  .object({
    $schema: z.string().optional(),
    entries: z.array(PendingCopyRevisionSchema).min(1),
  })
  .strict();

export type BannedPhrase = z.infer<typeof BannedPhraseSchema>;
export type PendingCopyRevision = z.infer<typeof PendingCopyRevisionSchema>;
export type RevisionStatus = z.infer<typeof RevisionStatusSchema>;
