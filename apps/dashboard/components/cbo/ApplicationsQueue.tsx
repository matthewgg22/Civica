"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PIPELINE_STEPS,
  PHASES,
  formatUsd,
  type PhaseGroup,
  type QueueApplication,
  type SurveyAnswer,
  type Risk,
  type Phase,
} from "../../lib/cbo/demo-pipeline";
import TableExport from "./TableExport";
import { EVALUATION_GATES, deductionRows, deductionOneLine } from "../../lib/cbo/engine-view";

// Lifecycle pipeline for /cbo-preview: a funnel (Requesting → Live → Enrolled →
// Recertification) over a searchable, expandable case list grouped by phase.
// Answers are synthetic; the benefit estimate + verification needs are REAL
// engine output. Inline edits are an ephemeral demo (not persisted).

const TOTAL_STEPS = PIPELINE_STEPS.length;

function completionPct(completed: number): number {
  return Math.round((completed / TOTAL_STEPS) * 100);
}
function riskLabel(risk: Risk): string {
  return risk === "High risk" ? "HIGH" : risk === "Medium risk" ? "MED" : "LOW";
}
function riskClass(risk: Risk): string {
  return risk === "High risk" ? "text-brick font-semibold" : risk === "Medium risk" ? "text-warning" : "text-graphite";
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Lifecycle funnel — the four phases left→right with live counts.
function Funnel({ phases }: { phases: PhaseGroup[] }) {
  const countOf = (k: string) => phases.find((p) => p.key === k)?.cases.length ?? 0;
  return (
    <div className="flex items-stretch border border-hairline rounded-[2px] bg-surface overflow-x-auto">
      {PHASES.map((p, i) => (
        <div key={p.key} className="flex items-stretch flex-1 min-w-[150px]">
          <div className="flex-1 px-4 py-2.5">
            <div className="flex items-baseline gap-2">
              <span className={`w-2 h-2 rounded-sm ${p.accent}`} aria-hidden="true" />
              <span className="text-[16px] font-semibold tabular-nums text-ink leading-none">{countOf(p.key)}</span>
            </div>
            <div className="text-[11px] font-semibold text-ink mt-1">{p.label}</div>
            <div className="text-[10px] text-graphite leading-tight">{p.blurb}</div>
          </div>
          {i < PHASES.length - 1 && (
            <div className="flex items-center text-graphite px-1 shrink-0" aria-hidden="true">→</div>
          )}
        </div>
      ))}
    </div>
  );
}

function StepList({ completedSteps }: { completedSteps: number }) {
  return (
    <ol className="space-y-1.5">
      {PIPELINE_STEPS.map((step, i) => {
        const state = i < completedSteps ? "done" : i === completedSteps ? "current" : "pending";
        return (
          <li key={step} className="flex items-center gap-2.5 text-[12px]">
            <span
              className={`shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                state === "done" ? "bg-pine text-white" : state === "current" ? "bg-warning text-white" : "border border-hairline text-muted"
              }`}
              aria-hidden="true"
            >
              {state === "done" ? "✓" : state === "current" ? "●" : i + 1}
            </span>
            <span className={state === "done" ? "text-graphite" : state === "current" ? "text-ink font-semibold" : "text-muted"}>
              {step}
            </span>
            {state === "current" && (
              <span className="text-[11px] uppercase tracking-wider text-warning font-semibold">in progress</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Edit-mode option sets: fields with a fixed answer space render as a <select>
// instead of free text. Money / number / name / date fields are omitted and fall
// through to a text input. The current value is always included in the list so an
// off-list value (e.g. a flagged "Provided — does not match SSA records") renders.
const FIELD_OPTIONS: Record<string, string[]> = {
  State: ["California"],
  "Preferred language": ["English", "Spanish", "Chinese", "Vietnamese", "Tagalog", "Korean", "Other"],
  "Contact phone on file": ["Yes", "No"],
  "Children under 14?": ["Yes", "No"],
  "Anyone 60+ or disabled?": ["Yes", "No"],
  "Everyone applying is a citizen or eligible noncitizen?": ["Yes", "No"],
  "Employment status": ["Employed", "Self-employed", "Not employed"],
  "Income type": ["Wages / salary", "Self-employment", "Fixed income", "No income"],
  "Pay frequency": ["Weekly", "Every two weeks", "Twice monthly", "Monthly"],
  "Out-of-pocket medical (60+/disabled)": ["Not applicable", "$0.00"],
  "Countable assets (cash + bank)": ["Under $2,750.00", "$2,750.00 or more"],
  "Photo ID": ["On hand", "Provided", "Requested", "Not yet uploaded"],
  "Proof of income": ["On hand", "Provided", "Requested", "Not provided"],
  "Proof of residence": ["On hand", "Provided", "Requested", "Not provided"],
  "Social Security Number": ["Provided", "Not provided"],
  "Expedited-service screen": ["Completed", "Not started"],
  "Signed under penalty of perjury": ["Yes", "No"],
};

function optionsFor(question: string, current: string): string[] | null {
  const opts = FIELD_OPTIONS[question];
  if (!opts) return null;
  return opts.includes(current) ? opts : [current, ...opts];
}

// ── Case actions (ephemeral demo) ─────────────────────────────────────────────
// Comments, transfer, and manual advance are client-only state — they reset on
// reload and never hit a backend (the caseload is synthetic). Mirrors the
// existing "inline edits are an ephemeral demo" honesty.
type CaseComment = { author: string; text: string; when: string };
// Chain-of-custody entry: who did what, when. Seeded from history, appended on
// every demo action (advance, transfer, comment, response edit).
type ActivityEntry = { ts: string; actor: string; action: string };
type CaseRecord = QueueApplication & {
  assignedTo: string;
  comments: CaseComment[];
  activity: ActivityEntry[];
};

// Peer navigators a case can be transferred to (demo set, drawn from history).
const PEERS = ["J. Ruiz", "A. Cole", "M. Diaz", "R. Okafor", "L. Park"];

const PHASE_ORDER: Phase[] = ["requesting", "live", "enrolled", "recert"];
const nextPhase = (p: Phase): Phase | null => {
  const i = PHASE_ORDER.indexOf(p);
  return i >= 0 && i < PHASE_ORDER.length - 1 ? PHASE_ORDER[i + 1] : null;
};
const phaseLabel = (p: Phase) => PHASES.find((x) => x.key === p)?.label ?? p;

// Default stage copy when a case is manually advanced into a phase.
const ADVANCE_STAGE: Record<Phase, string> = {
  requesting: "Reached out",
  live: "Submitted for review",
  enrolled: "Approved",
  recert: "Recertification due",
};

// Seed the assignee from the most recent navigator in the case history.
function initialAssignee(c: QueueApplication): string {
  const nav = [...c.history].reverse().find((e) => e.by?.startsWith("Navigator "));
  return nav?.by ? nav.by.replace("Navigator ", "") : "Unassigned";
}

const nowLabel = () =>
  new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Timestamp for a live activity-log entry (date + time, like a real audit trail).
const nowStamp = () =>
  new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Seed the activity log from the case history (oldest→newest); the log renders
// newest-first, so reverse it here.
function seedActivity(c: QueueApplication): ActivityEntry[] {
  return [...c.history].reverse().map((e) => ({ ts: e.when, actor: e.by ?? "System", action: e.label }));
}

// Automated cross-check of the application response components — what the engine
// could confirm from the answers vs. what still needs a human check. Grounded in
// real signals (flagged answers, document status, engine assumptions); NOT an
// eligibility determination (the adapter never emits a verdict).
type VCheck = { label: string; ok: boolean; note: string };
function buildVerification(app: QueueApplication): VCheck[] {
  const ans = (q: string) => app.answers.find((a) => a.question === q)?.answer ?? "";
  const flaggedIn = (section: string) => app.answers.some((a) => a.section === section && a.flagged);
  const docsOut = app.answers
    .filter((a) => a.section === "Documents" && /not (yet uploaded|provided)/i.test(a.answer))
    .map((a) => a.question);
  const proofOk = !/^not /i.test(ans("Proof of income"));
  const ssn = ans("Social Security Number");
  const income = ans("Gross monthly income");
  return [
    { label: "Income & employment", ok: !!income && proofOk && !flaggedIn("Income & employment"),
      note: income ? `${income}${proofOk ? " · proof on hand" : " · awaiting pay stub"}` : "not captured" },
    { label: "Household composition", ok: !flaggedIn("Your household"), note: `${ans("Household size") || "?"} captured` },
    { label: "Shelter & expenses", ok: !flaggedIn("Expenses & deductions"),
      note: flaggedIn("Expenses & deductions") ? "shelter cost needs review" : `rent ${ans("Monthly rent") || "?"}` },
    { label: "Identity / SSN", ok: !/not|does not match/i.test(ssn),
      note: /does not match/i.test(ssn) ? "does not match SSA records" : "SSN provided" },
    { label: "Documents", ok: docsOut.length === 0, note: docsOut.length ? `${docsOut.join(", ")} outstanding` : "all on hand" },
    { label: "Eligibility factors", ok: false,
      note: app.assumptions.length ? `assumed, pending: ${app.assumptions.join("; ")}` : (app.verificationNeeds[0] ?? "pending human confirmation") },
  ];
}

// Full application responses for the expanded case. Renders the complete intake
// as a per-section ruled table (Field | Response). Editing is a single batch
// mode: "Edit responses" unlocks every field at once (fixed-option fields as a
// dropdown, others as text); "Save changes" commits the diff.
function AnswerList({
  answers, edited, onEdit, onSave,
}: {
  answers: SurveyAnswer[];
  edited: Record<string, string>;
  onEdit: (question: string, value: string) => void;
  onSave?: (changedQuestions: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [viewDoc, setViewDoc] = useState<string | null>(null);

  const current = (a: SurveyAnswer) => edited[a.question] ?? a.answer;

  const startEdit = () => {
    const seed: Record<string, string> = {};
    for (const a of answers) seed[a.question] = current(a);
    setDrafts(seed);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setDrafts({});
  };
  const save = () => {
    const changed: string[] = [];
    for (const a of answers) {
      const next = drafts[a.question];
      if (next !== undefined && next !== current(a)) {
        onEdit(a.question, next);
        changed.push(a.question);
      }
    }
    if (changed.length) onSave?.(changed);
    setEditing(false);
    setDrafts({});
  };

  const sections: { section: string; items: SurveyAnswer[] }[] = [];
  for (const a of answers) {
    const last = sections[sections.length - 1];
    if (last && last.section === a.section) last.items.push(a);
    else sections.push({ section: a.section, items: [a] });
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Application responses</p>
        {editing ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={cancel}
              className="rounded-[2px] border border-hairline px-2.5 py-1 text-[11px] font-medium text-graphite hover:bg-surface-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-[2px] bg-pine px-2.5 py-1 text-[11px] font-medium text-white hover:bg-pine-pressed"
            >
              Save changes
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] tabular-nums text-graphite">{answers.length} answers</span>
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 rounded-[2px] border border-hairline px-2.5 py-1 text-[11px] font-medium text-pine hover:bg-surface-secondary"
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M9.5 2.5l2 2L5 11l-2.5.5L3 9l6.5-6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
              Edit responses
            </button>
          </div>
        )}
      </div>

      {/* Each section is a ruled mini-table: a tinted label column + a value
          column, horizontal rule per row + vertical rule between columns — a
          spreadsheet grid so the eye tracks rows/columns without floating.
          Laid out two-up to keep label adjacent to its value. */}
      <div className="grid md:grid-cols-2 gap-3 items-start">
        {sections.map((group) => (
          <div key={group.section} className="border border-hairline rounded-[2px] overflow-hidden bg-surface">
            <div className="px-3 py-2 border-b border-hairline">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink">{group.section}</p>
            </div>
            <table className="w-full border-collapse text-[12px]">
              <tbody>
                {group.items.map((a) => {
                  const wasEdited = a.question in edited;
                  return (
                    <tr key={a.question} className="border-b border-hairline last:border-b-0">
                      <th
                        scope="row"
                        className="w-[42%] align-top text-left font-normal text-graphite leading-snug px-3 py-1.5 border-r border-hairline"
                      >
                        {a.question}
                      </th>
                      <td className="align-top px-3 py-1.5">
                        {editing ? (
                          (() => {
                            const opts = optionsFor(a.question, drafts[a.question] ?? "");
                            return opts ? (
                              <select
                                value={drafts[a.question] ?? ""}
                                onChange={(e) => setDrafts((p) => ({ ...p, [a.question]: e.target.value }))}
                                className="w-full px-1.5 py-1 text-[12px] bg-surface border border-hairline rounded-[2px] text-ink focus:border-pine focus:outline-none"
                                aria-label={a.question}
                              >
                                {opts.map((o) => (
                                  <option key={o} value={o}>{o}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                value={drafts[a.question] ?? ""}
                                onChange={(e) => setDrafts((p) => ({ ...p, [a.question]: e.target.value }))}
                                className="w-full px-1.5 py-0.5 text-[12px] bg-surface border border-hairline rounded-[2px] text-ink focus:border-pine focus:outline-none"
                                aria-label={a.question}
                              />
                            );
                          })()
                        ) : (
                          <span
                            className={`font-medium leading-snug break-words ${
                              a.flagged && !wasEdited ? "text-brick" : "text-ink"
                            }`}
                          >
                            {current(a)}
                            {a.flagged && !wasEdited && <span className="ml-1 text-[11px]" aria-label="flagged">⚑</span>}
                            {wasEdited && <span className="ml-1 text-[10px] uppercase tracking-wider text-graphite">· edited</span>}
                            {a.section === "Documents" && !/not (yet uploaded|provided)/i.test(current(a)) && (
                              <button
                                type="button"
                                onClick={() => setViewDoc(a.question)}
                                className="ml-2 text-[11px] font-medium text-pine hover:underline"
                              >
                                View
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {viewDoc && (
        <div
          role="dialog"
          aria-label={`Document — ${viewDoc}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setViewDoc(null)}
        >
          <div
            className="w-full max-w-md rounded-[3px] border border-hairline bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
              <p className="text-[12px] font-semibold text-ink">{viewDoc}</p>
              <button
                type="button"
                aria-label="Close document"
                onClick={() => setViewDoc(null)}
                className="px-1 text-muted hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[2px] border border-dashed border-hairline bg-surface-secondary px-4 text-center">
                <span className="text-[12px] leading-relaxed text-graphite">
                  Synthetic demo document
                  <br />
                  <span className="text-ink font-medium">{viewDoc}</span>
                  <br />
                  No real applicant file in the preview.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// One of the three engine panels in the expanded case view: a titled, tagged
// card with a consistent grammar (result → trace → provenance tag).
function EngineBlock({ title, tag, children }: { title: string; tag: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-hairline rounded-[2px] p-3">
      <div className="flex items-baseline justify-between gap-2 mb-2 pb-1.5 border-b border-hairline">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink">{title}</p>
        <span className="text-[11px] uppercase tracking-wider text-graphite shrink-0">{tag}</span>
      </div>
      {children}
    </div>
  );
}

function CaseRow({
  app, border, onAdvance, onTransfer, onComment, onEditLog,
}: {
  app: CaseRecord;
  border: boolean;
  onAdvance: () => void;
  onTransfer: (to: string) => void;
  onComment: (text: string) => void;
  onEditLog: (changedQuestions: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [showMath, setShowMath] = useState(false);
  const [comment, setComment] = useState("");
  const [confirmAdvance, setConfirmAdvance] = useState(false);
  const pct = completionPct(app.completedSteps);
  const next = nextPhase(app.phase);
  const checks = buildVerification(app);
  const checksClear = checks.filter((c) => c.ok).length;

  // Open Mae prefilled with the case context (no applicant PII — stage + the
  // engine's top suggested action). MaeChat listens for this event.
  const askMae = () => {
    const top = app.recommendations[0]?.action ?? app.verificationNeeds[0];
    const text = `I'm reviewing a CalFresh case at the "${app.stage}" stage.${top ? ` The engine's next step is: "${top}".` : ""} What does the governing rule require here?`;
    window.dispatchEvent(new CustomEvent("mae:prefill", { detail: { text } }));
  };
  const flagCount = app.docFlags.length;
  const enrolled = app.phase === "enrolled";

  return (
    <div className={border ? "border-t border-hairline" : ""}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className={`w-full flex items-center gap-4 px-4 py-1.5 text-left transition-colors ${
          open ? "bg-[var(--color-row-hover)]" : "hover:bg-[var(--color-row-hover)]"
        }`}>
        <span className="text-[11px] text-graphite font-mono tabular-nums tracking-tight shrink-0 w-[92px]">{app.caseId}</span>
        <span className="text-[13px] font-semibold text-ink shrink-0 w-[88px] truncate">{app.name}</span>
        <span className="text-[12px] text-graphite shrink-0 w-[110px] truncate hidden sm:block">{app.county} County</span>
        <span className="text-[12px] text-ink flex-1 min-w-0 flex items-center gap-2">
          <span className="truncate">{app.stage}</span>
          {app.expedited && (
            <span className="shrink-0 rounded-[2px] border border-warning px-1.5 text-[11px] font-semibold uppercase tracking-wider text-warning">
              Expedited
            </span>
          )}
        </span>
        {/* Enrolled shows benefit; others show pipeline completion */}
        <span className="hidden md:flex items-center justify-end shrink-0 w-[130px]">
          {enrolled && app.estimatedBenefitUsd !== null ? (
            <span className="text-[12px] tabular-nums text-ink font-medium">~{formatUsd(app.estimatedBenefitUsd)}/mo</span>
          ) : (
            <span className="flex items-center gap-2 w-full">
              <span className="h-1.5 flex-1 rounded-[1px] bg-surface-secondary overflow-hidden">
                <span className="block h-full rounded-[1px] bg-muted" style={{ width: `${pct}%` }} />
              </span>
              <span className="text-[11px] tabular-nums text-graphite w-[34px] text-right">{pct}%</span>
            </span>
          )}
        </span>
        <span className="shrink-0 w-[64px] text-right">
          {flagCount > 0 ? (
            <span className="text-[11px] font-semibold text-brick tabular-nums">{flagCount} flag{flagCount > 1 ? "s" : ""}</span>
          ) : (
            <span className="text-[11px] text-graphite">clean</span>
          )}
        </span>
        <span className={`text-[11px] uppercase tracking-wider tabular-nums shrink-0 w-[40px] text-right ${riskClass(app.risk)}`}>
          {riskLabel(app.risk)}
        </span>
        <span className="text-graphite shrink-0"><Chevron open={open} /></span>
      </button>

      {open && (
        <div className="bg-[var(--color-row-hover)] border-t border-hairline px-4 py-4 space-y-4">
          {/* Expedited-service screen (7 CFR 273.2(i)) — time-sensitive, surfaced first. */}
          {app.expedited && (
            <div className="flex items-start gap-2 rounded-[2px] border border-warning/40 bg-surface px-3 py-2">
              <span className="text-warning text-[13px] leading-none mt-[1px]" aria-hidden="true">⚡</span>
              <p className="text-[12px] text-ink leading-snug">
                <span className="font-semibold text-warning">Screen for expedited service</span> — 7 CFR 273.2(i):{" "}
                {app.expeditedReason.toLowerCase()}. Target 7-day processing.{" "}
                <span className="text-graphite">Provisional — confirm liquid resources.</span>
              </p>
            </div>
          )}

          <AnswerList
            answers={app.answers}
            edited={edited}
            onEdit={(q, v) => setEdited((p) => ({ ...p, [q]: v }))}
            onSave={onEditLog}
          />

          {/* Automated verification — cross-check of the response components. */}
          <div className="border-t border-hairline pt-3">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Automated verification</p>
              <span className="text-[11px] tabular-nums text-graphite">{checksClear}/{checks.length} components clear</span>
            </div>
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5">
              {checks.map((c) => (
                <li key={c.label} className="flex items-baseline gap-2 text-[12px]">
                  <span className={`shrink-0 ${c.ok ? "text-pine" : "text-warning"}`} aria-hidden="true">{c.ok ? "✓" : "⚠"}</span>
                  <span>
                    <span className="font-medium text-ink">{c.label}</span>
                    <span className="text-graphite"> — {c.note}{c.ok ? "" : " (needs check)"}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-graphite mt-2 leading-snug">
              Automated cross-check of the responses — what the engine could confirm vs. what needs a human check. Not an eligibility determination.
            </p>
          </div>

          {/* The three engines, made explicit */}
          <div className="border-t border-hairline pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite mb-2">Civica engine</p>
            <div className="grid gap-3 md:grid-cols-3">
              {/* 1 — Eligibility (provisional: the gates it evaluates, in order) */}
              <EngineBlock title="Eligibility" tag="provisional">
                <p className="text-[12px] text-ink">
                  Determination pending{" "}
                  <span className="font-semibold tabular-nums">{app.verificationNeeds.length}</span> item(s).
                </p>
                <ol className="mt-1.5 space-y-1">
                  {EVALUATION_GATES.map((g, i) => (
                    <li key={g.citation} className="flex items-baseline gap-1.5 text-[12px] leading-snug">
                      <span className="tabular-nums text-graphite w-3 shrink-0">{i + 1}</span>
                      <span className="text-ink">{g.label}</span>
                      <span className="text-[11px] text-graphite">{g.citation}</span>
                    </li>
                  ))}
                </ol>
                {app.assumptions.length > 0 && (
                  <p className="text-[11px] text-graphite mt-2 leading-snug">Assumed: {app.assumptions.join("; ")}.</p>
                )}
              </EngineBlock>

              {/* 2 — Benefit amount (the number + the math). Always the engine
                  estimate — never the county's actual award, even when enrolled. */}
              <EngineBlock title="Benefit amount" tag="estimate">
                {app.estimatedBenefitUsd !== null ? (
                  <>
                    <p className="text-[16px] font-semibold tabular-nums text-ink leading-none">
                      <span className="text-[11px] font-normal text-graphite">approx.</span> ~{formatUsd(app.estimatedBenefitUsd)}
                      <span className="text-[11px] font-normal text-graphite">/mo</span>
                    </p>
                    {app.deduction && (
                      <>
                        <p className="text-[11px] text-graphite mt-1.5 leading-snug">{deductionOneLine(app.deduction)}</p>
                        <button
                          type="button"
                          onClick={() => setShowMath((v) => !v)}
                          className="text-[11px] text-pine hover:underline mt-1"
                        >
                          {showMath ? "Hide the math" : "Show the math"}
                        </button>
                        {showMath && (
                          <table className="mt-1.5 w-full text-[11px]">
                            <tbody>
                              {deductionRows(app.deduction).map((r) => (
                                <tr key={r.label} className={r.total ? "border-t border-hairline font-semibold text-ink" : "text-graphite"}>
                                  <td className="py-0.5 pr-2 align-top">
                                    {r.label}
                                    {r.citation && <span className="block text-[11px] text-graphite">{r.citation}</span>}
                                  </td>
                                  <td className="py-0.5 text-right tabular-nums align-top">
                                    {r.amount < 0 ? `−${formatUsd(-r.amount)}` : formatUsd(r.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-[12px] text-muted">No estimate for this household.</p>
                )}
              </EngineBlock>

              {/* 3 — Recommendations: Component R benefit-raising actions when it
                  finds any; otherwise the verification steps that move the case
                  to a determination (the genuine "good next" for a provisional
                  case, per the 273.2(f) hierarchy). */}
              <EngineBlock
                title="Recommended next steps"
                tag={app.recommendations.length > 0 ? "Component R" : "verification · 273.2(f)"}
              >
                {app.recommendations.length > 0 ? (
                  <ol className="space-y-1.5">
                    {app.recommendations.slice(0, 4).map((r) => (
                      <li key={r.rank} className="text-[12px] text-ink leading-snug">
                        <span className="font-semibold text-ink">Good next:</span> {r.action}
                        {r.deltaUsd > 0 && (
                          <span className="text-ink font-semibold tabular-nums"> (+{formatUsd(r.deltaUsd)}/mo)</span>
                        )}
                        {r.citation && <span className="block text-[11px] text-graphite">{r.citation}</span>}
                      </li>
                    ))}
                  </ol>
                ) : app.verificationNeeds.length > 0 ? (
                  <ol className="space-y-1.5">
                    {app.verificationNeeds.slice(0, 5).map((v) => (
                      <li key={v} className="text-[12px] text-ink leading-snug">
                        <span className="font-semibold text-ink">Good next:</span> confirm{" "}
                        {v.charAt(0).toLowerCase() + v.slice(1)}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[12px] text-muted">No actions outstanding.</p>
                )}
                <button
                  type="button"
                  onClick={askMae}
                  className="mt-2 text-[11px] font-medium text-pine hover:underline"
                >
                  Ask Mae about this case →
                </button>
              </EngineBlock>
            </div>
            <p className="text-[12px] text-graphite mt-3 leading-snug">
              Estimate + recommendations are live engine output on these answers; eligibility is provisional until the
              verification items are confirmed — an estimate, not a determination.
            </p>
          </div>

          {/* Navigator flags (the still-needed items now live in the
              Recommended-next-steps engine block above). */}
          <div className="border-t border-hairline pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite mb-2">Navigator flags</p>
            {app.docFlags.length > 0 ? (
              <ul className="space-y-1.5">
                {app.docFlags.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12px] text-ink">
                    <span className="shrink-0 mt-[5px] w-1.5 h-1.5 rounded-full bg-brick" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-muted">No flags.</p>
            )}
          </div>

          {/* Comments (demo) — caseworker notes, newest first. */}
          <div className="border-t border-hairline pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite mb-2">Comments</p>
            {app.comments.length > 0 ? (
              <ul className="space-y-2 mb-2">
                {app.comments.map((c, i) => (
                  <li key={i} className="text-[12px]">
                    <span className="text-graphite">{c.author} · {c.when}</span>
                    <p className="text-ink leading-snug">{c.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-muted mb-2">No comments yet.</p>
            )}
            <div className="flex items-start gap-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Add a comment…"
                aria-label="Add a comment"
                className="flex-1 resize-none rounded-[2px] border border-hairline bg-surface px-2 py-1 text-[12px] text-ink placeholder:text-muted focus:border-pine focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const t = comment.trim();
                  if (t) { onComment(t); setComment(""); }
                }}
                disabled={comment.trim().length === 0}
                className="rounded-[2px] bg-pine px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-pine-pressed disabled:bg-pine-disabled"
              >
                Add
              </button>
            </div>
            <p className="text-[11px] text-graphite mt-1.5">Transfer, advance, and comments are a local demo — not saved.</p>
          </div>

          <div className="border-t border-hairline pt-3">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Processing steps</p>
              <p className="text-[11px] tabular-nums text-graphite">{app.completedSteps}/{TOTAL_STEPS} · {pct}%</p>
            </div>
            <StepList completedSteps={app.completedSteps} />
          </div>

          {/* Activity log — chain of custody: # · when · who · action. Seeded from
              history; every demo action (advance, transfer, comment, edit) appends. */}
          <div className="border-t border-hairline pt-3">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Activity log</p>
              <span className="text-[11px] tabular-nums text-graphite">{app.activity.length} entries</span>
            </div>
            <div className="border border-hairline rounded-[2px] overflow-hidden bg-surface">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-hairline text-[11px] uppercase tracking-wider text-graphite">
                    <th className="w-8 px-2 py-1 text-left font-semibold">#</th>
                    <th className="w-[150px] px-2 py-1 text-left font-semibold">When</th>
                    <th className="w-[130px] px-2 py-1 text-left font-semibold">Who</th>
                    <th className="px-2 py-1 text-left font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {app.activity.map((e, i) => (
                    <tr key={`${e.ts}-${i}`} className="border-b border-hairline last:border-b-0 align-top">
                      <td className="px-2 py-1 tabular-nums text-graphite">{i + 1}</td>
                      <td className="px-2 py-1 tabular-nums text-graphite whitespace-nowrap">{e.ts}</td>
                      <td className="px-2 py-1 text-ink">{e.actor}</td>
                      <td className="px-2 py-1 text-ink leading-snug">{e.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Case actions footer (demo): transfer, manual advance (confirm), full case. */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
            <label className="flex items-center gap-1.5 text-[11px] text-graphite">
              <span className="font-semibold uppercase tracking-wider">Assigned to</span>
              <select
                value={app.assignedTo}
                onChange={(e) => onTransfer(e.target.value)}
                className="px-1.5 py-0.5 text-[12px] bg-surface border border-hairline rounded-[2px] text-ink focus:border-pine focus:outline-none"
                aria-label="Transfer case to caseworker"
              >
                {!PEERS.includes(app.assignedTo) && <option value={app.assignedTo}>{app.assignedTo}</option>}
                {PEERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-3">
              {next && (confirmAdvance ? (
                <span className="flex items-center gap-2 text-[11px]">
                  <span className="text-graphite">Advance to {phaseLabel(next)}?</span>
                  <button
                    type="button"
                    onClick={() => { onAdvance(); setConfirmAdvance(false); }}
                    className="rounded-[2px] bg-pine px-2.5 py-1 font-medium text-white hover:bg-pine-pressed"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAdvance(false)}
                    className="rounded-[2px] border border-hairline px-2.5 py-1 font-medium text-graphite hover:bg-surface"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmAdvance(true)}
                  className="rounded-[2px] border border-hairline px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-surface"
                >
                  Advance to {phaseLabel(next)} →
                </button>
              ))}
              <Link href={`/packets/${app.id}`} className="text-[12px] font-semibold text-pine hover:underline">
                Open full case →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApplicationsQueue({ phases }: { phases: PhaseGroup[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // Flat client-side caseload (seeded from the server-built groups) so manual
  // advance / transfer / comment actions can mutate it. Ephemeral demo state.
  const [cases, setCases] = useState<CaseRecord[]>(() =>
    phases.flatMap((p) => p.cases).map((c) => ({ ...c, assignedTo: initialAssignee(c), comments: [], activity: seedActivity(c) })),
  );

  // Prepend a chain-of-custody entry (newest-first), attributed to "You".
  const log = (c: CaseRecord, action: string): ActivityEntry[] => [{ ts: nowStamp(), actor: "You", action }, ...c.activity];

  const advance = (id: string) =>
    setCases((cs) =>
      cs.map((c) => {
        if (c.id !== id) return c;
        const np = nextPhase(c.phase);
        if (!np) return c;
        return {
          ...c,
          phase: np,
          stage: ADVANCE_STAGE[np],
          completedSteps: np === "live" ? Math.max(c.completedSteps, 4) : TOTAL_STEPS,
          activity: log(c, `Advanced to ${phaseLabel(np)}`),
        };
      }),
    );
  const transfer = (id: string, to: string) =>
    setCases((cs) =>
      cs.map((c) => (c.id === id && to !== c.assignedTo ? { ...c, assignedTo: to, activity: log(c, `Reassigned from ${c.assignedTo} to ${to}`) } : c)),
    );
  const addComment = (id: string, text: string) =>
    setCases((cs) =>
      cs.map((c) =>
        c.id === id
          ? { ...c, comments: [{ author: "You", text, when: nowLabel() }, ...c.comments], activity: log(c, "Added a comment") }
          : c,
      ),
    );
  const logEdit = (id: string, questions: string[]) =>
    setCases((cs) =>
      cs.map((c) => (c.id === id ? { ...c, activity: log(c, `Edited responses: ${questions.join(", ")}`) } : c)),
    );

  // Regroup the live caseload by phase for rendering + funnel counts.
  const grouped = useMemo<PhaseGroup[]>(
    () => PHASES.map((p) => ({ ...p, cases: cases.filter((c) => c.phase === p.key) })),
    [cases],
  );

  const filtered = useMemo(() => {
    if (!q) return grouped;
    return grouped.map((p) => ({
      ...p,
      cases: p.cases.filter((a) =>
        [a.caseId, a.name, a.county, a.stage, (a as CaseRecord).assignedTo, ...a.docFlags, ...(a as CaseRecord).comments.map((c) => c.text), ...a.verificationNeeds, ...a.answers.flatMap((x) => [x.question, x.answer])]
          .join(" ").toLowerCase().includes(q),
      ),
    }));
  }, [grouped, q]);

  const matchCount = filtered.reduce((s, p) => s + p.cases.length, 0);
  const totalCases = cases.length;

  // Export the FULL caseload (not the search-filtered view), flattened across
  // phases. Engine-computed benefit + verification-need counts travel with it.
  const exportRows = grouped.flatMap((p) =>
    p.cases.map((a) => [
      p.label,
      a.caseId,
      a.name,
      `${a.county} County, CA`,
      a.stage,
      (a as CaseRecord).assignedTo,
      `${completionPct(a.completedSteps)}%`,
      a.estimatedBenefitUsd != null ? formatUsd(a.estimatedBenefitUsd) : "—",
      String(a.docFlags.length),
      riskLabel(a.risk),
    ]),
  );

  return (
    <div className="space-y-4">
      {/* Lifecycle funnel */}
      <Funnel phases={grouped} />

      {/* Search + export */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search case ID, name, county, stage, answer, or flag…"
            aria-label="Search cases"
            className="w-full pl-9 pr-3 py-1.5 text-[13px] bg-surface border border-hairline rounded-[2px] text-ink placeholder:text-muted focus:outline-none focus:border-pine"
          />
        </div>
        <TableExport
          filename="cbo-caseload"
          title="Navigator caseload — cases"
          columns={["Phase", "Case ID", "Applicant", "County", "Stage", "Assigned", "Completion", "Est. benefit", "Flags", "Risk"]}
          rows={exportRows}
          note="Illustrative caseload. Benefit estimate + verification needs are computed by Civica's rules engine; applicant records are synthetic."
        />
      </div>
      {q && (
        <p className="text-[12px] text-graphite">
          {matchCount} match{matchCount === 1 ? "" : "es"} for “{query.trim()}”
        </p>
      )}

      {/* Case list grouped by lifecycle phase */}
      <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-1.5 bg-surface-secondary border-b border-hairline text-[11px] font-semibold uppercase tracking-wider text-graphite">
          <span className="shrink-0 w-[92px]">Case ID</span>
          <span className="shrink-0 w-[88px]">Applicant</span>
          <span className="shrink-0 w-[110px] hidden sm:block">County</span>
          <span className="flex-1 min-w-0">Stage</span>
          <span className="shrink-0 w-[130px] hidden md:block text-right">Progress / benefit</span>
          <span className="shrink-0 w-[64px] text-right">Flags</span>
          <span className="shrink-0 w-[40px] text-right">Risk</span>
          <span className="w-[12px]" />
        </div>

        {filtered.map((phase) => {
          if (phase.cases.length === 0) return null;
          return (
            <div key={phase.key}>
              <div className="flex items-center gap-2 px-4 py-1 bg-surface-secondary border-b border-hairline">
                <span className={`w-2 h-2 rounded-sm ${phase.accent}`} aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-graphite">{phase.label}</span>
                <span className="text-[11px] text-graphite tabular-nums">{phase.cases.length}</span>
              </div>
              {phase.cases.map((a, i) => (
                <CaseRow
                  key={a.id}
                  app={a as CaseRecord}
                  border={i > 0}
                  onAdvance={() => advance(a.id)}
                  onTransfer={(to) => transfer(a.id, to)}
                  onComment={(text) => addComment(a.id, text)}
                  onEditLog={(questions) => logEdit(a.id, questions)}
                />
              ))}
            </div>
          );
        })}

        {q && matchCount === 0 && (
          <p className="px-4 py-6 text-[13px] text-muted text-center">No cases match your search.</p>
        )}
        {!q && totalCases === 0 && (
          <p className="px-4 py-8 text-[13px] text-muted text-center">No active cases in the caseload yet.</p>
        )}
      </div>
    </div>
  );
}
