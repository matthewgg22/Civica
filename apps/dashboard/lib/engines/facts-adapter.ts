// packet_answers (EAV) → snap-rules Facts (#504).
//
// Real packets store a flat key→value answer set (packet_answers.question_key /
// applicant_answer, with navigator_confirmed_value as an override). Today the
// apply flow collects only: household_size, employment_status, monthly_income,
// monthly_rent, has_children, has_disability (rarely housing_situation,
// monthly_utilities).
//
// That is enough to ESTIMATE the benefit amount (computeBenefit is just the
// deduction-stack math) but NOT to render a true eligibility verdict —
// citizenship, ages, assets, and cat-elig aren't collected. So this adapter:
//   • fills the unknown determinative fields with documented ASSUMPTIONS so the
//     benefit math can run, and
//   • returns the list of fields a navigator must confirm before the verdict is
//     real (confirmForVerdict). No silent defaults dressed up as fact.
//
// Resilient by construction: unknown keys are ignored; as the apply flow starts
// collecting more (immigration, assets, …), wire them in here and the estimate
// sharpens into a determination. Reads stable DB keys, not the in-flux apply types.

import { computeBenefit } from "@civica/snap-rules";
import type { Facts } from "@civica/snap-rules";
import { evaluateComponentR, type Recommendation } from "@civica/snap-recommendation";

/** Flat answer map for one packet: question_key → confirmed-or-applicant value. */
export type PacketAnswers = Record<string, string | null | undefined>;

export interface PacketFactsResult {
  facts: Facts;
  /** Assumptions baked in to run the math (each is a thing to verify). */
  assumptions: string[];
  /** Fields not collected today that a verdict needs — the navigator's checklist. */
  confirmForVerdict: string[];
}

export interface PacketEstimate extends PacketFactsResult {
  /** Estimated monthly benefit IF eligible (benefit math only, not a verdict). */
  estimatedMonthlyBenefitUsd: number;
}

function toNum(v: string | null | undefined): number {
  if (!v) return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function toBool(v: string | null | undefined): boolean {
  const s = String(v ?? "").toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

/**
 * Build a Facts from the collected answers, plus the honesty metadata. Pure.
 * Maps only the keys that exist today; everything else is a documented
 * assumption surfaced in `assumptions` / `confirmForVerdict`.
 */
export function packetAnswersToFacts(answers: PacketAnswers): PacketFactsResult {
  const size = Math.max(1, Math.round(toNum(answers.household_size)) || 1);
  const monthlyIncome = toNum(answers.monthly_income);
  const rent = toNum(answers.monthly_rent);
  const utilities = toNum(answers.monthly_utilities);
  const hasDisability = toBool(answers.has_disability);
  const employment = String(answers.employment_status ?? "").toLowerCase();
  const incomeType = employment.includes("self") ? "self_employment" : "wages";

  const assumptions: string[] = [];
  const confirmForVerdict: string[] = [];

  // Household: we know the size but not per-member detail. Assume one
  // working-age adult head + dependents, all citizens, so the size-driven
  // benefit math runs. Flagged for confirmation — never trusted as fact.
  const household: Facts["household"] = Array.from({ length: size }, (_, i) => ({
    member_id: `m${i + 1}`,
    age: i === 0 ? 35 : 10,
    role: i === 0 ? "head" : "child",
    immigration: "citizen",
    disability: i === 0 ? hasDisability : false,
    elderly: false,
    student: "not",
    five_yr_bar: "n/a",
    sponsored: false,
    work_class: "gen_work_subject",
    abawd_months_used: 0,
    disqual: [],
    living: "housed",
  }));
  assumptions.push("Household members assumed U.S. citizens of working age");
  confirmForVerdict.push("Citizenship / immigration status (per member)", "Ages (per member)");

  // SUA: if utilities were reported assume the full tier, else none.
  const suaTier = utilities > 0 ? "HCSUA" : "none";
  if (utilities <= 0) confirmForVerdict.push("Utility costs (heating/cooling, electric, phone)");

  // Not collected today.
  assumptions.push("Assumed no countable assets and regular (non-categorical) eligibility");
  confirmForVerdict.push("Liquid assets (asset test)", "Cash-aid status (TANF / SSI)");

  const facts: Facts = {
    household,
    income:
      monthlyIncome > 0
        ? [{ member: "m1", type: incomeType, amount: monthlyIncome, freq: "monthly", anticipation: "averaged", source_status: "ongoing" }]
        : [],
    shelter: { rent, sua_tier: suaTier, sua_amount: 0, internet: 0, homeless_deduction: false },
    deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
    assets: 0,
    cat_elig: "NPA",
  };

  return { facts, assumptions, confirmForVerdict };
}

/**
 * Estimate the monthly benefit from a packet's answers. The number is the
 * benefit-formula output assuming eligibility — pair it with confirmForVerdict
 * in the UI so it reads as "estimate, pending confirmation," never a promise.
 */
export function estimatePacketBenefit(
  answers: PacketAnswers,
  state: "CA" | "MA" = "CA",
  asOf: Date = new Date(),
): PacketEstimate {
  const mapped = packetAnswersToFacts(answers);
  const detail = computeBenefit(mapped.facts, state, asOf);
  return { ...mapped, estimatedMonthlyBenefitUsd: detail.monthly_benefit };
}

/** Collapse packet_answers rows into a flat map (navigator-confirmed wins). */
export function rowsToAnswers(
  rows: { question_key: string; applicant_answer: string | null; navigator_confirmed_value: string | null }[],
): PacketAnswers {
  const out: PacketAnswers = {};
  for (const r of rows) out[r.question_key] = r.navigator_confirmed_value ?? r.applicant_answer ?? undefined;
  return out;
}

export interface PacketAssessment extends PacketEstimate {
  /** Component R recommendations (ways to strengthen / raise the outcome). */
  recommendations: Recommendation[];
}

/**
 * Full per-packet assessment: the benefit estimate PLUS Component R's ranked
 * recommendations, from the same mapped Facts. The estimate is always the
 * benefit math (shows even when assumed-eligibility is borderline); the recs
 * are "actions that could raise the benefit or strengthen the case" — valid to
 * surface regardless of the provisional verdict. The verdict itself stays
 * pending confirmForVerdict and is NOT exposed here (it would rest on assumed
 * citizenship/age/assets). Pure.
 */
export function assessPacket(
  answers: PacketAnswers,
  state: "CA" | "MA" = "CA",
  asOf: Date = new Date(),
): PacketAssessment {
  const mapped = packetAnswersToFacts(answers);
  const estimatedMonthlyBenefitUsd = computeBenefit(mapped.facts, state, asOf).monthly_benefit;
  let recommendations: Recommendation[] = [];
  try {
    const cr = evaluateComponentR({ facts: mapped.facts, answeredAxes: {}, state, asOf });
    recommendations = cr.stage3?.recommendations ?? [];
  } catch {
    recommendations = [];
  }
  return { ...mapped, estimatedMonthlyBenefitUsd, recommendations };
}
