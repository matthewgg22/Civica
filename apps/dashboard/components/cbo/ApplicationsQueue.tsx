"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PIPELINE_STEPS,
  formatUsd,
  type QueueBucket,
  type QueueApplication,
  type SurveyAnswer,
  type TimelineEvent,
  type Risk,
} from "../../lib/cbo/demo-pipeline";

// Searchable, expandable navigator pipeline for /cbo-preview Applications.
// The applicant answers are synthetic; the determination + verification needs
// are REAL engine output (see lib/cbo/demo-pipeline). Editing here is an
// ephemeral demo (local-only, resets on reload) — real persisted edits live on
// the authenticated /packets/[id] dashboard.

const TOTAL_STEPS = PIPELINE_STEPS.length;

function completionPct(completed: number): number {
  return Math.round((completed / TOTAL_STEPS) * 100);
}
function riskLabel(risk: Risk): string {
  return risk === "High risk" ? "HIGH" : risk === "Medium risk" ? "MED" : "LOW";
}
function riskClass(risk: Risk): string {
  return risk === "High risk" ? "text-brick font-semibold" : risk === "Medium risk" ? "text-warning" : "text-muted";
}
function barClass(risk: Risk): string {
  return risk === "High risk" ? "bg-brick" : risk === "Medium risk" ? "bg-warning" : "bg-pine";
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
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
              <span className="text-[10px] uppercase tracking-wider text-warning font-semibold">in progress</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Editable answer list, grouped by survey section. `onEdit` mutates local
// (ephemeral) state in the parent — no persistence on this public preview.
function AnswerList({
  answers,
  edited,
  onEdit,
}: {
  answers: SurveyAnswer[];
  edited: Record<string, string>;
  onEdit: (question: string, value: string) => void;
}) {
  const [editingQ, setEditingQ] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const sections: { section: string; items: SurveyAnswer[] }[] = [];
  for (const a of answers) {
    const last = sections[sections.length - 1];
    if (last && last.section === a.section) last.items.push(a);
    else sections.push({ section: a.section, items: [a] });
  }

  function commit(q: string) {
    onEdit(q, draft);
    setEditingQ(null);
  }

  return (
    <div className="space-y-3">
      {sections.map((group) => (
        <div key={group.section}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1.5">{group.section}</p>
          <dl className="space-y-1">
            {group.items.map((a) => {
              const value = edited[a.question] ?? a.answer;
              const wasEdited = a.question in edited;
              const isEditing = editingQ === a.question;
              return (
                <div key={a.question} className="flex items-baseline justify-between gap-3 text-[12px] group">
                  <dt className="text-graphite shrink-0 max-w-[50%]">{a.question}</dt>
                  <dd className="flex items-baseline gap-2 text-right min-w-0">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commit(a.question)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commit(a.question);
                          if (e.key === "Escape") setEditingQ(null);
                        }}
                        className="w-40 px-1.5 py-0.5 text-[12px] text-right bg-surface border border-pine rounded-[2px] focus:outline-none"
                        aria-label={`Edit ${a.question}`}
                      />
                    ) : (
                      <>
                        <span className={`tabular-nums ${a.flagged && !wasEdited ? "text-brick font-semibold" : "text-ink font-medium"}`}>
                          {value}
                          {a.flagged && !wasEdited && <span className="ml-1 text-[10px] uppercase tracking-wider">⚑</span>}
                          {wasEdited && <span className="ml-1 text-[9px] uppercase tracking-wider text-pine">· edited</span>}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQ(a.question);
                            setDraft(value);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-pine shrink-0"
                          aria-label={`Edit ${a.question}`}
                          title="Edit"
                        >
                          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                            <path d="M9.5 2.5l2 2L5 11l-2.5.5L3 9l6.5-6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative space-y-3 pl-4">
      <span className="absolute left-[3px] top-1 bottom-1 w-px bg-hairline" aria-hidden="true" />
      {events.map((e, i) => (
        <li key={`${e.label}-${i}`} className="relative text-[12px]">
          <span
            className={`absolute -left-4 top-[3px] w-[7px] h-[7px] rounded-full ${i === events.length - 1 ? "bg-pine" : "bg-graphite/40"}`}
            aria-hidden="true"
          />
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink">{e.label}</span>
            <span className="text-graphite tabular-nums shrink-0">{e.when}</span>
          </div>
          {e.by && <p className="text-[11px] text-muted">{e.by}</p>}
        </li>
      ))}
    </ol>
  );
}

function ApplicationRow({ app, border }: { app: QueueApplication; border: boolean }) {
  const [open, setOpen] = useState(false);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const pct = completionPct(app.completedSteps);
  const flagCount = app.docFlags.length;

  return (
    <div className={border ? "border-t border-hairline" : ""}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="w-full flex items-center gap-4 px-4 py-1.5 text-left hover:bg-paper transition-colors">
        <span className="text-[11px] text-graphite font-mono tabular-nums tracking-tight shrink-0 w-[92px]">{app.caseId}</span>
        <span className="text-[13px] font-semibold text-ink shrink-0 w-[88px] truncate">{app.name}</span>
        <span className="text-[12px] text-graphite shrink-0 w-[120px] truncate hidden sm:block">{app.county} County</span>
        <span className="text-[12px] text-ink flex-1 min-w-0 truncate">{app.status}</span>
        <span className="hidden md:flex items-center gap-2 shrink-0 w-[120px]">
          <span className="h-1.5 flex-1 rounded-full bg-paper overflow-hidden">
            <span className={`block h-full rounded-full ${barClass(app.risk)}`} style={{ width: `${pct}%` }} />
          </span>
          <span className="text-[11px] tabular-nums text-graphite w-[30px] text-right">{pct}%</span>
        </span>
        <span className="shrink-0 w-[64px] text-right">
          {flagCount > 0 ? (
            <span className="text-[11px] font-semibold text-brick tabular-nums">{flagCount} flag{flagCount > 1 ? "s" : ""}</span>
          ) : (
            <span className="text-[11px] text-muted">clean</span>
          )}
        </span>
        <span className={`text-[11px] uppercase tracking-wider tabular-nums shrink-0 w-[40px] text-right ${riskClass(app.risk)}`}>
          {riskLabel(app.risk)}
        </span>
        <span className="text-graphite shrink-0"><Chevron open={open} /></span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 border-l-2 border-pine/30 ml-4 space-y-3">
          {/* Application responses — editable (ephemeral demo) */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite">Application responses</p>
              <p className="text-[11px] tabular-nums text-graphite">{app.answers.length} answers</p>
            </div>
            <AnswerList
              answers={app.answers}
              edited={edited}
              onEdit={(question, value) => setEdited((prev) => ({ ...prev, [question]: value }))}
            />
          </div>

          {/* Engine determination — REAL output */}
          <div className="border-t border-hairline pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1.5">
              Engine determination <span className="text-pine">· live</span>
            </p>
            {app.estimatedBenefitUsd !== null ? (
              <p className="text-[13px] text-ink">
                Estimated benefit{" "}
                <span className="font-semibold tabular-nums">{formatUsd(app.estimatedBenefitUsd)}/mo</span>
                <span className="text-[11px] text-graphite"> · estimate pending verification</span>
              </p>
            ) : (
              <p className="text-[12px] text-muted">Engine could not produce an estimate for this household.</p>
            )}
            {app.assumptions.length > 0 && (
              <p className="text-[11px] text-graphite mt-1">Assumptions: {app.assumptions.join("; ")}.</p>
            )}
          </div>

          {/* Verification checklist (engine confirmForVerdict) + workflow flags */}
          <div className="grid gap-4 md:grid-cols-2 border-t border-hairline pt-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-2">
                Verification needed <span className="text-pine">· engine</span>
              </p>
              {app.verificationNeeds.length > 0 ? (
                <ul className="space-y-1.5">
                  {app.verificationNeeds.map((v) => (
                    <li key={v} className="flex items-start gap-2 text-[12px] text-ink">
                      <span className="shrink-0 mt-[5px] w-1.5 h-1.5 rounded-full bg-warning" aria-hidden="true" />
                      {v}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-muted">Nothing outstanding from the engine.</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-2">Navigator flags</p>
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
                <p className="text-[12px] text-muted">No flags — clear to advance.</p>
              )}
            </div>
          </div>

          {/* Pipeline + history */}
          <div className="grid gap-4 md:grid-cols-2 border-t border-hairline pt-3">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite">Pipeline</p>
                <p className="text-[11px] tabular-nums text-graphite">{app.completedSteps}/{TOTAL_STEPS} · {pct}%</p>
              </div>
              <StepList completedSteps={app.completedSteps} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-2">History</p>
              <Timeline events={app.history} />
            </div>
          </div>

          <Link href={`/packets/${app.id}`} className="inline-block text-[12px] font-semibold text-pine hover:underline">
            Open full case →
          </Link>
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
          [a.caseId, a.name, a.county, a.status, ...a.docFlags, ...a.verificationNeeds, ...a.answers.flatMap((x) => [x.question, x.answer])]
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
      <div className="relative max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search case ID, name, county, status, answer, or flag…"
          aria-label="Search applications"
          className="w-full pl-9 pr-3 py-1.5 text-[13px] bg-surface border border-hairline rounded-[2px] text-ink placeholder:text-muted focus:outline-none focus:border-pine"
        />
      </div>
      {q && (
        <p className="text-[12px] text-graphite">
          {matchCount} match{matchCount === 1 ? "" : "es"} for “{query.trim()}”
        </p>
      )}

      <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-1.5 bg-surface-secondary border-b border-hairline text-[10px] font-semibold uppercase tracking-wider text-graphite">
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
              <div className="flex items-center gap-2 px-4 py-1 bg-paper border-b border-hairline">
                <span className={`w-2 h-2 rounded-sm ${bucket.accent}`} aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-graphite">{bucket.label}</span>
                <span className="text-[11px] text-graphite tabular-nums">{hasRows ? bucket.applications.length : bucket.completedCount}</span>
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
    </div>
  );
}
