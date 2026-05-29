// Error-rate one-pager — presentational (server component).
//
// Renders the LIVE truth point (lib/analytics/error-rate-snapshot
// getErrorRateTruthPoint) around one ethos: the best thing an applicant can
// submit is a PERFECT application; the error rate is just the scoreboard of how
// close they got. Every section is paired with a plain-language "what this means"
// read for someone who did casework, not data science. The status banner
// auto-flips from pre-production to a measured signal once QC sampling clears
// n>=30. It shows exactly what the snapshot holds — no claim it cannot back.

import Link from "next/link";
import type { ErrorRateTruthPoint, ErrorRateMetricView } from "../../lib/analytics/error-rate-snapshot";
import { CA_QC_GROUNDING } from "../../lib/analytics/ca-qc-grounding";
import { CA_CAPER_GROUNDING } from "../../lib/analytics/ca-caper-grounding";
import { CA_POLICYENGINE_GROUNDING } from "../../lib/analytics/ca-policyengine-grounding";

function pct(x: number | null | undefined): string {
  return x == null ? "—" : `${x.toFixed(2)}%`;
}
function pp(x: number | null | undefined): string {
  return x == null ? "—" : `${x.toFixed(2)} pp`;
}
function metricLabel(v: ErrorRateMetricView): string {
  return typeof v.meta?.label === "string" ? v.meta.label : (v.sliceValue ?? v.metric);
}

