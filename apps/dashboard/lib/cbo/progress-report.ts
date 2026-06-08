// Snapshot periods + progress-report generation for the CBO Overview.
//
// The Overview "Snapshot" recomputes its KPIs across Day / Week / Month / YTD /
// Year. "Month" is anchored to the LIVE engine benefit total (multiplier 1);
// other periods scale it illustratively, since the rest of the caseload is
// synthetic. The report builder emits a single HTML document reused for both
// the PDF (print-window) and Word (.doc Blob) paths — zero dependencies.

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
  navigators: { name: string; cases: number; flags: number; risk: string; avgDays: number | null }[];
  totals: { cases: number; flags: number; benefitsUsd: number };
};

// A complete, self-contained HTML document. `forWord` adds the Office XML
// namespaces (so Word opens it natively) and drops the on-screen Print button.
export function reportDocument(d: ReportData, opts: { forWord: boolean }): string {
  const kpis: [string, string, string][] = [
    ["Applications", String(d.snapshot.apps), "submitted"],
    ["Households enrolled", String(d.snapshot.enrolled), "approved"],
    ["Benefits secured", usd(d.snapshot.benefitsUsd), "to households"],
    ["Error rate (Civica cohort)", `${d.snapshot.errorRate.toFixed(1)}%`, "vs ~10.8% manual baseline"],
    ["Avg time to handoff", `${d.snapshot.handoff} days`, "vs ~22 days manual"],
  ];
  const kpiRows = kpis
    .map(([label, value, sub]) => `<tr><th>${esc(label)}</th><td class="num">${esc(value)}</td><td class="sub">${esc(sub)}</td></tr>`)
    .join("");

  const phaseRows = d.phases
    .map((p) => `<tr><th>${esc(p.label)}</th><td class="num">${esc(p.count)}</td></tr>`)
    .join("");

  const navRows = d.navigators
    .map(
      (n) =>
        `<tr><td>${esc(n.name)}</td><td class="num">${esc(n.cases)}</td><td class="num">${esc(n.flags)}</td><td>${esc(n.risk)}</td><td class="num">${n.avgDays != null ? `${esc(n.avgDays)}d` : "—"}</td></tr>`,
    )
    .join("");

  const head = opts.forWord
    ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Civica Progress Report</title>`
    : `<!doctype html><html><head><meta charset="utf-8"><title>Civica Progress Report — ${esc(d.periodLabel)}</title>`;

  const style = `<style>
  * { box-sizing: border-box; }
  body { font: 13px -apple-system, system-ui, "Segoe UI", sans-serif; color: #15181C; margin: 40px; max-width: 760px; }
  h1 { font-size: 19px; margin: 0 0 2px; }
  .meta { font-size: 12px; color: #565E68; margin: 0 0 4px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #565E68; margin: 24px 0 8px; border-bottom: 1px solid rgba(15,23,42,.14); padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th { text-align: left; font-weight: 600; color: #3C424B; padding: 5px 8px; vertical-align: top; border-bottom: 1px solid rgba(15,23,42,.08); }
  td { padding: 5px 8px; vertical-align: top; border-bottom: 1px solid rgba(15,23,42,.08); }
  td.num { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.sub { color: #565E68; font-size: 12px; }
  thead th { text-transform: uppercase; font-size: 10px; letter-spacing: .06em; color: #565E68; }
  thead td.num { text-align: right; }
  .disc { font-size: 11px; color: #565E68; margin-top: 24px; line-height: 1.5; border-top: 1px solid rgba(15,23,42,.14); padding-top: 10px; }
  .bar { display: flex; justify-content: flex-end; margin: 0 0 18px; }
  .bar button { font: 600 12px -apple-system, system-ui, sans-serif; color: #fff; background: #2D5A45; border: 0; border-radius: 3px; padding: 7px 14px; cursor: pointer; }
  @media print { body { margin: 0; } .bar { display: none; } @page { margin: 16mm; } }
</style></head><body>`;

  const printBar = opts.forWord ? "" : `<div class="bar"><button onclick="window.print()">Print / Save as PDF</button></div>`;

  const body = `${printBar}
  <h1>Civica — Progress Report</h1>
  <p class="meta">${esc(d.periodLabel)} · ${esc(d.rangeLabel)}</p>
  <p class="meta">Generated ${esc(d.generatedAt)} · Civica CBO preview</p>

  <h2>Snapshot</h2>
  <table><tbody>${kpiRows}</tbody></table>

  <h2>Caseload by phase</h2>
  <table><tbody>${phaseRows}</tbody></table>

  <h2>Navigator roster</h2>
  <table>
    <thead><tr><th>Navigator</th><td class="num">Cases</td><td class="num">Flags</td><th>Top risk</th><td class="num">Avg days</td></tr></thead>
    <tbody>${navRows}</tbody>
  </table>

  <h2>Totals</h2>
  <table><tbody>
    <tr><th>Active cases</th><td class="num">${esc(d.totals.cases)}</td></tr>
    <tr><th>Open flags</th><td class="num">${esc(d.totals.flags)}</td></tr>
    <tr><th>Benefits secured (monthly run-rate, enrolled)</th><td class="num">${esc(usd(d.totals.benefitsUsd))}/mo</td></tr>
  </tbody></table>

  <p class="disc">Benefit estimates and the error-rate cohort figure are computed by Civica's rules engine on the household answers; applicant records and the period volume counts in this preview are synthetic and illustrative. Not an eligibility determination — verify against current CalFresh / CDSS rules and the county system of record.</p>
</body></html>`;

  return head + style + body;
}
