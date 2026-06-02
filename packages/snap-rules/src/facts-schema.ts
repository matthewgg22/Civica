// Zod schema for the verdict composer's Facts input.
//
// Mirrors data-ops/sample/civica-test-profiles/v0.6.schema.json (Draft
// 2020-12) using the same Zod pattern already established in
// packages/snap-rules/src/schema.ts (RulesFileSchema) and consumed at
// the API boundary by apps/enrollment-api/src/routes/packets.ts.
//
// Used to gate composeVerdict — malformed Facts get rejected with a
// structured safeParse error rather than crashing the engine. The
// 2026-06-02 audit showed that throws in the composer were being
// silently classified as harness SKIPs; the schema gate makes the
// engine's input contract explicit.

import { z } from "zod";

export const SUATierSchema = z.enum(["HCSUA", "LUA", "phone", "none"]);

export const MemberSchema = z
  .object({
    member_id: z.string().min(1),
    age: z.number().int().min(0).max(150),
    role: z.string().min(1),
    disability: z.boolean().optional(),
    elderly: z.boolean().optional(),
    student: z.string().optional(),
    immigration: z.string().optional(),
    five_yr_bar: z.string().optional(),
    sponsored: z.boolean().optional(),
    work_class: z.string().optional(),
    abawd_months_used: z.number().int().min(0).optional(),
    disqual: z.array(z.string()).optional(),
    living: z.string().optional(),
  })
  .passthrough();

export const IncomeLineSchema = z
  .object({
    member: z.string().optional(),
    type: z.string().optional(),
    amount: z.number(),
    freq: z.string().optional(),
    anticipation: z.string().optional(),
    source_status: z.string().optional(),
  })
  .passthrough();

export const ShelterSchema = z
  .object({
    rent: z.number(),
    sua_tier: SUATierSchema,
    sua_amount: z.number().optional(),
    internet: z.number().optional(),
    homeless_deduction: z.boolean().optional(),
  })
  .passthrough();

export const DeductionsSchema = z
  .object({
    dependent_care: z.number().optional(),
    medical_unreimbursed: z.number().optional(),
    child_support_paid: z.number().optional(),
  })
  .passthrough();

/**
 * `assets` is either a number (countable resources $) or a sentinel
 * string ("n/a:categorical_no_asset_test" for cat-elig HHs where the
 * asset test is waived; "n/a:not_authored" for fixture profiles that
 * didn't pin a value).
 */
export const AssetsSchema = z.union([z.number(), z.string()]);

/**
 * Top-level Facts schema. Variant-specific runtime flags
 * (`coresident_income_pct`, `must_combine_with_parent`,
 * `active_warrant`, etc.) live alongside the canonical fields; the
 * top-level `passthrough` preserves them so the composition gate
 * can read them.
 */
export const FactsSchema = z
  .object({
    household: z.array(MemberSchema).min(0),
    income: z.array(IncomeLineSchema),
    shelter: ShelterSchema,
    deductions: DeductionsSchema,
    assets: AssetsSchema,
    cat_elig: z.string(),
    expedited: z.boolean().optional(),
    sponsor_income: z.number().nullable().optional(),
    as_of_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .passthrough();

export type FactsSchemaInput = z.input<typeof FactsSchema>;
export type FactsSchemaOutput = z.output<typeof FactsSchema>;

/**
 * Returns null on success, or a flat list of `path: message` error
 * lines on failure. Used by composeVerdict at the front door; the
 * composer rejects malformed Facts with a structured SKIP instead of
 * crashing.
 */
export function validateFacts(facts: unknown): string[] | null {
  const r = FactsSchema.safeParse(facts);
  if (r.success) return null;
  return r.error.issues.map(
    (i) => `${i.path.length > 0 ? i.path.join(".") : "(root)"}: ${i.message}`,
  );
}
