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

// State-keyed variant map. Rows where program name / agency attribution
// differs between launch states (CA = "CalFresh"/CDSS, MA = "SNAP"/DTA)
// supply per-state strings; rows whose copy is state-agnostic use the
// flat `approved_english` / `approved_spanish` slot.
const StateKeyedStringSchema = z
  .object({
    CA: z.string().min(1).optional(),
    MA: z.string().min(1).optional(),
  })
  .strict()
  .refine((v) => v.CA !== undefined || v.MA !== undefined, {
    message: "state-keyed variant must include at least one state",
  });

export const PendingCopyRevisionSchema = z
  .object({
    id: idSchema,
    surface_file: z.string().min(1),
    string_id: z.string().min(1),
    current_english: z.string().min(1),
    approved_english: z.string().min(1).nullable(),
    approved_spanish: z.string().min(1).nullable(),
    // Optional state-keyed override maps. When present, the registry's
    // state-aware lookup prefers the state's variant; the flat
    // `approved_english`/`approved_spanish` slot is the default fallback.
    approved_english_by_state: StateKeyedStringSchema.optional(),
    approved_spanish_by_state: StateKeyedStringSchema.optional(),
    audit_reference: z.string().min(1),
    rationale: z.string().min(1),
    status: RevisionStatusSchema,
    // Set to true when Spanish strings haven't been validated by the
    // Session K Spanish reviewer yet. Surfaces to QA / launch preflight.
    spanish_parity_review_pending: z.boolean().optional(),
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
