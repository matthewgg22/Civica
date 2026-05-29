import React, { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClientFromCookies } from "../../../lib/supabase";
import WorkRequirementsSection, { WorkRequirementsSkeleton } from "../../../components/packet-detail/WorkRequirementsSection";
import NotesSection, { NotesSkeleton } from "../../../components/packet-detail/NotesSection";
import TimelineSection, { TimelineSkeleton } from "../../../components/packet-detail/TimelineSection";
import DocumentsSection, { DocumentsSkeleton } from "../../../components/packet-detail/DocumentsSection";
import VerificationSection, { VerificationSkeleton } from "../../../components/packet-detail/VerificationSection";
import RiskTabSection, { RiskTabSkeleton } from "../../../components/packet-detail/RiskTabSection";
import EvidenceSection from "../../../components/packet-detail/EvidenceSection";
import StatusTransition, { type Blocker } from "../../../components/StatusTransition";
import ConsentCapture from "../../../components/ConsentCapture";
import ExtractionFieldList from "../../../components/ExtractionFieldList";
import AnswerReviewList from "../../../components/AnswerReviewList";
import StatusPill from "../../../components/StatusPill";
import LifecycleStrip from "../../../components/LifecycleStrip";
import HandoffPanel from "../../../components/HandoffPanel";
import BenefitsCalPanel from "../../../components/BenefitsCalPanel";
import ExpeditedReviewGate from "./ExpeditedReviewGate";
import ShelterAllocationPanel from "../../../components/ShelterAllocationPanel";
import type { ShelterAllocation } from "../../../components/ShelterAllocationPanel";
import { classifyTenancy, detectMissedElections, totalMissedMonthlyValue, perPacketGapContribution } from "@civica/snap-qc-engine";
import type { HouseholdElectionProfile } from "@civica/snap-qc-engine";
import MissedElectionsPanel from "../../../components/MissedElectionsPanel";
import ComplianceNarrative from "../../../components/ComplianceNarrative";
import type { VerificationSummary } from "../../../components/APIVerificationPanel";
import { determineSUATier, checkHEAPCompliance } from "@civica/snap-rules";
import type { SUATier } from "@civica/snap-rules";
import { compareIncome } from "../../../lib/income-verification";
import type { PayPeriod } from "../../../lib/income-verification";

import { formatDateTime, formatDate, decryptDemoName, firstNameLastInitial, shortId, timeAgo } from "../../../lib/format";
import { PACKET_STATUS_TRANSITIONS } from "@civica/snap-enums";
import type { RiskFlow, RiskAction } from "../../../components/packet-risk/types";
import { getWrStatus } from "../../../lib/packet-fetchers";
import { isDemoFallbackEnabled, getDemoPacketDetail } from "../../../lib/demo-data";

// Statuses where the expedited-review gate is relevant
const EXPEDITED_GATE_STATUSES = new Set(["Submitted for Review", "In Navigator Review"]);

const LANG_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  zh: "Chinese",
  vi: "Vietnamese",
};

