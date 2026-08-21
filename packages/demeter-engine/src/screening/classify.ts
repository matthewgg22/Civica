// The six screening outcomes, straight from the mockup's frame 05.
//
// composeVerdict returns APPROVE/DENY + a reason code. This maps that,
// screenExpedited's separate determination, and the completeness check into
// the classification a caseworker actually reads. None of the underlying
// eligibility math lives here — this is presentation logic over results
// snap-rules already computed.

import { composeVerdict, screenExpedited, evaluateCategorical, type VerdictResult } from "@civica/snap-rules";
import { assessCompleteness, completeFactsShape, type CompletenessResult } from "./completeness";
import type { PartialFacts } from "./facts-extraction";

export type ScreeningOutcome =
  | "not_enough_information"
  | "needs_county_review"
  | "categorically_eligible"
  | "expedited"
  | "likely_eligible"
  | "likely_ineligible";

export interface ScreeningClassification {
  outcome: ScreeningOutcome;
  /** One sentence — the mockup's own copy pattern ("Net income falls under
   *  the one-person limit"). */
  summary: string;
  verdict?: VerdictResult;
  completeness: CompletenessResult;
}

// Income types the engine can compute but that carry enough real-world
// variability (self-employment cost deductions, disputed hours) that a
// screener should hand off to the county rather than assert a number.
// Mirrors the mockup's own example: "Self-employment income requires a
// caseworker calculation."
const NEEDS_REVIEW_INCOME_TYPES = new Set(["self_employment", "farm_se"]);

function needsCountyReview(facts: PartialFacts): string | null {
  const hasSelfEmployment = (facts.income ?? []).some((i) =>
    NEEDS_REVIEW_INCOME_TYPES.has(i.type),
  );
  if (hasSelfEmployment) {
    return "Self-employment income requires a caseworker calculation.";
  }
  // A MIXED household with an unexempt half-time+ student (#898 second
  // pass): federal rules exclude the ineligible student from household size
  // while still counting their income (7 CFR 273.5; 273.1(b)(7)(i)) — math
  // the engine's household-global student gate can't do yet (it would DENY
  // the whole family, a documented Wave-2 gap in gates/student.ts). Rather
  // than compute a wrong number in either direction, route to a caseworker.
  // A SINGLE-person at-risk student flows through: the engine's own DENY is
  // correct there and matches its oracle coverage.
  const household = facts.household ?? [];
  const atRiskStudent = household.some(
    (m) =>
      m.age !== undefined &&
      m.age >= 18 &&
      m.age <= 49 &&
      m.student === "he_halftime_subject",
  );
  if (atRiskStudent && household.length > 1) {
    return "A student enrolled at least half-time is in the household — student eligibility needs a caseworker's review.";
  }
  return null;
}

export function classifyScreening(
  facts: PartialFacts,
  state: string,
  asOf: Date,
): ScreeningClassification {
  const completeness = assessCompleteness(facts);
  if (!completeness.computable) {
    return {
      outcome: "not_enough_information",
      summary: "Household size and income are still unknown.",
      completeness,
    };
  }

  const reviewReason = needsCountyReview(facts);
  if (reviewReason) {
    return {
      outcome: "needs_county_review",
      summary: reviewReason,
      completeness,
    };
  }

  // Same shape-completion assessCompleteness used to decide "computable" —
  // required by, e.g., composeVerdict's own Facts.deductions type, which is
  // legitimately just {} when nobody has any, never something to ask about.
  const full = completeFactsShape(facts);

  // Expedited screening is a SEPARATE federal path (7 CFR 273.2(i)) — a
  // household can be expedited-eligible independent of the ordinary verdict,
  // and the mockup treats it as its own outcome ("File today. The 7-day
  // clock starts at the application date, not the interview.").
  const expedited = screenExpedited(full);
  if (expedited.status === "eligible") {
    return {
      outcome: "expedited",
      summary: "Likely eligible · expedited service — file today.",
      completeness,
    };
  }

  const verdict = composeVerdict(full, state, asOf);

  if (verdict.not_implemented_surfaces?.length) {
    // The engine itself can't compute this household yet — a completeness gap
    // from the SCREENER's point of view even though the shape validated.
    //
    // But say WHOSE gap it is. "state-policy-not-loaded" means snap-rules has
    // no policy for this state at all, which is OUR gap, not the reader's —
    // and a corpus pack CAN exist for a state the calculator doesn't cover
    // (all 14 corpus states had engine parity as of #733/#734/etc., 2026-08;
    // this path stays live for whenever a NEW state pack lands ahead of its
    // own engine math again). Telling someone who gave complete information
    // that they are missing information is false, and it sends them looking
    // for a document that does not exist.
    const stateGap = verdict.not_implemented_surfaces.includes("state-policy-not-loaded");
    return {
      outcome: "not_enough_information",
      summary: stateGap
        ? `We can answer ${state} policy questions, but we can't calculate a benefit estimate for ${state} yet — that's our gap, not anything missing from what you told us. Your state agency can give you an exact figure.`
        : "This household needs information our screener doesn't have yet.",
      verdict,
      completeness,
    };
  }

  if (verdict.verdict === "DENY") {
    return {
      outcome: "likely_ineligible",
      summary: verdict.reason ?? "Gross or net income is above the limit for this household size.",
      verdict,
      completeness,
    };
  }

  // APPROVE. Categorical (pure SSI/TANF) is its own outcome per the mockup
  // ("Household receives SSI, so income and asset tests are waived").
  const cat = evaluateCategorical(full);
  if (cat.path === "pure_cash") {
    return {
      outcome: "categorically_eligible",
      summary: cat.reason,
      verdict,
      completeness,
    };
  }

  return {
    outcome: "likely_eligible",
    summary: "Net income falls under the limit for this household size.",
    verdict,
    completeness,
  };
}
