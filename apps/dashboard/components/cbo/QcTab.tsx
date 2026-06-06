"use client";

// QC tab for the CBO preview demo. Client component so it can offer three
// comprehension aids a prospective CBO asked for:
//   1. A collapsible "How the engine works" panel (default closed → less dense),
//      containing a visual applicant → engine → navigator → county flow.
//   2. A plain-language toggle that swaps SNAP/OBBBA jargon for plain words
//      across the whole tab (expert view stays one click away).
// Demo data is synthetic (labelled at the foot of the tab).

import { Fragment, useState } from "react";
import { CA_BASELINE_PER, PROJECTED_PER_AT_FULL_ENGAGEMENT } from "@civica/snap-qc-engine";
import InfoTip from "../InfoTip";
import FlagSensitivityControl from "./FlagSensitivityControl";

// CA baseline + projected PER are the engine's published constants (USDA FNS-380
// baseline; modeled projection at full engagement), not hand-typed numbers — so
// the demo can never contradict the engine (#507) and never implies a measured
// cohort PER that doesn't exist yet.
const CA_BASELINE = CA_BASELINE_PER;

const DEMO_QC = {
  per: PROJECTED_PER_AT_FULL_ENGAGEMENT,
  obbbaReady: 94,
  pillars: [
    {
      label: "Income verification", pass: 96, fail: 4,
      note: "§10104 threshold", notePlain: "income reporting",
      tip: "Wages, self-employment, and unearned income checked against the §10104 reporting threshold. The most common QC error category nationally.",
    },
    {
      label: "Household composition", pass: 98, fail: 2,
      note: "Citizenship + residency", notePlain: "who's in the home",
      tip: "Who counts in the household — citizenship, residency, and members added or removed mid-period. Drives household size and the benefit amount.",
    },
    {
      label: "Work requirements", pass: 91, fail: 9,
      note: "ABAWD + §10108 exemptions", notePlain: "work rules + exemptions",
      tip: "ABAWD time limits and §10108 exemptions under the 2025 rules. Wrongly applied exemptions are a frequent audit finding.",
    },
    {
      label: "Deduction calculation", pass: 89, fail: 11,
      note: "SUA + shelter", notePlain: "utilities + rent",
      tip: "Standard Utility Allowance tier and shelter costs. The highest-error pillar — a small SUA tier mistake moves the benefit a lot.",
    },
  ],
  recentFlags: [
    { id: "QC-0041", field: "Gross income", issue: "Self-employment income missing quarterly average", status: "Open" },
    { id: "QC-0040", field: "Shelter deduction", issue: "Rent amount exceeds SUA cap without documentation", status: "Resolved" },
    { id: "QC-0039", field: "Household size", issue: "Household member added mid-period, proration needed", status: "Open" },
  ],
} as const;

// The applicant → county journey, for the visual flow inside the explainer.
const FLOW = [
  { label: "Applicant", caption: "applies on phone or web" },
  { label: "Civica engine", caption: "checks against the rules" },
  { label: "Navigator", caption: "fixes flagged issues" },
  { label: "County", caption: "gets a clean packet" },
] as const;

const HOW_STEPS = [
  {
    head: "1 · Checks every packet",
    body: "Runs each application through the same rule checks a county reviewer uses — income, household, work rules, deductions — the moment it's entered.",
  },
  {
    head: "2 · Reaches people where they are",
    body: "Households apply on their phone or the web, or a navigator enters it with them. Likely errors land in the navigator's queue as flags — not in a denial letter weeks later.",
  },
  {
    head: "3 · Adapts to your org",
    body: "California and Massachusetts rules are built in. Each CBO sets how aggressively flags surface and which categories to focus on — without changing the eligibility decision or the measured error rate.",
  },
] as const;

