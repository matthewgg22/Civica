// ---------------------------------------------------------------------------
// Shared error-risk scoring for SNAP packets.
//
// Called from both:
//   - apps/enrollment-api/src/routes/me-packets.ts  (POST /me/packets/:id/error-risk)
//   - apps/enrollment-api/src/routes/navigator.ts   (POST /navigator/packets/:id/error-risk)
//
// Why one function: navigator-side and applicant-side scores MUST match. A
// county navigator making casework decisions on a "moderate" score that the
// applicant view shows as "weak" (due to a HEAP+full-SUA conflict) is a
// defensibility hole that undermines the §10105 error-rate story.
// ---------------------------------------------------------------------------

import { scoreErrorRisk } from "@civica/snap-qc-engine";
import { determineSUATier, checkHEAPCompliance } from "@civica/snap-rules";
import { makeAnonClient, makeServiceClient } from "./supabase.js";
import { compareIncome } from "./income-verification.js";
import type { PayPeriod } from "./income-verification.js";
import type { Env } from "../types.js";

export type FlowSignal = {
  flow: "gig-income" | "utility-sua" | "shared-lease";
  defensibility_score: "strong" | "moderate" | "weak";
};

export type ScoringResult = {
  score: number | null;
  tier: string;
  factors: string[];
  engine_version: string;
};

/**
 * Return shape of scorePacketRisk: the aggregate ScoringResult plus the
 * per-flow defensibility signals that produced it. Signals are needed for
 * shadow-mode QC evaluation emit (TODO-5) and forward-compat with the
 * snap-qc-engine perPacketGapContributionFromResults variant — callers
 * that only want the aggregate destructure result.
 */
export type ScoringOutput = {
  result: ScoringResult;
  flowSignals: FlowSignal[];
};

/**
 * Computes the error-risk score for a packet using the full QC logic:
 *   - utility-sua: determineSUATier() + checkHEAPCompliance()
 *   - gig-income: compareIncome(OCR vs reported) + Argyle
 *   - shared-lease: housing_situation heuristic
 *
 * Reads via the anon client so RLS scopes the data to the caller (applicant
 * or navigator). Does NOT persist — call persistPacketRiskScore() separately
 * if you want history.
 */
