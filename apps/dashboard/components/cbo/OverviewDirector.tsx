"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PhaseGroup, QueueApplication } from "../../lib/cbo/demo-pipeline";
import { PIPELINE_STEPS, formatUsd } from "../../lib/cbo/demo-pipeline";
import {
  PERIODS,
  PERIOD_LABEL,
  snapshotFor,
  rangeForPeriod,
  fmtRange,
  isoDate,
  reportDocument,
  type Period,
  type ReportData,
} from "../../lib/cbo/progress-report";
import TableExport from "./TableExport";

type Risk = "Low risk" | "Medium risk" | "High risk";

// A caseworker on the roster. Seeded from the constants below; editable +
// extendable at runtime (ephemeral demo — resets on reload).
type Caseworker = { name: string; email: string; phone: string; avgDays: number | null };

const TOTAL_STEPS = PIPELINE_STEPS.length;
function pct(n: number) { return Math.round((n / TOTAL_STEPS) * 100); }
function riskLabel(r: Risk) { return r === "High risk" ? "HIGH" : r === "Medium risk" ? "MED" : "LOW"; }
function riskText(r: Risk) { return r === "High risk" ? "text-brick font-semibold" : r === "Medium risk" ? "text-warning" : "text-muted"; }

// Which lifecycle bucket a case sits in — by stage, not just phase, so the
// interview (the single biggest denial cause) gets its own visible queue.
type CaseBucket = "pre" | "interview" | "submitted" | "closed";
function caseBucket(c: QueueApplication): CaseBucket {
  if (c.phase === "enrolled" || c.phase === "recert") return "closed";
  const s = c.stage.toLowerCase();
  if (s.includes("interview")) return "interview";
  if (s.includes("submitted")) return "submitted";
  return "pre"; // requesting + live, not yet filed
}

// #4 — navigator capacity ceiling (cases a caseworker can carry at once)
const CAPACITY = 20;

// Civica licenses by seat — the roster can hold up to this many caseworkers.
const LICENSED_SEATS = 8;

// #9 — synthetic avg days to handoff per navigator (illustrative)
const NAV_AVG_DAYS: Record<string, number> = {
  "A. Cole":   7,
  "J. Ruiz":   5,
  "L. Park":   9,
  "M. Diaz":   4,
  "R. Okafor": 6,
};

// Synthetic caseworker contact info, surfaced when a roster row is expanded.
const NAV_CONTACT: Record<string, { email: string; phone: string }> = {
  "A. Cole":   { email: "acole@civica.org",   phone: "(213) 555-0142" },
  "J. Ruiz":   { email: "jruiz@civica.org",   phone: "(619) 555-0188" },
  "L. Park":   { email: "lpark@civica.org",   phone: "(408) 555-0119" },
  "M. Diaz":   { email: "mdiaz@civica.org",   phone: "(559) 555-0173" },
  "R. Okafor": { email: "rokafor@civica.org", phone: "(510) 555-0164" },
};

// Trend delta — a single signed percent change. Up is good for apps; down is
// good for error rate and handoff days. A director wants "how much better,
// which direction," not a chart.
function TrendDelta({ pct, goodWhenUp, caption }: { pct: number; goodWhenUp: boolean; caption: string }) {
  const isUp = pct > 0;
  const isGood = goodWhenUp ? isUp : !isUp;
  return (
    <span className="mt-1 inline-flex items-center gap-1 text-[11px]">
      <span className={`font-semibold tabular-nums ${isGood ? "text-pine" : "text-warning"}`}>
        {isUp ? "↑" : "↓"} {Math.abs(pct)}%
      </span>
      <span className="text-muted">{caption}</span>
    </span>
  );
}

// Snapshot time-range options + the trend caption each one shows.
const SNAPSHOT_RANGES = ["Day", "Week", "Month", "YTD", "Year"] as const;
type SnapshotRange = typeof SNAPSHOT_RANGES[number];
const RANGE_CAPTION: Record<SnapshotRange, string> = {
  Day:   "vs yesterday",
  Week:  "vs last week",
  Month: "vs last month",
  YTD:   "vs last year",
  Year:  "vs prior year",
};

// Which direction is "good" for each metric (drives the green/orange color).
const GOOD_WHEN_UP = { apps: true, errorRate: false, handoff: false } as const;

// Per-range KPI figures (illustrative — synthetic caseload). Switching the
// range selector swaps all four numbers and their trend deltas. trendPct is
// signed: positive = up vs the prior comparable period. Benefits has no delta
// (just the total + household count). Month is the live-engine anchor; the
// component overrides Month's benefits with the real enrolled-case sum.
type KpiMetric = { value: string; trendPct: number };
const SNAPSHOT_DATA: Record<
  SnapshotRange,
  { apps: KpiMetric; errorRate: KpiMetric; handoff: KpiMetric; benefits: { usd: number; households: number } }