export default function QcTab() {
  const [plain, setPlain] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  // expert vs plain string picker
  const t = (expert: string, plainText: string) => (plain ? plainText : expert);
  const openCount = DEMO_QC.recentFlags.filter((f) => f.status === "Open").length;

  return (
    <div className="space-y-6">
      {/* ── Plain-language toggle ───────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-[12px] text-graphite">Plain language</span>
        <button
          type="button"
          role="switch"
          aria-checked={plain}
          aria-label="Toggle plain language"
          onClick={() => setPlain((p) => !p)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            plain ? "bg-pine" : "bg-graphite/30"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow-sm transition-transform ${
              plain ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* ── Collapsible "How the engine works" (flow diagram + steps) ────────── */}
      <section aria-label="How the engine works" className="bg-surface border border-hairline rounded-[4px]">
        <button
          type="button"
          aria-expanded={howOpen}
          onClick={() => setHowOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <span>
            <span className="block text-[14px] font-semibold text-ink">How the engine works</span>
            <span className="mt-0.5 block text-[12px] text-graphite">
              {t(
                "How it operates, reaches people, and adapts to your org",
                "What this does, how people use it, and how you shape it",
              )}
            </span>
          </span>
          <span
            className={`shrink-0 text-graphite transition-transform ${howOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </button>

        {howOpen && (
          <div className="border-t border-hairline px-5 py-5">
            {/* Visual flow: applicant → engine → navigator → county */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              {FLOW.map((node, i) => (
                <Fragment key={node.label}>
                  <div className="flex-1 rounded-[4px] border border-hairline bg-surface-secondary px-4 py-3 text-center">
                    <p className="text-[13px] font-semibold text-ink">{node.label}</p>
                    <p className="mt-0.5 text-[11px] text-graphite">{node.caption}</p>
                  </div>
                  {i < FLOW.length - 1 && (
                    <div className="hidden items-center justify-center px-1 text-graphite/50 sm:flex" aria-hidden="true">
                      →
                    </div>
                  )}
                </Fragment>
              ))}
            </div>

            {/* The three steps in plain language */}
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
              {HOW_STEPS.map((s) => (
                <div key={s.head}>
                  <p className="text-[13px] font-semibold text-ink">{s.head}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-graphite">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Top metrics — divided metric row, no per-card chrome ────────────── */}
      <div className="border border-hairline rounded-[2px] bg-surface grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-hairline">
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite">
            {t("Payment Error Rate — projected", "Benefit-dollar mistakes — projected")}
            <InfoTip
              align="left"
              label="The share of benefit dollars issued in error — over- or under-payment. USDA's official Quality Control measure. §10105 penalizes states that exceed 105% of the national average error rate. The figure shown is Civica's modeled projection at full engagement, not a measured cohort."
            />
          </p>
          <p className="text-[28px] font-semibold tabular-nums text-ink leading-none mt-2">{DEMO_QC.per}%</p>
          <p className="text-[11px] text-graphite mt-1.5">projected at full engagement vs {CA_BASELINE}% CA baseline (USDA FNS-380)</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite">
            {t("OBBBA Readiness", "New-rules readiness")}
            <InfoTip
              align="left"
              label="Share of work-requirement determinations the FY2026 rules engine handles automatically under the 2025 OBBBA changes — the ABAWD age band and §10108 exemptions. Higher means less manual rule-tracking for your team."
            />
          </p>
          <p className="text-[28px] font-semibold tabular-nums text-ink leading-none mt-2">{DEMO_QC.obbbaReady}%</p>
          <p className="text-[11px] text-graphite mt-1.5">{t("Work-requirement compliance · FY2026 rules active", "Work rules · 2026 rules active")}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite">
            {t("Open QC flags", "Open issues to review")}
            <InfoTip
              align="left"
              label="Issues the engine auto-flagged this week for a navigator to resolve before handoff. This is flagging, not a determination — the household's eligibility is unchanged until a navigator acts."
            />
          </p>
          <p className="text-[28px] font-semibold tabular-nums text-ink leading-none mt-2">{openCount}</p>
          <p className="text-[11px] text-graphite mt-1.5">of {DEMO_QC.recentFlags.length} auto-flagged this week</p>
        </div>
      </div>

      {/* ── Pillar breakdown — table with thin monochrome bars ──────────────── */}
      <section aria-label="QC pillars">
        <p className="eyebrow mb-2">
          {t("Error by pillar", "Mistakes by category")}
          <InfoTip label="Each pillar is a category USDA scores during Quality Control. Error rate = share of reviewed packets with an issue in that category. Pass rate is the complement." />
        </p>
        <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-hairline bg-surface-secondary">
                <th className="py-2 pl-4 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Pillar</th>
                <th className="py-2 px-4 text-right text-[10px] font-semibold uppercase tracking-wider text-graphite">{t("Error", "Mistakes")}</th>
                <th className="py-2 pr-4 pl-4 text-right text-[10px] font-semibold uppercase tracking-wider text-graphite">{t("Pass", "Correct")}</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_QC.pillars.map((p) => {
                const high = p.fail > 8;
                return (
                  <tr key={p.label} className="border-b border-hairline last:border-b-0">
                    <td className="py-2 pl-4 pr-4 align-top w-[55%]">
                      <span className="text-[13px] font-semibold text-ink">{p.label}</span>
                      <span className="text-[12px] text-muted ml-2">{t(p.note, p.notePlain)}</span>
                      <InfoTip label={p.tip} />
                      <div className="mt-1 h-[3px] w-full bg-paper">
                        <div className={high ? "h-full bg-brick" : "h-full bg-graphite"} style={{ width: `${p.fail}%` }} />
                      </div>
                    </td>
                    <td className={`py-2 px-4 text-right text-[13px] font-semibold tabular-nums align-top whitespace-nowrap ${high ? "text-brick" : "text-ink"}`}>{p.fail}%</td>
                    <td className="py-2 pr-4 pl-4 text-right text-[12px] tabular-nums text-muted align-top whitespace-nowrap">{p.pass}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── CBO flag-sensitivity control (scaffold) ─────────────────────────── */}
      <FlagSensitivityControl />

      {/* ── Recent flags — institutional table ──────────────────────────────── */}
      <section aria-label="Recent QC flags">
        <p className="eyebrow mb-2">{t("Recent flags", "Recent issues")}</p>
        <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-hairline bg-surface-secondary">
                <th className="py-2 pl-4 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Flag</th>
                <th className="py-2 px-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Field</th>
                <th className="py-2 px-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Issue</th>
                <th className="py-2 pr-4 pl-4 text-right text-[10px] font-semibold uppercase tracking-wider text-graphite">Status</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_QC.recentFlags.map((flag) => (
                <tr key={flag.id} className="border-b border-hairline last:border-b-0">
                  <td className="py-2 pl-4 pr-4 text-[11px] font-mono text-graphite tabular-nums align-top whitespace-nowrap">{flag.id}</td>
                  <td className="py-2 px-4 text-[13px] font-semibold text-ink align-top whitespace-nowrap">{flag.field}</td>
                  <td className="py-2 px-4 text-[12px] text-graphite align-top">{flag.issue}</td>
                  <td className={`py-2 pr-4 pl-4 text-right text-[11px] font-semibold uppercase tracking-wider align-top whitespace-nowrap ${flag.status === "Open" ? "text-brick" : "text-pine"}`}>
                    {t(flag.status, flag.status === "Open" ? "Open" : "Fixed")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] text-graphite">Demo data — representative QC metrics from a synthetic cohort. Engine version FY2026.</p>
    </div>
  );
}
