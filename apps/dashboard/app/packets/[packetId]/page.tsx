import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClientFromCookies } from "../../../lib/supabase";
import StatusTransition, { type Blocker } from "../../../components/StatusTransition";
import ConsentCapture from "../../../components/ConsentCapture";
import ExtractionFieldList from "../../../components/ExtractionFieldList";
import DocumentChecklist from "../../../components/DocumentChecklist";
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
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);

  const [packetResult, answersResult, docsResult, notesResult, historyResult, fieldsResult, docItemsResult, wrStatusResult, recertResult] = await Promise.all([
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

  // Pre-flight blockers for "Ready for Handoff"
  const [unresolvedDocsResult, unreviewedFieldsResult, consentResult] = await Promise.all([
    supabase.schema("snap_enrollment").from("required_document_items")
      .select("item_id").eq("packet_id", packetId).eq("is_required", true)
      .is("resolved_at", null).is("waived_at", null),
    supabase.schema("snap_enrollment").from("extraction_fields")
      .select("field_id").eq("packet_id", packetId).eq("needs_review", true).is("reviewed_at", null),
    supabase.schema("snap_enrollment").from("user_consents")
      .select("consent_id, consented_at").eq("applicant_id", packet.applicant_id)
      .eq("consent_kind", "privacy_notice").is("revoked_at", null).limit(1),
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

        {/* Documents */}
        <Section title="Uploaded Documents" count={docs.length} subtitle="Files submitted by the applicant.">
          {docs.length === 0 ? (
            <EmptyState
              title="No documents uploaded"
              description="move packet to 'Needs Documents' to request files"
            />
          ) : (
            <div>
              {docs.map((doc, i) => (
                <div key={doc.document_id} className={`flex items-center justify-between py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
                  <div>
                    <p className="text-[15px] font-medium text-ink">{doc.document_kind}</p>
                    <p className="text-[12px] text-muted mt-0.5">{doc.original_filename ?? shortId(doc.document_id)}</p>
                  </div>
                  <span className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    doc.processing_status === "complete"
                      ? "bg-teal/10 text-teal"
                      : "bg-amber/15 text-amber"
                  }`}>
                    {doc.processing_status}
                  </span>
                </div>
              ))}
            </div>
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
