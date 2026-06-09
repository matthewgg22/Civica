// Snapshot periods + progress-report generation for the CBO Overview.
//
// The Overview "Snapshot" recomputes its KPIs across Day / Week / Month / YTD /
// Year. "Month" is anchored to the LIVE engine benefit total (multiplier 1);
// other periods scale it illustratively, since the rest of the caseload is
// synthetic. The report builder emits a single HTML document reused for both
// the PDF (print-window) and Word (.doc Blob) paths — zero dependencies.

import { CA_BASELINE_PER } from "@civica/snap-qc-engine";

export type Period = "day" | "week" | "month" | "ytd" | "year";

export const PERIODS: { key: Period; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "ytd", label: "YTD" },
  { key: "year", label: "Year" },
];

export const PERIOD_LABEL: Record<Period, string> = {
  day: "Today",
  week: "This week",
  month: "This month",
  ytd: "Year to date",
  year: "Trailing 12 months",
};

export type Snapshot = {
  apps: number;
  enrolled: number;
  benefitsUsd: number;
  errorRate: number;
  handoff: number;
};

// Period-scoped operating figures. `month` benefits == the live engine total
// (multiplier 1); other periods scale it. Counts are synthetic but monotonic so
// the count-up animation reads as real volume growth across the window.
export function snapshotFor(period: Period, monthlyBenefitUsd: number): Snapshot {
  const benefitMult: Record<Period, number> = { day: 1 / 22, week: 1 / 4.3, month: 1, ytd: 5.4, year: 12 };
  const apps: Record<Period, number> = { day: 4, week: 19, month: 78, ytd: 421, year: 936 };
  const enrolled: Record<Period, number> = { day: 2, week: 11, month: 44, ytd: 238, year: 528 };
  const errorRate: Record<Period, number> = { day: 4.2, week: 4.4, month: 4.2, ytd: 4.6, year: 5.1 };
  const handoff: Record<Period, number> = { day: 6, week: 6, month: 6, ytd: 7, year: 8 };
  return {
    apps: apps[period],
    enrolled: enrolled[period],
    benefitsUsd: Math.round(monthlyBenefitUsd * benefitMult[period]),
    errorRate: errorRate[period],
    handoff: handoff[period],
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The calendar window a period covers, ending at `now`.
export function rangeForPeriod(period: Period, now: Date): { from: Date; to: Date } {
  const to = new Date(now);
  const from = new Date(now);
  switch (period) {
    case "day":
      break;
    case "week":
      from.setDate(from.getDate() - 6);
      break;
    case "month":
      from.setDate(from.getDate() - 29);
      break;
    case "ytd":
      from.setMonth(0, 1);
      break;
    case "year":
      from.setFullYear(from.getFullYear() - 1);
      from.setDate(from.getDate() + 1);
      break;
  }
  return { from, to };
}

export function fmtRange(from: Date, to: Date): string {
  const full: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (isoDate(from) === isoDate(to)) return to.toLocaleDateString("en-US", full);
  const sameYear = from.getFullYear() === to.getFullYear();
  const fromOpts: Intl.DateTimeFormatOptions = sameYear ? { month: "short", day: "numeric" } : full;
  return `${from.toLocaleDateString("en-US", fromOpts)} – ${to.toLocaleDateString("en-US", full)}`;
}

const usd = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;

function esc(s: unknown): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type ReportData = {
  periodLabel: string;
  rangeLabel: string;
  generatedAt: string;
  snapshot: Snapshot;
  phases: { label: string; count: number }[];
  // Roster is framed as case-level work signals (docs to chase, interviews to
  // prep) — NOT a per-caseworker flag/risk scorecard. Mirrors the on-screen
  // Overview roster so the export and the screen tell the same story.
  navigators: { name: string; cases: number; needsDocs: number; interview: number; avgDays: number | null }[];
  totals: { cases: number; awaitingDocs: number; benefitsUsd: number };
};

// A complete, self-contained HTML document. `forWord` adds the Office XML
// namespaces (so Word opens it natively) and drops the on-screen Print button.
export function reportDocument(d: ReportData, opts: { forWord: boolean }): string {
  // Snapshot rows. The error-rate benchmark is the published CA state average
  // (USDA FNS-380 FY2024), not a "vs manual" pitch number. Handoff has no
  // sourced state benchmark, so it carries a plain descriptor.
  const kpis: [string, string, string][] = [
    ["Applications", String(d.snapshot.apps), "submitted"],
    ["Households enrolled", String(d.snapshot.enrolled), "approved"],
    ["Benefits secured", usd(d.snapshot.benefitsUsd), "to households"],
    ["Error rate (Civica cohort)", `${d.snapshot.errorRate.toFixed(1)}%`, `vs ${CA_BASELINE_PER}% CA state average`],
    ["Avg time to handoff", `${d.snapshot.handoff} days`, "intake to county"],
  ];
  const kpiRows = kpis
    .map(([label, value, sub]) => `<tr><th>${esc(label)}</th><td class="num">${esc(value)}</td><td class="sub">${esc(sub)}</td></tr>`)
    .join("");

  const phaseRows = d.phases
    .map((p) => `<tr><th>${esc(p.label)}</th><td class="num">${esc(p.count)}</td></tr>`)
    .join("");

  const dash = (n: number) => (n > 0 ? String(n) : "—");
  const navRows = d.navigators
    .map(
      (n) =>
        `<tr><td>${esc(n.name)}</td><td class="num">${esc(n.cases)}</td><td class="num">${esc(dash(n.needsDocs))}</td><td class="num">${esc(dash(n.interview))}</td><td class="num">${n.avgDays != null ? `${esc(n.avgDays)}d` : "—"}</td></tr>`,
    )
    .join("");

  // Word page setup (mso) so the .doc opens with sane Letter margins instead of
  // the browser-export default. PDF/print path uses @page below.
  const wordPageSetup = opts.forWord
    ? `<!--[if gte mso 9]><xml>
      <o:OfficeDocumentSettings><o:AllowPNG/></o:OfficeDocumentSettings>
      <w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument>
    </xml><![endif]-->`
    : "";

  const head = opts.forWord
    ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Civica Progress Report</title>${wordPageSetup}`
    : `<!doctype html><html><head><meta charset="utf-8"><title>Civica Progress Report — ${esc(d.periodLabel)}</title>`;

  // Solid hex borders (not rgba) and Calibri-first font so Word renders the
  // tables cleanly; the same rules look right in the print/PDF window.
  const style = `<style>
  @page WordSection1 { size: 8.5in 11.0in; margin: 0.9in 0.9in 0.9in 0.9in; }
  div.WordSection1 { page: WordSection1; }
  * { box-sizing: border-box; }
  body { font-family: Calibri, -apple-system, system-ui, "Segoe UI", sans-serif; font-size: 11pt; color: #1A1D21; margin: 40px; }
  .doc { max-width: 720px; }
  .brand { font-size: 9pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #2D5A45; margin: 0 0 2px; }
  h1 { font-size: 20pt; font-weight: 700; margin: 0 0 6px; padding-bottom: 8px; border-bottom: 2px solid #2D5A45; }
  .meta { font-size: 9.5pt; color: #5B636D; margin: 2px 0 0; }
  h2 { font-size: 9.5pt; text-transform: uppercase; letter-spacing: .09em; color: #5B636D; margin: 26px 0 6px; border-bottom: 1px solid #D5D9DE; padding-bottom: 5px; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 2px; }
  th { text-align: left; font-weight: 600; color: #2C323A; padding: 6px 10px; vertical-align: top; border-bottom: 1px solid #E8EAED; }
  td { padding: 6px 10px; vertical-align: top; border-bottom: 1px solid #E8EAED; color: #1A1D21; }
  td.num { text-align: right; font-weight: 700; white-space: nowrap; }
  td.sub { color: #5B636D; font-size: 9.5pt; font-weight: 400; }
  thead th, thead td { text-transform: uppercase; font-size: 8.5pt; letter-spacing: .07em; color: #6B727B; font-weight: 700; border-bottom: 1.5px solid #C9CED4; }
  tbody tr:last-child th, tbody tr:last-child td { border-bottom: none; }
  .disc { font-size: 8.5pt; color: #5B636D; margin-top: 26px; line-height: 1.5; border-top: 1px solid #D5D9DE; padding-top: 10px; }
  .bar { text-align: right; margin: 0 0 18px; }
  .bar button { font-family: Calibri, -apple-system, system-ui, sans-serif; font-size: 11px; font-weight: 600; color: #fff; background: #2D5A45; border: 0; border-radius: 3px; padding: 8px 16px; cursor: pointer; }
  @media print { body { margin: 0; } .bar { display: none; } @page { margin: 14mm; } }
</style></head><body>`;

  const printBar = opts.forWord ? "" : `<div class="bar"><button onclick="window.print()">Print / Save as PDF</button></div>`;

  const openWrap = opts.forWord ? `<div class="WordSection1"><div class="doc">` : `<div class="doc">`;
  const closeWrap = opts.forWord ? `</div></div>` : `</div>`;

  const body = `${printBar}${openWrap}
  <p class="brand">Civica</p>
  <h1>Progress Report</h1>
  <p class="meta">${esc(d.periodLabel)} · ${esc(d.rangeLabel)}</p>
  <p class="meta">Generated ${esc(d.generatedAt)} · Civica CBO preview</p>

  <h2>Snapshot</h2>
  <table><tbody>${kpiRows}</tbody></table>

  <h2>Caseload by phase</h2>
  <table><tbody>${phaseRows}</tbody></table>

  <h2>Caseworker roster</h2>
  <table>
    <thead><tr><th>Caseworker</th><td class="num">Cases</td><td class="num">Needs docs</td><td class="num">Interview</td><td class="num">Avg days</td></tr></thead>
    <tbody>${navRows}</tbody>
  </table>

  <h2>Totals</h2>
  <table><tbody>
    <tr><th>Active cases</th><td class="num">${esc(d.totals.cases)}</td></tr>
    <tr><th>Cases awaiting documents</th><td class="num">${esc(d.totals.awaitingDocs)}</td></tr>
    <tr><th>Benefits secured (monthly run-rate, enrolled)</th><td class="num">${esc(usd(d.totals.benefitsUsd))}/mo</td></tr>
  </tbody></table>

  <p class="disc">Benefit estimates and the error-rate cohort figure are computed by Civica's rules engine on the household answers. Not an eligibility determination — verify against current CalFresh / CDSS rules and the county system of record.</p>
${closeWrap}</body></html>`;

  return head + style + body;
}
