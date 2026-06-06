"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

// Searchable, expandable navigator pipeline for /cbo-preview Applications.
// Each application can expand to show the engine pipeline steps (with per-step
// completion), a perceived completion rate, and the flags the engine raised.
// Synthetic demo data — no real applicant information.

// The end-to-end application + engine journey a navigator tracks. Order matters:
// completion rate is derived from how far down this list a case has progressed.
export const PIPELINE_STEPS = [
  "Eligibility screener",
  "Household & identity",
  "Income & employment",
  "Expenses & deductions",
  "Document verification",
  "Engine determination",
  "Navigator review",
  "Submitted to county",
] as const;

const TOTAL_STEPS = PIPELINE_STEPS.length;

type Risk = "Low risk" | "Medium risk" | "High risk";

// One applicant response, mirroring snap_enrollment.packet_answers
// (question_label + applicant_answer), grouped by the iOS survey section it
// came from. `flagged` marks an answer the engine raised a concern on.
export interface SurveyAnswer {
  section: string;
  question: string;
  answer: string;
  flagged?: boolean;
}

export interface QueueApplication {
  id: string;
  caseId: string;
  name: string;
  county: string;
  status: string;
  risk: Risk;
  updated: string;
  /** Count of completed pipeline steps (0..TOTAL_STEPS). The next step is "current". */
  completedSteps: number;
  /** Engine / navigator flags raised on this case. Empty = clean. */
  flags: string[];
  /** Application responses (questions + answers), grouped by survey section. */
  answers: SurveyAnswer[];
}

export interface QueueBucket {
  key: string;
  label: string;
  accent: string; // tailwind bg-* token for the bucket marker
  applications: QueueApplication[];
  /** For the completed bucket: a count with no live rows. */
  completedCount?: number;
}

function completionPct(completed: number): number {
  return Math.round((completed / TOTAL_STEPS) * 100);
}