> = {
  Day:   { apps: { value: "1",   trendPct:  4 }, errorRate: { value: "4.5%", trendPct: -2  }, handoff: { value: "6d", trendPct: -3  }, benefits: { usd:   389, households:  1 } },
  Week:  { apps: { value: "6",   trendPct: 11 }, errorRate: { value: "4.3%", trendPct: -6  }, handoff: { value: "6d", trendPct: -8  }, benefits: { usd:   935, households:  2 } },
  Month: { apps: { value: "23",  trendPct: 28 }, errorRate: { value: "4.2%", trendPct: -31 }, handoff: { value: "6d", trendPct: -33 }, benefits: { usd:   935, households:  2 } },
  YTD:   { apps: { value: "187", trendPct: 35 }, errorRate: { value: "4.6%", trendPct: -22 }, handoff: { value: "7d", trendPct: -25 }, benefits: { usd: 11240, households: 24 } },
  Year:  { apps: { value: "271", trendPct: 52 }, errorRate: { value: "5.1%", trendPct: -38 }, handoff: { value: "8d", trendPct: -40 }, benefits: { usd: 14580, households: 31 } },
};

// ── Navigator initials avatar ─────────────────────────────────────────────────

function NavAvatar({ name }: { name: string }) {
  if (name === "Unassigned") {
    return (
      <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full border border-dashed border-hairline text-[11px] text-muted">
        ?
      </span>
    );
  }
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-pine/10 text-pine text-[11px] font-semibold">
      {initials}
    </span>
  );
}