export default async function PacketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ packetId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { packetId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const devtoolsEnabled = resolvedSearchParams.devtools === "1";
  const tab = typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : "overview";

  // Reject stale-link IDs before they hit Supabase. Real packet IDs are UUIDs;
  // demo IDs start with `demo-pkt-`. Anything else is a leftover from
  // pre-#290 /cbo-preview tabs (where the queue rows pointed at `sample-1`
  // etc.) or a typo. The RLS recursion bug hangs every Supabase query
  // regardless of whether the row exists, so even a `notFound()` after the
  // query would 504 for staff users. Short-circuit to 404 instead.
  const isValidPacketShape =
    packetId.startsWith("demo-pkt-") ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(packetId);
  if (!isValidPacketShape) notFound();

  // Demo packet short-circuit: when DEMO_FALLBACK=true and the packetId
  // matches a fixture, synthesize all the destructured `*Result` shapes
  // from the hardcoded bundle. Lets the detail page render the full
  // Review Status card narrative even when the local Supabase has the
  // pre-existing RLS recursion bug.
  //
  // CRITICAL: for demo packets we must SKIP the live Supabase queries
  // entirely, not just override results afterward. The /cbo-preview
  // landing page links unauthenticated CBO previewers directly into
  // this surface using demo-pkt-* IDs; the RLS recursion bug hangs every
  // query without a valid session → Vercel 504. Per-section Suspense
  // fetchers in lib/packet-fetchers.ts get the same short-circuit.
  const demoBundle = isDemoFallbackEnabled() ? getDemoPacketDetail(packetId) : null;

  // Note: wr_status is NOT fetched here. It's deferred to
  // <WorkRequirementsSection> which fetches via the cached
  // getWrStatus() helper and renders inside a <Suspense> boundary —
  // so a slow wr query doesn't gate the rest of the packet detail.
  // navigator_notes, packet_status_history, required_document_items are deferred —
  // they're fetched inside their own Suspense sections (NotesSection, TimelineSection,
  // DocumentsSection) via the cache()-wrapped fetchers in lib/packet-fetchers.ts.
  //
  // The `let`-declared live result vars stay `undefined` on the demo path
  // because the demoBundle ternaries below pick the demo branch before
  // ever reading them. Type-erase to `any`: each Supabase query returns a
  // distinct generic shape and re-deriving 9 tuple types here would dwarf
  // the actual fix.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let livePacketResult: any;
  let liveAnswersResult: any;
  let liveDocsResult: any;
  let liveFieldsResult: any;
  let liveRecertResult: any;
  let liveExtractionsResult: any;
  let livePaychecksResult: any;
  let liveErrorRiskResult: any;
  let liveShelterAllocationResult: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (!demoBundle) {
    const cookieStore = await cookies();
    const supabase = createServerClientFromCookies(cookieStore);
    [livePacketResult, liveAnswersResult, liveDocsResult, liveFieldsResult, liveRecertResult, liveExtractionsResult, livePaychecksResult, liveErrorRiskResult, liveShelterAllocationResult] = await Promise.all([
      supabase.schema("snap_enrollment").from("snap_packets").select(`*, applicants(*)`).eq("packet_id", packetId).is("deleted_at", null).single(),
      supabase.schema("snap_enrollment").from("packet_answers").select("*").eq("packet_id", packetId).order("question_key"),
      supabase.schema("snap_enrollment").from("uploaded_documents").select("*").eq("packet_id", packetId).is("deleted_at", null).order("uploaded_at", { ascending: false }),
      supabase.schema("snap_enrollment").from("extraction_fields").select("*").eq("packet_id", packetId).order("needs_review", { ascending: false }).order("field_key"),
      supabase.schema("snap_enrollment")
        .from("recertifications")
        .select("recert_id, cert_period_end, cert_period_end_source, status")
        .eq("packet_id", packetId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Map document_id -> extraction_id so the document viewer can filter
      // extraction_fields (which only carries extraction_id) to the rows for
      // the opened document. We join via uploaded_documents.packet_id rather
      // than a follow-up query so this stays in the parallel batch.
      //
      // Also pulls extracted_at / extractor_model / overall_confidence so the
      // activity timeline can render engine-extraction events ("Paystub
      // extracted · 94% confidence").
      supabase.schema("snap_enrollment")
        .from("document_extractions")
        .select("extraction_id, document_id, extracted_at, extractor_model, overall_confidence, uploaded_documents!inner(packet_id, document_kind, original_filename)")
        .eq("uploaded_documents.packet_id", packetId)
        .order("extracted_at", { ascending: false }),
      // Argyle marketplace paychecks for cross-verification income panel
      supabase.schema("snap_enrollment")
        .from("marketplace_paychecks")
        .select("monthly_amount_usd, pay_date, employer_name")
        .eq("packet_id", packetId)
        .order("pay_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // History-aware: pull the last 5 risk evaluations so the timeline
      // can render "Engine re-scored 64 → 41 (−23)" events and the
      // profile-strength card can show a trend delta. errorRisk (latest)
      // is just [0].
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.schema("snap_enrollment").from("packet_error_risk" as any)
        .select("score, tier, factors, engine_version, created_at")
        .eq("packet_id", packetId)
        .order("created_at", { ascending: false })
        .limit(5),
      // Shelter allocation — navigator-confirmed rent share for shared-lease cases
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.schema("snap_enrollment") as any).from("shelter_allocations")
        .select("*")
        .eq("packet_id", packetId)
        .maybeSingle(),
    ]);
  }

  // Apply demo overrides AFTER the live destructure so downstream code
  // keeps the live result types. Each `*Result` accessor exposes only
  // `.data` and `.error`, so this is a safe per-field swap.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packetResult = demoBundle ? ({ data: demoBundle.packet as any, error: null } as typeof livePacketResult) : livePacketResult;
  const answersResult = demoBundle ? { data: demoBundle.answers, error: null } : liveAnswersResult;
  const docsResult = demoBundle ? { data: demoBundle.docs, error: null } : liveDocsResult;
  const fieldsResult = demoBundle ? { data: demoBundle.fields, error: null } : liveFieldsResult;
  const recertResult = liveRecertResult; // demo doesn't seed recertifications
  const extractionsResult = demoBundle ? { data: demoBundle.extractions, error: null } : liveExtractionsResult;
  const paychecksResult = demoBundle ? { data: demoBundle.paychecks, error: null } : livePaychecksResult;
  const errorRiskResult = demoBundle ? { data: demoBundle.riskHistory, error: null } : liveErrorRiskResult;
  const shelterAllocationResult = demoBundle ? { data: demoBundle.shelterAllocation, error: null } : liveShelterAllocationResult;

  if (!packetResult.data) notFound();
  const packet = packetResult.data;
  const applicant = packet.applicants as { full_name_ciphertext: string | null; preferred_language: string } | null;
  // Concrete shapes for downstream `.find`/`.filter`/`.some` callbacks.
  // Inference through the `any`-typed live result vars (kept loose so the
  // demo-bundle short-circuit can fall through without re-deriving every
  // Supabase generic tuple) would otherwise hand back `any[]` here and
  // break TS narrowing in 8 downstream callbacks.
  type AnswerListRow = { question_key: string; applicant_answer: string | null };
  type DocListRow = {
    document_id: string;
    document_kind: string;
    original_filename: string | null;
    processing_status: string;
    uploaded_at: string;
  };
  type FieldListRow = {
    field_id: string;
    extraction_id: string;
    field_key: string;
    field_label: string;
    original_ocr_value: string | null;
    applicant_answer: string | null;
    navigator_confirmed_value: string | null;
    confidence: number;
    needs_review: boolean;
    reviewed_at: string | null;
    review_note: string | null;
  };
  const answers = (answersResult.data ?? []) as AnswerListRow[];
  const docs = (docsResult.data ?? []) as DocListRow[];
  const fields = (fieldsResult.data ?? []) as FieldListRow[];
  // notes, history, docItems are fetched inside their Suspense sections — not needed here.
  const recert = recertResult.data ?? null;
  type ExtractionRow = {
    extraction_id: string;
    document_id: string;
    extracted_at: string;
    extractor_model: string | null;
    overall_confidence: number | null;
    uploaded_documents: { document_kind: string; original_filename: string | null } | null;
  };
  const extractions = (extractionsResult.data ?? []) as ExtractionRow[];
  const extractionsByDoc: Record<string, string[]> = {};
  for (const ex of extractions) {
    (extractionsByDoc[ex.document_id] ??= []).push(ex.extraction_id);
  }
  const latestPaycheck = paychecksResult.data as { monthly_amount_usd: number; pay_date: string; employer_name: string | null } | null;
  // errorRiskResult is now an array (last 5 evaluations, newest first).
  // The chronological history (oldest first) is used for timeline Δ events.
  // The table is queried via `from("packet_error_risk" as any)` so the
  // result type is opaque to Supabase's type generator — cast through
  // `unknown` to get a real shape without disabling narrowing.
  const errorRiskHistory = ((errorRiskResult.data ?? []) as unknown) as Array<{
    score: number | null;
    tier: string | null;
    engine_version: string | null;
    created_at: string;
  }>;
  const errorRisk = errorRiskHistory[0] ?? null;
  const nextStatuses = PACKET_STATUS_TRANSITIONS[packet.status as keyof typeof PACKET_STATUS_TRANSITIONS] ?? [];

  // ── Answer helpers — hoisted so sublease classifier + failure-to-elect below can use them ──
  type AnswerRow = { question_key: string; applicant_answer: string | null };
  const answerMap: Record<string, string | null> = Object.fromEntries(
    answers.map((r: AnswerRow) => [r.question_key, r.applicant_answer])
  );
  const getAnswer = (key: string): string | null => answerMap[key] ?? null;
  const suaAnswers = {
    has_heating_costs: getAnswer("has_heating_costs") as "yes" | "no" | null,
    has_electric_or_gas: getAnswer("has_electric_or_gas") as "yes" | "no" | null,
    has_phone: getAnswer("has_phone") as "yes" | "no" | null,
  };
  const suaComputed = determineSUATier(suaAnswers);
  const answersMap: Record<string, string> = {};
  for (const a of answers) {
    if (a.applicant_answer != null) answersMap[a.question_key] = a.applicant_answer;
  }
  const shelterAllocation = shelterAllocationResult?.data ?? null;

  // Expedited review gate (OBBBA §10102(a)): show when employment_status = "unemployed"
  // AND monthly gross income is very low or unanswered AND navigator hasn't acted yet.
  const employmentAnswer = answers.find((a) => a.question_key === "employment_status");
  const incomeAnswer = answers.find((a) => a.question_key === "monthly_gross_income");
  const grossIncome = incomeAnswer ? parseFloat(incomeAnswer.applicant_answer ?? "NaN") : NaN;
  const looksExpedited =
    employmentAnswer?.applicant_answer === "unemployed" &&
    (isNaN(grossIncome) || grossIncome < 150);
  const showExpeditedGate =
    looksExpedited &&
    (packet as { is_expedited?: boolean | null }).is_expedited === null &&
    EXPEDITED_GATE_STATUSES.has(packet.status);

  // Sublease classifier — deterministic v1, drives ShelterAllocationPanel visibility
  const rentTransactions = docs
    .filter((d) => d.document_kind === "bank_statement" || d.document_kind === "other")
    .slice(0, 10)
    .map((d, i) => ({
      transaction_id: d.document_id ?? `t${i}`,
      date: d.uploaded_at ?? new Date().toISOString(),
      amount: parseFloat(getAnswer("monthly_rent_or_mortgage") ?? "0") || 0,
      name: "",
    }));
  const leaseClassification = classifyTenancy({
    intake: {
      lease_in_applicant_name: answersMap["lease_in_applicant_name"] === "true",
      leaseholder_name: answersMap["leaseholder_name"] ?? undefined,
      stated_monthly_rent: parseFloat(getAnswer("monthly_rent_or_mortgage") ?? "0") || 0,
      payment_method: (answersMap["rent_payment_method"] as "bank_transfer" | "cash" | "venmo_zelle" | "other" | undefined) ?? "other",
      address: answersMap["address"] ?? "",
    },
    applicant_name: packet.applicants ? (packet.applicants as { full_name_ciphertext?: string | null }).full_name_ciphertext ?? "" : "",
    household_size: parseFloat(getAnswer("household_size") ?? "1") || 1,
    named_tenants_on_lease: parseFloat(getAnswer("named_tenants_on_lease") ?? "1") || 1,
    rent_transactions: rentTransactions,
    has_lease_document: docs.some((d) => d.document_kind === "lease"),
  });
  const showAllocationPanel =
    leaseClassification.tenancy === "shared_tenancy" ||
    leaseClassification.tenancy === "sublease" ||
    shelterAllocation !== null;

  // ── Failure-to-elect detection ──────────────────────────────────────────
  // Build a HouseholdElectionProfile from intake answers + household members.
  // household_members is derived from household_size — we don't have per-member
  // age/disability data in intake answers, so we use the best available proxy.
  const householdSizeNum = parseFloat(getAnswer("household_size") ?? "1") || 1;
  const hasElderly = getAnswer("has_elderly_disabled_member") === "yes";
  const hasDisabled = getAnswer("has_disabled_member") === "yes";
  const isWorking = getAnswer("employment_status") === "employed" ||
    getAnswer("employment_status") === "self_employed";
  const childAges = (getAnswer("child_ages") ?? "").split(",")
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n));

  // Synthetic household members: primary adult + any known children
  const householdMembers: HouseholdElectionProfile["household_members"] = [
    {
      age: hasElderly ? 68 : 35,
      is_disabled: hasDisabled,
      is_working: isWorking,
      receives_ssi: getAnswer("receives_ssi") === "yes",
    },
    ...childAges.map((age) => ({
      age,
      is_disabled: false,
      is_working: false,
      receives_ssi: false,
    })),
  ];
  // Pad to household size with generic working-age adults if needed
  while (householdMembers.length < householdSizeNum) {
    householdMembers.push({ age: 30, is_disabled: false, is_working: false, receives_ssi: false });
  }

  const electionProfile: HouseholdElectionProfile = {
    state_code: (packet.state_code as "CA" | "MA") ?? "CA",
    housing_situation: (getAnswer("housing_situation") as HouseholdElectionProfile["housing_situation"]) ?? "renting",
    claimed_homeless_deduction: getAnswer("claimed_homeless_deduction") === "true",
    claimed_sua_tier: (suaComputed as HouseholdElectionProfile["claimed_sua_tier"]) ?? "NONE",
    claimed_actual_utility_cost_usd:
      parseFloat(getAnswer("actual_utility_cost_monthly") ?? "") || null,
    claimed_dependent_care_usd:
      parseFloat(getAnswer("monthly_dependent_care_cost") ?? "") || null,
    claimed_medical_deduction_usd:
      parseFloat(getAnswer("monthly_medical_cost") ?? "") || null,
    has_heating_costs: getAnswer("has_heating_costs") === "yes" ? true
      : getAnswer("has_heating_costs") === "no" ? false : null,
    has_electric_or_gas: getAnswer("has_electric_or_gas") === "yes" ? true
      : getAnswer("has_electric_or_gas") === "no" ? false : null,
    has_phone: getAnswer("has_phone") === "yes" ? true
      : getAnswer("has_phone") === "no" ? false : null,
    documented_monthly_utility_usd:
      parseFloat(getAnswer("documented_monthly_utility") ?? "") || null,
    household_members: householdMembers,
    monthly_dependent_care_paid_usd:
      parseFloat(getAnswer("monthly_dependent_care_cost") ?? "") || null,
    monthly_medical_out_of_pocket_usd:
      parseFloat(getAnswer("monthly_medical_cost") ?? "") || null,
  };

  const missedElections = detectMissedElections(electionProfile);
  const missedElectionsTotal = totalMissedMonthlyValue(missedElections);

  // Pre-flight blockers for "Ready for Handoff" + consent + argyle linkage.
  // packet_error_risk is NOT fetched here — already retrieved in the first
  // batch above as `errorRiskResult`, exposed as `errorRisk`. The previous
  // second-batch risk query was a duplicate that doubled the round-trip
  // cost on every packet-detail load.
  // wrStatusForEngine: shared with the Suspense'd <WorkRequirementsSection>
  // via React's cache() in lib/packet-fetchers.ts — calling it here lets
  // the engine sign-off checklist + activity timeline reference the same
  // row without a second round-trip. The fetch is fast (single indexed
  // lookup) so adding it to the main batch is well under the cost ceiling
  // T6b was guarding against.
  //
  // Same demo-mode gate as the first batch — skipped entirely for demo
  // packets so unauthenticated CBO previewers never hit Supabase.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let liveUnresolvedDocsResult: any;
  let liveUnreviewedFieldsResult: any;
  let liveConsentResult: any;
  let liveArgyleResult: any;
  let liveWrStatusForEngine: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (!demoBundle) {
    const cookieStore = await cookies();
    const supabase = createServerClientFromCookies(cookieStore);
    [liveUnresolvedDocsResult, liveUnreviewedFieldsResult, liveConsentResult, liveArgyleResult, liveWrStatusForEngine] = await Promise.all([
      supabase.schema("snap_enrollment").from("required_document_items")
        .select("item_id").eq("packet_id", packetId).eq("is_required", true)
        .is("resolved_at", null).is("waived_at", null),
      supabase.schema("snap_enrollment").from("extraction_fields")
        .select("field_id").eq("packet_id", packetId).eq("needs_review", true).is("reviewed_at", null),
      supabase.schema("snap_enrollment").from("user_consents")
        .select("consent_id, consented_at").eq("applicant_id", packet.applicant_id)
        .eq("consent_kind", "privacy_notice").is("revoked_at", null).limit(1),
      supabase.schema("snap_enrollment")
        .from("argyle_connections")
        .select("connection_id, linked_at, argyle_user_id, linked_accounts")
        .eq("applicant_id", packet.applicant_id)
        .is("revoked_at", null)
        .limit(1)
        .maybeSingle(),
      getWrStatus(packetId),
    ]);
  }

  // Apply demo overrides (mirrors the main-batch pattern above).
  const unresolvedDocsResult = demoBundle
    ? { data: Array.from({ length: demoBundle.unresolvedDocs }, (_, i) => ({ item_id: `unres-${i}` })), error: null }
    : liveUnresolvedDocsResult;
  const unreviewedFieldsResult = demoBundle
    ? { data: Array.from({ length: demoBundle.unreviewedFields }, (_, i) => ({ field_id: `unrev-${i}` })), error: null }
    : liveUnreviewedFieldsResult;
  const consentResult = demoBundle
    ? { data: demoBundle.hasConsent ? [{ consent_id: "c-demo", consented_at: demoBundle.consentedAt }] : [], error: null }
    : liveConsentResult;
  const argyleResult = demoBundle
    ? { data: demoBundle.argyle, error: null }
    : liveArgyleResult;
  const wrStatusForEngine = demoBundle ? demoBundle.wrStatus : liveWrStatusForEngine;

  const hasConsent = (consentResult.data?.length ?? 0) > 0;
  const consentedAt = hasConsent ? (consentResult.data![0] as { consented_at: string }).consented_at : null;

  // ── Verification Summary (computed server-side from DB data) ────────────────
  // (answerMap / getAnswer / suaAnswers / suaComputed / answersMap / shelterAllocation
  //  are declared earlier so the sublease classifier + failure-to-elect can reference them)
  const heapCheck = checkHEAPCompliance({
    receives_heap: getAnswer("receives_heap") as "yes" | "no" | null | undefined,
    sua_tier_claimed: suaComputed,
  });

  type FieldRow = { field_key: string; original_ocr_value: string | null; confidence: number };
  const payFields = (fields as FieldRow[]).filter((f) =>
    ["gross_pay", "pay_amount", "monthly_gross_income"].includes(f.field_key)
  ).sort((a, b) => b.confidence - a.confidence);
  const payPeriodField = (fields as FieldRow[]).find((f) => f.field_key === "pay_period");

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

  const reportedMonthly = parseFloat(getAnswer("monthly_gross_income") ?? "") || null;
  const incomeComparison = compareIncome(reportedMonthly, ocrPayAmount, ocrPayPeriod);

  const argyleLinked = (((argyleResult.data as { linked_accounts?: unknown[] } | null)?.linked_accounts ?? []) as unknown[]).length > 0;

  const verificationSummary: VerificationSummary = {
    shelter: {
      address: { deliverability: "unavailable", rdi: "Unknown" },
      rent: {
        claimed: parseFloat(getAnswer("monthly_rent_or_mortgage") ?? "") || null,
        fmr: null,
        ratio: null,
        flagged: false,
      },
      sua_tier: {
        claimed: suaComputed as SUATier | null,
        computed: suaComputed as SUATier | null,
        flagged: false,
        heap_flag: heapCheck.heap_flag,
      },
    },
    income: {
      reported_monthly: incomeComparison.reported_monthly,
      ocr_monthly: incomeComparison.ocr_monthly,
      delta_pct: incomeComparison.delta_pct,
      direction: incomeComparison.direction,
      flagged: incomeComparison.flagged,
      argyle_monthly: latestPaycheck?.monthly_amount_usd ?? null,
    },
    obbba: {
      heap_flag: heapCheck.heap_flag,
      flag_reason: heapCheck.flag_reason,
    },
  };

  const verificationFlagCount = [
    verificationSummary.shelter.rent.flagged,
    verificationSummary.shelter.sua_tier.heap_flag,
    verificationSummary.income.flagged,
  ].filter(Boolean).length;

  const unresolvedDocsCount = unresolvedDocsResult.data?.length ?? 0;
  const unreviewedFieldsCount = unreviewedFieldsResult.data?.length ?? 0;

  const blockers: Blocker[] = [];
  if (unresolvedDocsCount > 0)
    blockers.push({ kind: "unresolved_docs", label: "Required documents not yet resolved", count: unresolvedDocsCount });
  if (unreviewedFieldsCount > 0)
    blockers.push({ kind: "unreviewed_fields", label: "Extraction fields flagged for review", count: unreviewedFieldsCount });
  if (!hasConsent)
    blockers.push({ kind: "missing_consent", label: "Privacy notice consent not on file" });

  // ── Review-status computations ──────────────────────────────────────────
  // Verification strength: invert the risk score (so 0=weak, 100=strong),
  // plus small bonuses for verified data sources and penalties for
  // unresolved blockers. Intentionally a transparent aggregation of
  // signals that already exist elsewhere on the page.
  const errorRiskScore = errorRisk?.score ?? null;
  const strengthBase = errorRiskScore != null ? 100 - errorRiskScore : null;
  const strengthBonus =
    (argyleLinked ? 5 : 0) +
    (verificationFlagCount === 0 ? 5 : 0) +
    (wrStatusForEngine?.compliance_status === "compliant" ? 5 : 0);
  const strengthPenalty = blockers.length * 4;
  const profileStrength = strengthBase != null
    ? Math.max(0, Math.min(100, strengthBase + strengthBonus - strengthPenalty))
    : null;
  const previousRisk = errorRiskHistory[1]?.score ?? null;
  const strengthDelta = profileStrength != null && previousRisk != null && errorRiskScore != null
    ? (100 - errorRiskScore) - (100 - previousRisk)
    : null;

  // Pre-handoff checks: each gate has pass/blocked + a one-line reason.
  // Labels are caseworker-facing; keep them in workflow language
  // ("acceptable", "complete", "captured"), not jargon ("≤ Medium",
  // "§10102", "extraction fields").
  type SignoffCheck = { id: string; label: string; passed: boolean; note?: string };
  const signoffChecks: SignoffCheck[] = [
    {
      id: "risk",
      label: "Error-risk acceptable",
      passed: errorRisk?.tier === "low" || errorRisk?.tier === "medium",
      note: errorRisk?.tier
        ? errorRisk.tier === "high"
          ? `${errorRiskScore ?? "—"}/100 · high`
          : `${errorRiskScore ?? "—"}/100 · ${errorRisk.tier}`
        : "Not yet reviewed",
    },
    {
      id: "verification",
      label: "Cross-checks passed",
      passed: verificationFlagCount === 0,
      note: verificationFlagCount === 0
        ? argyleLinked ? "Income verified via payroll" : "No flags"
        : `${verificationFlagCount} flag${verificationFlagCount === 1 ? "" : "s"} to review`,
    },
    {
      id: "work-req",
      label: "Work-hours rule",
      passed: !wrStatusForEngine?.is_subject || wrStatusForEngine?.compliance_status === "compliant",
      note: !wrStatusForEngine
        ? "Not evaluated"
        : !wrStatusForEngine.is_subject
          ? "Not subject"
          : wrStatusForEngine.compliance_status === "compliant"
            ? "Compliant"
            : `${wrStatusForEngine.compliance_status ?? "unknown"}`,
    },
    {
      id: "docs",
      label: "Required documents",
      passed: (unresolvedDocsResult.data?.length ?? 0) === 0,
      note: (unresolvedDocsResult.data?.length ?? 0) === 0
        ? "All received"
        : `${unresolvedDocsResult.data!.length} outstanding`,
    },
    {
      id: "extractions",
      label: "Document field review",
      passed: (unreviewedFieldsResult.data?.length ?? 0) === 0,
      note: (unreviewedFieldsResult.data?.length ?? 0) === 0
        ? "None flagged"
        : `${unreviewedFieldsResult.data!.length} to review`,
    },
    {
      id: "consent",
      label: "Privacy consent",
      passed: hasConsent,
      note: hasConsent ? "Captured" : "Not captured",
    },
  ];
  const passedChecks = signoffChecks.filter((c) => c.passed).length;

  // ── Error risk tab data ──────────────────────────────────────────────────
  // `errorRisk` is from the first batch above (errorRiskResult). The old
  // second-batch `riskResult` query has been removed as duplicate.
  const riskRow = errorRisk;
  const argyleConn = argyleResult.data ?? null;
  const isArgyleConnected = argyleConn !== null;

  // answersMap / suaComputed hoisted above sublease classifier — just use them here
  const suaQuestionsAnswered = suaComputed !== null;
  const hasHousingSituation = !!answersMap["housing_situation"];
  const hasIncomeDocs = docs.some((d) =>
    ["pay_stub", "tax_return", "w2", "1099", "income"].some((k) =>
      d.document_kind.toLowerCase().includes(k)
    )
  );

  function flowPoints(weight: number, def: RiskFlow["defensibility"]): number | null {
    if (def === "not-scored") return null;
    const m = def === "strong" ? 0.05 : def === "moderate" ? 0.35 : 0.80;
    return Math.round(weight * m);
  }
  function impactIfUpgraded(weight: number, def: RiskFlow["defensibility"]): number | null {
    if (def === "strong" || def === "not-scored") return null;
    const from = def === "weak" ? 0.80 : 0.35;
    const to   = def === "weak" ? 0.35 : 0.05;
    return Math.round(weight * (from - to));
  }

  const suaDef: "moderate" | "weak"   = suaQuestionsAnswered ? "moderate" : "weak";
  const gigDef: "strong"  | "weak"    = isArgyleConnected   ? "strong"   : "weak";

  // shelterAllocation hoisted above sublease classifier

  // Pull OCR-computed civica_* verification fields for lease documents.
  // These synthetic fields are written by the OCR webhook after verifyLeaseExtraction() runs.
  type LeaseFieldRow = { field_key: string; original_ocr_value: string | null; navigator_confirmed_value: string | null };
  const ocrLeaseDefField = (fields as LeaseFieldRow[]).find(
    (f) => f.field_key === "civica_defensibility_tier",
  );
  const ocrRentMatch = (fields as LeaseFieldRow[]).find(
    (f) => f.field_key === "civica_rent_verification_status",
  );
  const ocrNameMatch = (fields as LeaseFieldRow[]).find(
    (f) => f.field_key === "civica_name_verification_status",
  );
  // Best value: navigator_confirmed_value overrides original_ocr_value
  const ocrLeaseTier = (ocrLeaseDefField?.navigator_confirmed_value ?? ocrLeaseDefField?.original_ocr_value) as
    | "strong" | "moderate" | "weak" | null | undefined;
  const ocrRentMatchValue = ocrRentMatch?.navigator_confirmed_value ?? ocrRentMatch?.original_ocr_value;
  const ocrNameMatchValue = ocrNameMatch?.navigator_confirmed_value ?? ocrNameMatch?.original_ocr_value;

  // Defensibility ladder for shared-lease (priority order):
  //   1. OCR verification ran + both axes strong → strong
  //   2. Allocation set + evidence document → strong
  //   3. OCR verification ran (any result) → use OCR tier
  //   4. Allocation set (no evidence doc) → moderate
  //   5. Housing situation answered → moderate
  //   6. Nothing → weak
  const leaseDef: "strong" | "moderate" | "weak" = (() => {
    if (!hasHousingSituation) return "weak";
    if (ocrLeaseTier === "strong") return "strong";
    if (shelterAllocation?.evidence_document_id) return "strong";
    if (ocrLeaseTier === "moderate" || ocrLeaseTier === "weak") return ocrLeaseTier;
    if (shelterAllocation) return "moderate";
    return "moderate";
  })();

  const riskFlows: RiskFlow[] = [
    {
      id: "utility-sua",
      label: "SUA / Utility Verification",
      weight: 50.5,
      defensibility: suaDef,
      points: flowPoints(50.5, suaDef),
      actionable: true,
      impactIfImproved: impactIfUpgraded(50.5, suaDef),
      detail: suaDef === "weak"
        ? "SUA utility questions (heating, electric/gas, phone) have not been answered. USDA classifies SUA as the highest payment-error driver (50.5% weight). Complete the expense questions to move this flow to moderate."
        : `SUA tier determined: ${suaComputed} (${ { FULL: "$663", LIMITED: "$170", TELEPHONE: "$44", NONE: "$0" }[suaComputed!] }/mo). Utility costs are confirmed from the applicant's intake answers.`,
      evidence: [
        { label: "Heating costs", value: answersMap["has_heating_costs"] ?? "not answered" },
        { label: "Electric / gas", value: answersMap["has_electric_or_gas"] ?? "not answered" },
        { label: "Phone costs", value: answersMap["has_phone"] ?? "not answered" },
        { label: "SUA tier", value: suaComputed ?? "incomplete — questions unanswered" },
      ],
    },
    {
      id: "gig-income",
      label: "Gig & Informal Income",
      weight: 26.8,
      defensibility: gigDef,
      points: flowPoints(26.8, gigDef),
      actionable: gigDef !== "strong",
      impactIfImproved: impactIfUpgraded(26.8, gigDef),
      detail: gigDef === "weak"
        ? "Argyle is not connected. Without payroll data, income cannot be independently verified — this is the primary verification gap for gig and informal workers. Connect Argyle to move this flow to strong."
        : `Argyle connected${argyleConn?.linked_at ? " " + formatDate(argyleConn.linked_at) : ""}. Payroll data available for income verification — this flow is strongly defensible.`,
      evidence: [
        { label: "Argyle", value: isArgyleConnected ? `connected${argyleConn?.linked_at ? " " + formatDate(argyleConn.linked_at) : ""}` : "not connected" },
        { label: "Income docs", value: hasIncomeDocs ? "uploaded" : "not uploaded" },
        { label: "Employment", value: answersMap["employment_status"] ?? "not answered" },
      ],
    },
    {
      id: "shared-lease",
      label: "Shared Housing / Lease",
      weight: 11.4,
      defensibility: leaseDef,
      points: flowPoints(11.4, leaseDef),
      actionable: true,
      impactIfImproved: impactIfUpgraded(11.4, leaseDef),
      detail: leaseDef === "weak"
        ? "Housing situation was not answered in the questionnaire. Shared-lease arrangements are a known error source — USDA assigns 11.4% weight. A clear housing answer moves this to moderate."
        : leaseDef === "strong"
          ? ocrLeaseTier === "strong"
            ? `Lease OCR verified: rent ${ocrRentMatchValue ?? "matched"}, name ${ocrNameMatchValue ?? "matched"}. Strong defensibility — both axes confirmed independently.`
            : `Rent allocation confirmed by navigator (${shelterAllocation ? `$${shelterAllocation.allocated_rent_usd}/mo — ${Math.round(shelterAllocation.household_share_pct * 100)}% of total lease` : "see allocation"}) with supporting evidence document on file. Strong defensibility.`
          : ocrLeaseTier === "weak"
            ? `OCR flagged a discrepancy: rent ${ocrRentMatchValue ?? "unknown"}, name ${ocrNameMatchValue ?? "unknown"}. Navigator review required before this can advance.`
            : ocrLeaseTier === "moderate"
              ? `Lease extracted — one axis incomplete. Rent: ${ocrRentMatchValue ?? "pending"}, name: ${ocrNameMatchValue ?? "pending"}. Confirm or correct in the extraction fields panel below.`
              : shelterAllocation
                ? `Rent allocation set by navigator: $${shelterAllocation.allocated_rent_usd}/mo (${Math.round(shelterAllocation.household_share_pct * 100)}% of $${shelterAllocation.total_lease_rent_usd} total lease). Upload a roommate agreement or wait for OCR to reach strong.`
                : "Housing situation is on file. OCR verification will run automatically when the lease document is confirmed. Sublease classifier v1 live.",
      evidence: [
        { label: "Housing situation", value: answersMap["housing_situation"] ?? "missing" },
        { label: "Lease document", value: docs.some((d) => d.document_kind.toLowerCase().includes("lease")) ? "uploaded" : "not uploaded" },
        { label: "Rent OCR match", value: ocrRentMatchValue ?? "not yet extracted" },
        { label: "Name OCR match", value: ocrNameMatchValue ?? "not yet extracted" },
        { label: "OCR defensibility", value: ocrLeaseTier ?? "pending extraction" },
        { label: "Rent allocation", value: shelterAllocation ? `$${shelterAllocation.allocated_rent_usd}/mo (${Math.round(shelterAllocation.household_share_pct * 100)}%)` : "not set" },
      ],
    },
    {
      id: "assets",
      label: "Asset Verification",
      weight: 8.2,
      defensibility: "moderate",
      points: flowPoints(8.2, "moderate"),
      actionable: false,
      impactIfImproved: null,
      detail: "Asset declarations are taken from the eligibility questionnaire. Bank-statement cross-verification is the next defensibility upgrade for this flow.",
      evidence: [
        { label: "Vehicle value", value: answersMap["vehicle_value"] ?? "not answered" },
        { label: "Savings", value: answersMap["savings_amount"] ?? "not answered" },
        { label: "Bank verification", value: "pending" },
      ],
    },
    {
      id: "benefit-calc",
      label: "Benefit Calculation",
      weight: 3.1,
      defensibility: "strong",
      points: flowPoints(3.1, "strong"),
      actionable: false,
      impactIfImproved: null,
      detail: "Civica runs a deterministic benefit calculation from collected data. This flow is fully defensible — the calculation is repeatable from the packet record.",
      evidence: [
        { label: "Household size", value: answersMap["household_size"] ?? "not answered" },
        { label: "Gross income", value: answersMap["monthly_gross_income"] ? `$${parseFloat(answersMap["monthly_gross_income"]).toFixed(0)}/mo` : "not answered" },
        { label: "Calc engine", value: "deterministic" },
      ],
    },
  ];

  const riskActions: RiskAction[] = riskFlows
    .filter((f) => f.actionable && f.impactIfImproved != null)
    .sort((a, b) => (b.impactIfImproved ?? 0) - (a.impactIfImproved ?? 0))
    .map((f, i) => ({
      id: f.id,
      n: i + 1,
      title:
        f.id === "gig-income"   ? "Connect Argyle to verify income" :
        f.id === "utility-sua"  ? "Complete SUA expense questions"   :
        f.id === "shared-lease" ? "Document housing situation"      : "Improve defensibility",
      flowLabel: f.label,
      weight: f.weight,
      impact: f.impactIfImproved!,
      timeEst: f.id === "gig-income" ? "3–5 min" : "2–3 min",
      actor: f.id === "gig-income" ? "Applicant" : "Navigator",
      body:
        f.id === "gig-income"
          ? "Ask the applicant to connect their employer via Argyle in the Civica iOS app. Once connected, Civica can independently verify income — moving this flow from weak to strong and significantly reducing the score."
          : f.id === "utility-sua"
          ? "Answer the three SUA utility questions in the packet: heating costs, electric/gas, and phone. Answering all three lets Civica derive the correct SUA tier (FULL/LIMITED/TELEPHONE/NONE) and moves this flow from weak to moderate defensibility."
          : "Ask the applicant to clarify their housing arrangement in the eligibility questionnaire. Any concrete answer (own, rent, shared) moves this flow from weak to moderate.",
      cta: f.id === "gig-income" ? "Connect Argyle" : "Update Answers",
      ctaSub: f.id === "gig-income" ? "via iOS app" : "in questionnaire",
    }));
  // ── end risk data ────────────────────────────────────────────────────────

  const applicantName = applicant ? firstNameLastInitial(decryptDemoName(applicant.full_name_ciphertext)) : "Unknown applicant";
  const language = applicant ? (LANG_LABELS[applicant.preferred_language] ?? applicant.preferred_language) : null;

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-surface border-b border-hairline px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/packets" className="text-[13px] font-semibold text-pine hover:underline">← Applications</Link>
          <span className="text-hairline">·</span>
          <span className="text-[12px] font-mono tabular-nums text-muted">{shortId(packetId)}</span>
          <span className="text-hairline">·</span>
          <Link
            href={`/packets/${packetId}/audit`}
            className="text-[12px] uppercase tracking-wider font-semibold text-muted hover:text-graphite"
          >
            Audit log →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-8 space-y-5">

        {/* Hero */}
        <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
          {/* Top accent bar — semantic per status. Brick is reserved for
              recovery/denial/distress (DESIGN.md §1.3), so the default falls
              through to hairline rather than shouting brick on every packet. */}
          <div className={`h-1 w-full ${
            ["Needs Documents", "Needs Applicant Clarification"].includes(packet.status)
              ? "bg-warning"
              : ["Ready for Handoff"].includes(packet.status)
              ? "bg-teal"
              : ["Handed Off", "Closed"].includes(packet.status)
              ? "bg-pine-surface"
              : ["In Navigator Review", "Submitted for Review"].includes(packet.status)
              ? "bg-indigo/40"
              : "bg-hairline"
          }`} />
          <div className="p-8">
            <div className="flex items-center justify-between gap-4 mb-3">
              <p className="eyebrow">Packet</p>
              <p className="text-[12px] text-muted">
                <span className="font-mono tabular-nums">#{shortId(packetId)}</span>
                {packet.submitted_at && (
                  <span className="ml-3">submitted <span className="tabular-nums text-graphite">{formatDateTime(packet.submitted_at)}</span></span>
                )}
              </p>
            </div>
            <h1 className="text-[28px] font-semibold tracking-tight leading-tight text-ink">
              {applicantName}
            </h1>
            <p className="text-[16px] text-graphite mt-1">
              {packet.county ?? "Unknown County"}, {packet.state_code}
              {language && <span className="text-muted"> · {language}</span>}
            </p>
            <div className="mt-3 mb-6 flex items-center gap-3 flex-wrap">
              <StatusPill status={packet.status} />
              {errorRisk && errorRisk.tier && (
                <a href="#api-verification" className="inline-flex items-center gap-1.5 group">
                  <RiskTierBadge tier={errorRisk.tier as "high" | "medium" | "low"} score={errorRisk.score} />
                </a>
              )}
            </div>

            {/* Lifecycle progress strip */}
            <div className="pt-5 border-t border-hairline">
              <LifecycleStrip status={packet.status} />
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-surface border border-hairline rounded-[4px] p-1 self-start">
          <Link
            href={`/packets/${packetId}`}
            className={`px-4 py-2 text-[13px] font-medium rounded-[3px] transition-colors ${
              tab === "overview"
                ? "bg-paper text-ink shadow-sm"
                : "text-muted hover:text-graphite"
            }`}
          >
            Overview
          </Link>
          <Link
            href={`/packets/${packetId}?tab=risk`}
            className={`px-4 py-2 text-[13px] font-medium rounded-[3px] transition-colors flex items-center gap-2 ${
              tab === "risk"
                ? "bg-paper text-ink shadow-sm"
                : "text-muted hover:text-graphite"
            }`}
          >
            Error Risk
            {riskRow && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
                style={{
                  color: riskRow.tier === "high" ? "#9C3A24" : riskRow.tier === "medium" ? "var(--color-amber-dark)" : "#2A6F66",
                  background: riskRow.tier === "high" ? "rgba(156,58,36,0.10)" : riskRow.tier === "medium" ? "rgba(154,90,20,0.10)" : "rgba(42,111,102,0.10)",
                }}
              >
                {riskRow.score}
              </span>
            )}
          </Link>
        </div>

        {tab === "risk" ? (
          <Suspense fallback={<RiskTabSkeleton />}>
            <RiskTabSection riskRow={riskRow} riskFlows={riskFlows} riskActions={riskActions} />
          </Suspense>
        ) : (
          <>

        {/* Recert countdown — only for active enrollments (Handed Off / Closed) */}
        {(packet.status === "Handed Off" || packet.status === "Closed") && packet.handed_off_at && (
          <RecertBanner status={packet.status} handedOffAt={packet.handed_off_at} recert={recert} />
        )}

        {/* ── DECIDE zone — sign-off gates + actions. Same-weight cards, all
            open. The reviewer's "what do I do?" surface. See
            docs/plans/packet-detail-decide-evidence-layout.md. ─────────── */}

        {/* Review Status — the single at-a-glance answer to
            "is this packet safe to hand off, and if not, what's next."
            Consolidates verification strength, automated checks,
            top next actions, and last-reviewed timestamp into one card. */}
        <ReviewStatusCard
          strength={profileStrength}
          delta={strengthDelta}
          riskScore={errorRiskScore}
          riskTier={errorRisk?.tier as "high" | "medium" | "low" | null}
          lastReviewedAt={errorRisk?.created_at ?? null}
          evalCount={errorRiskHistory.length}
          signoffChecks={signoffChecks}
          passedChecks={passedChecks}
          totalChecks={signoffChecks.length}
          topActions={riskActions.slice(0, 2)}
          argyleLinked={argyleLinked}
          packetId={packetId}
        />

        {/* Work-Hours Rule (HR 1 §10102 / OBBBA) */}
        <Suspense fallback={<WorkRequirementsSkeleton />}>
          <WorkRequirementsSection packetId={packetId} />
        </Suspense>

        {/* Consent capture */}
        <Section
          title="Privacy Notice Consent"
          subtitle="Required before handoff. Record how the applicant acknowledged the privacy notice."
        >
          <ConsentCapture
            applicantId={packet.applicant_id}
            hasConsent={hasConsent}
            consentedAt={consentedAt}
          />
        </Section>

        {/* Shared lease allocation — shown when classifier detects shared/sublease tenancy */}
        {showAllocationPanel && (
          <Section
            title="Shared Lease — Rent Allocation"
            subtitle={`Classifier: ${leaseClassification.tenancy} · confidence ${Math.round(leaseClassification.confidence * 100)}% · ${leaseClassification.signals.slice(0, 2).join("; ")}`}
          >
            <ShelterAllocationPanel
              packetId={packetId}
              statedMonthlyRent={parseFloat(getAnswer("monthly_rent_or_mortgage") ?? "0") || null}
              existing={shelterAllocation as ShelterAllocation | null}
              leaseDocs={docs.filter((d) =>
                d.document_kind === "lease" || d.document_kind === "other" || d.document_kind === "bank_statement"
              )}
            />
          </Section>
        )}

        {/* Expedited review gate — OBBBA §10102(a) compliance */}
        {showExpeditedGate && <ExpeditedReviewGate packetId={packetId} />}

        {/* Status transition */}
        {nextStatuses.length > 0 && (
          <Section title="Advance Status" subtitle="Move this packet to its next stage. All transitions are logged in the audit trail.">
            <StatusTransition packetId={packetId} nextStatuses={nextStatuses} blockers={blockers} />
          </Section>
        )}

        {/* BenefitsCal automated submission (Phase 2 — runs the CBO Assister
            Playwright pipeline against the real portal). Sits above the manual
            export panel so it's the primary CA path; HandoffPanel below is the
            fallback for environments where the driver isn't wired. */}
        <Section
          title="BenefitsCal Submission"
          subtitle="Send the prepared packet to BenefitsCal via the CBO Assister automation. Prepare → review payload → submit; the background worker drives the live portal."
        >
          <BenefitsCalPanel
            packetId={packetId}
            packetStatus={packet.status}
            blockerCount={blockers.length}
          />
        </Section>

        {/* Handoff export (manual fallback) */}
        <Section
          title="Handoff &amp; Export"
          subtitle="Generate a structured packet for the official SNAP application channel. Civica does not determine eligibility."
        >
          <HandoffPanel
            packetId={packetId}
            packetStatus={packet.status}
            blockerCount={blockers.length}
          />
        </Section>

        {/* ── EVIDENCE zone — source material + computed advisory. Collapsible
            <details> rows. Auto-open when underlying data has flags;
            otherwise closed. Summary chip text announces state so a closed
            row never hides a problem. ─────────────────────────────────── */}
        <div className="pt-6">
          <p className="eyebrow mb-3">Evidence</p>
          <div className="space-y-3">

            {/* Documents — required checklist, missing-item requests, uploaded grid */}
            <EvidenceSection
              title="Documents"
              count={docs.length}
              summary={unresolvedDocsCount > 0 ? `${unresolvedDocsCount} unresolved` : "all received"}
              flagged={unresolvedDocsCount > 0}
            >
              <Suspense fallback={<DocumentsSkeleton />}>
                <DocumentsSection
                  packetId={packetId}
                  applicantId={packet.applicant_id}
                  stateCode={packet.state_code as string}
                  uploadedDocs={docs as Array<{ document_id: string; document_kind: string; original_filename: string | null; processing_status: string; uploaded_at: string }>}
                  fields={fields as Array<{ field_id: string; extraction_id: string; field_key: string; field_label: string; original_ocr_value: string | null; applicant_answer: string | null; navigator_confirmed_value: string | null; confidence: number; needs_review: boolean; reviewed_at: string | null; review_note: string | null }>}
                  extractionsByDoc={extractionsByDoc}
                />
              </Suspense>
            </EvidenceSection>

            {/* Application Answers — reference, never auto-open */}
            <EvidenceSection title="Application Answers" count={answers.length}>
              {answers.length === 0 ? (
                <EmptyState
                  title="No answers yet"
                  description="will appear as applicant completes the eligibility flow"
                />
              ) : (
                <AnswerReviewList answers={answers as unknown as React.ComponentProps<typeof AnswerReviewList>["answers"]} />
              )}
            </EvidenceSection>

            {/* Extracted Fields — auto-open when any need review */}
            {fields.length > 0 && (
              <EvidenceSection
                title="Extracted Fields"
                count={fields.length}
                summary={unreviewedFieldsCount > 0 ? `${unreviewedFieldsCount} need review` : "all reviewed"}
                flagged={unreviewedFieldsCount > 0}
              >
                <ExtractionFieldList fields={fields} />
              </EvidenceSection>
            )}

            {/* API Cross-Verification — auto-open when flagged */}
            <EvidenceSection
              id="api-verification"
              title="API Cross-Verification"
              summary={verificationFlagCount > 0
                ? `${verificationFlagCount} flag${verificationFlagCount === 1 ? "" : "s"}`
                : "no flags"}
              flagged={verificationFlagCount > 0}
            >
              <Suspense fallback={<VerificationSkeleton />}>
                <VerificationSection summary={verificationSummary} flagCount={verificationFlagCount} />
              </Suspense>
            </EvidenceSection>

            {/* Missed Elections — advisory; auto-open when any detected */}
            <EvidenceSection
              title="Missed Elections"
              count={missedElections.length}
              summary={missedElections.length > 0
                ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(missedElectionsTotal)}/mo potential`
                : "all claimed"}
              flagged={missedElections.length > 0}
            >
              <MissedElectionsPanel elections={missedElections} totalMonthlyValue={missedElectionsTotal} />
            </EvidenceSection>

            {/* Notes — reference, never auto-open */}
            <EvidenceSection title="Navigator Notes">
              <Suspense fallback={<NotesSkeleton />}>
                <NotesSection packetId={packetId} />
              </Suspense>
            </EvidenceSection>

            {/* Activity Timeline — reference, never auto-open */}
            <EvidenceSection title="Activity Timeline">
              <Suspense fallback={<TimelineSkeleton />}>
                <TimelineSection
                  packetId={packetId}
                  riskHistory={errorRiskHistory}
                  docs={docs as Array<{ document_id: string; document_kind: string; uploaded_at: string; original_filename: string | null }>}
                  extractions={extractions as Array<{ extraction_id: string; document_id: string; extracted_at: string; extractor_model: string | null; overall_confidence: number | null; uploaded_documents: { document_kind: string; original_filename: string | null } | null }>}
                  argyleConn={argyleResult.data as { linked_at: string | null } | null}
                />
              </Suspense>
            </EvidenceSection>

            {/* Packet metadata — collapsed row in Evidence zone */}
            <EvidenceSection title="Packet metadata">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">
                <MetaInline label="State"     value={packet.state_code} />
                <MetaInline label="County"    value={packet.county ?? "—"} />
                <MetaInline label="Created"   value={formatDateTime(packet.created_at)} mono />
                <MetaInline label="Submitted" value={packet.submitted_at ? formatDateTime(packet.submitted_at) : "—"} mono={!!packet.submitted_at} />
                {packet.handed_off_at && <MetaInline label="Handed Off" value={formatDateTime(packet.handed_off_at)} mono />}
                <MetaInline label="Language"  value={language ?? "—"} />
              </div>
            </EvidenceSection>

          </div>
        </div>

        {devtoolsEnabled ? (
          <Section title="Compliance Narrative (devtools)" subtitle="Proof-of-life: rendered from @civica/snap-compliance-copy.">
            <ComplianceNarrative />
          </Section>
        ) : null}

          </>
        )}
      </main>
    </div>
  );
}

// UnifiedTimeline moved to components/packet-detail/TimelineSection.tsx (T6b §5).

type RecertData = { cert_period_end: string; cert_period_end_source: string; status: string } | null;

function RecertBanner({ status, handedOffAt, recert }: { status: string; handedOffAt: string; recert: RecertData }) {
  const RECERT_MONTHS = 12;
  const handed = new Date(handedOffAt);
  const recertDate = recert?.cert_period_end
    ? new Date(recert.cert_period_end)
    : new Date(handed.getTime() + RECERT_MONTHS * 30 * 24 * 60 * 60 * 1000);
  const daysToRecert = Math.floor((recertDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const isClosed = status === "Closed";
  const isOverdue = daysToRecert < 0;
  const isExpiringSoon = !isOverdue && daysToRecert <= 30;

  const totalDays = RECERT_MONTHS * 30;
  const elapsedDays = totalDays - daysToRecert;
  const pctElapsed = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

  const recertSourceLabel = recert?.cert_period_end
    ? recert.cert_period_end_source === "agency_confirmed"
      ? "⬤ Agency confirmed"
      : recert.cert_period_end_source === "manual"
        ? "⬤ Navigator entry"
        : "⬤ Estimated"
    : null;

  // Static class lookup — Tailwind requires full class names at compile time
  const theme = isClosed
    ? { border: "border-indigo/40", ring: "ring-indigo/10", tint: "bg-indigo/8", text: "text-indigo", bar: "bg-indigo" }
    : isOverdue
      ? { border: "border-brick/40",  ring: "ring-brick/10",  tint: "bg-brick/10",  text: "text-brick",  bar: "bg-brick" }
      : isExpiringSoon
        ? { border: "border-warning/40", ring: "ring-warning/10", tint: "bg-warning/10", text: "text-warning", bar: "bg-warning" }
        : { border: "border-teal/40",  ring: "ring-teal/10",  tint: "bg-teal/8",   text: "text-teal",  bar: "bg-teal" };

  const headline = isClosed
    ? "Recertified · benefits renewed"
    : isOverdue
      ? `Recertification ${Math.abs(daysToRecert)} days overdue`
      : isExpiringSoon
        ? `Recertification due in ${daysToRecert} days — action soon`
        : `${daysToRecert} days until recertification`;

  return (
    <section className={`bg-surface border ${theme.border} rounded-[4px] overflow-hidden ring-1 ${theme.ring}`}>
      <div className={`${theme.tint} px-6 py-4 flex items-center justify-between gap-6 flex-wrap`}>
        <div>
          <p className={`text-[11px] uppercase tracking-[0.15em] font-semibold ${theme.text}`}>Benefit Period</p>
          <h3 className="text-[18px] font-semibold tracking-tight text-ink mt-1">{headline}</h3>
          <p className="text-[12px] text-graphite mt-1 tabular-nums">
            Enrolled {handed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            {!isClosed && (
              <> · Recerts {recertDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</>
            )}
            {recertSourceLabel && (
              <span className="ml-2 text-muted">{recertSourceLabel}</span>
            )}
          </p>
        </div>
        {!isClosed && (
          <div className="text-right shrink-0">
            <p className={`text-[40px] font-semibold tabular-nums leading-none ${theme.text}`}>
              {isOverdue ? `−${Math.abs(daysToRecert)}` : daysToRecert}
              <span className="text-[16px] text-graphite font-normal ml-1">d</span>
            </p>
            <p className="text-[11px] uppercase tracking-wider text-muted mt-1">
              {isOverdue ? "past recert" : "until recert"}
            </p>
          </div>
        )}
      </div>
      {!isClosed && (
        <div className="px-6 pb-4">
          <div className="h-2 bg-paper rounded-full overflow-hidden">
            <div className={`h-full ${theme.bar} transition-all`} style={{ width: `${pctElapsed}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted uppercase tracking-wider mt-1.5 font-medium">
            <span>enrolled</span>
            <span>{pctElapsed.toFixed(0)}% through 12-month cycle</span>
            <span>recert due</span>
          </div>
        </div>
      )}
    </section>
  );
}

