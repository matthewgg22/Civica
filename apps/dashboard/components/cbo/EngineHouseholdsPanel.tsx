import { assessDemoHouseholds, type DemoAssessment } from "../../lib/engines/demo-assessments";

// Live engine output for /cbo-preview (#504/#505 surfaced in the demo).
//
// The whole point of this panel: prove the engine is real. Every verdict and
// dollar figure is computed at render by @civica/snap-rules (composeVerdict +
// computeBenefit) over synthetic households. Nothing here is hand-typed. A
// regression test (demo-assessments.test.ts) asserts each verdict matches the
// v0.6 oracle, so the demo can never silently show a wrong determination.
//
// Server component: pure render of server-computed data, no client JS.

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === "APPROVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-pine/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-pine">
        <span className="h-1.5 w-1.5 rounded-full bg-pine" />
        Eligible
      </span>
    );
  }
  if (verdict === "DENY") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brick/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brick">
        <span className="h-1.5 w-1.5 rounded-full bg-brick" />
        Not eligible
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-graphite">
      Indeterminate
    </span>
  );
}

function HouseholdCard({ a }: { a: DemoAssessment }) {
  return (
    <div className="rounded-[4px] border border-hairline bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink leading-tight">{a.name}</p>
          <p className="text-[12px] text-graphite mt-0.5 leading-snug">{a.situation}</p>
        </div>
        <VerdictBadge verdict={a.verdict} />
      </div>

      {a.verdict === "APPROVE" && a.monthlyBenefitUsd !== null && (
        <p className="mt-3 text-[28px] font-semibold leading-none tabular-nums text-ink">
          ${a.monthlyBenefitUsd}
          <span className="text-[13px] font-normal text-graphite">/mo</span>
        </p>
      )}

      <p className="mt-2 text-[12px] leading-relaxed text-graphite">{a.why}</p>
    </div>
  );
}

export default function EngineHouseholdsPanel() {
  const assessments = assessDemoHouseholds();

  return (
    <section aria-label="Live eligibility engine" className="space-y-4">
      <div>
        <p className="eyebrow">Live eligibility engine · synthetic households, real determinations</p>
        <p className="mt-1 text-[13px] text-graphite leading-relaxed max-w-2xl">
          Every verdict and dollar figure below is computed at page load by Civica&apos;s rules
          engine (<code className="text-[12px] text-ink">@civica/snap-rules</code>) — the same code
          path a real application runs. The households are fictional; the math is not.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {assessments.map((a) => (
          <HouseholdCard key={a.key} a={a} />
        ))}
      </div>

      <p className="text-[11px] text-graphite">
        Synthetic profiles from Civica&apos;s engine test deck (FY2026, post-OBBBA). No real
        applicant data is shown or derivable. Determinations are cross-checked against the deck&apos;s
        verified oracle in CI.
      </p>
    </section>
  );
}