export async function scorePacketRisk(
  env: Env,
  jwt: string,
  packetId: string,
  applicantId: string,
): Promise<ScoringOutput> {
  const anonDb = makeAnonClient(env, jwt);

  const [answersResult, argyleResult, fieldsResult] = await Promise.all([
    anonDb
      .schema("snap_enrollment")
      .from("packet_answers")
      .select("question_key, applicant_answer")
      .eq("packet_id", packetId)
      .in("question_key", [
        "employment_status",
        "housing_situation",
        "monthly_utilities",
        "monthly_gross_income",
        "has_heating_costs",
        "has_electric_or_gas",
        "has_phone",
        "receives_heap",
      ]),
    anonDb
      .schema("snap_enrollment")
      .from("argyle_connections")
      .select("linked_accounts")
      .eq("applicant_id", applicantId)
      .is("revoked_at", null)
      .maybeSingle(),
    anonDb
      .schema("snap_enrollment")
      .from("extraction_fields")
      .select("field_key, original_ocr_value, confidence")
      .eq("packet_id", packetId)
      .in("field_key", ["gross_pay", "pay_amount", "monthly_gross_income", "pay_period"]),
  ]);

  type AnswerRow = { question_key: string; applicant_answer: string | null };
  const answers: Record<string, string> = Object.fromEntries(
    (answersResult.data ?? [])
      .map((a: AnswerRow) => [a.question_key, a.applicant_answer ?? ""] as [string, string])
      .filter(([, v]) => v !== "")
  );

  const linkedAccounts = (argyleResult.data?.linked_accounts as unknown[]) ?? [];
  const argyleConnected = linkedAccounts.length > 0;

  // OCR income extraction — sorted by confidence so the strongest field wins.
  type FieldRow = { field_key: string; original_ocr_value: string | null; confidence: number };
  const payFields = ((fieldsResult.data ?? []) as FieldRow[])
    .filter((f) => ["gross_pay", "pay_amount", "monthly_gross_income"].includes(f.field_key))
    .sort((a, b) => b.confidence - a.confidence);
  const payPeriodField = ((fieldsResult.data ?? []) as FieldRow[]).find((f) => f.field_key === "pay_period");

  const ocrPayAmount = payFields[0]?.original_ocr_value
    ? parseFloat(payFields[0].original_ocr_value) || null
    : null;

  let ocrPayPeriod: PayPeriod | null = null;
  if (payPeriodField?.original_ocr_value) {
    const raw = payPeriodField.original_ocr_value.toLowerCase();
    if (raw.includes("biweekly") || raw.includes("bi-weekly")) ocrPayPeriod = "biweekly";
    else if (raw.includes("weekly")) ocrPayPeriod = "weekly";
    else if (raw.includes("semi")) ocrPayPeriod = "semimonthly";
    else if (raw.includes("monthly")) ocrPayPeriod = "monthly";
    else if (raw.includes("annual") || raw.includes("yearly")) ocrPayPeriod = "annual";
  } else if (payFields[0]?.field_key === "monthly_gross_income") {
    ocrPayPeriod = "monthly";
  }

  const reportedMonthly = parseFloat(answers["monthly_gross_income"] ?? "") || null;
  const ocrComparison = compareIncome(reportedMonthly, ocrPayAmount, ocrPayPeriod);

  // SUA tier + OBBBA HEAP compliance
  const suaAnswers = {
    has_heating_costs: (answers["has_heating_costs"] as "yes" | "no" | null) ?? null,
    has_electric_or_gas: (answers["has_electric_or_gas"] as "yes" | "no" | null) ?? null,
    has_phone: (answers["has_phone"] as "yes" | "no" | null) ?? null,
  };
  const suaComputed = determineSUATier(suaAnswers);
  const heapCheck = checkHEAPCompliance({
    receives_heap: (answers["receives_heap"] as "yes" | "no" | null) ?? null,
    sua_tier_claimed: suaComputed,
  });

  const flowSignals: FlowSignal[] = [];

  // utility-sua: deterministic SUA tier; HEAP conflict → weak
  const hasSuaData = suaAnswers.has_heating_costs !== null
    || suaAnswers.has_electric_or_gas !== null
    || suaAnswers.has_phone !== null;
  const hasFullSuaData = suaAnswers.has_heating_costs !== null
    && suaAnswers.has_electric_or_gas !== null
    && suaAnswers.has_phone !== null;
  const hasMonthlyUtilities = parseFloat(answers["monthly_utilities"] ?? "0") > 0;

  if (hasSuaData || hasMonthlyUtilities) {
    const suaDef: "strong" | "moderate" | "weak" =
      heapCheck.heap_flag ? "weak"      // OBBBA HEAP+Full-SUA conflict → high QC risk
      : hasFullSuaData ? "moderate"     // all questions answered; deterministic tier
      : "weak";                         // partial SUA data; tier uncertain
    flowSignals.push({ flow: "utility-sua", defensibility_score: suaDef });
  }

  // gig-income: Argyle → strong; OCR match → moderate; mismatch/none → weak
  const incomeStatuses = new Set(["employed_full_time", "employed_part_time", "self_employed"]);
  const employmentStatus = answers["employment_status"];
  if (employmentStatus && incomeStatuses.has(employmentStatus)) {
    let incomeDef: "strong" | "moderate" | "weak";
    if (argyleConnected) {
      incomeDef = "strong";
    } else if (ocrComparison.direction === "incomplete" || ocrComparison.flagged) {
      incomeDef = "weak";
    } else if (ocrComparison.ocr_monthly !== null) {
      incomeDef = "moderate";
    } else {
      incomeDef = "weak";
    }
    flowSignals.push({ flow: "gig-income", defensibility_score: incomeDef });
  }

  // shared-lease: housing_situation heuristic (doc resolution not yet wired)
  const housingSituation = answers["housing_situation"];
  if (housingSituation === "renting" || housingSituation === "living_with_family") {
    flowSignals.push({ flow: "shared-lease", defensibility_score: "moderate" });
  }

  return { result: scoreErrorRisk(flowSignals), flowSignals };
}

/**
 * Fire-and-forget insert into packet_error_risk for analytics history.
 * Caller decides whether to persist (applicant endpoint does; navigator does not).
 */
export function persistPacketRiskScore(
  env: Env,
  packetId: string,
  result: ScoringResult,
): void {
  if (result.score === null) return;
  void makeServiceClient(env)
    .schema("snap_enrollment")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("packet_error_risk" as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      packet_id: packetId,
      engine_version: result.engine_version,
      score: result.score,
      factors: result.factors,
      tier: result.tier,
    } as any)
    .then(() => {}, () => {});
}