function Section({ id, title, count, subtitle, children }: { id?: string; title: string; count?: number; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-surface border border-hairline rounded-[4px] p-6">
      <div className="mb-5">
        <div className="flex items-baseline gap-2">
          <h2 className="section-title">{title}</h2>
          {count !== undefined && <span className="text-[12px] text-muted tabular-nums">({count})</span>}
        </div>
        {subtitle && <p className="section-sub mt-1 leading-snug">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function MetaRow({ label, value, mono, muted }: { label: string; value: string; mono?: boolean; muted?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-muted uppercase tracking-wider font-medium mb-0.5">{label}</p>
      <p className={`text-[15px] ${mono ? "font-mono tabular-nums" : ""} ${muted ? "text-muted italic" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function MetaInline({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[11px] uppercase tracking-wider font-semibold text-muted">{label}</span>
      <span className={`text-ink ${mono ? "font-mono tabular-nums text-[13px]" : "font-medium"}`}>{value}</span>
    </span>
  );
}

// WorkRequirementsCard moved to
// components/packet-detail/WorkRequirementsSection.tsx as part of the
// T6b per-section Suspense refactor. Page-level wr_status fetch
// removed too — the section fetches its own data via the cached
// getWrStatus() helper in lib/packet-fetchers.ts.

/**
 * Single at-a-glance card that answers the caseworker's two core
 * questions about a packet:
 *   1. Is this safe to hand off?            (status label + gate list)
 *   2. If not, what's the next action?      (top 2 prioritized fixes)
 *
 * Consolidates what were previously four separate surfaces (profile
 * strength, Argyle uplift, engine sign-off, engine heartbeat) into one
 * dense panel positioned right under the hero. Everything inside is
 * derived from data already fetched by the page — no extra round-trips.
 */
function ReviewStatusCard({
  strength, delta, riskScore, riskTier, lastReviewedAt, evalCount,
  signoffChecks, passedChecks, totalChecks, topActions, argyleLinked, packetId,
}: {
  strength: number | null;
  delta: number | null;
  riskScore: number | null;
  riskTier: "high" | "medium" | "low" | null;
  lastReviewedAt: string | null;
  evalCount: number;
  signoffChecks: { id: string; label: string; passed: boolean; note?: string }[];
  passedChecks: number;
  totalChecks: number;
  topActions: RiskAction[];
  argyleLinked: boolean;
  packetId: string;
}) {
  const remaining = totalChecks - passedChecks;
  const isReady = remaining === 0 && (riskTier === "low" || riskTier === "medium");
  const isCritical = riskTier === "high" || remaining >= 4;
  const isAlmost = !isReady && remaining <= 2 && !isCritical;

  const readinessLabel = strength == null
    ? "Awaiting review"
    : isReady
      ? "Ready to hand off"
      : isCritical
        ? "Needs review"
        : isAlmost
          ? `Almost ready · ${remaining} check${remaining === 1 ? "" : "s"} remaining`
          : `In review · ${remaining} check${remaining === 1 ? "" : "s"} remaining`;

  const tone: "teal" | "warning" | "graphite" | "muted" =
    strength == null ? "muted"
      : isReady ? "teal"
        : isCritical ? "warning"
          : "graphite";
  const toneClass = {
    teal: { border: "border-teal/40", ring: "ring-teal/15", band: "bg-teal/10", text: "text-teal", bar: "bg-teal", dot: "bg-teal" },
    warning: { border: "border-warning/40", ring: "ring-warning/15", band: "bg-warning/10", text: "text-warning", bar: "bg-warning", dot: "bg-warning" },
    graphite: { border: "border-hairline", ring: "ring-hairline", band: "bg-paper", text: "text-graphite", bar: "bg-graphite", dot: "bg-graphite" },
    muted: { border: "border-hairline", ring: "ring-hairline", band: "bg-paper", text: "text-muted", bar: "bg-muted", dot: "bg-muted" },
  }[tone];

  const strengthBand = strength == null
    ? "—"
    : strength >= 80 ? "Verified"
      : strength >= 60 ? "Partial"
        : strength >= 40 ? "Needs work"
          : "Critical";

  return (
    <section className={`bg-surface border ${toneClass.border} rounded-[4px] overflow-hidden ring-1 ${toneClass.ring}`}>
      {/* Readiness band */}
      <div className={`${toneClass.band} px-6 py-3 flex items-center gap-3 flex-wrap border-b border-hairline`}>
        <span className={`inline-flex w-2 h-2 rounded-full ${toneClass.dot}`} aria-hidden />
        <span className={`text-[13px] font-semibold ${toneClass.text}`}>{readinessLabel}</span>
        {lastReviewedAt && (
          <span className="ml-auto text-[12px] text-muted tabular-nums">
            Reviewed {timeAgo(lastReviewedAt)}
            {evalCount > 1 && <span className="text-muted"> · {evalCount} reviews on file</span>}
          </span>
        )}
      </div>

      {/* Strength + risk */}
      <div className="px-6 py-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[28px] font-semibold text-ink tabular-nums leading-none">
            {strength ?? "—"}
            <span className="text-[14px] text-muted font-normal"> / 100</span>
          </span>
          <span className="text-[13px] uppercase tracking-wider font-semibold text-graphite">
            verification strength · {strengthBand}
          </span>
          {delta != null && delta !== 0 && (
            <span className={`text-[12px] font-semibold tabular-nums ${delta > 0 ? "text-teal" : "text-warning"}`}>
              {delta > 0 ? "+" : "−"}{Math.abs(delta)} since last review
            </span>
          )}
        </div>
        {/* Pillar subtitle — names the four engine inputs in the same
            vocabulary /qc's FormulaHero uses, so a navigator can trace this
            packet's score back to the aggregate engagement realization gap. */}
        <p className="text-[11px] text-muted mt-1 leading-snug">
          shelter · income · shared-lease · calc
        </p>
        <div className="mt-2 h-1.5 bg-paper rounded-full overflow-hidden">
          <div className={`h-full ${toneClass.bar} transition-all`} style={{ width: `${strength ?? 0}%` }} />
        </div>
        <p className="text-[12px] text-muted mt-2 tabular-nums">
          Risk score <span className="text-graphite font-medium">{riskScore ?? "—"}/100</span>
          {riskTier && <span> · {riskTier}</span>}
          {argyleLinked && <span className="text-teal"> · income verified via payroll</span>}
        </p>
        {/* Reverse bridge to /qc: this packet's contribution to the
            engagement realization gap, in the same pp unit /qc's
            FormulaHero renders. perPacketGapContribution returns null
            when the packet is incomplete (no flows evaluated yet). */}
        {(() => {
          const gapPp = perPacketGapContribution(riskScore);
          if (gapPp == null) return null;
          return (
            <p className="text-[12px] text-graphite mt-2 leading-snug">
              This packet contributes{" "}
              <span className="font-semibold text-ink tabular-nums">
                {gapPp.toFixed(1)} pts
              </span>{" "}
              to the engagement realization gap.{" "}
              <Link
                href={`/qc?packetFocus=${encodeURIComponent(packetId)}#feed`}
                className="font-semibold text-pine hover:underline"
              >
                See aggregate impact ↗
              </Link>
            </p>
          );
        })()}
      </div>

      {/* Pre-handoff checks */}
      <div className="px-6 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {signoffChecks.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-[13px]">
            <span
              className={`shrink-0 inline-flex w-4 h-4 items-center justify-center rounded-full text-[10px] font-bold ${
                c.passed ? "bg-teal text-white" : "bg-paper border border-hairline text-muted"
              }`}
              aria-hidden
            >
              {c.passed ? "✓" : ""}
            </span>
            <span className={c.passed ? "text-graphite" : "text-ink font-medium"}>{c.label}</span>
            {c.note && <span className="ml-auto text-[12px] text-muted tabular-nums">{c.note}</span>}
          </div>
        ))}
      </div>

      {/* Next actions — promote the top 2 from the Risk tab so caseworkers
          don't have to tab-switch to see what to do. */}
      {topActions.length > 0 && (
        <div className="border-t border-hairline bg-paper/40 px-6 py-4">
          <div className="flex items-baseline justify-between mb-2.5">
            <p className="eyebrow">Next actions</p>
            <Link
              href={`/packets/${packetId}?tab=risk`}
              className="text-[12px] font-semibold text-pine hover:underline"
            >
              See full breakdown →
            </Link>
          </div>
          <ol className="space-y-1.5">
            {topActions.map((a) => (
              <li key={a.id} className="flex items-baseline gap-2 text-[13px]">
                <span className="tabular-nums text-muted font-semibold shrink-0">{a.n}.</span>
                <span className="text-ink font-medium">{a.title}</span>
                <span className="text-[12px] text-muted shrink-0">
                  · {a.actor} · {a.timeEst}
                </span>
                <span className="ml-auto text-[12px] font-semibold text-teal tabular-nums shrink-0">
                  −{a.impact} pts
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

const RISK_TIER_STYLE: Record<"high" | "medium" | "low", { bg: string; text: string; dot: string; label: string }> = {
  high:   { bg: "bg-brick/10",   text: "text-brick",   dot: "bg-brick",   label: "High risk" },
  medium: { bg: "bg-warning/15",   text: "text-warning",   dot: "bg-warning",   label: "Medium risk" },
  low:    { bg: "bg-teal/10",    text: "text-teal",    dot: "bg-teal",    label: "Low risk" },
};

function RiskTierBadge({ tier, score }: { tier: "high" | "medium" | "low"; score: number | null }) {
  const s = RISK_TIER_STYLE[tier];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${s.bg} ${s.text}`}
      title={`Error-risk score: ${score ?? "—"}/100 — click to jump to verification panel`}
    >
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {s.label}
      {score !== null && <span className="opacity-70 tabular-nums">({score})</span>}
    </span>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-3 px-4 bg-paper border border-dashed border-hairline rounded-[4px] flex items-center gap-3">
      <span className="text-muted text-[16px] shrink-0">○</span>
      <p className="text-[13px] text-graphite leading-snug">
        <span className="font-semibold">{title}</span>
        <span className="text-muted"> · {description}</span>
      </p>
    </div>
  );
}
