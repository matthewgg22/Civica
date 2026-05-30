import { z } from "zod";
import caRules from "../rules/appealability/CA.json";
import maRules from "../rules/appealability/MA.json";

// Appealability evaluator. CQ-4 of iOS audit 2026-05-29.
//
// Inputs: a denial reason code (free-form string the inbound notice
// ingestion eventually classifies), the state code, the decision
// date, and an optional override "now" for testability.
//
// Outputs an object with:
//   isAppealable — should the Appeal next-step card be the primary
//                  CTA on the denial view?
//   reason       — discriminator describing WHY: window_expired,
//                  category_excluded, within_window, or
//                  unknown_reason (no denial reason provided yet —
//                  default to appealable so we don't accidentally
//                  block a user who has a real right of appeal).
//
// State-author-friendly: rule data lives in JSON under
// rules/appealability/{STATE}.json and is auditable per-state.

export const AppealabilityRulesSchema = z
  .object({
    $schema: z.string().optional(),
    state_code: z.enum(["CA", "MA"]),
    version: z.literal(1),
    as_of_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    window_days: z.number().int().positive(),
    non_appealable_categories: z.array(z.string()),
    source: z.string().optional(),
  })
  .strict();

export type AppealabilityRules = z.infer<typeof AppealabilityRulesSchema>;

const STATE_DATA: Record<string, unknown> = {
  CA: caRules,
  MA: maRules,
};

export function loadAppealabilityRules(stateCode: "CA" | "MA"): AppealabilityRules {
  const raw = STATE_DATA[stateCode];
  if (raw === undefined) throw new Error(`No appealability rules for state: ${stateCode}`);
  return AppealabilityRulesSchema.parse(raw);
}

export type AppealabilityReason =
  | "within_window"
  | "window_expired"
  | "category_excluded"
  | "unknown_reason";

export interface AppealabilityResult {
  isAppealable: boolean;
  reason: AppealabilityReason;
}

export function evaluateAppealability(
  denialReason: string | null | undefined,
  state: "CA" | "MA",
  decisionDate: Date,
  now: Date = new Date(),
): AppealabilityResult {
  const rules = loadAppealabilityRules(state);

  // Unknown reason: default to appealable (today's behavior) so we
  // don't accidentally block a user who has a real right of appeal.
  if (denialReason === null || denialReason === undefined || denialReason === "") {
    return { isAppealable: true, reason: "unknown_reason" };
  }

  if (rules.non_appealable_categories.includes(denialReason)) {
    return { isAppealable: false, reason: "category_excluded" };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSince = Math.floor((now.getTime() - decisionDate.getTime()) / msPerDay);
  if (daysSince > rules.window_days) {
    return { isAppealable: false, reason: "window_expired" };
  }

  return { isAppealable: true, reason: "within_window" };
}
