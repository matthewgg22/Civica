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
  type TimelineEvent,
  type Risk,
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

// Full application responses for the expanded case. Renders the complete intake
// as a per-section ruled table (Field | Response). Editing is a single batch
// mode: "Edit responses" unlocks every field at once (fixed-option fields as a
// dropdown, others as text); "Save changes" commits the diff.
function AnswerList({
  answers, edited, onEdit,
}: {
  answers: SurveyAnswer[];
  edited: Record<string, string>;
  onEdit: (question: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

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
    for (const a of answers) {
      const next = drafts[a.question];
      if (next !== undefined && next !== current(a)) onEdit(a.question, next);
    }
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
          {e.by && <p className="text-[11px] text-graphite">{e.by}</p>}
        </li>
      ))}
    </ol>
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

function CaseRow({ app, border }: { app: QueueApplication; border: boolean }) {
  const [open, setOpen] = useState(false);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [showMath, setShowMath] = useState(false);
  const pct = completionPct(app.completedSteps);

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
        className="w-full flex items-center gap-4 px-4 py-1.5 text-left hover:bg-surface-secondary transition-colors">
        <span className="text-[11px] text-graphite font-mono tabular-nums tracking-tight shrink-0 w-[92px]">{app.caseId}</span>
        <span className="text-[13px] font-semibold text-ink shrink-0 w-[88px] truncate">{app.name}</span>
        <span className="text-[12px] text-graphite shrink-0 w-[110px] truncate hidden sm:block">{app.county} County</span>
        <span className="text-[12px] text-ink flex-1 min-w-0 truncate">{app.stage}</span>
        {/* Enrolled shows benefit; others show pipeline completion */}
        <span className="hidden md:flex items-center justify-end shrink-0 w-[130px]">
          {enrolled && app.estimatedBenefitUsd !== null ? (
            <span className="text-[12px] tabular-nums text-ink font-medium">~{formatUsd(app.estimatedBenefitUsd)}/mo</span>
          ) : (
            <span className="flex items-center gap-2 w-full">
              <span className="h-1.5 flex-1 rounded-[1px] bg-surface-secondary overflow-hidden">
                <span className="block h-full rounded-[1px] bg-graphite" style={{ width: `${pct}%` }} />
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
        <div className="bg-surface-secondary border-t border-hairline px-4 py-4 space-y-4">
          <AnswerList answers={app.answers} edited={edited} onEdit={(q, v) => setEdited((p) => ({ ...p, [q]: v }))} />

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

          <div className="grid gap-4 md:grid-cols-2 border-t border-hairline pt-3">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Pipeline</p>
                <p className="text-[11px] tabular-nums text-graphite">{app.completedSteps}/{TOTAL_STEPS} · {pct}%</p>
              </div>
              <StepList completedSteps={app.completedSteps} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite mb-2">History</p>
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

export default function ApplicationsQueue({ phases }: { phases: PhaseGroup[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return phases;
    return phases
      .map((p) => ({
        ...p,
        cases: p.cases.filter((a) =>
          [a.caseId, a.name, a.county, a.stage, ...a.docFlags, ...a.verificationNeeds, ...a.answers.flatMap((x) => [x.question, x.answer])]
            .join(" ").toLowerCase().includes(q),
        ),
      }));
  }, [phases, q]);

  const matchCount = filtered.reduce((s, p) => s + p.cases.length, 0);
  const totalCases = phases.reduce((s, p) => s + p.cases.length, 0);

  // Export the FULL caseload (not the search-filtered view), flattened across
  // phases. Engine-computed benefit + verification-need counts travel with it.
  const exportRows = phases.flatMap((p) =>
    p.cases.map((a) => [
      p.label,
      a.caseId,
      a.name,
      `${a.county} County, CA`,
      a.stage,
      `${completionPct(a.completedSteps)}%`,
      a.estimatedBenefitUsd != null ? formatUsd(a.estimatedBenefitUsd) : "—",
      String(a.docFlags.length),
      riskLabel(a.risk),
    ]),
  );

  return (
    <div className="space-y-4">
      {/* Lifecycle funnel */}
      <Funnel phases={phases} />

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
          filename="cbo-pipeline"
          title="Navigator pipeline — cases"
          columns={["Phase", "Case ID", "Applicant", "County", "Stage", "Completion", "Est. benefit", "Flags", "Risk"]}
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
              {phase.cases.map((a, i) => <CaseRow key={a.id} app={a} border={i > 0} />)}
            </div>
          );
        })}

        {q && matchCount === 0 && (
          <p className="px-4 py-6 text-[13px] text-muted text-center">No cases match your search.</p>
        )}
        {!q && totalCases === 0 && (
          <p className="px-4 py-8 text-[13px] text-muted text-center">No active cases in the pipeline yet.</p>
        )}
      </div>
    </div>
  );
}
