import { z } from "zod";

// Zod mirror of schema/rules.schema.json.
// Schema validation fails the build (via tests) if helper_text_en or
// helper_text_es is missing from any document requirement.

const RequiredWhenSchema = z.union([
  z.object({ always: z.literal(true) }),
  z.object({ household_size_gte: z.number().int().min(1) }),
  z.object({ has_earned_income: z.literal(true) }),
  z.object({ has_unearned_income: z.literal(true) }),
  z.object({ claims_shelter_deduction: z.literal(true) }),
  z.object({ claims_utility_deduction: z.literal(true) }),
]);

export type RequiredWhen = z.infer<typeof RequiredWhenSchema>;

export const DOCUMENT_CATEGORIES = [
  "photo_id",
  "paystub",
  "lease",
  "utility_bill",
  "bank_statement",
  "tax_return",
  "benefit_letter",
  "other",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DocumentRequirementSchema = z.object({
  category: z.enum(DOCUMENT_CATEGORIES),
  label: z.string().min(1),
  helper_text_en: z.string().min(1),
  helper_text_es: z.string().min(1),
  required_when: RequiredWhenSchema,
  is_required: z.boolean(),
  review_note: z.string().optional(),
});

export type DocumentRequirement = z.infer<typeof DocumentRequirementSchema>;

export const ShelterRuleSchema = z.object({
  rule_type: z.string(),
  label_en: z.string().min(1),
  label_es: z.string().min(1),
}).passthrough();

export const IncomeThresholdSchema = z.object({
  threshold_type: z.string(),
  household_size: z.number().int().min(1),
  monthly_amount_usd: z.number().min(0),
}).passthrough();

export const SUPPORTED_VERSIONS = [1] as const;

export const RulesFileSchema = z.object({
  $schema: z.string().optional(),
  state_code: z.enum(["CA", "MA"]),
  version: z.literal(1),
  as_of_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "as_of_date must be YYYY-MM-DD"),
  document_requirements: z.array(DocumentRequirementSchema).min(1),
  shelter_rules: z.array(ShelterRuleSchema),
  income_thresholds: z.array(IncomeThresholdSchema),
});

export type RulesFile = z.infer<typeof RulesFileSchema>;
export type StateCode = RulesFile["state_code"];