// ── Navigator roster row ──────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
      className={`shrink-0 text-graphite transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// Assign-to dropdown — pick an approved caseworker to take an unassigned case.
function AssignMenu({ workers, onAssign }: { workers: string[]; onAssign: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-[2px] bg-pine px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-pine-pressed transition-colors"
      >
        Assign <span aria-hidden="true" className="text-[9px]">▾</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-10 mt-1 w-48 rounded-[2px] border border-hairline bg-surface shadow-sm py-1 max-h-64 overflow-auto">
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-graphite">Assign to caseworker</p>
          {workers.length > 0 ? (
            workers.map((w) => (
              <button
                key={w}
                type="button"
                role="menuitem"
                onClick={() => { onAssign(w); setOpen(false); }}
                className="block w-full px-3 py-1.5 text-left text-[13px] text-ink hover:bg-paper"
              >
                {w}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-[12px] text-muted">No caseworkers yet — add one in the roster.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Inline "add caseworker" form — shown in the roster when managing. Gated by
// the CBO's remaining licensed seats; when full it shows a buy-more prompt.
function AddCaseworkerRow({ onAdd, seatsLeft }: { onAdd: (cw: Caseworker) => void; seatsLeft: number }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const cls = "px-2 py-1 text-[13px] bg-surface border border-hairline rounded-[2px] text-ink placeholder:text-muted focus:outline-none focus:border-pine";
  function submit() {
    const n = name.trim();
    if (!n || seatsLeft <= 0) return;
    onAdd({ name: n, email: email.trim(), phone: phone.trim(), avgDays: null });
    setName(""); setEmail(""); setPhone("");
  }
  if (seatsLeft <= 0) {
    return (
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-hairline bg-paper/60">
        <span className="text-[12px] text-graphite">All licensed seats are filled. Remove a caseworker to free a seat, or contact Civica to add seats.</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-hairline bg-paper/60">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-dashed border-hairline text-[13px] text-muted shrink-0" aria-hidden="true">+</span>
      <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Name (e.g. T. Nguyen)" aria-label="New caseworker name" className={`${cls} w-40`} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="email@civica.org" aria-label="New caseworker email" className={`${cls} w-48`} />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="(555) 555-0100" aria-label="New caseworker phone" className={`${cls} w-36`} />
      <button
        type="button"
        onClick={submit}
        disabled={!name.trim()}
        className="ml-auto inline-flex items-center rounded-[2px] bg-pine px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-pine-pressed disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Add caseworker
        <span className="ml-1.5 text-[11px] font-normal text-white/80">{seatsLeft} seat{seatsLeft !== 1 ? "s" : ""} left</span>
      </button>
    </div>
  );
}

// Inline-editable contact field (ephemeral demo — edits reset on reload, never
// persisted). Click the pencil to edit; Enter or blur saves, Escape cancels.
function EditableField({
  label, value, type, onSave, alwaysEdit = false,
}: {
  label: string;
  value: string;
  type: "email" | "tel" | "text";
  onSave: (v: string) => void;
  alwaysEdit?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  function commit() {
    onSave(draft.trim() || value);
    setEditing(false);
  }
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1">{label}</p>
      {editing ? (
        <input
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          className="w-52 max-w-full px-2 py-1 text-[13px] bg-surface border border-pine rounded-[2px] text-ink focus:outline-none"
          aria-label={`Edit ${label.toLowerCase()}`}
        />
      ) : (
        <div className="group flex items-center gap-1.5">
          <span className="text-[13px] text-ink truncate">{value}</span>
          <button
            type="button"
            onClick={() => { setDraft(value); setEditing(true); }}
            aria-label={`Edit ${label.toLowerCase()}`}
            title="Edit"
            className={`shrink-0 transition-opacity text-graphite hover:text-pine ${alwaysEdit ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9.5 2.5l2 2L5 11l-2.5.5L3 9l6.5-6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function NavigatorRow({
  worker, cases, border, managing, onUpdate, onRemove,
}: {
  worker: Caseworker;
  cases: QueueApplication[];
  border: boolean;
  managing: boolean;
  onUpdate: (patch: Partial<Caseworker>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const name = worker.name;
  // Case-level work signals (NOT a judgment on the caseworker): how many of
  // their cases are waiting on documents, and how many have an interview to prep.
  const awaitingDocs = cases.filter((c) => c.docFlags.length > 0).length;
  const awaitingInterview = cases.filter((c) => caseBucket(c) === "interview").length;
  const avgDays = worker.avgDays;

  // #4 capacity bar — share of the caseworker's case ceiling
  const utilPct = Math.min((cases.length / CAPACITY) * 100, 100);
  const utilColor = utilPct >= 80 ? "bg-brick" : utilPct >= 60 ? "bg-warning" : "bg-pine/50";

  const exportRows = cases.map((c) => [
    name,
    c.caseId,
    c.name,
    `${c.county} County, CA`,
    c.stage,
    `${pct(c.completedSteps)}%`,
    c.estimatedBenefitUsd != null ? formatUsd(c.estimatedBenefitUsd) : "—",
    String(c.docFlags.length),
    riskLabel(c.risk),
  ]);

  return (
    <div className={border ? "border-t border-hairline" : ""}>
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper transition-colors">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
        >
          <NavAvatar name={name} />
          <span className="text-[14px] font-semibold leading-none text-ink">{name}</span>
          <Chevron open={open} />
        </button>

        {/* #4 cases + capacity bar */}
        <span className="shrink-0 w-28 flex items-center justify-end gap-2">
          <span className="text-[13px] tabular-nums text-ink">
            {cases.length}<span className="text-graphite text-[12px]">/{CAPACITY}</span>
          </span>
          <span className="w-14 h-1.5 rounded-full bg-surface-secondary overflow-hidden">
            <span className={`block h-full rounded-full transition-all ${utilColor}`} style={{ width: `${utilPct}%` }} />
          </span>
        </span>

        {/* Needs docs — cases waiting on a document follow-up (work to do, not a ding) */}
        <span className={`shrink-0 w-20 text-right text-[13px] tabular-nums ${awaitingDocs > 0 ? "text-warning font-medium" : "text-muted"}`}>
          {awaitingDocs > 0 ? awaitingDocs : "—"}
        </span>

        {/* Interview — cases with an interview to prep the client for (#1 denial cause) */}
        <span className={`shrink-0 w-20 text-right text-[13px] tabular-nums ${awaitingInterview > 0 ? "text-warning font-medium" : "text-muted"}`}>
          {awaitingInterview > 0 ? awaitingInterview : "—"}
        </span>

        {/* #9 avg days to handoff */}
        <span className="shrink-0 w-16 text-right">
          {avgDays != null ? (
            <span className="text-[13px] tabular-nums text-graphite">{avgDays}d</span>
          ) : (
            <span className="text-[12px] text-muted">—</span>
          )}
        </span>

        <div className="shrink-0 w-28 flex justify-end">
          {cases.length > 0 ? (
            <TableExport
              filename={`progress-${name.toLowerCase().replace(/[\s.]/g, "-")}`}
              title={`Progress report — ${name}`}
              columns={["Navigator", "Case ID", "Applicant", "County", "Stage", "Completion", "Est. benefit", "Flags", "Risk"]}
              rows={exportRows}
              note={`Progress report for navigator ${name}. Benefit estimate and verification needs are computed by Civica's rules engine.`}
            />
          ) : (
            <span className="text-[11px] text-muted">no cases</span>
          )}
        </div>
      </div>

      {/* Expanded: caseworker contact (editable) + cases they're handling */}
      {open && (
        <div className="px-4 pb-4 pt-3 bg-paper/60 border-t border-hairline">
          <div className="rounded-[3px] border border-hairline bg-surface px-4 py-3 mb-3 flex flex-wrap items-start gap-x-10 gap-y-3">
            <EditableField
              label="Name"
              type="text"
              value={worker.name}
              onSave={(v) => onUpdate({ name: v })}
              alwaysEdit={managing}
            />
            <EditableField
              label="Email"
              type="email"
              value={worker.email}
              onSave={(v) => onUpdate({ email: v })}
              alwaysEdit={managing}
            />
            <EditableField
              label="Phone"
              type="tel"
              value={worker.phone}
              onSave={(v) => onUpdate({ phone: v })}
              alwaysEdit={managing}
            />
            {avgDays != null && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1">Avg to handoff</p>
                <p className="text-[13px] text-ink tabular-nums">{avgDays} days</p>
              </div>
            )}
            {managing && (
              <button
                type="button"
                onClick={onRemove}
                className="ml-auto self-center text-[12px] font-medium text-brick hover:underline"
              >
                Remove caseworker
              </button>
            )}
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1.5">
            Handling {cases.length} case{cases.length !== 1 ? "s" : ""}
          </p>
          <div className="rounded-[3px] border border-hairline bg-surface overflow-hidden">
            {cases.length > 0 ? (
              cases.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/cbo-preview/application/${c.id}`}
                  className={`flex items-center gap-3 px-3 py-2 text-[12px] hover:bg-paper transition-colors ${i > 0 ? "border-t border-hairline" : ""}`}
                >
                  <span className="font-mono tabular-nums text-graphite w-[96px] shrink-0 whitespace-nowrap">{c.caseId}</span>
                  <span className="font-semibold text-ink w-[88px] shrink-0 truncate">{c.name}</span>
                  <span className="text-graphite flex-1 min-w-0 truncate">{c.stage}</span>
                  {c.docFlags.length > 0 && (
                    <span className="text-[11px] text-brick font-semibold tabular-nums shrink-0">{c.docFlags.length} flag{c.docFlags.length > 1 ? "s" : ""}</span>
                  )}
                  <span className={`text-[10px] uppercase tracking-wider shrink-0 w-[34px] text-right ${riskText(c.risk)}`}>{riskLabel(c.risk)}</span>
                </Link>
              ))
            ) : (
              <p className="px-3 py-3 text-[12px] text-muted">No cases assigned yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Case row (flat table, no expand) ─────────────────────────────────────────

function CaseRow({ app, border }: { app: QueueApplication; border: boolean }) {
  const completion = pct(app.completedSteps);
  const enrolled = app.phase === "enrolled";
  const flags = app.docFlags.length;

  return (
    <Link
      href={`/cbo-preview/application/${app.id}`}
      className={`flex items-center gap-3 px-4 py-2 hover:bg-paper transition-colors ${border ? "border-t border-hairline" : ""}`}
    >
      <span className="text-[11px] text-graphite font-mono tabular-nums tracking-tight shrink-0 w-[88px]">{app.caseId}</span>
      <span className="text-[13px] font-semibold text-ink shrink-0 w-[84px] truncate">{app.name}</span>
      <span className="text-[12px] text-graphite shrink-0 w-[80px] truncate hidden md:block">{app.navigator}</span>
      <span className="text-[12px] text-graphite shrink-0 w-[96px] truncate hidden sm:block">{app.county} County</span>
      <span className="text-[12px] text-ink flex-1 min-w-0 truncate">{app.stage}</span>
      <span className="hidden lg:flex items-center justify-end shrink-0 w-[112px]">
        {enrolled && app.estimatedBenefitUsd !== null ? (
          <span className="text-[12px] tabular-nums text-ink font-medium">{formatUsd(app.estimatedBenefitUsd)}/mo</span>
        ) : (
          <span className="flex items-center gap-2 w-full">
            {/* Progress = neutral graphite (how far along). Risk lives in its
                own column — a full bar shouldn't read as a warning. */}
            <span className="h-1.5 flex-1 rounded-full bg-surface-secondary overflow-hidden">
              <span className="block h-full rounded-full bg-graphite" style={{ width: `${completion}%` }} />
            </span>
            <span className="text-[11px] tabular-nums text-graphite w-[28px] text-right">{completion}%</span>
          </span>
        )}
      </span>
      <span className="shrink-0 w-[52px] text-right">
        {flags > 0 ? (
          <span className="text-[11px] font-semibold text-brick tabular-nums">{flags} flag{flags > 1 ? "s" : ""}</span>
        ) : (
          <span className="text-[11px] text-muted">clean</span>
        )}
      </span>
      <span className={`text-[11px] uppercase tracking-wider shrink-0 w-[32px] text-right ${riskText(app.risk)}`}>
        {riskLabel(app.risk)}
      </span>
    </Link>
  );
}

// ── Collapsible caseload category ─────────────────────────────────────────────
// A broad bucket (Active / Enrolled & closed) the director opens on demand.
// Collapsed, the header still carries the at-a-glance summary (count, flags,
// high-risk) so it's informative without expanding.

function CaseCategory({
  label, blurb, cases, defaultOpen,
}: {
  label: string;
  blurb: string;
  cases: QueueApplication[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const flags = cases.reduce((s, c) => s + c.docFlags.length, 0);
  const high = cases.filter((c) => c.risk === "High risk").length;

  return (
    <div className="border border-hairline rounded-[3px] bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-paper transition-colors"
      >
        <Chevron open={open} />
        <span className="text-[14px] font-semibold text-ink shrink-0">{label}</span>
        <span className="text-[12px] text-graphite truncate hidden sm:block">{blurb}</span>
        <span className="flex-1" />
        <span className="text-[13px] tabular-nums text-ink shrink-0">{cases.length} case{cases.length !== 1 ? "s" : ""}</span>
        {flags > 0 && (
          <span className="text-[12px] text-brick font-medium tabular-nums shrink-0">{flags} flag{flags !== 1 ? "s" : ""}</span>
        )}
        {high > 0 && (
          <span className="text-[11px] uppercase tracking-wider text-brick font-semibold shrink-0">{high} high</span>
        )}
      </button>

      {open && (
        <div className="border-t border-hairline">
          {cases.length > 0 ? (
            <>
              {/* Column headers */}
              <div className="flex items-center gap-3 px-4 py-1.5 bg-surface-secondary border-b border-hairline text-[10px] font-semibold uppercase tracking-wider text-graphite">
                <span className="shrink-0 w-[88px]">Case ID</span>
                <span className="shrink-0 w-[84px]">Applicant</span>
                <span className="shrink-0 w-[80px] hidden md:block">Navigator</span>
                <span className="shrink-0 w-[96px] hidden sm:block">County</span>
                <span className="flex-1 min-w-0">Stage</span>
                <span className="shrink-0 w-[112px] hidden lg:block text-right">Progress / Benefit</span>
                <span className="shrink-0 w-[52px] text-right">Flags</span>
                <span className="shrink-0 w-[32px] text-right">Risk</span>
              </div>
              {cases.map((app, i) => (
                <CaseRow key={app.id} app={app} border={i > 0} />
              ))}
            </>
          ) : (
            <p className="px-4 py-6 text-[13px] text-muted text-center">No cases in this category.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Animated count-up for the Snapshot numbers ───────────────────────────────
// Tween toward `target` with an ease-out curve; resumes smoothly if the target
// changes mid-flight, honors prefers-reduced-motion, and is SSR-safe (initial
// state == target, so the server renders the final figure).
function useCountUp(target: number, duration = 650): number {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    const to = target;
    if (reduce || from === to) {
      fromRef.current = to;
      setVal(to);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const cur = from + (to - from) * ease(p);
      fromRef.current = cur;
      setVal(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        fromRef.current = to;
        setVal(to);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// Animate a pre-formatted KPI string ("187", "4.6%", "7d", "$1,234"): parse the
// numeric token, animate it, and re-emit with the same prefix / suffix / decimals
// + thousands grouping. Non-numeric values render verbatim.
function CountUpText({ value, className }: { value: string; className?: string }) {
  const match = value.match(/^(\D*)([\d,]+(?:\.\d+)?)(\D*)$/);
  const numStr = match ? match[2] : "";
  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
  const target = match ? parseFloat(numStr.replace(/,/g, "")) : 0;
  const v = useCountUp(target);
  if (!match) return <span className={className}>{value}</span>;
  const formatted = v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span className={`tabular-nums ${className ?? ""}`}>
      {match[1]}
      {formatted}
      {match[3]}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OverviewDirector({
  phases,
  synthetic,
}: {
  phases: PhaseGroup[];
  synthetic: boolean;
}) {
  const [snapshotRange, setSnapshotRange] = useState<SnapshotRange>("Month");
  const [managing, setManaging] = useState(false);

  // Roster of approved caseworkers — seeded from the constants, editable +
  // extendable at runtime (ephemeral). Assignments override a case's navigator.
  const [caseworkers, setCaseworkers] = useState<Caseworker[]>(() =>
    Object.keys(NAV_CONTACT).map((name) => ({
      name,
      email: NAV_CONTACT[name].email,
      phone: NAV_CONTACT[name].phone,
      avgDays: NAV_AVG_DAYS[name] ?? null,
    })),
  );
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const allCases = useMemo(() => phases.flatMap((p) => p.cases), [phases]);

  // Apply ephemeral dispatch assignments on top of the seeded navigator.
  const effectiveCases = useMemo(
    () => allCases.map((c) => (assignments[c.id] ? { ...c, navigator: assignments[c.id] } : c)),
    [allCases, assignments],
  );

  // #8 unassigned dispatch
  const unassignedCases = useMemo(
    () => effectiveCases.filter((c) => c.navigator === "Unassigned"),
    [effectiveCases],
  );

  // ── Caseworker management handlers (all ephemeral) ──
  const assignCase = (caseId: string, name: string) =>
    setAssignments((a) => ({ ...a, [caseId]: name }));

  const addCaseworker = (cw: Caseworker) =>
    setCaseworkers((prev) =>
      prev.length >= LICENSED_SEATS || prev.some((p) => p.name === cw.name) ? prev : [...prev, cw],
    );

  const updateCaseworker = (name: string, patch: Partial<Caseworker>) => {
    // Renaming a caseworker must follow their cases — remap any assignment
    // pointing at the old name so their caseload doesn't vanish.
    if (patch.name && patch.name !== name) {
      const newName = patch.name;
      setAssignments((a) => {
        const out = { ...a };
        for (const c of effectiveCases) if (c.navigator === name) out[c.id] = newName;
        return out;
      });
    }
    setCaseworkers((prev) => prev.map((cw) => (cw.name === name ? { ...cw, ...patch } : cw)));
  };

  const removeCaseworker = (name: string) => {
    // Their cases fall back to unassigned (reappear in Needs dispatch).
    setAssignments((a) => {
      const out = { ...a };
      for (const c of effectiveCases) if (c.navigator === name) out[c.id] = "Unassigned";
      return out;
    });
    setCaseworkers((prev) => prev.filter((cw) => cw.name !== name));
  };

  // #3 benefits enrolled this month
  const enrolledCases = useMemo(
    () => phases.find((p) => p.key === "enrolled")?.cases ?? [],
    [phases],
  );
  const totalBenefitUsd = enrolledCases.reduce((s, c) => s + (c.estimatedBenefitUsd ?? 0), 0);
  const enrolledWithBenefit = enrolledCases.filter((c) => c.estimatedBenefitUsd != null).length;

  // Snapshot KPIs for the selected range. Month is anchored to the live engine
  // sum of enrolled benefits; other ranges are illustrative synthetic figures.
  const snap = SNAPSHOT_DATA[snapshotRange];
  const caption = RANGE_CAPTION[snapshotRange];
  const benefits =
    snapshotRange === "Month"
      ? { usd: totalBenefitUsd, households: enrolledWithBenefit }
      : snap.benefits;

  // Caseworker → their (effective) cases. Sorted alphabetically; keeps zero-case
  // caseworkers visible so the roster reflects the team, not just who has work.
  const sortedWorkers = useMemo(
    () => [...caseworkers].sort((a, b) => a.name.localeCompare(b.name)),
    [caseworkers],
  );
  const casesByWorker = useMemo(() => {
    const m = new Map<string, QueueApplication[]>();
    for (const cw of caseworkers) m.set(cw.name, []);
    for (const c of effectiveCases) {
      if (c.navigator !== "Unassigned" && m.has(c.navigator)) m.get(c.navigator)!.push(c);
    }
    return m;
  }, [caseworkers, effectiveCases]);

  // Caseload sorted by lifecycle bucket the director opens on demand. The two
  // pre-county stages — pre-submission and awaiting-interview — lead and open by
  // default, because that's where a CBO can still change the outcome.
  const caseCategories = useMemo(() => {
    const byRisk = (a: QueueApplication, b: QueueApplication) => {
      const order: Record<Risk, number> = { "High risk": 0, "Medium risk": 1, "Low risk": 2 };
      return order[a.risk] - order[b.risk];
    };
    const inBucket = (b: CaseBucket) => effectiveCases.filter((c) => caseBucket(c) === b).sort(byRisk);
    return [
      { key: "pre",       label: "Pre-submission",      blurb: "Not yet filed — needs documents or review", cases: inBucket("pre"),       defaultOpen: true  },
      { key: "interview", label: "Awaiting interview",  blurb: "Interview scheduled — prep the client",       cases: inBucket("interview"), defaultOpen: true  },
      { key: "submitted", label: "Submitted to county", blurb: "Filed — awaiting the county decision",        cases: inBucket("submitted"), defaultOpen: false },
      { key: "closed",    label: "Enrolled & closed",   blurb: "Receiving benefits, recertifying, or closed", cases: inBucket("closed"),    defaultOpen: false },
    ];
  }, [effectiveCases]);

  // Caseload-level signals for the roster summary — framed as cases, not as a
  // tally against the caseworkers.
  const casesAwaitingDocs = effectiveCases.filter((c) => c.docFlags.length > 0).length;
  const casesAwaitingInterview = effectiveCases.filter((c) => caseBucket(c) === "interview").length;

  const allExportRows = effectiveCases.map((c) => [
    c.navigator ?? "Unassigned",
    c.caseId,
    c.name,
    `${c.county} County, CA`,
    c.stage,
    `${pct(c.completedSteps)}%`,
    c.estimatedBenefitUsd != null ? formatUsd(c.estimatedBenefitUsd) : "—",
    String(c.docFlags.length),
    riskLabel(c.risk),
  ]);

  // ── Progress report (period or custom range → PDF / Word .doc) ──
  const [reportPeriod, setReportPeriod] = useState<Period | "custom">("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const buildReportData = (): ReportData => {
    const now = new Date();
    let periodLabel: string;
    let rangeLabel: string;
    let snapData;
    if (reportPeriod === "custom") {
      const from = customFrom ? new Date(`${customFrom}T00:00:00`) : now;
      const to = customTo ? new Date(`${customTo}T00:00:00`) : now;
      periodLabel = "Custom range";
      rangeLabel = fmtRange(from, to);
      snapData = snapshotFor("month", totalBenefitUsd);
    } else {
      const { from, to } = rangeForPeriod(reportPeriod, now);
      periodLabel = PERIOD_LABEL[reportPeriod];
      rangeLabel = fmtRange(from, to);
      snapData = snapshotFor(reportPeriod, totalBenefitUsd);
    }
    return {
      periodLabel,
      rangeLabel,
      generatedAt: isoDate(now),
      snapshot: snapData,
      phases: phases.map((p) => ({ label: p.label, count: p.cases.length })),
      // Case-level work signals per caseworker — mirrors the on-screen roster
      // (Needs docs / Interview), not a flag/risk scorecard on the caseworker.
      navigators: sortedWorkers.map((cw) => {
        const cs = casesByWorker.get(cw.name) ?? [];
        return {
          name: cw.name,
          cases: cs.length,
          needsDocs: cs.filter((c) => c.docFlags.length > 0).length,
          interview: cs.filter((c) => caseBucket(c) === "interview").length,
          avgDays: cw.avgDays,
        };
      }),
      totals: {
        cases: effectiveCases.length,
        awaitingDocs: effectiveCases.filter((c) => c.docFlags.length > 0).length,
        benefitsUsd: totalBenefitUsd,
      },
    };
  };

  const downloadWordReport = () => {
    const html = reportDocument(buildReportData(), { forWord: true });
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `civica-progress-report-${reportPeriod}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const openPdfReport = () => {
    const w = window.open("", "_blank", "width=880,height=1000");
    if (!w) {
      alert("Couldn't open the report — allow pop-ups for this site, then try again.");
      return;
    }
    w.document.write(reportDocument(buildReportData(), { forWord: false }));
    w.document.close();
  };

  return (
    <div className="space-y-8">

      {/* ── KPI hero — the Snapshot ── #1 #3
          The hero block: larger numbers, more breathing room, the heaviest
          thing on the page. No "vs manual" pitch framing — a director running
          the program doesn't need re-selling daily. The range selector picks
          the period; numbers are illustrative (synthetic caseload). */}
      <section aria-label="Snapshot">
        <div className="flex items-center justify-between mb-3">
          <p className="eyebrow">Snapshot</p>
          <div className="inline-flex items-center rounded-[2px] border border-hairline overflow-hidden" role="group" aria-label="Snapshot period">
            {SNAPSHOT_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSnapshotRange(r)}
                aria-pressed={snapshotRange === r}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${r !== "Day" ? "border-l border-hairline" : ""} ${
                  snapshotRange === r ? "bg-ink/8 text-ink" : "text-graphite hover:bg-ink/5"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-stretch border border-hairline rounded-[3px] bg-surface overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {/* Apps per navigator */}
          <div className="flex-1 px-6 py-5 flex flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Apps / navigator</p>
            <CountUpText value={snap.apps.value} className="text-[34px] font-semibold text-ink leading-none mt-2 block" />
            <TrendDelta pct={snap.apps.trendPct} goodWhenUp={GOOD_WHEN_UP.apps} caption={caption} />
          </div>
          {/* Error rate */}
          <div className="flex-1 px-6 py-5 border-l border-hairline flex flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Error rate</p>
            <CountUpText value={snap.errorRate.value} className="text-[34px] font-semibold text-ink leading-none mt-2 block" />
            <TrendDelta pct={snap.errorRate.trendPct} goodWhenUp={GOOD_WHEN_UP.errorRate} caption={caption} />
          </div>
          {/* Avg handoff */}
          <div className="flex-1 px-6 py-5 border-l border-hairline flex flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Time to handoff</p>
            <CountUpText value={snap.handoff.value} className="text-[34px] font-semibold text-ink leading-none mt-2 block" />
            <TrendDelta pct={snap.handoff.trendPct} goodWhenUp={GOOD_WHEN_UP.handoff} caption={caption} />
          </div>
          {/* Benefits enrolled — Month is live from engine; other ranges illustrative */}
          <div className="flex-1 px-6 py-5 border-l border-hairline flex flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Benefits enrolled</p>
            {benefits.usd > 0 ? (
              <>
                <CountUpText value={formatUsd(benefits.usd)} className="text-[34px] font-semibold text-ink leading-none mt-2 block" />
                <span className="mt-1.5 text-[11px] text-muted">
                  /mo · {benefits.households} household{benefits.households !== 1 ? "s" : ""}
                </span>
              </>
            ) : (
              <span className="text-[20px] font-semibold text-muted mt-2">—</span>
            )}
          </div>
        </div>

        {/* ── Generate progress report (period or custom range → PDF / Word) ── */}
        <div className="mt-3 rounded-[2px] border border-hairline bg-surface px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Generate progress report</p>
            <div role="tablist" aria-label="Report range" className="inline-flex items-center rounded-[2px] border border-hairline p-0.5">
              {PERIODS.map((p) => {
                const active = reportPeriod === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setReportPeriod(p.key)}
                    className={`rounded-[2px] px-2.5 py-1 text-[12px] font-semibold transition-colors ${active ? "bg-ink text-white" : "text-graphite hover:bg-surface-secondary"}`}
                  >
                    {p.label}
                  </button>
                );
              })}
              <button
                type="button"
                role="tab"
                aria-selected={reportPeriod === "custom"}
                onClick={() => setReportPeriod("custom")}
                className={`rounded-[2px] px-2.5 py-1 text-[12px] font-semibold transition-colors ${reportPeriod === "custom" ? "bg-ink text-white" : "text-graphite hover:bg-surface-secondary"}`}
              >
                Custom
              </button>
            </div>

            {reportPeriod === "custom" && (
              <div className="flex items-center gap-2 text-[12px] text-graphite">
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  aria-label="Report start date"
                  className="rounded-[2px] border border-hairline bg-surface px-2 py-1 text-ink focus:border-pine focus:outline-none"
                />
                <span aria-hidden="true">–</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => setCustomTo(e.target.value)}
                  aria-label="Report end date"
                  className="rounded-[2px] border border-hairline bg-surface px-2 py-1 text-ink focus:border-pine focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={openPdfReport}
                className="inline-flex items-center gap-1.5 rounded-[2px] bg-pine px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-pine-pressed"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={downloadWordReport}
                className="inline-flex items-center gap-1.5 rounded-[2px] border border-hairline bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-paper"
              >
                Download Word
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Exports the snapshot, caseload-by-phase, and caseworker roster for the selected range. Benefit + error-rate figures are engine-computed.
          </p>
        </div>
      </section>

      {/* ── Needs dispatch — dedicated unassigned-applications queue ──
          The director's most actionable daily task: assign a caseworker to
          applications that have none. Surfaced as its own section (not a chip)
          so it's impossible to miss. Hidden when everything is assigned. */}
      {synthetic && unassignedCases.length > 0 && (
        <section aria-label="Needs dispatch">
          <div className="flex items-baseline justify-between mb-3">
            <p className="eyebrow">Needs dispatch</p>
            <span className="text-[12px] text-warning font-medium">
              {unassignedCases.length} application{unassignedCases.length !== 1 ? "s" : ""} without a caseworker
            </span>
          </div>
          <div className="border border-warning/30 rounded-[3px] bg-warning/[0.04]">
            {unassignedCases.map((c, i) => (
              <div
                key={c.id}
                className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-warning/15" : ""}`}
              >
                <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full border border-dashed border-warning/40 text-[11px] text-warning" aria-hidden="true">?</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-ink">{c.name}</span>
                    <span className="text-[11px] text-graphite font-mono tabular-nums">{c.caseId}</span>
                    <span className="text-[12px] text-graphite">· {c.county} County</span>
                  </div>
                  <p className="text-[12px] text-graphite mt-0.5">{c.stage} · waiting {c.updated}</p>
                </div>
                <AssignMenu
                  workers={sortedWorkers.map((w) => w.name)}
                  onAssign={(name) => assignCase(c.id, name)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Navigator roster ── */}
      {synthetic && (
        <section aria-label="Navigator roster">
          <div className="flex items-center justify-between mb-3 gap-3">
            <p className="eyebrow">Caseworker roster</p>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-graphite">
                <span className={caseworkers.length >= LICENSED_SEATS ? "text-warning font-medium" : ""}>
                  {caseworkers.length} of {LICENSED_SEATS} seats
                </span>
                {casesAwaitingDocs > 0 && (
                  <> · <span className="text-warning font-medium">{casesAwaitingDocs} awaiting docs</span></>
                )}
                {casesAwaitingInterview > 0 && (
                  <> · <span className="text-warning font-medium">{casesAwaitingInterview} interview{casesAwaitingInterview !== 1 ? "s" : ""}</span></>
                )}
              </span>
              <button
                type="button"
                onClick={() => setManaging((m) => !m)}
                aria-pressed={managing}
                aria-label="Manage caseworkers"
                title="Manage caseworkers"
                className={`inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-1 text-[11px] font-medium transition-colors ${
                  managing ? "border-pine/40 bg-pine/8 text-pine" : "border-hairline text-graphite hover:bg-ink/5"
                }`}
              >
                <GearIcon />
                {managing ? "Done" : "Manage seats"}
              </button>
            </div>
          </div>
          {managing && (
            <p className="text-[12px] text-graphite mb-2">
              Click a caseworker to edit their name, email, or phone. Remove one to free a seat, or add one while seats remain.
              <span className="text-muted"> Civica licenses {LICENSED_SEATS} seats for this CBO.</span>
            </p>
          )}
          <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-1.5 bg-surface-secondary border-b border-hairline text-[10px] font-semibold uppercase tracking-wider text-graphite">
              <span className="flex-1">Caseworker</span>
              <span className="w-28 text-right">Workload</span>
              <span className="w-20 text-right">Needs docs</span>
              <span className="w-20 text-right">Interview</span>
              <span className="w-16 text-right">Avg days</span>
              <span className="w-28 text-right">Progress report</span>
            </div>
            {sortedWorkers.map((cw, i) => (
              <NavigatorRow
                key={cw.name}
                worker={cw}
                cases={casesByWorker.get(cw.name) ?? []}
                border={i > 0}
                managing={managing}
                onUpdate={(patch) => updateCaseworker(cw.name, patch)}
                onRemove={() => removeCaseworker(cw.name)}
              />
            ))}
            {managing && <AddCaseworkerRow onAdd={addCaseworker} seatsLeft={LICENSED_SEATS - caseworkers.length} />}
          </div>
        </section>
      )}

      {/* ── Active caseload ── */}
      {synthetic && (
        <section id="active-caseload" aria-label="Active caseload">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <p className="eyebrow">Caseload</p>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-graphite">{allCases.length} cases</span>
              <TableExport
                filename="cbo-caseload-all"
                title="CBO caseload — all applications"
                columns={["Navigator", "Case ID", "Applicant", "County", "Stage", "Completion", "Est. benefit", "Flags", "Risk"]}
                rows={allExportRows}
                note="Benefit estimates are computed by Civica's rules engine."
              />
            </div>
          </div>

          <div className="space-y-3">
            {caseCategories.map((cat) => (
              <CaseCategory key={cat.key} label={cat.label} blurb={cat.blurb} cases={cat.cases} defaultOpen={cat.defaultOpen} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
