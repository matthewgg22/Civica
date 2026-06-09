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
  type InterviewStatus,
} from "../../lib/cbo/demo-pipeline";
import TableExport from "./TableExport";
import { EVALUATION_GATES, deductionRows, deductionOneLine } from "../../lib/cbo/engine-view";
import {
  buildDeficiencyItems,
  deficiencyDocument,
  cureDateLabel,
  isoDate as isoDateForNotice,
} from "../../lib/cbo/deficiency-notice";

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

// Caseload-level timeliness summary — the director's at-a-glance read across the
// whole queue: how many interviews are booked vs. missed, and how many cases are
// up against (or past) the §273.2 processing wire. Procedural risk, not score.
function SummaryStat({ n, label, tone }: { n: number; label: string; tone: "ink" | "warn" | "brick" }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`text-[15px] font-semibold tabular-nums leading-none ${tone === "brick" ? "text-brick" : tone === "warn" ? "text-warning" : "text-ink"}`}>{n}</span>
      <span className="text-[11px] text-graphite">{label}</span>
    </span>
  );
}

function TimelinessSummary({ cases }: { cases: QueueApplication[] }) {
  let scheduled = 0;
  let missed = 0;
  let completed = 0;
  let overdue = 0;
  let dueSoon = 0;
  let curing = 0;
  for (const c of cases) {
    if (c.interview.status === "scheduled") scheduled++;
    else if (c.interview.status === "missed") missed++;
    else if (c.interview.status === "completed") completed++;
    const clk = processingClock(c);
    if (clk) {
      if (clk.left < 0) overdue++;
      else if (clk.left <= 3) dueSoon++;
    }
    if (c.cureDaysLeft != null) curing++;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[2px] border border-hairline bg-surface px-4 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-graphite">This week</span>
      <SummaryStat n={scheduled} label="interviews scheduled" tone="ink" />
      <SummaryStat n={missed} label="missed" tone={missed > 0 ? "brick" : "ink"} />
      <SummaryStat n={completed} label="completed" tone="ink" />
      <span className="h-3 w-px bg-hairline" aria-hidden="true" />
      <SummaryStat n={overdue} label="past the 273.2 wire" tone={overdue > 0 ? "brick" : "ink"} />
      <SummaryStat n={dueSoon} label="due ≤3 days" tone={dueSoon > 0 ? "warn" : "ink"} />
      <SummaryStat n={curing} label="curing verification" tone={curing > 0 ? "warn" : "ink"} />
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

// Which application response fields each document corroborates. Drives the
// per-document "verifies …" disclosure + the green "supported" cue in the
// Documents section.
const DOC_VERIFIES: Record<string, string[]> = {
  "Photo ID": ["Applicant name", "Date of birth", "Identity"],
  "Proof of income": ["Gross monthly income", "Employment status", "Pay frequency"],
  "Proof of residence": ["County", "Monthly rent", "Residency"],
  "Social Security Number": ["SSN", "Identity match (SSA)"],
};
const docIsPresent = (answer: string) => !/not (yet uploaded|provided)/i.test(answer);

// At-a-glance eligibility triage for outreach — derived from the engine's
// computed estimate, NOT a determination. >$0 → likely eligible (passes the
// income/calc tests under the stated assumptions); $0 → likely ineligible;
// null → can't compute yet (incomplete).
type EligScan = { label: string; tone: "eligible" | "ineligible" | "incomplete"; note: string };
function eligibilityScan(app: QueueApplication): EligScan {
  if (app.estimatedBenefitUsd == null)
    return { label: "Incomplete", tone: "incomplete", note: "Not enough confirmed to estimate — complete the items below." };
  if (app.estimatedBenefitUsd > 0)
    return {
      label: "Likely eligible",
      tone: "eligible",
      note: `Passes the income + benefit tests under the stated assumptions (~${formatUsd(app.estimatedBenefitUsd)}/mo). Provisional — confirm the items at right.`,
    };
  return { label: "Likely ineligible", tone: "ineligible", note: "Computes to $0 under the stated assumptions — likely over the income limit. Provisional." };
}
const ELIG_CHIP: Record<EligScan["tone"], string> = {
  eligible: "bg-pine-surface text-ink",
  ineligible: "bg-brick/10 text-brick",
  incomplete: "bg-surface-secondary text-graphite",
};

// ── Regulatory clocks (§273.2) ────────────────────────────────────────────────
// The three statutory timers a navigator actually triages on: the 30-day (7 for
// expedited) processing clock, the eligibility-interview gate, and the ~10-day
// verification "cure" window. These dominate triage order more than risk score —
// ~2/3 of CA denials are procedural (missed interview / un-cured verification),
// not substantive ineligibility.

type ClockTone = "ok" | "warn" | "overdue";
const CLOCK_TONE_BOX: Record<ClockTone, string> = {
  ok: "bg-pine-surface text-ink",
  warn: "bg-warning/12 text-warning",
  overdue: "bg-brick/10 text-brick",
};
// The §273.2 processing clock for an in-flight application. Null once decided
// (enrolled / recert) — the clock only runs while the county owes a decision.
type ProcessingClock = { day: number; limit: number; left: number; tone: ClockTone; label: string; sub: string };
function processingClock(app: QueueApplication): ProcessingClock | null {
  if (app.processingDay == null) return null;
  const day = app.processingDay;
  const limit = app.processingLimit;
  const left = limit - day;
  const tone: ClockTone = left < 0 ? "overdue" : left <= 3 ? "warn" : "ok";
  return {
    day,
    limit,
    left,
    tone,
    label: left < 0 ? `Day ${day} of ${limit} · overdue` : `Day ${day} of ${limit}`,
    sub:
      limit === 7
        ? "Expedited service · 7 CFR 273.2(i)"
        : "Application processing · 7 CFR 273.2(g)",
  };
}

// Eligibility-interview gate (7 CFR 273.2(e)). A missed interview is the single
// biggest procedural-denial driver, so it surfaces as its own actionable state.
const INTERVIEW_META: Record<InterviewStatus, { label: string; tone: ClockTone; box: string }> = {
  none: { label: "Not yet scheduled", tone: "warn", box: "bg-surface-secondary text-graphite" },
  scheduled: { label: "Scheduled", tone: "ok", box: "bg-pine-surface text-ink" },
  missed: { label: "Missed — reschedule", tone: "overdue", box: "bg-brick/10 text-brick" },
  completed: { label: "Completed", tone: "ok", box: "bg-pine-surface text-ink" },
};

// Map an engine verification item / recommendation to the application section it
// concerns, so a click can jump the reviewer to it.
const sectionDomId = (caseId: string, section: string) =>
  `cbo-sec-${caseId}-${section.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
function needToSection(text: string): string {
  const t = text.toLowerCase();
  if (/asset|resource|liquid/.test(t)) return "Resources";
  if (/document|proof|photo|ssn|social security/.test(t)) return "Documents";
  if (/shelter|rent|utilit|expense|medical|dependent|child support/.test(t)) return "Expenses & deductions";
  if (/income|employ|pay|cash.?aid|tanf|ssi|wage/.test(t)) return "Income & employment";
  if (/citizen|immigration|age|household|child|member/.test(t)) return "Your household";
  return "About you";
}
function scrollToCaseSection(caseId: string, section: string): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(sectionDomId(caseId, section));
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.style.outline = "2px solid var(--color-pine)";
  el.style.outlineOffset = "2px";
  el.style.transition = "outline-color 250ms";
  window.setTimeout(() => { el.style.outline = "2px solid transparent"; }, 1400);
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
  pinned: boolean;
};

// The signed-in caseworker (demo) + peer navigators a case can be transferred to.
const CURRENT_USER = "Ashley Davis";
const PEERS = ["Jordan Ruiz", "Ashley Cole", "Marcus Diaz", "Robert Okafor", "Lena Park"];

// Map the synthetic history actors to full names for the activity log.
const NAME_MAP: Record<string, string> = {
  "Navigator J. Ruiz": "Jordan Ruiz",
  "Navigator A. Cole": "Ashley Cole",
  "Navigator M. Diaz": "Marcus Diaz",
  "Navigator R. Okafor": "Robert Okafor",
  "Navigator L. Park": "Lena Park",
  Applicant: "Applicant (self-service)",
  County: "County office",
  "Civica engine": "Civica engine (automated)",
};
const fullName = (who: string | undefined) => (who ? NAME_MAP[who] ?? who : "System");

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
  return nav ? fullName(nav.by) : "Unassigned";
}

const nowLabel = () =>
  new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Full audit timestamp: "06/20/2026 - 11:36pm".
function formatStamp(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  let h = d.getHours();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()} - ${h}:${min}${ampm}`;
}

// Timestamp for a live activity-log entry (now, full format).
const nowStamp = () => formatStamp(new Date());

// Named county eligibility officials (per launch county) — "County office" was
// too vague; an audit trail records the specific official who acted.
const COUNTY_OFFICIALS: Record<string, string> = {
  "Los Angeles": "Renee Foster · LA County DPSS",
  "San Diego": "Carl Nguyen · SD County HHSA",
  "San Francisco": "Dana Whitfield · SF HSA",
  Fresno: "Hector Salas · Fresno County DSS",
  Sacramento: "Joan Pierce · Sacramento County DHA",
  Alameda: "Terrence Hall · Alameda County SSA",
  "San Jose": "Maria Lopez · Santa Clara County SSA",
};
const countyOfficial = (county: string) => COUNTY_OFFICIALS[county] ?? `${county} County eligibility worker`;

// Build a detailed chain-of-custody log from the case's structured state: intake
// consent (account, CBO-of-record, data-sharing, buddy auth), per-step packet
// completion with %, engine determination, navigator review, outreach on each
// flag, expedited screen, and named county actions. Synthetic but specific —
// enough to actually follow up on. Newest-first; deterministic timestamps.
function seedActivity(c: QueueApplication): ActivityEntry[] {
  const A = "Applicant (self-service)";
  const nav = initialAssignee(c);
  const county = countyOfficial(c.county);
  const engine = "Civica engine (automated)";
  const pct = (n: number) => `${Math.round((n / TOTAL_STEPS) * 100)}%`;
  const seedNum = Number(c.caseId.match(/\d+$/)?.[0] ?? "0");
  const built: { actor: string; action: string }[] = [];

  built.push({ actor: A, action: "Created account and started a CalFresh application online" });
  built.push({ actor: A, action: "Agreed to CBO assistance — VoteNow Advocacy Foundation recorded as CBO of record" });
  built.push({ actor: A, action: "Signed consent to share application data with the county" });
  if (seedNum % 2 === 0) built.push({ actor: A, action: `Authorized a buddy / representative (${PEERS[seedNum % PEERS.length]}) to assist with the case` });
  if (c.expedited) built.push({ actor: engine, action: `Auto-screened for expedited service (7 CFR 273.2(i)) — ${c.expeditedReason.toLowerCase()}` });

  for (let i = 0; i < Math.min(c.completedSteps, PIPELINE_STEPS.length); i++) {
    const step = PIPELINE_STEPS[i];
    if (step === "Document verification") built.push({ actor: nav, action: `Verified uploaded documents — packet ${pct(i + 1)} complete` });
    else if (step === "Engine determination") built.push({ actor: engine, action: c.estimatedBenefitUsd != null ? `Eligibility gates + benefit estimate computed — approx. ~${formatUsd(c.estimatedBenefitUsd)}/mo` : "Eligibility screen computed (estimate pending)" });
    else if (step === "Navigator review") built.push({ actor: nav, action: `Opened navigator review — packet ${pct(i + 1)} complete` });
    else if (step === "Submitted to county") built.push({ actor: nav, action: "Submitted the application packet to the county" });
    else built.push({ actor: A, action: `Completed "${step}" — packet ${pct(i + 1)} complete` });
  }
  for (const f of c.docFlags) built.push({ actor: nav, action: `Outreach — contacted applicant to resolve: ${f}` });
  if (c.phase === "enrolled") {
    built.push({ actor: county, action: "Conducted eligibility interview" });
    built.push({ actor: county, action: `Approved — Notice of Action issued${c.estimatedBenefitUsd != null ? ` (~${formatUsd(c.estimatedBenefitUsd)}/mo)` : ""}` });
  }
  if (c.phase === "recert") {
    built.push({ actor: engine, action: "Recertification notice generated and sent to the applicant" });
    if (/overdue/i.test(c.stage)) built.push({ actor: nav, action: "Outreach — recertification overdue, reminder call placed" });
  }

  // Walk a per-case cursor forward (deterministic, SSR-safe); reverse so the log
  // reads newest-first.
  const base = new Date(2025, 8, 6 + (seedNum % 18), 9, 5, 0, 0).getTime();
  const stamped = built.map((e, i) => ({
    ts: formatStamp(new Date(base + (i * 11 + (i % 3) * 5) * 3600 * 1000)),
    actor: e.actor,
    action: e.action,
  }));
  return stamped.reverse();
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

// Compact, PII-light snapshot of ONE case for Mae's context, so "Ask Mae about
// this case" carries the application into the conversation — Mae can then answer
// "what needs to be done?" concretely. Sends engine verdict, the §273.2 clocks,
// interview state, and the outstanding cure items (categories + rule), NOT raw
// identifiers (SSN/DOB/address/phone are never included; /api/mae also redacts).
function caseContextSummary(app: CaseRecord): { caseContext: string; caseLabel: string } {
  const scan = eligibilityScan(app);
  const clock = processingClock(app);
  const iv = INTERVIEW_META[app.interview.status];
  const defs = buildDeficiencyItems(app);
  const enrolled = app.phase === "enrolled";
  const L: string[] = [];
  L.push(
    "The navigator is asking about this specific application. Use these case facts to answer concretely about what to do next on THIS case. Do not repeat back any personal identifiers.",
  );
  L.push(
    "SCOPE: this is a California (CalFresh) application — stay scoped to California for procedure; if asked about another state, say that's outside this case's jurisdiction.",
  );
  L.push("");
  L.push(`CASE: ${app.caseId} · ${app.name} — ${app.county} County, CA`);
  L.push(`Stage: ${app.stage}${app.expedited ? " · EXPEDITED (7 CFR 273.2(i))" : ""}`);
  L.push(
    `Eligibility (engine, provisional): ${scan.label}${app.estimatedBenefitUsd != null ? ` · est. ~${formatUsd(app.estimatedBenefitUsd)}/mo` : ""}`,
  );
  if (clock) L.push(`Processing clock: Day ${clock.day} of ${clock.limit}${clock.left < 0 ? " — OVERDUE" : ` (${clock.left}d left)`} (7 CFR 273.2)`);
  L.push(`Interview: ${iv.label}${app.interview.date ? ` (${app.interview.date})` : ""} (7 CFR 273.2(e))`);
  if (app.cureDaysLeft != null) L.push(`Verification cure window: ~${app.cureDaysLeft} day(s) left (7 CFR 273.2(h))`);
  if (enrolled) {
    L.push("Outstanding verification: none — household is enrolled/approved.");
  } else if (defs.length) {
    L.push(`Outstanding to cure before filing (${defs.length}):`);
    defs.forEach((d, i) => L.push(`  ${i + 1}. ${d.category} — ${d.action} [${d.citation}]`));
  } else {
    L.push("Outstanding verification: none — ready to file.");
  }
  if (app.docFlags.length) L.push(`Navigator flags: ${app.docFlags.join("; ")}`);
  if (app.assumptions.length) L.push(`Engine assumptions (unconfirmed): ${app.assumptions.join("; ")}`);
  return { caseContext: L.join("\n"), caseLabel: `${app.caseId} · ${app.name}` };
}

// Open ONE case as a clean, print-friendly page in a new tab — the full
// application + engine summary + verification + activity, formatted as a
// document with a "Print / Save as PDF" button (no auto-print). Client-side
// window.write so it works on the synthetic preview with no real packet route.
function openFullApplication(app: CaseRecord): void {
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) {
    alert("Couldn't open the application — allow pop-ups for this site, then try again.");
    return;
  }
  const esc = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Group answers by section (consecutive), like the in-app table.
  const sections: { section: string; items: SurveyAnswer[] }[] = [];
  for (const a of app.answers) {
    const last = sections[sections.length - 1];
    if (last && last.section === a.section) last.items.push(a);
    else sections.push({ section: a.section, items: [a] });
  }
  const responsesHtml = sections
    .map(
      (g) => `<h2>${esc(g.section)}</h2><table class="kv"><tbody>${g.items
        .map(
          (a) =>
            `<tr><th>${esc(a.question)}</th><td class="${a.flagged ? "flag" : ""}">${esc(a.answer)}${a.flagged ? " &#9873;" : ""}</td></tr>`,
        )
        .join("")}</tbody></table>`,
    )
    .join("");

  const gatesHtml = EVALUATION_GATES.map(
    (gt, i) => `<li><span class="n">${i + 1}</span> ${esc(gt.label)} <span class="cite">${esc(gt.citation)}</span></li>`,
  ).join("");

  const nextSteps = app.recommendations.length
    ? app.recommendations.slice(0, 5).map((r) => `<li>${esc(r.action)}</li>`).join("")
    : app.verificationNeeds.slice(0, 6).map((v) => `<li>Confirm ${esc(v.charAt(0).toLowerCase() + v.slice(1))}</li>`).join("");

  const checksHtml = buildVerification(app)
    .map((c) => `<li>${c.ok ? "&#10003;" : "&#9888;"} <b>${esc(c.label)}</b> — ${esc(c.note)}${c.ok ? "" : " (needs check)"}</li>`)
    .join("");

  const activityHtml = app.activity
    .map(
      (e, i) =>
        `<tr><td>${i + 1}</td><td class="ts">${esc(e.ts)}</td><td>${esc(e.actor)}</td><td>${esc(e.action)}</td></tr>`,
    )
    .join("");

  const benefit = app.estimatedBenefitUsd != null ? `approx. ~${formatUsd(app.estimatedBenefitUsd)}/mo` : "no estimate";
  const mathLine = app.deduction ? `<p class="math">${esc(deductionOneLine(app.deduction))}</p>` : "";

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(app.caseId)} — ${esc(app.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font: 13px -apple-system, system-ui, sans-serif; color: #15181C; margin: 40px; max-width: 720px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .meta { font-size: 12px; color: #565E68; margin: 0 0 6px; }
  .pill { display:inline-block; font:600 10px sans-serif; text-transform:uppercase; letter-spacing:.06em; color:#B5511E; border:1px solid #B5511E; border-radius:2px; padding:1px 6px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #565E68; margin: 20px 0 6px; border-bottom: 1px solid rgba(15,23,42,.14); padding-bottom: 4px; }
  table.kv { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  table.kv th { text-align: left; font-weight: 400; color: #3C424B; width: 42%; padding: 4px 8px; vertical-align: top; border-bottom: 1px solid rgba(15,23,42,.08); }
  table.kv td { padding: 4px 8px; font-weight: 500; vertical-align: top; border-bottom: 1px solid rgba(15,23,42,.08); }
  td.flag { color: #9C3A24; font-weight: 600; }
  .est { font-size: 16px; font-weight: 700; }
  .math { font-size: 12px; color: #3C424B; margin: 4px 0 0; }
  ol.gates { list-style: none; padding: 0; margin: 4px 0; font-size: 12px; }
  ol.gates li { padding: 2px 0; } ol.gates .n { color: #565E68; display:inline-block; width: 16px; } ol.gates .cite { color: #565E68; font-size: 11px; }
  ul.plain { margin: 4px 0; padding-left: 18px; font-size: 12px; } ul.plain li { padding: 1px 0; }
  ul.checks { list-style: none; padding: 0; margin: 4px 0; font-size: 12px; } ul.checks li { padding: 2px 0; }
  table.log { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 4px; }
  table.log td { padding: 4px 8px; border-bottom: 1px solid rgba(15,23,42,.10); vertical-align: top; } table.log td.ts { white-space: nowrap; color: #565E68; }
  .disc { font-size: 11px; color: #565E68; margin-top: 22px; line-height: 1.5; border-top: 1px solid rgba(15,23,42,.14); padding-top: 10px; }
  .bar { display: flex; justify-content: flex-end; margin: 0 0 18px; }
  .bar button { font: 600 12px -apple-system, system-ui, sans-serif; color: #fff; background: #2D5A45; border: 0; border-radius: 3px; padding: 7px 14px; cursor: pointer; }
  @media print { body { margin: 0; } .bar { display: none; } @page { margin: 16mm; } }
</style></head><body>
  <div class="bar"><button onclick="window.print()">Print / Save as PDF</button></div>
  <h1>${esc(app.name)} — ${esc(app.caseId)}</h1>
  <p class="meta">${esc(app.county)} County, CA · ${esc(app.stage)} · assigned to ${esc(app.assignedTo)}${app.expedited ? ' · <span class="pill">Expedited</span>' : ""}</p>
  <p class="meta">Generated ${esc(new Date().toISOString().slice(0, 10))} · Civica CBO preview</p>

  <h2>Application responses</h2>
  ${responsesHtml}

  <h2>Civica engine — benefit estimate</h2>
  <p class="est">${esc(benefit)}</p>
  ${mathLine}

  <h2>Eligibility gates (provisional · pending ${app.verificationNeeds.length} item(s))</h2>
  <ol class="gates">${gatesHtml}</ol>

  <h2>Recommended next steps</h2>
  <ul class="plain">${nextSteps || "<li>No outstanding actions.</li>"}</ul>

  <h2>Automated verification</h2>
  <ul class="checks">${checksHtml}</ul>

  <h2>Activity log (${app.activity.length})</h2>
  <table class="log"><tbody>${activityHtml}</tbody></table>

  <p class="disc">Estimate + recommendations are live engine output on these answers; eligibility is provisional until the verification items are confirmed — an estimate, not a determination. Verify against current CalFresh / CDSS rules and the county system of record.</p>
<\/body><\/html>`);
  w.document.close();
}

// Assemble the deficiency-notice payload from a case (the same gaps the
// on-screen verification cross-check shows), stamping today + the ~10-day cure.
function deficiencyDocFor(app: CaseRecord) {
  const now = new Date();
  return {
    applicant: app.name,
    caseId: app.caseId,
    county: app.county,
    generatedAt: isoDateForNotice(now),
    cureBy: cureDateLabel(now),
    items: buildDeficiencyItems(app),
  };
}

// Open the client-ready document request as a print-friendly tab (PDF via the
// browser's Save-as-PDF), reusing the established window.write pattern.
function openDeficiencyNotice(app: CaseRecord): void {
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) {
    alert("Couldn't open the document request — allow pop-ups for this site, then try again.");
    return;
  }
  w.document.write(deficiencyDocument(deficiencyDocFor(app), { forWord: false }));
  w.document.close();
}

// Download the same document request as a Word (.doc) file.
function downloadDeficiencyWord(app: CaseRecord): void {
  const html = deficiencyDocument(deficiencyDocFor(app), { forWord: true });
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `document-request-${app.caseId}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Full application responses for the expanded case. Renders the complete intake
// as a per-section ruled table (Field | Response). Editing is a single batch
// mode: "Edit responses" unlocks every field at once (fixed-option fields as a
// dropdown, others as text); "Save changes" commits the diff.
function AnswerList({
  caseId, answers, edited, onEdit, onSave,
}: {
  caseId: string;
  answers: SurveyAnswer[];
  edited: Record<string, string>;
  onEdit: (question: string, value: string) => void;
  onSave?: (changes: { question: string; from: string; to: string }[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [viewDoc, setViewDoc] = useState<string | null>(null);
  const [openDocs, setOpenDocs] = useState<Set<string>>(new Set());
  const toggleDoc = (q: string) =>
    setOpenDocs((s) => {
      const n = new Set(s);
      if (n.has(q)) n.delete(q);
      else n.add(q);
      return n;
    });

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
    const changes: { question: string; from: string; to: string }[] = [];
    for (const a of answers) {
      const next = drafts[a.question];
      if (next !== undefined && next !== current(a)) {
        changes.push({ question: a.question, from: current(a), to: next });
        onEdit(a.question, next);
      }
    }
    if (changes.length) onSave?.(changes);
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
          <div
            key={group.section}
            id={sectionDomId(caseId, group.section)}
            className="border border-hairline rounded-[2px] overflow-hidden bg-surface"
            style={{ outline: "2px solid transparent", outlineOffset: 2 }}
          >
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
                          <>
                            <span
                              className={`font-medium leading-snug break-words ${
                                a.flagged && !wasEdited ? "text-brick" : "text-ink"
                              }`}
                            >
                              {current(a)}
                              {a.flagged && !wasEdited && <span className="ml-1 text-[11px]" aria-label="flagged">⚑</span>}
                              {wasEdited && <span className="ml-1 text-[10px] uppercase tracking-wider text-graphite">· edited</span>}
                              {a.section === "Documents" && docIsPresent(current(a)) && (
                                <button
                                  type="button"
                                  onClick={() => setViewDoc(a.question)}
                                  className="ml-2 text-[11px] font-medium text-pine hover:underline"
                                >
                                  View
                                </button>
                              )}
                            </span>

                            {/* Stronger gate for SSN — explicit SSA-match status (7 CFR 273.6). */}
                            {a.question === "Social Security Number" && (
                              /does not match|mismatch|not provided/i.test(current(a)) ? (
                                <p className="mt-1 flex items-start gap-1 text-[11px] font-semibold text-brick leading-snug">
                                  <span aria-hidden="true">⛔</span> SSA match failed — must clear before submission (7 CFR 273.6)
                                </p>
                              ) : (
                                <p className="mt-1 flex items-center gap-1 text-[11px] text-pine">
                                  <span aria-hidden="true">✓</span> Verified against SSA records
                                </p>
                              )
                            )}

                            {/* Per-document disclosure: which response fields it corroborates. */}
                            {a.section === "Documents" && DOC_VERIFIES[a.question] && (() => {
                              const present = docIsPresent(current(a));
                              const fields = DOC_VERIFIES[a.question];
                              const isOpen = openDocs.has(a.question);
                              return (
                                <div className="mt-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleDoc(a.question)}
                                    aria-expanded={isOpen}
                                    className={`inline-flex items-center gap-1 text-[11px] ${present ? "text-pine" : "text-graphite hover:text-ink"}`}
                                  >
                                    <span aria-hidden="true">{present ? "✓" : "○"}</span>
                                    {present ? "Verifies" : "Would verify"} {fields.length} field{fields.length > 1 ? "s" : ""}
                                    <span aria-hidden="true" className="text-graphite">{isOpen ? "▴" : "▾"}</span>
                                  </button>
                                  {isOpen && (
                                    <ul className="mt-1 ml-1 space-y-0.5">
                                      {fields.map((f) => (
                                        <li key={f} className="flex items-baseline gap-1.5 text-[11px]">
                                          <span aria-hidden="true" className={present ? "text-pine" : "text-graphite/40"}>{present ? "✓" : "○"}</span>
                                          <span className={present ? "text-ink" : "text-graphite"}>{f}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              );
                            })()}
                          </>
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
                  Document preview
                  <br />
                  <span className="text-ink font-medium">{viewDoc}</span>
                  <br />
                  Open the full application to view the file.
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
// Consistent colored "result box" that leads each of the three engine cards, so
// a layperson reads verdict / dollars / action items with the same grammar:
// pine = likely eligible, amber = the benefit (a positive outcome), blue = the
// call-to-action count. (Amber is reserved for positive outcomes per DESIGN.md.)
function ResultLede({
  box,
  kicker,
  value,
  unit,
}: {
  box: string;
  kicker: string;
  value: React.ReactNode;
  unit?: string;
}) {
  return (
    <div className={`rounded-[3px] px-2.5 py-1.5 ${box}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-80">{kicker}</p>
      <p className="text-[18px] font-semibold tabular-nums leading-tight mt-0.5">
        {value}
        {unit && <span className="text-[12px] font-normal opacity-80">{unit}</span>}
      </p>
    </div>
  );
}

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

// Per-case timeliness rail — the three §273.2 clocks side by side, surfaced at
// the top of the expanded case (above the responses) because they set triage
// priority. Interview offers inline actions (reminder / call / practice flag),
// each logged to the chain of custody.
function TimelinessBanner({
  app,
  onAction,
}: {
  app: CaseRecord;
  onAction: (action: string) => void;
}) {
  const clock = processingClock(app);
  const iv = INTERVIEW_META[app.interview.status];
  const cure = app.cureDaysLeft;
  const cureTone: ClockTone = cure == null ? "ok" : cure <= 1 ? "overdue" : cure <= 3 ? "warn" : "warn";
  // Only render for cases where at least one clock is live.
  if (!clock && app.interview.status === "none" && cure == null) return null;

  const showInterviewActions = app.interview.status === "missed" || app.interview.status === "scheduled" || app.interview.status === "none";

  return (
    <div className="rounded-[2px] border border-hairline bg-surface px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite mb-2">Timeliness · 7 CFR 273.2</p>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {/* Processing clock — the day-of-N statutory wire. */}
        <div className={`rounded-[2px] px-2.5 py-1.5 ${clock ? CLOCK_TONE_BOX[clock.tone] : "bg-surface-secondary text-graphite"}`}>
          <p className="text-[10px] uppercase tracking-wider opacity-80">Processing clock</p>
          {clock ? (
            <>
              <p className="text-[15px] font-semibold tabular-nums leading-tight mt-0.5">{clock.label}</p>
              <p className="text-[10px] opacity-80 leading-snug mt-0.5">
                {clock.tone === "overdue"
                  ? `${-clock.left}d past the limit · ${clock.sub}`
                  : `${clock.left}d left · ${clock.sub}`}
              </p>
            </>
          ) : (
            <p className="text-[13px] font-medium leading-tight mt-0.5">No clock running</p>
          )}
        </div>

        {/* Interview gate. */}
        <div className={`rounded-[2px] px-2.5 py-1.5 ${iv.box}`}>
          <p className="text-[10px] uppercase tracking-wider opacity-80">Interview · 273.2(e)</p>
          <p className="text-[13px] font-semibold leading-tight mt-0.5">{iv.label}</p>
          <p className="text-[10px] opacity-80 leading-snug mt-0.5">
            {app.interview.date ? `${app.interview.status === "completed" ? "Held" : app.interview.status === "missed" ? "Was set for" : "Set for"} ${app.interview.date}` : "CF-296 not yet booked"}
          </p>
        </div>

        {/* Verification cure clock. */}
        <div className={`rounded-[2px] px-2.5 py-1.5 ${cure == null ? "bg-surface-secondary text-graphite" : CLOCK_TONE_BOX[cureTone]}`}>
          <p className="text-[10px] uppercase tracking-wider opacity-80">Cure clock · 273.2(h)</p>
          {cure == null ? (
            <p className="text-[13px] font-medium leading-tight mt-0.5">Nothing pending</p>
          ) : (
            <>
              <p className="text-[15px] font-semibold tabular-nums leading-tight mt-0.5">{cure}d to cure</p>
              <p className="text-[10px] opacity-80 leading-snug mt-0.5">Chasing: {app.assignedTo}</p>
            </>
          )}
        </div>
      </div>

      {/* Interview actions — only where an interview still needs work. */}
      {showInterviewActions && (
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {app.interview.status === "missed" && (
            <span className="text-[11px] font-semibold text-brick mr-1">Missed interview — recover before the county denies (273.2(e)):</span>
          )}
          <button
            type="button"
            onClick={() => onAction(`Sent interview reminder to applicant${app.interview.date ? ` (CF-296 set for ${app.interview.date})` : ""}`)}
            className="rounded-[2px] border border-hairline bg-surface px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-paper"
          >
            Send reminder
          </button>
          <button
            type="button"
            onClick={() => onAction("Placed outreach call to applicant about the eligibility interview")}
            className="rounded-[2px] border border-hairline bg-surface px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-paper"
          >
            Call applicant
          </button>
          <button
            type="button"
            onClick={() => onAction("Flagged applicant for the interview-practice tool (mock CalFresh interview)")}
            className="rounded-[2px] border border-hairline bg-surface px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-paper"
          >
            Flag for interview practice
          </button>
        </div>
      )}
    </div>
  );
}

function CaseRow({
  app, border, onAdvance, onTransfer, onComment, onEditLog, onTogglePin, onLogAction,
}: {
  app: CaseRecord;
  border: boolean;
  onAdvance: () => void;
  onTransfer: (to: string) => void;
  onComment: (text: string) => void;
  onEditLog: (changes: { question: string; from: string; to: string }[]) => void;
  onTogglePin: () => void;
  onLogAction: (action: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [showMath, setShowMath] = useState(false);
  const [comment, setComment] = useState("");
  const [confirmAdvance, setConfirmAdvance] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState("");
  const openActivity = () => { setRefreshedAt(nowStamp()); setShowActivity(true); };
  const pct = completionPct(app.completedSteps);
  const next = nextPhase(app.phase);
  const checks = buildVerification(app);
  const checksClear = checks.filter((c) => c.ok).length;
  const clock = processingClock(app);
  const deficiencies = buildDeficiencyItems(app);

  // Open Mae with an empty composer — the caseworker types their own question.
  // (No auto-generated prefill; MaeChat listens for this event to open.)
  const askMae = () => {
    // Hand Mae this case as context (no auto-typed question — the navigator
    // asks their own), so it can answer "what needs to be done?" about THIS one.
    // caseState/caseRef are logged so the audit shows this was an application-
    // specific, CA-scoped query (caseRef = internal packet id, not the PII case #).
    const { caseContext, caseLabel } = caseContextSummary(app);
    window.dispatchEvent(
      new CustomEvent("mae:prefill", {
        detail: { caseContext, caseLabel, caseState: "CA", caseRef: app.id },
      }),
    );
  };
  const flagCount = app.docFlags.length;
  const enrolled = app.phase === "enrolled";

  return (
    <div className={border ? "border-t border-hairline" : ""}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className={`w-full flex items-center gap-4 px-4 py-1.5 text-left transition-colors ${
          open ? "bg-[var(--color-row-hover)]" : "hover:bg-[var(--color-row-hover)]"
        }`}>
        {/* Pin/star — toggles without expanding the row (stopPropagation). */}
        <span
          role="button"
          tabIndex={0}
          aria-label={app.pinned ? "Unpin case" : "Pin case"}
          aria-pressed={app.pinned}
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onTogglePin(); }
          }}
          className={`shrink-0 w-4 flex items-center justify-center cursor-pointer ${
            app.pinned ? "text-amber" : "text-graphite/25 hover:text-graphite/60"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={app.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth={app.pinned ? 0 : 1.5} strokeLinejoin="round">
            <path d="M12 3.2l2.7 5.6 6.1.6-4.6 4.1 1.3 6L12 16.9 6.5 19.5l1.3-6L3.2 9.4l6.1-.6z" />
          </svg>
        </span>
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
          {app.interview.status === "missed" && (
            <span className="shrink-0 rounded-[2px] border border-brick px-1.5 text-[11px] font-semibold uppercase tracking-wider text-brick">
              Interview missed
            </span>
          )}
        </span>
        {/* Enrolled → benefit; active w/ a running clock → "Day X of N"
            (drives triage); otherwise pipeline completion. */}
        <span className="hidden md:flex items-center justify-end shrink-0 w-[130px]">
          {enrolled && app.estimatedBenefitUsd !== null ? (
            <span className="text-[12px] tabular-nums text-ink font-medium">~{formatUsd(app.estimatedBenefitUsd)}/mo</span>
          ) : clock ? (
            <span className={`rounded-[2px] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${CLOCK_TONE_BOX[clock.tone]}`}>
              Day {clock.day} of {clock.limit}
            </span>
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

          {/* §273.2 clocks — processing / interview / cure (sets triage priority). */}
          <TimelinessBanner app={app} onAction={onLogAction} />

          <AnswerList
            caseId={app.id}
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

            {/* Deficiency notice — emit a client-ready document request from the
                gaps above (each item + the §273 rule + the ~10-day cure). A cure
                only applies to a case that isn't decided yet — an enrolled
                household has nothing outstanding to file. */}
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[2px] bg-[var(--color-surface-secondary)] px-3 py-2">
              {enrolled ? (
                <span className="text-[12px] font-medium text-pine">✓ Enrolled — no document request needed</span>
              ) : deficiencies.length > 0 ? (
                <>
                  <span className="text-[12px] text-ink">
                    <span className="font-semibold text-warning">{deficiencies.length} item{deficiencies.length !== 1 ? "s" : ""}</span> to cure before this is clean
                    <span className="text-graphite"> · client gets ~10 days once filed (7 CFR 273.2(h))</span>
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openDeficiencyNotice(app)}
                      className="rounded-[2px] bg-pine px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-pine-pressed"
                    >
                      Document request (PDF)
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadDeficiencyWord(app)}
                      className="rounded-[2px] border border-hairline bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-paper"
                    >
                      Word
                    </button>
                  </div>
                </>
              ) : (
                <span className="text-[12px] font-medium text-pine">✓ No outstanding verification — ready to file</span>
              )}
            </div>
          </div>

          {/* The three engines, made explicit */}
          <div className="border-t border-hairline pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite mb-2">Civica engine</p>
            <div className="grid gap-3 md:grid-cols-3">
              {/* 1 — Eligibility: at-a-glance verdict for outreach + the gate chain. */}
              <EngineBlock title="Eligibility" tag="provisional">
                {(() => {
                  const scan = eligibilityScan(app);
                  return (
                    <>
                      <ResultLede
                        box={ELIG_CHIP[scan.tone]}
                        kicker="Verdict"
                        value={<span className="text-[15px] uppercase tracking-wide">{scan.label}</span>}
                      />
                      <p className="text-[12px] text-ink mt-1.5 leading-snug">{scan.note}</p>
                      <p className="text-[11px] text-graphite mt-1">Not a determination.</p>
                    </>
                  );
                })()}
                <details className="mt-2">
                  <summary className="text-[11px] text-pine hover:underline cursor-pointer">Gates evaluated (8)</summary>
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
                </details>
              </EngineBlock>

              {/* 2 — Benefit amount (the number + the math). Always the engine
                  estimate — never the county's actual award, even when enrolled. */}
              <EngineBlock title="Benefit amount" tag="provisional">
                {app.estimatedBenefitUsd !== null ? (
                  <>
                    <ResultLede
                      box="bg-amber-surface text-ink"
                      kicker="Est. monthly benefit"
                      value={`~${formatUsd(app.estimatedBenefitUsd)}`}
                      unit="/mo"
                    />
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
              <EngineBlock title="Recommended next steps" tag="provisional">
                {(() => {
                  const hasRecs = app.recommendations.length > 0;
                  const count = hasRecs ? app.recommendations.length : app.verificationNeeds.length;
                  if (count === 0) return <p className="text-[12px] text-muted">Nothing outstanding to confirm.</p>;
                  return (
                    <>
                      <ResultLede
                        box="bg-[var(--color-row-hover)] text-ink"
                        kicker={hasRecs ? "Ways to raise the benefit" : "Action items to complete"}
                        value={count}
                        unit={` ${hasRecs ? (count === 1 ? "way" : "ways") : "to confirm"}`}
                      />
                      <ul className="mt-1.5 space-y-1">
                        {hasRecs
                          ? app.recommendations.slice(0, 4).map((r) => (
                              <li key={r.rank} className="text-[12px] leading-snug">
                                <button
                                  type="button"
                                  onClick={() => scrollToCaseSection(app.id, needToSection(r.action))}
                                  className="text-left text-pine hover:underline"
                                >
                                  {r.action}
                                  {r.deltaUsd > 0 && <span className="font-semibold tabular-nums"> (+{formatUsd(r.deltaUsd)}/mo)</span>}
                                </button>
                              </li>
                            ))
                          : app.verificationNeeds.slice(0, 6).map((v) => (
                              <li key={v} className="text-[12px] leading-snug">
                                <button
                                  type="button"
                                  onClick={() => scrollToCaseSection(app.id, needToSection(v))}
                                  className="text-left text-pine hover:underline"
                                >
                                  Confirm {v.charAt(0).toLowerCase() + v.slice(1)}
                                </button>
                              </li>
                            ))}
                      </ul>
                    </>
                  );
                })()}
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
              <button
                type="button"
                onClick={openActivity}
                className="rounded-[2px] border border-hairline px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-surface"
              >
                Activity log ({app.activity.length})
              </button>
              <button
                type="button"
                onClick={() => openFullApplication(app)}
                className="text-[12px] font-semibold text-pine hover:underline"
              >
                Open full application →
              </button>
              <Link href={`/cbo-preview/application/${app.id}`} className="text-[12px] font-semibold text-graphite hover:text-ink hover:underline">
                Printable draft →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Activity log — full-page takeover (chain of custody), with refresh. */}
      {showActivity && (
        <div role="dialog" aria-label={`Activity log — ${app.caseId}`} className="fixed inset-0 z-50 overflow-auto bg-paper">
          <div className="mx-auto max-w-4xl px-6 py-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <button type="button" onClick={() => setShowActivity(false)} className="text-[12px] font-medium text-pine hover:underline">
                  ← Back to caseload
                </button>
                <h2 className="text-[20px] font-bold tracking-tight text-ink mt-1">Activity log</h2>
                <p className="text-[12px] text-graphite">
                  {app.caseId} · {app.name} · {app.county} County · {app.activity.length} entries (newest first)
                </p>
              </div>
              <div className="flex items-center gap-3">
                {refreshedAt && <span className="text-[11px] tabular-nums text-graphite">Refreshed {refreshedAt}</span>}
                <button
                  type="button"
                  onClick={() => setRefreshedAt(nowStamp())}
                  className="inline-flex items-center gap-1.5 rounded-[2px] border border-hairline px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-surface"
                >
                  <span aria-hidden="true">↻</span> Refresh
                </button>
                <button
                  type="button"
                  aria-label="Close activity log"
                  onClick={() => setShowActivity(false)}
                  className="rounded-[2px] border border-hairline px-2.5 py-1 text-[11px] font-medium text-graphite hover:bg-surface"
                >
                  Close ✕
                </button>
              </div>
            </div>

            <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
              <table className="w-full border-collapse text-[12px]">
                <thead className="bg-surface-secondary">
                  <tr className="border-b border-hairline text-[11px] uppercase tracking-wider text-graphite">
                    <th className="w-10 px-3 py-2 text-left font-semibold">#</th>
                    <th className="w-[190px] px-3 py-2 text-left font-semibold">When</th>
                    <th className="w-[200px] px-3 py-2 text-left font-semibold">Who</th>
                    <th className="px-3 py-2 text-left font-semibold">Action taken</th>
                  </tr>
                </thead>
                <tbody>
                  {app.activity.map((e, i) => (
                    <tr key={`${e.ts}-${i}`} className="border-b border-hairline last:border-b-0 align-top">
                      <td className="px-3 py-2 tabular-nums text-graphite">{i + 1}</td>
                      <td className="px-3 py-2 tabular-nums text-graphite whitespace-nowrap">{e.ts}</td>
                      <td className="px-3 py-2 text-ink whitespace-nowrap">{e.actor}</td>
                      <td className="px-3 py-2 text-ink leading-snug">{e.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
    phases.flatMap((p) => p.cases).map((c) => ({ ...c, assignedTo: initialAssignee(c), comments: [], activity: seedActivity(c), pinned: false })),
  );

  const togglePin = (id: string) =>
    setCases((cs) => cs.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)));

  // Prepend chain-of-custody entries (newest-first), attributed to the signed-in
  // caseworker, with a full audit timestamp.
  const log = (c: CaseRecord, ...actions: string[]): ActivityEntry[] => [
    ...actions.map((action) => ({ ts: nowStamp(), actor: CURRENT_USER, action })),
    ...c.activity,
  ];

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
          activity: log(c, `Changed phase from "${phaseLabel(c.phase)}" to "${phaseLabel(np)}"; set stage to "${ADVANCE_STAGE[np]}"`),
        };
      }),
    );
  const transfer = (id: string, to: string) =>
    setCases((cs) =>
      cs.map((c) => (c.id === id && to !== c.assignedTo ? { ...c, assignedTo: to, activity: log(c, `Reassigned case from ${c.assignedTo} to ${to}`) } : c)),
    );
  const addComment = (id: string, text: string) =>
    setCases((cs) =>
      cs.map((c) =>
        c.id === id
          ? { ...c, comments: [{ author: CURRENT_USER, text, when: nowLabel() }, ...c.comments], activity: log(c, `Added comment: "${text}"`) }
          : c,
      ),
    );
  const logEdit = (id: string, changes: { question: string; from: string; to: string }[]) =>
    setCases((cs) =>
      cs.map((c) =>
        c.id === id ? { ...c, activity: log(c, ...changes.map((ch) => `Changed "${ch.question}" from "${ch.from}" to "${ch.to}"`)) } : c,
      ),
    );
  const logAction = (id: string, action: string) =>
    setCases((cs) => cs.map((c) => (c.id === id ? { ...c, activity: log(c, action) } : c)));

  // Regroup the live caseload by phase for rendering + funnel counts. Pinned
  // cases float to the top of their phase (stable sort preserves order otherwise).
  const grouped = useMemo<PhaseGroup[]>(
    () =>
      PHASES.map((p) => ({
        ...p,
        cases: cases
          .filter((c) => c.phase === p.key)
          .sort((a, b) => Number((b as CaseRecord).pinned) - Number((a as CaseRecord).pinned)),
      })),
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

      {/* Caseload-level §273.2 timeliness — interviews + processing-clock pressure. */}
      <TimelinessSummary cases={cases} />

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
          note="Benefit estimate + verification needs are computed by Civica's rules engine."
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
          <span className="shrink-0 w-4" aria-hidden="true" />
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
                  onTogglePin={() => togglePin(a.id)}
                  onLogAction={(action) => logAction(a.id, action)}
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
