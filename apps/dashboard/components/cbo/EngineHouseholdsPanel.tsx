import { assessDemoHouseholds, type DemoAssessment } from "../../lib/engines/demo-assessments";

// Live engine output for /cbo-preview (#504/#505 surfaced in the demo).
//
// The whole point of this panel: prove the engine is real. Every verdict and
// dollar figure is computed at render by @civica/snap-rules (composeVerdict +
// computeBenefit) over synthetic households. Nothing here is hand-typed. A
// regression test (demo-assessments.test.ts) asserts each verdict matches the
// v0.6 oracle, so the demo can never silently show a wrong determination.
//
// Institutional (utility-first) presentation: a dense determinations table with
// hairline row rules, text-only verdicts (no badges/pills), and right-aligned
// tabular numerics — see DESIGN.md §10. Server component: pure render, no client JS.

/** Verdict as text, not a badge. Color is carried by the text itself (2-signal rule). */
function verdictText(verdict: string): { label: string; className: string } {
  if (verdict === "APPROVE") return { label: "Eligible", className: "text-pine" };
  if (verdict === "DENY") return { label: "Not eligible", className: "text-brick" };
  return { label: "Indeterminate", className: "text-graphite" };
}

function DeterminationRow({ a, last }: { a: DemoAssessment; last: boolean }) {
  const v = verdictText(a.verdict);
  return (
    <tr className={last ? "" : "border-b border-hairline"}>
      <td className="py-2.5 pr-4 align-top">
        <span className="text-[13px] font-semibold text-ink">{a.name}</span>
        <span className="block text-[12px] text-graphite leading-snug">{a.situation}</span>
      </td>
      <td className="py-2.5 px-4 align-top whitespace-nowrap">
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${v.className}`}>{v.label}</span>
      </td>
      <td className="py-2.5 pl-4 align-top text-right tabular-nums whitespace-nowrap">
        {a.verdict === "APPROVE" && a.monthlyBenefitUsd !== null ? (
          <span className="text-[15px] font-semibold text-ink">
            ${a.monthlyBenefitUsd}
            <span className="text-[11px] font-normal text-graphite"> /mo</span>
          </span>
        ) : (
          <span className="text-[13px] text-muted">—</span>
        )}
      </td>
    </tr>
  );
}

export default function EngineHouseholdsPanel() {
  const assessments = assessDemoHouseholds();

  return (
    <section aria-label="Live eligibility engine" className="space-y-3">
      <div>
        <p className="eyebrow">Live eligibility engine · synthetic households, real determinations</p>
        <p className="mt-1 text-[12px] text-graphite leading-relaxed max-w-2xl">
          Every verdict and dollar figure is computed at page load by Civica&apos;s rules engine
          (<code className="text-[12px] text-ink">@civica/snap-rules</code>) — the same code path a
          real application runs. The households are fictional; the math is not.
        </p>
      </div>

      <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-hairline bg-surface-secondary">
              <th className="py-2 pl-4 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Household</th>
              <th className="py-2 px-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Determination</th>
              <th className="py-2 pr-4 pl-4 text-right text-[10px] font-semibold uppercase tracking-wider text-graphite">Est. benefit</th>
            </tr>
          </thead>
          <tbody>
            {assessments.map((a, i) => (
              <DeterminationRow key={a.key} a={a} last={i === assessments.length - 1} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-graphite leading-relaxed">
        Synthetic profiles from Civica&apos;s engine test deck (FY2026, post-OBBBA). No real applicant
        data is shown or derivable. Determinations are cross-checked against the deck&apos;s verified
        oracle in CI. Estimate assumes eligibility pending document verification — the county sets the
        final amount.
      </p>
    </section>
  );
}
