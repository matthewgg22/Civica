// Run the synthetic demo households through the REAL rules engine (#504/#505).
//
// This is what makes /cbo-preview honest: instead of hand-typed verdict/benefit
// constants, every number rendered is computed live by @civica/snap-rules
// (composeVerdict + computeBenefit). The households are synthetic
// (DEMO_HOUSEHOLDS, pure fiction from the v0.6 deck), so there is zero PII on
// this public page — but the engine output is the same code path a real packet
// runs.
//
// Pure + never throws: each household is assessed independently; if computeBenefit
// throws (e.g. an unauthored SUA tier), that household's benefit degrades to null
// without sinking the page (mirrors facts-adapter's defensive posture).

import { composeVerdict, computeBenefit } from "@civica/snap-rules";
import { DEMO_HOUSEHOLDS, DEMO_AS_OF, type DemoHousehold } from "./__fixtures__/demo-households";

export interface DemoAssessment {
  key: string;
  name: string;
  situation: string;
  /** Live verdict from composeVerdict — "APPROVE" | "DENY" | "UNKNOWN". */
  verdict: string;
  /** Whether the live verdict matches the v0.6 oracle (demo integrity guard). */
  matchesOracle: boolean;
  /** Live monthly benefit if eligible (computeBenefit), else null. */
  monthlyBenefitUsd: number | null;
  /** Household member count (from facts). */
  householdSize: number;
  /** Gross monthly income (computeBenefit), 0 if the calc threw. */
  grossMonthlyUsd: number;
  /** Net monthly income after deductions (computeBenefit), 0 if the calc threw. */
  netMonthlyUsd: number;
  /** One-line plain-English explanation of the verdict (from the deduction trace). */
  why: string;
}

function explain(
  verdict: string,
  benefit: number | null,
  grossMonthlyIncome: number,
  netMonthlyIncome: number,
  reason: string | undefined,
): string {
  if (verdict === "DENY") {
    // Only the income tests are about income. Naming "income" for an
    // immigration / disqualification / ABAWD / composition denial would print a
    // false reason on this public page — so name income ONLY when the engine's
    // reason actually IS an income test; otherwise stay accurate and neutral.
    const isIncomeDenial =
      reason?.startsWith("gross_income") || reason?.startsWith("net_income");
    if (isIncomeDenial) {
      return `Counted income ($${Math.round(grossMonthlyIncome)}/mo gross) exceeds the program limit for this household.`;
    }
    return "Not eligible under SNAP rules for this household.";
  }
  if (verdict === "APPROVE") {
    return `Eligible — after deductions, net income is $${Math.round(netMonthlyIncome)}/mo, yielding a $${benefit ?? 0}/mo allotment.`;
  }
  return "Engine could not produce a determination for this household.";
}

/** Assess one synthetic household with the live engine. Pure, never throws. */
export function assessDemoHousehold(h: DemoHousehold, asOf: Date): DemoAssessment {
  const state = "CA";

  // Both engine calls are guarded — a throw from either degrades that household
  // to UNKNOWN / null benefit rather than sinking the whole public page.
  let verdict = "UNKNOWN";
  let reason: string | undefined;
  try {
    const verdictResult = composeVerdict(h.facts, state, asOf);
    verdict = verdictResult.verdict ?? "UNKNOWN";
    reason = verdictResult.reason;
  } catch {
    verdict = "UNKNOWN";
  }

  let monthlyBenefitUsd: number | null = null;
  let gross = 0;
  let net = 0;
  try {
    const detail = computeBenefit(h.facts, state, asOf);
    gross = detail.gross_monthly_income;
    net = detail.net_monthly_income;
    monthlyBenefitUsd = verdict === "APPROVE" ? detail.monthly_benefit : null;
  } catch {
    monthlyBenefitUsd = null;
  }

  return {
    key: h.key,
    name: h.name,
    situation: h.situation,
    verdict,
    matchesOracle: verdict === h.oracleCA.verdict,
    monthlyBenefitUsd,
    householdSize: h.facts.household?.length ?? 0,
    grossMonthlyUsd: Math.round(gross),
    netMonthlyUsd: Math.round(net),
    why: explain(verdict, monthlyBenefitUsd, gross, net, reason),
  };
}

/**
 * Assess every demo household with the live engine.
 *
 * asOf defaults to DEMO_AS_OF (the deck's FY2026 basis), NOT the wall clock, so
 * the public demo is deterministic and always matches the v0.6 oracle the
 * regression test asserts — a CBO sees the same verdicts whatever day they load
 * the page, and the engine is evaluated against the same policy date the
 * fixtures were authored for.
 */
export function assessDemoHouseholds(asOf: Date = DEMO_AS_OF): DemoAssessment[] {
  return DEMO_HOUSEHOLDS.map((h) => assessDemoHousehold(h, asOf));
}