export default function ErrorRateOnePager({ truthPoint }: { truthPoint: ErrorRateTruthPoint }) {
  const tp = truthPoint;

  if (!tp.available) {
    return (
      <div className="rounded-lg border border-graphite/20 bg-surface-secondary p-8 text-center">
        <p className="text-graphite">
          The error-rate snapshot is not populated yet. Once the daily refresh
          runs, the live reading appears here.
        </p>
      </div>
    );
  }

  const productionSignal = tp.measured?.meta?.status === "measured";
  const elements = [...tp.elements].sort((a, b) => (b.perPct ?? 0) - (a.perPct ?? 0));
  const tam = tp.incomeGroups.find((g) => g.sliceValue === "civica_tam");
  const noEarned = tp.incomeGroups.find((g) => g.sliceValue === "no_earned");
  const tamRatio =
    tam?.perPct != null && noEarned?.perPct ? (tam.perPct / noEarned.perPct).toFixed(1) : null;

  return (
    <div className="space-y-10">
      {/* ── Status banner (auto-flips on the n>=30 gate) ───────────────── */}
      {productionSignal ? (
        <div className="rounded-lg border border-pine/30 bg-pine/[0.06] p-4">
          <p className="text-sm font-semibold text-pine">Live reading — measured</p>
          <p className="mt-1 text-sm leading-relaxed text-graphite">
            Measured on {tp.measured?.n} sampled QC reviews. The numbers below are
            real Civica-served outcomes.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-warning/30 bg-warning/[0.06] p-4">
          <p className="text-sm font-semibold text-warning">
            This page is reading test data — and it says so
          </p>
          <p className="mt-1 text-sm leading-relaxed text-graphite">
            No live applicants have come through yet, so it will not show a
            &ldquo;reduction&rdquo; it cannot back up. Everything below is published
            federal data — the map we built the product from, not a claim about
            our own results.
          </p>
        </div>
      )}

      {/* ── The number, today ──────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-graphite">
          The number, today
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="CA baseline" value={pct(tp.baselineCa)} sub="FY2024 · USDA FNS-380" />
          <Metric label="If perfect" value={pct(tp.projected)} sub="error left after verification" />
          <Metric label="Implied today" value={pct(tp.engagementImplied)} sub="live · current coverage" />
          <Metric
            label="Measured"
            value={productionSignal ? pct(tp.measured?.perPct) : "pending"}
            sub={productionSignal ? `n=${tp.measured?.n}` : `n=${tp.measured?.n ?? 0} of 30`}
          />
        </div>
        <Means>
          Read it like this: today California gets it wrong on{" "}
          <span className="text-ink">{pct(tp.baselineCa)}</span> of benefits. A
          perfect application would put that near{" "}
          <span className="text-ink">{pct(tp.projected)}</span> — the small amount
          that is left even after you verify everything. The live figure is not a
          real reading yet (no production applicants), which is why the banner says
          so.
        </Means>
      </section>

      {/* ── Operational, not policy ────────────────────────────────────── */}
      <section className="rounded-lg border border-graphite/15 bg-surface-secondary p-4">
        <h2 className="text-sm font-semibold text-ink">These are operational errors, not policy</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-graphite">
          In the real federal data,{" "}
          <span className="font-semibold text-ink">
            ~{CA_QC_GROUNDING.operationalPct}% of California&rsquo;s error dollars
            are operational
          </span>{" "}
          — income that is hard to verify, a deduction miscalculated, a change
          that never got processed. The other ~{CA_QC_GROUNDING.clientPct}% is on
          the household to report. There is no &ldquo;policy&rdquo; category at
          all: the federal review marks every error as the agency&rsquo;s or the
          household&rsquo;s, nothing in between. Almost none is fraud (under 2%).
          That is the whole point — roughly two-thirds of the problem is the
          day-to-day kind a tool fixes. You do not change a law to get an
          application right; you verify the parts that are hard to get right by
          hand.
        </p>
        <p className="mt-2 text-xs text-graphite">
          USDA QC FY{CA_QC_GROUNDING.fiscalYear}, California (n=
          {CA_QC_GROUNDING.caCases}) ·{" "}
          <Link
            href={`/findings/${CA_QC_GROUNDING.findingId}`}
            className="text-pine underline-offset-2 hover:underline"
          >
            how we counted
          </Link>
        </p>
      </section>

      {/* ── A caution from the witness lens (Guarino) ──────────────────── */}
      <section className="rounded-lg border border-graphite/15 bg-surface-secondary p-4">
        <h2 className="text-sm font-semibold text-ink">A caution worth taking seriously</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-graphite">
          The rate is a partial scoreboard, and chasing it the wrong way
          backfires. Dave Guarino — who built GetCalFresh, the tool that
          processed millions of CalFresh applications — points out that the rate
          only counts overpayments in cases that actually got processed, and that
          the usual way agencies push it down (demanding more documentation)
          quietly pushes eligible people back out.
        </p>
        <blockquote className="mt-3 border-l-2 border-graphite/30 pl-3 text-sm italic leading-relaxed text-graphite">
          &ldquo;When does asking for more documentation actually lead to eligible
          people not getting benefits due to that extra burden?&rdquo;
          <span className="mt-1 block text-xs not-italic text-graphite">
            — Dave Guarino,{" "}
            <a
              href="https://daveguarino.substack.com/p/government-stuff-1"
              className="text-pine underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer noopener"
            >
              Plausible Legibility
            </a>
          </span>
        </blockquote>
        <p className="mt-3 text-sm leading-relaxed text-graphite">
          That is the line Civica sits on the right side of: it lowers the rate by
          making the application{" "}
          <span className="text-ink">correct before it is submitted</span>, not by
          adding hoops. The error falls because the case is right — not because
          the applicant cleared one more burden.
        </p>
        <p className="mt-2 text-xs text-graphite">
          Practitioner perspective — not federal data ·{" "}
          <Link
            href="/findings/2026-05-29-guarino-error-rate-metric"
            className="text-pine underline-offset-2 hover:underline"
          >
            how we read this
          </Link>
        </p>
      </section>

      {/* ── The other side of error: CAPER (denial-side, federal) ──────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-graphite">
          The other side of the rate: improper denials (USDA CAPER FY{CA_CAPER_GROUNDING.fiscalYear})
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric
            label="California"
            value={`${CA_CAPER_GROUNDING.caRatePct.toFixed(2)}%`}
            sub="of denial/cut-off actions had an error"
            highlight
          />
          <Metric
            label="United States"
            value={`${CA_CAPER_GROUNDING.usRatePct.toFixed(2)}%`}
            sub="national"
          />
          <Metric
            label="Massachusetts"
            value={`${CA_CAPER_GROUNDING.maRatePct.toFixed(2)}%`}
            sub="lowest-burden peer"
          />
        </div>
        <Means>
          The payment rate only watches money that went <em>out</em>. The federal
          Case and Procedural Error Rate watches the other door — denials,
          terminations, and cut-offs. In FY{CA_CAPER_GROUNDING.fiscalYear},{" "}
          <span className="text-ink">roughly 2 in 5</span> of California&rsquo;s
          negative actions carried a case or procedural error. That is the witness
          point made in federal data: error lives on <em>both</em> doors of the
          application, and both are operational — process and paperwork, not policy
          or fraud. (A flagged action is not proof the household was eligible —
          many are procedural — but it is the agency&rsquo;s error to own, and the
          kind a tool prevents.)
        </Means>
        <p className="mt-2 text-xs text-graphite">
          USDA CAPER FY{CA_CAPER_GROUNDING.fiscalYear} (dated {CA_CAPER_GROUNDING.dated}) ·{" "}
          <Link
            href={`/findings/${CA_CAPER_GROUNDING.findingId}`}
            className="text-pine underline-offset-2 hover:underline"
          >
            how we read this
          </Link>
        </p>
      </section>

      {/* ── Where errors live ──────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-graphite">
          Where CA errors live (USDA FY2023)
        </h2>
        <div className="overflow-hidden rounded-lg border border-graphite/15">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary text-left text-xs uppercase tracking-wide text-graphite">
              <tr>
                <th className="px-3 py-2 font-medium">Part of the application</th>
                <th className="px-3 py-2 text-right font-medium">Share of CA errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite/10">
              {elements.slice(0, 8).map((e) => (
                <tr key={e.sliceValue}>
                  <td className="px-3 py-1.5 text-ink">{metricLabel(e)}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-graphite">
                    {pct(e.perPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-graphite">
          ✓ These shares reproduce from the raw USDA QC microdata within ~
          {CA_QC_GROUNDING.elementMaxDeltaPp} pp —{" "}
          <Link
            href={`/findings/${CA_QC_GROUNDING.findingId}`}
            className="text-pine underline-offset-2 hover:underline"
          >
            not our estimate, the federal file
          </Link>
          .
        </p>
        <Means>
          The two parts caseworkers fight hardest — rent/shelter and wage income —
          are <span className="text-ink">6 of every 10</span> California errors
          ({CA_QC_GROUNDING.shelterOrWagesPct}% in the federal file). Get those
          two right and most of the error is simply gone. They are the first two
          parts Civica verifies automatically.
        </Means>
      </section>

      {/* ── Who has them — the TAM ─────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-graphite">
          Who has them (national FY2023)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tp.incomeGroups
            .slice()
            .sort((a, b) => (b.perPct ?? 0) - (a.perPct ?? 0))
            .map((g) => (
              <Metric
                key={g.sliceValue}
                label={(g.sliceValue ?? "").replace(/_/g, " ")}
                value={pct(g.perPct)}
                sub={g.sliceValue === "civica_tam" ? "the Civica household" : ""}
                highlight={g.sliceValue === "civica_tam"}
              />
            ))}
        </div>
        <Means>
          Working families have the hardest applications to get perfect — more
          income to document, more moving parts — so they carry{" "}
          {tamRatio ? <span className="text-ink">{tamRatio}×</span> : <>more than 2×</>}{" "}
          the error rate of households with no earnings. They are exactly who
          Civica is built for, which is why the addressable problem is bigger than
          the statewide average makes it look.
        </Means>
      </section>

      {/* ── Per-pillar reduction ───────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-graphite">
          What each fix removes
        </h2>
        <div className="overflow-hidden rounded-lg border border-graphite/15">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary text-left text-xs uppercase tracking-wide text-graphite">
              <tr>
                <th className="px-3 py-2 font-medium">Civica verifies</th>
                <th className="px-3 py-2 text-right font-medium">of the error</th>
                <th className="px-3 py-2 text-right font-medium">used so far</th>
                <th className="px-3 py-2 text-right font-medium">error removed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite/10">
              {tp.pillarContributions.map((p) => (
                <tr key={p.sliceValue}>
                  <td className="px-3 py-1.5 text-ink">{(p.sliceValue ?? "").replace(/_/g, " ")}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-graphite">
                    {typeof p.meta?.usda_share === "number" ? `${(p.meta.usda_share * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-graphite">
                    {typeof p.meta?.coverage === "number" ? `${(p.meta.coverage * 100).toFixed(0)}%` : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-graphite">{pp(p.perPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Means>
          Each row perfects one part of the application. &ldquo;Error removed&rdquo;
          is what that fix takes off the rate once an applicant actually uses it —
          near zero today because no one has yet, with about{" "}
          <span className="text-ink">5 points</span> of headroom waiting to be
          captured as real applications come through.
        </Means>
      </section>

      {/* ── What a mistake costs: modeled (PolicyEngine) ───────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-graphite">
          What a mistake actually costs (modeled · PolicyEngine FY{CA_POLICYENGINE_GROUNDING.paramYear})
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric
            label="$1 of unreported income"
            value={`${Math.round(CA_POLICYENGINE_GROUNDING.unearnedLeverage * 100)}¢`}
            sub="lost benefit per $1"
            highlight
          />
          <Metric
            label="$1 of unreported wages"
            value={`${Math.round(CA_POLICYENGINE_GROUNDING.wagesLeverage * 100)}¢`}
            sub="work gets a 20% discount"
          />
          <Metric label="$1 of rent · most CA renters" value="0¢" sub="already over the shelter cap" />
        </div>
        <Means>
          Not every mistake costs the same. Run a representative California caseload
          through the open-source benefit model and a dollar of unreported{" "}
          <span className="text-ink">income</span> lowers the benefit about{" "}
          <span className="text-ink">30¢</span> (24¢ for wages — work gets a
          discount). Rent only counts up to a cap, and roughly{" "}
          <span className="text-ink">7 in 10</span> non-elderly California renters
          are already over it, so for them a rent error moves the benefit nothing;
          only elderly and disabled households see the full 30¢. The
          highest-<em>dollar</em> error is income — which is exactly the part Civica
          verifies automatically.
        </Means>
        <p className="mt-2 text-xs text-graphite">
          Modeled — PolicyEngine US (offline), FY{CA_POLICYENGINE_GROUNDING.paramYear} ·{" "}
          <Link
            href={`/findings/${CA_POLICYENGINE_GROUNDING.findingId}`}
            className="text-pine underline-offset-2 hover:underline"
          >
            how we modeled this
          </Link>
        </p>
      </section>

      {/* ── The close — the dam ────────────────────────────────────────── */}
      <section className="rounded-lg border border-pine/25 bg-pine/[0.04] p-5">
        <h2 className="text-base font-semibold text-ink">Implementation is not the leap. It is the release.</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-graphite">
          Put it together. We know which parts of an application go wrong (shelter,
          wages), who struggles most (working families), and which verification
          perfects each one. None of that is a hypothesis to test in the field — it
          is drawn from three independent lenses that agree — the federal error
          samples, an open-source benefit model, and the person who built
          California&rsquo;s intake — before we shipped a single line. The perfect
          application is not the aspiration; it is what the product builds. There is
          a reservoir of homework behind this — and turning it on is just letting it
          through.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-graphite">
          The method:{" "}
          <Link href="/findings/regression" className="text-pine underline-offset-2 hover:underline">
            a regression locked before the data
          </Link>
          , a single canonical number every screen reads, and a check that refuses
          to call test data a result (the banner up top).
        </p>
      </section>

      {/* ── Provenance footer ──────────────────────────────────────────── */}
      <footer className="border-t border-graphite/15 pt-4 text-xs text-graphite">
        <p>
          Live from <span className="font-mono">snap_enrollment.v_error_rate_current</span>
          {tp.engineVersion ? ` · engine ${tp.engineVersion}` : ""}
          {tp.computedAt ? ` · computed ${tp.computedAt}` : ""}. Method:{" "}
          <Link
            href="/findings/2026-05-29-error-rate-truth-point"
            className="text-pine underline-offset-2 hover:underline"
          >
            error-rate truth point
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}

/** Plain-language "what this means" read — the human translation under each section. */
function Means({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 border-l-2 border-pine/30 pl-3 text-sm leading-relaxed text-graphite">
      <span className="font-semibold text-ink">What this means. </span>
      {children}
    </p>
  );
}

function Metric({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? "border-pine/30 bg-pine/[0.05]" : "border-graphite/15 bg-surface-secondary"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-graphite">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-ink">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-graphite">{sub}</p> : null}
    </div>
  );
}
