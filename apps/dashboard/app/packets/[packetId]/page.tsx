import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClientFromCookies } from "../../../lib/supabase";
import StatusTransition, { type Blocker } from "../../../components/StatusTransition";
import ConsentCapture from "../../../components/ConsentCapture";
import ExtractionFieldList from "../../../components/ExtractionFieldList";
import DocumentChecklist from "../../../components/DocumentChecklist";
import DocumentGrid from "../../../components/DocumentGrid";
import AnswerReviewList from "../../../components/AnswerReviewList";
import NotesList from "../../../components/NotesList";
import StatusPill from "../../../components/StatusPill";
import LifecycleStrip from "../../../components/LifecycleStrip";
import HandoffPanel from "../../../components/HandoffPanel";
import MissingItemRequestPanel from "../../../components/MissingItemRequestPanel";
import ExpeditedReviewGate from "./ExpeditedReviewGate";
import ComplianceNarrative from "../../../components/ComplianceNarrative";

import { formatDateTime, formatDate, decryptDemoName, docKindLabel, firstNameLastInitial, shortId } from "../../../lib/format";
import { PACKET_STATUS_TRANSITIONS } from "@civica/snap-enums";
import RiskScoreHero from "../../../components/packet-risk/RiskScoreHero";
import FlowBreakdown from "../../../components/packet-risk/FlowBreakdown";
import RecommendedActions from "../../../components/packet-risk/RecommendedActions";
import type { RiskFlow, RiskAction } from "../../../components/packet-risk/types";

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
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);

  const [packetResult, answersResult, docsResult, notesResult, historyResult, fieldsResult, docItemsResult, wrStatusResult, recertResult, extractionsResult] = await Promise.all([
    supabase.schema("snap_enrollment").from("snap_packets").select(`*, applicants(*)`).eq("packet_id", packetId).is("deleted_at", null).single(),
    supabase.schema("snap_enrollment").from("packet_answers").select("*").eq("packet_id", packetId).order("question_key"),
    supabase.schema("snap_enrollment").from("uploaded_documents").select("*").eq("packet_id", packetId).is("deleted_at", null).order("uploaded_at", { ascending: false }),
    supabase.schema("snap_enrollment").from("navigator_notes").select("*").eq("packet_id", packetId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.schema("snap_enrollment").from("packet_status_history").select("*").eq("packet_id", packetId).order("occurred_at", { ascending: false }),
    supabase.schema("snap_enrollment").from("extraction_fields").select("*").eq("packet_id", packetId).order("needs_review", { ascending: false }).order("field_key"),
    supabase.schema("snap_enrollment").from("required_document_items").select("*").eq("packet_id", packetId).order("created_at"),
    supabase.schema("snap_enrollment")
      .from("work_requirement_statuses")
      .select("wr_status_id, is_subject, compliance_status, exemption_type, months_used_in_window, next_review_due, determined_at, determination_basis")
      .eq("packet_id", packetId)
      .order("determined_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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
    supabase.schema("snap_enrollment")
      .from("document_extractions")
      .select("extraction_id, document_id, uploaded_documents!inner(packet_id)")
      .eq("uploaded_documents.packet_id", packetId),
  ]);

  if (!packetResult.data) notFound();
  const packet = packetResult.data;
  const applicant = packet.applicants as { full_name_ciphertext: string | null; preferred_language: string } | null;
  const answers = answersResult.data ?? [];
  const docs = docsResult.data ?? [];
  const notes = notesResult.data ?? [];
  const history = historyResult.data ?? [];
  const fields = fieldsResult.data ?? [];
  const docItems = docItemsResult.data ?? [];
  const wrStatus = wrStatusResult.data ?? null;
  const recert = recertResult.data ?? null;
  const extractions = (extractionsResult.data ?? []) as Array<{ extraction_id: string; document_id: string }>;
  const extractionsByDoc: Record<string, string[]> = {};
  for (const ex of extractions) {
    (extractionsByDoc[ex.document_id] ??= []).push(ex.extraction_id);
  }
  const nextStatuses = PACKET_STATUS_TRANSITIONS[packet.status as keyof typeof PACKET_STATUS_TRANSITIONS] ?? [];

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

  // Pre-flight blockers for "Ready for Handoff" + risk data
  const [unresolvedDocsResult, unreviewedFieldsResult, consentResult, riskResult, argyleResult] = await Promise.all([
    supabase.schema("snap_enrollment").from("required_document_items")
      .select("item_id").eq("packet_id", packetId).eq("is_required", true)
      .is("resolved_at", null).is("waived_at", null),
    supabase.schema("snap_enrollment").from("extraction_fields")
      .select("field_id").eq("packet_id", packetId).eq("needs_review", true).is("reviewed_at", null),
    supabase.schema("snap_enrollment").from("user_consents")
      .select("consent_id, consented_at").eq("applicant_id", packet.applicant_id)
      .eq("consent_kind", "privacy_notice").is("revoked_at", null).limit(1),
    (supabase.schema("snap_enrollment") as any)
      .from("packet_error_risk")
      .select("score, tier, engine_version, created_at, factors")
      .eq("packet_id", packetId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.schema("snap_enrollment")
      .from("argyle_connections")
      .select("connection_id, linked_at, argyle_user_id")
      .eq("applicant_id", packet.applicant_id)
      .is("revoked_at", null)
      .limit(1)
      .maybeSingle(),
  ]);

  const hasConsent = (consentResult.data?.length ?? 0) > 0;
  const consentedAt = hasConsent ? (consentResult.data![0] as { consented_at: string }).consented_at : null;

  const blockers: Blocker[] = [];
  if ((unresolvedDocsResult.data?.length ?? 0) > 0)
    blockers.push({ kind: "unresolved_docs", label: "Required documents not yet resolved", count: unresolvedDocsResult.data!.length });
  if ((unreviewedFieldsResult.data?.length ?? 0) > 0)
    blockers.push({ kind: "unreviewed_fields", label: "Extraction fields flagged for review", count: unreviewedFieldsResult.data!.length });
  if (!hasConsent)
    blockers.push({ kind: "missing_consent", label: "Privacy notice consent not on file" });

  // ── Error risk tab data ──────────────────────────────────────────────────
  const riskRow = riskResult.data ?? null;
  const argyleConn = argyleResult.data ?? null;
  const isArgyleConnected = argyleConn !== null;

  const answersMap: Record<string, string> = {};
  for (const a of answers) {
    if (a.applicant_answer != null) answersMap[a.question_key] = a.applicant_answer;
  }
  const monthlyUtilities = parseFloat(answersMap["monthly_utilities"] ?? "");
  const hasUtilityAnswer = !isNaN(monthlyUtilities) && monthlyUtilities > 0;
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

  const suaDef: "moderate" | "weak"   = hasUtilityAnswer    ? "moderate" : "weak";
  const gigDef: "strong"  | "weak"    = isArgyleConnected   ? "strong"   : "weak";
  const leaseDef: "moderate" | "weak" = hasHousingSituation ? "moderate" : "weak";

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
        ? "No utility cost was reported in the eligibility questionnaire. USDA classifies SUA as the highest payment-error driver (50.5% weight). Without a verifiable utility amount, this flow defaults to weak defensibility."
        : "A monthly utility amount was reported, providing a basis for SUA verification. Phase 2 will connect UtilityAPI for independent verification.",
      evidence: [
        { label: "Monthly utilities", value: hasUtilityAnswer ? `$${monthlyUtilities.toFixed(0)}/mo` : "missing" },
        { label: "UtilityAPI", value: "phase 2" },
        { label: "SUA election", value: answersMap["sua_election"] ?? "not answered" },
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
        : "Housing situation is on file. A sublease classifier (Phase 2) will upgrade this to strong with independent verification.",
      evidence: [
        { label: "Housing situation", value: answersMap["housing_situation"] ?? "missing" },
        { label: "Lease document", value: docs.some((d) => d.document_kind.toLowerCase().includes("lease")) ? "uploaded" : "not uploaded" },
        { label: "Sublease classifier", value: "phase 2" },
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
      detail: "Asset declarations are taken from the eligibility questionnaire. Phase 1 scores this as moderate; Phase 2 will verify against bank statement data.",
      evidence: [
        { label: "Vehicle value", value: answersMap["vehicle_value"] ?? "not answered" },
        { label: "Savings", value: answersMap["savings_amount"] ?? "not answered" },
        { label: "Bank verification", value: "phase 2" },
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
        f.id === "utility-sua"  ? "Record monthly utility costs"    :
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
          ? "Enter the monthly utility cost in the packet answers. Even a self-reported amount moves SUA from weak to moderate. Phase 2 will connect UtilityAPI for independent verification."
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
          <Link href="/packets" className="text-[13px] font-semibold text-brick hover:underline">← Queue</Link>
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
          {/* Top accent bar based on status urgency */}
          <div className={`h-1 w-full ${
            ["Needs Documents", "Needs Applicant Clarification"].includes(packet.status)
              ? "bg-amber"
              : ["Ready for Handoff"].includes(packet.status)
              ? "bg-teal"
              : "bg-brick"
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
            <div className="mt-3 mb-6">
              <StatusPill status={packet.status} />
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
                  color: riskRow.tier === "high" ? "#9C3A24" : riskRow.tier === "medium" ? "#9A5A14" : "#2A6F66",
                  background: riskRow.tier === "high" ? "rgba(156,58,36,0.10)" : riskRow.tier === "medium" ? "rgba(154,90,20,0.10)" : "rgba(42,111,102,0.10)",
                }}
              >
                {riskRow.score}
              </span>
            )}
          </Link>
        </div>

        {tab === "risk" ? (
          <>
            <RiskScoreHero
              score={riskRow?.score ?? null}
              tier={(riskRow?.tier as "high" | "medium" | "low" | "incomplete") ?? "incomplete"}
              engineVersion={riskRow?.engine_version ?? "v0.2.0"}
              evaluatedAt={riskRow?.created_at ? formatDate(riskRow.created_at) : null}
              flows={riskFlows}
            />
            <FlowBreakdown flows={riskFlows} />
            <RecommendedActions actions={riskActions} currentScore={riskRow?.score ?? null} />
          </>
        ) : (
          <>

        {/* Recert countdown — only for active enrollments (Handed Off / Closed) */}
        {(packet.status === "Handed Off" || packet.status === "Closed") && packet.handed_off_at && (
          <RecertBanner status={packet.status} handedOffAt={packet.handed_off_at} recert={recert} />
        )}

        {/* OBBBA Work Requirements */}
        <WorkRequirementsCard wrStatus={wrStatus} />

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

        {/* Expedited review gate — OBBBA §10102(a) compliance */}
        {showExpeditedGate && <ExpeditedReviewGate packetId={packetId} />}

        {/* Status transition */}
        {nextStatuses.length > 0 && (
          <Section title="Advance Status" subtitle="Move this packet to its next stage. All transitions are logged in the audit trail.">
            <StatusTransition packetId={packetId} nextStatuses={nextStatuses} blockers={blockers} />
          </Section>
        )}

        {/* Packet metadata — compact horizontal strip */}
        <section className="bg-surface border border-hairline rounded-[4px] px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">
            <MetaInline label="State"     value={packet.state_code} />
            <MetaInline label="County"    value={packet.county ?? "—"} />
            <MetaInline label="Created"   value={formatDateTime(packet.created_at)} mono />
            <MetaInline label="Submitted" value={packet.submitted_at ? formatDateTime(packet.submitted_at) : "—"} mono={!!packet.submitted_at} />
            {packet.handed_off_at && <MetaInline label="Handed Off" value={formatDateTime(packet.handed_off_at)} mono />}
            <MetaInline label="Language"  value={language ?? "—"} />
          </div>
        </section>

        {/* Answers */}
        <Section title="Application Answers" count={answers.length} subtitle="Responses from the eligibility questionnaire.">
          {answers.length === 0 ? (
            <EmptyState
              title="No answers yet"
              description="will appear as applicant completes the eligibility flow"
            />
          ) : (
            <AnswerReviewList answers={answers} />
          )}
        </Section>

        {/* Required document checklist */}
        <Section
          title="Required Documents"
          count={docItems.length}
          subtitle="Documents needed before handoff. Mark each resolved once received, or waive with a reason."
        >
          <DocumentChecklist packetId={packetId} applicantId={packet.applicant_id} stateCode={packet.state_code as "CA" | "MA"} items={docItems} uploadedDocs={docs} />
        </Section>

        {/* Missing-item requests (navigator-side creator + history) */}
        <Section
          title="Missing-Item Requests"
          subtitle="Send a structured request to the applicant for a missing or unclear document."
        >
          <MissingItemRequestPanel
            packetId={packetId}
            unresolvedItems={(docItems as Array<{ item_id: string; label: string; document_kind: string; resolved_at: string | null; waived_at: string | null }>)
              .filter((it) => !it.resolved_at && !it.waived_at)
              .map((it) => ({
                item_id: it.item_id,
                label: it.label,
                document_kind: it.document_kind,
                resolved_at: it.resolved_at,
                waived_at: it.waived_at,
              }))}
          />
        </Section>

        {/* Extraction field review */}
        {fields.length > 0 && (
          <Section
            title="Extracted Fields"
            subtitle="Values extracted by OCR from uploaded documents. Fields below 85% confidence require review."
          >
            <ExtractionFieldList fields={fields} />
          </Section>
        )}

        {/* Documents — click a thumbnail to open the inline viewer */}
        <Section title="Uploaded Documents" count={docs.length} subtitle="Click a document to view the original file alongside its extracted fields.">
          {docs.length === 0 ? (
            <EmptyState
              title="No documents uploaded"
              description="move packet to 'Needs Documents' to request files"
            />
          ) : (
            <DocumentGrid
              docs={docs as Array<{ document_id: string; document_kind: string; original_filename: string | null; processing_status: string; uploaded_at: string }>}
              fields={fields as Array<{ field_id: string; extraction_id: string; field_key: string; field_label: string; original_ocr_value: string | null; applicant_answer: string | null; navigator_confirmed_value: string | null; confidence: number; needs_review: boolean; reviewed_at: string | null; review_note: string | null }>}
              extractionsByDoc={extractionsByDoc}
            />
          )}
        </Section>

        {/* Notes */}
        <Section title="Navigator Notes" count={notes.length} subtitle="Internal notes for your team. Mark internal-only to hide from the applicant.">
          <NotesList packetId={packetId} initialNotes={notes} />
        </Section>

        {/* Handoff export */}
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

        {/* Unified activity timeline — status changes + uploads + notes, sorted by time desc */}
        <Section title="Activity Timeline" subtitle="Everything that's happened on this packet, in order.">
          <UnifiedTimeline history={history} docs={docs} notes={notes} />
        </Section>

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

type HistoryRow = { history_id: string; from_status: string | null; to_status: string; occurred_at: string; reason: string | null };
type DocRow     = { document_id: string; document_kind: string; uploaded_at: string; original_filename: string | null };
type NoteRow    = { note_id: string; created_at: string; is_internal: boolean };

function UnifiedTimeline({ history, docs, notes }: { history: HistoryRow[]; docs: DocRow[]; notes: NoteRow[] }) {
  type Event = {
    id: string;
    at: string;
    icon: string;
    iconBg: string;
    title: React.ReactNode;
    detail?: string;
  };

  const events: Event[] = [];

  for (const h of history) {
    events.push({
      id: `h-${h.history_id}`,
      at: h.occurred_at,
      icon: "↗",
      iconBg: "bg-indigo/15 text-indigo",
      title: (
        <span>
          Status moved from <span className="font-semibold text-graphite">{h.from_status ?? "—"}</span> to <span className="font-semibold text-ink">{h.to_status}</span>
        </span>
      ),
      detail: h.reason ?? undefined,
    });
  }

  for (const d of docs) {
    const kindLabel = docKindLabel(d.document_kind);
    events.push({
      id: `d-${d.document_id}`,
      at: d.uploaded_at,
      icon: "↥",
      iconBg: "bg-teal/15 text-teal",
      title: <span><span className="font-semibold text-ink">{kindLabel}</span> uploaded</span>,
      detail: d.original_filename ?? undefined,
    });
  }

  for (const n of notes) {
    events.push({
      id: `n-${n.note_id}`,
      at: n.created_at,
      icon: "✎",
      iconBg: "bg-amber/15 text-amber",
      title: <span>Navigator added a {n.is_internal ? <span className="font-semibold text-ink">private note</span> : <span className="font-semibold text-ink">note visible to applicant</span>}</span>,
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (events.length === 0) {
    return <EmptyState title="No activity yet" description="status changes, uploads, and notes will appear here in order" />;
  }

  return (
    <ol className="relative space-y-3">
      {/* Vertical guide line */}
      <div className="absolute left-[15px] top-3 bottom-3 w-px bg-hairline" aria-hidden />
      {events.map((e) => (
        <li key={e.id} className="relative flex items-start gap-3 pl-0">
          <div className={`w-8 h-8 rounded-full ${e.iconBg} flex items-center justify-center text-[14px] font-semibold shrink-0 relative z-10 bg-surface ring-4 ring-surface`}>
            <span>{e.icon}</span>
          </div>
          <div className="flex-1 min-w-0 pt-1.5">
            <p className="text-[14px] text-graphite leading-snug">{e.title}</p>
            {e.detail && (
              <p className="text-[12px] text-muted italic mt-0.5">"{e.detail}"</p>
            )}
          </div>
          <span className="text-[12px] text-muted tabular-nums shrink-0 pt-2">{formatDateTime(e.at)}</span>
        </li>
      ))}
    </ol>
  );
}

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
        ? { border: "border-amber/40", ring: "ring-amber/10", tint: "bg-amber/10", text: "text-amber", bar: "bg-amber" }
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

function Section({ title, count, subtitle, children }: { title: string; count?: number; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6">
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

type WrStatusData = {
  wr_status_id: string;
  is_subject: boolean;
  compliance_status: string | null;
  exemption_type: string | null;
  months_used_in_window: number | null;
  next_review_due: string | null;
  determined_at: string;
  determination_basis: string | null;
} | null;

const COMPLIANCE_BADGE: Record<string, string> = {
  unknown: "bg-paper text-muted border border-hairline",
  compliant: "bg-teal/10 text-teal",
  at_risk: "bg-amber/15 text-amber",
  non_compliant: "bg-brick/10 text-brick",
};

function WorkRequirementsCard({ wrStatus }: { wrStatus: WrStatusData }) {
  if (wrStatus === null) {
    return (
      <section className="bg-surface border border-hairline rounded-[4px] p-6">
        <p className="eyebrow mb-3">OBBBA Work Requirements</p>
        <p className="text-[14px] text-graphite leading-snug">
          Work requirements not yet evaluated. Use the iOS navigator app to run the §10102 evaluation for this household.
        </p>
      </section>
    );
  }

  const complianceBadgeClass = COMPLIANCE_BADGE[wrStatus.compliance_status ?? "unknown"] ?? COMPLIANCE_BADGE["unknown"];
  const determinationLabel =
    wrStatus.determination_basis === "rules_engine" ? "rules engine" : "navigator override";

  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6 space-y-3">
      <p className="eyebrow">OBBBA Work Requirements</p>

      {/* Subject / not subject headline */}
      <p className={`text-[16px] font-semibold ${wrStatus.is_subject ? "text-brick" : "text-teal"}`}>
        {wrStatus.is_subject ? "Subject to work requirements" : "Not subject to work requirements"}
      </p>

      {wrStatus.is_subject ? (
        <div className="space-y-2">
          {/* Compliance status badge */}
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${complianceBadgeClass}`}>
              {wrStatus.compliance_status ?? "unknown"}
            </span>
          </div>

          {/* Exemption */}
          {wrStatus.exemption_type && wrStatus.exemption_type !== "none" && (
            <p className="text-[13px] text-graphite">
              Exemption: <span className="font-medium text-ink">{wrStatus.exemption_type}</span>
            </p>
          )}

          {/* Time limit */}
          {wrStatus.months_used_in_window !== null && (
            <p className="text-[13px] text-graphite">
              Time limit: <span className="font-medium text-ink tabular-nums">{wrStatus.months_used_in_window}/3 months used</span>
            </p>
          )}
        </div>
      ) : (
        <div>
          {wrStatus.exemption_type ? (
            <p className="text-[13px] text-graphite">
              Exempt — <span className="font-medium text-ink">{wrStatus.exemption_type}</span>
            </p>
          ) : (
            <p className="text-[13px] text-muted italic">Not subject — no exemption required</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="pt-2 border-t border-hairline text-[11px] text-muted space-y-0.5">
        <p>
          Evaluated {formatDate(wrStatus.determined_at)} · via {determinationLabel}
        </p>
        {wrStatus.next_review_due && (
          <p>Next review: {formatDate(wrStatus.next_review_due)}</p>
        )}
      </div>
    </section>
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