// ---------------------------------------------------------------------------
// Shadow-mode QC evaluation emit — TODO-5 / T8 shadow-mode instrumentation.
//
// Mirrors persistPacketRiskScore: every persisted score also emits one
// analytical event to `civica-analytics/civica-emit/qc-evaluations/date=*/`.
// Read consumer: @civica/analytics-engine.civicaEmit.qcEvaluations.byOrg.
//
// Why a separate bucket emit (vs reading packet_error_risk back later):
// the analytical tier is OLTP-independent by design (docs/data-architecture.md).
// Self-contained events let DuckDB / signed-URL delivery run without RLS
// joins back to snap_enrollment.
// ---------------------------------------------------------------------------

export const QC_EVALUATION_EMIT_BUCKET = "civica-analytics";
export const QC_EVALUATION_EMIT_PREFIX = "civica-emit/qc-evaluations";

/**
 * One QC evaluation event. Schema is forward-compatible: readers should
 * tolerate unknown extra fields. Breaking changes bump `schema_version`.
 *
 * Per-flow signals are included so downstream analytics can re-derive the
 * per-packet PER contribution from `flow_signals` (more accurate than the
 * aggregate score; see snap-qc-engine.perPacketGapContribution doc comment).
 */
export interface QcEvaluationEvent {
  schema_version: 1;
  event_id: string;
  emitted_at: string;
  packet_id: string;
  applicant_id: string;
  org_id: string | null;
  county: string | null;
  state_code: string | null;
  packet_status: string | null;
  engine_version: string;
  tier: string;
  score: number | null;
  factors: string[];
  flow_signals: FlowSignal[];
}

/**
 * Optional packet-context columns we hydrate at the call site. Kept as a
 * loose Partial so adding new context fields here is a one-line change at
 * the call site, not a breaking API in the lib.
 */
export interface QcEvaluationContext {
  org_id?: string | null;
  county?: string | null;
  state_code?: string | null;
  packet_status?: string | null;
}

/**
 * Fire-and-forget emit of one QC evaluation event to civica-analytics
 * Storage. Path: `civica-emit/qc-evaluations/date=YYYY-MM-DD/{packet_id}-{ts}.json`.
 *
 * Skipped (no-op) when result.score is null — incomplete evaluations
 * don't carry meaningful analytical signal and would pollute the read frame.
 *
 * Errors are caught and never thrown back to the request handler. Storage
 * outages or bucket-missing errors must NOT break navigator/applicant
 * scoring UX. The emit is purely additive instrumentation.
 *
 * Returns the storage object path on success (mostly for tests); undefined
 * on skip; null on error.
 */
export async function emitQcEvaluation(
  env: Env,
  packetId: string,
  applicantId: string,
  result: ScoringResult,
  flowSignals: FlowSignal[],
  context: QcEvaluationContext = {},
): Promise<string | null | undefined> {
  if (result.score === null) return undefined;

  const emittedAt = new Date();
  const date = emittedAt.toISOString().slice(0, 10);
  const ts = emittedAt.toISOString().replace(/[:.]/g, "-");
  const eventId = cryptoRandomId();
  const path = `${QC_EVALUATION_EMIT_PREFIX}/date=${date}/${packetId}-${ts}-${eventId.slice(0, 8)}.json`;

  const event: QcEvaluationEvent = {
    schema_version: 1,
    event_id: eventId,
    emitted_at: emittedAt.toISOString(),
    packet_id: packetId,
    applicant_id: applicantId,
    org_id: context.org_id ?? null,
    county: context.county ?? null,
    state_code: context.state_code ?? null,
    packet_status: context.packet_status ?? null,
    engine_version: result.engine_version,
    tier: result.tier,
    score: result.score,
    factors: result.factors,
    flow_signals: flowSignals,
  };

  try {
    const svc = makeServiceClient(env);
    const body = new Blob([JSON.stringify(event)], { type: "application/json" });
    const { error } = await svc.storage
      .from(QC_EVALUATION_EMIT_BUCKET)
      .upload(path, body, { contentType: "application/json", upsert: false });
    if (error) {
      console.warn(`qc_evaluation emit failed: ${error.message}`);
      return null;
    }
    return path;
  } catch (err) {
    console.warn(`qc_evaluation emit threw: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Lightweight uuid-v4-ish id for event correlation. Uses crypto.randomUUID
 * when available (Workers runtime + modern Node), falls back to a
 * Math.random-based id (test environments only — never hit in prod).
 */
function cryptoRandomId(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Fallback for ancient runtimes: rfc4122-shaped but not crypto-strong.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
