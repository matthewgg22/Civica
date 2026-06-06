import { assessDemoHouseholds, type DemoAssessment } from "../../lib/engines/demo-assessments";
import TableExport from "./TableExport";

// Live engine output for /cbo-preview (#504/#505 surfaced in the demo).
//
// The whole point of this panel: prove the engine is real. Every verdict and
// dollar figure is computed at render by @civica/snap-rules (composeVerdict +
// computeBenefit) over synthetic households. Nothing here is hand-typed. A
// regression test (demo-assessments.test.ts) asserts each verdict matches the
// v0.6 oracle, so the demo can never silently show a wrong determination.
//
// Institutional (utility-first) presentation: a dense determinations table with
// hairline row rules, zebra striping, text-only verdicts (no badges/pills),
// right-aligned tabular numerics, and CSV/PDF export — see DESIGN.md §10.
// Server component: pure render of server-computed data, no client JS (the
// export control is the one client island).

const NOTE =
  "Synthetic profiles from Civica's engine test deck (FY2026, post-OBBBA). No real applicant data is shown or derivable. Determinations are cross-checked against the deck's verified oracle in CI. Estimate assumes eligibility pending document verification — the county sets the final amount.";

function verdictText(verdict: string): { label: string; className: string } {
  if (verdict === "APPROVE") return { label: "Eligible", className: "text-pine" };
  if (verdict === "DENY") return { label: "Not eligible", className: "text-brick" };
  return { label: "Indeterminate", className: "text-graphite" };
}

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

function Row({ a, even }: { a: DemoAssessment; even: boolean }) {
  const v = verdictText(a.verdict);
  return (
    <tr className={`border-b border-hairline last:border-b-0 ${even ? "bg-surface-secondary/40" : ""}`}>
      <td className="py-2 pl-4 pr-3">
        <span className="text-[13px] font-semibold text-ink">{a.name}</span>
        <span className="block text-[11px] text-graphite leading-tight">{a.situation}</span>
      </td>
      <td className="py-2 px-3 text-right text-[12px] tabular-nums text-graphite whitespace-nowrap">{a.householdSize}</td>
      <td className="py-2 px-3 text-right text-[12px] tabular-nums text-graphite whitespace-nowrap">{usd(a.grossMonthlyUsd)}</td>
      <td className="py-2 px-3 text-left whitespace-nowrap">
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${v.className}`}>{v.label}</span>
      </td>
      <td className="py-2 pl-3 pr-4 text-right tabular-nums whitespace-nowrap">
        {a.verdict === "APPROVE" && a.monthlyBenefitUsd !== null ? (
          <span className="text-[14px] font-semibold text-ink">
            {usd(a.monthlyBenefitUsd)}<span className="text-[10px] font-normal text-graphite"> /mo</span>
          </span>
        ) : (
          <span className="text-[13px] text-muted">—</span>
        )}
      </td>
    </tr>
  );
}

const TH = "py-2 text-[10px] font-semibold uppercase tracking-wider text-graphite";

export default function EngineHouseholdsPanel() {
  const assessments = assessDemoHouseholds();
  const exportRows = assessments.map((a) => [
    a.name,
    a.situation,
    String(a.householdSize),
    usd(a.grossMonthlyUsd),
    verdictText(a.verdict).label,
    a.monthlyBenefitUsd !== null && a.verdict === "APPROVE" ? usd(a.monthlyBenefitUsd) : "—",
  ]);

  return (
    <section aria-label="Live eligibility engine" className="space-y-2.5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Live eligibility engine · synthetic households, real determinations</p>
          <p className="mt-1 text-[12px] text-graphite leading-relaxed max-w-2xl">
            Every verdict and dollar figure is computed at page load by Civica&apos;s rules engine
            (<code className="text-[12px] text-ink">@civica/snap-rules</code>) — the same code path a
            real application runs. The households are fictional; the math is not.
          </p>
        </div>
        <TableExport
          filename="cbo-eligibility-determinations"
          title="Eligibility determinations — synthetic households"
          columns={["Household", "Situation", "Size", "Gross income /mo", "Determination", "Est. benefit /mo"]}
          rows={exportRows}
          note={NOTE}
        />
      </div>

      <div className="border border-hairline rounded-[2px] bg-surface overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-hairline bg-surface-secondary">
              <th className={`${TH} pl-4 pr-3 text-left`}>Household</th>
              <th className={`${TH} px-3 text-right`}>Size</th>
              <th className={`${TH} px-3 text-right`}>Gross /mo</th>
              <th className={`${TH} px-3 text-left`}>Determination</th>
              <th className={`${TH} pl-3 pr-4 text-right`}>Est. benefit</th>
            </tr>
          </thead>
          <tbody>
            {assessments.map((a, i) => (
              <Row key={a.key} a={a} even={i % 2 === 1} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-graphite leading-relaxed">{NOTE}</p>
    </section>
  );
}