function riskLabel(risk: Risk): string {
  return risk === "High risk" ? "HIGH" : risk === "Medium risk" ? "MED" : "LOW";
}
function riskClass(risk: Risk): string {
  return risk === "High risk"
    ? "text-brick font-semibold"
    : risk === "Medium risk"
      ? "text-warning"
      : "text-muted";
}
function barClass(risk: Risk): string {
  return risk === "High risk" ? "bg-brick" : risk === "Medium risk" ? "bg-warning" : "bg-pine";
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
                state === "done"
                  ? "bg-pine text-white"
                  : state === "current"
                    ? "bg-warning text-white"
                    : "border border-hairline text-muted"
              }`}
              aria-hidden="true"
            >
              {state === "done" ? "✓" : state === "current" ? "●" : i + 1}
            </span>
            <span
              className={
                state === "done"
                  ? "text-graphite"
                  : state === "current"
                    ? "text-ink font-semibold"
                    : "text-muted"
              }
            >
              {step}
            </span>
            {state === "current" && (
              <span className="text-[10px] uppercase tracking-wider text-warning font-semibold">in progress</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Application responses, grouped by the survey section they came from —
// mirrors snap_enrollment.packet_answers (question_label → applicant_answer).
function AnswerList({ answers }: { answers: SurveyAnswer[] }) {
  const sections: { section: string; items: SurveyAnswer[] }[] = [];
  for (const a of answers) {
    const last = sections[sections.length - 1];
    if (last && last.section === a.section) last.items.push(a);
    else sections.push({ section: a.section, items: [a] });
  }
  return (
    <div className="space-y-3">
      {sections.map((group) => (
        <div key={group.section}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1.5">{group.section}</p>
          <dl className="space-y-1">
            {group.items.map((a) => (
              <div key={a.question} className="flex items-baseline justify-between gap-4 text-[12px]">
                <dt className="text-graphite shrink-0 max-w-[60%]">{a.question}</dt>
                <dd
                  className={`text-right tabular-nums ${a.flagged ? "text-brick font-semibold" : "text-ink font-medium"}`}
                >
                  {a.answer}
                  {a.flagged && <span className="ml-1 text-[10px] uppercase tracking-wider">⚑</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

function ApplicationRow({ app, border }: { app: QueueApplication; border: boolean }) {
  const [open, setOpen] = useState(false);
  const pct = completionPct(app.completedSteps);

  return (
    <div className={border ? "border-t border-hairline" : ""}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-4 px-4 py-2.5 text-left hover:bg-paper transition-colors"
      >
        <span className="text-[11px] text-graphite font-mono tabular-nums tracking-tight shrink-0 w-[92px]">
          {app.caseId}
        </span>
        <span className="text-[13px] font-semibold text-ink shrink-0 w-[88px] truncate">{app.name}</span>
        <span className="text-[12px] text-graphite shrink-0 w-[120px] truncate hidden sm:block">
          {app.county} County
        </span>
        <span className="text-[12px] text-ink flex-1 min-w-0 truncate">{app.status}</span>
        {/* Completion */}
        <span className="hidden md:flex items-center gap-2 shrink-0 w-[120px]">
          <span className="h-1.5 flex-1 rounded-full bg-paper overflow-hidden">
            <span className={`block h-full rounded-full ${barClass(app.risk)}`} style={{ width: `${pct}%` }} />
          </span>
          <span className="text-[11px] tabular-nums text-graphite w-[30px] text-right">{pct}%</span>
        </span>
        {/* Flags count */}
        <span className="shrink-0 w-[64px] text-right">
          {app.flags.length > 0 ? (
            <span className="text-[11px] font-semibold text-brick tabular-nums">
              {app.flags.length} flag{app.flags.length > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-[11px] text-muted">clean</span>
          )}
        </span>
        <span className={`text-[11px] uppercase tracking-wider tabular-nums shrink-0 w-[40px] text-right ${riskClass(app.risk)}`}>
          {riskLabel(app.risk)}
        </span>
        <span className="text-graphite shrink-0">
          <Chevron open={open} />
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 bg-paper/60 space-y-5">
          {/* Application responses — questions + answers from the survey */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite">
                Application responses
              </p>
              <p className="text-[11px] tabular-nums text-graphite">{app.answers.length} answers</p>
            </div>
            <AnswerList answers={app.answers} />
          </div>

          {/* Engine pipeline + flags */}
          <div className="grid gap-5 md:grid-cols-2 border-t border-hairline pt-4">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite">Engine pipeline</p>
                <p className="text-[11px] tabular-nums text-graphite">
                  {app.completedSteps}/{TOTAL_STEPS} steps · {pct}%
                </p>
              </div>
              <StepList completedSteps={app.completedSteps} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-2">Flags raised</p>
              {app.flags.length > 0 ? (
                <ul className="space-y-1.5">
                  {app.flags.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12px] text-ink">
                      <span className="shrink-0 mt-[5px] w-1.5 h-1.5 rounded-full bg-brick" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-muted">No flags — clear to advance.</p>
              )}
              <Link
                href={`/packets/${app.id}`}
                className="inline-block mt-3 text-[12px] font-semibold text-pine hover:underline"
              >
                Open full case →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApplicationsQueue({ buckets }: { buckets: QueueBucket[] }) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return buckets;
    return buckets
      .map((b) => ({
        ...b,
        applications: b.applications.filter((a) =>
          [a.caseId, a.name, a.county, a.status, ...a.flags, ...a.answers.flatMap((x) => [x.question, x.answer])]
            .join(" ")
            .toLowerCase()
            .includes(q),
        ),
      }))
      .filter((b) => b.applications.length > 0 || (!q && b.completedCount));
  }, [buckets, q]);

  const matchCount = filtered.reduce((s, b) => s + b.applications.length, 0);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative max-w-sm">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search case ID, name, county, status, or flag…"
          aria-label="Search applications"
          className="w-full pl-9 pr-3 py-2 text-[13px] bg-surface border border-hairline rounded-[3px] text-ink placeholder:text-muted focus:outline-none focus:border-pine"
        />
      </div>
      {q && (
        <p className="text-[12px] text-graphite">
          {matchCount} match{matchCount === 1 ? "" : "es"} for “{query.trim()}”
        </p>
      )}

      {/* Column header */}
      <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-2 bg-surface-secondary border-b border-hairline text-[10px] font-semibold uppercase tracking-wider text-graphite">
          <span className="shrink-0 w-[92px]">Case ID</span>
          <span className="shrink-0 w-[88px]">Applicant</span>
          <span className="shrink-0 w-[120px] hidden sm:block">County</span>
          <span className="flex-1 min-w-0">Status</span>
          <span className="shrink-0 w-[120px] hidden md:block">Completion</span>
          <span className="shrink-0 w-[64px] text-right">Flags</span>
          <span className="shrink-0 w-[40px] text-right">Risk</span>
          <span className="w-[12px]" />
        </div>

        {filtered.map((bucket) => {
          const hasRows = bucket.applications.length > 0;
          if (!hasRows && !bucket.completedCount) return null;
          return (
            <div key={bucket.key}>
              <div className="flex items-center gap-2 px-4 py-1.5 bg-paper border-b border-hairline">
                <span className={`w-2 h-2 rounded-sm ${bucket.accent}`} aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-graphite">{bucket.label}</span>
                <span className="text-[11px] text-graphite tabular-nums">
                  {hasRows ? bucket.applications.length : bucket.completedCount}
                </span>
              </div>
              {hasRows ? (
                bucket.applications.map((a, i) => <ApplicationRow key={a.id} app={a} border={i > 0} />)
              ) : (
                <p className="px-4 py-2.5 text-[12px] text-muted italic">
                  {bucket.completedCount} completed applications in the last 90 days.
                </p>
              )}
            </div>
          );
        })}

        {q && matchCount === 0 && (
          <p className="px-4 py-6 text-[13px] text-muted text-center">No applications match your search.</p>
        )}
      </div>
      <p className="text-[11px] text-graphite">
        Sample pipeline — synthetic packets illustrating the navigator workflow. No real applicant information is shown.
      </p>
    </div>
  );
}
