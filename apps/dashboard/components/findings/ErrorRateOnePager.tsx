// Error-rate credibility one-pager — presentational (server component).
//
// Renders the LIVE truth point (apps/dashboard/lib/analytics/error-rate-snapshot
// getErrorRateTruthPoint) as a single shareable page: the headline metrics, the
// method, and the published reference layer — with an honest status banner that
// auto-flips from "pre-production / not-yet-signal" to "production signal" once
// measured QC reviews clear the n>=30 gate. No fabrication: it shows exactly
// what the snapshot holds, and says so.

import Link from "next/link";
import type { ErrorRateTruthPoint, ErrorRateMetricView } from "../../lib/analytics/error-rate-snapshot";

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
          runs (or it is triggered on demand), the live truth point renders here.
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
          <p className="text-sm font-semibold text-pine">Production signal — measured</p>
          <p className="mt-1 text-sm leading-relaxed text-graphite">
            Measured on {tp.measured?.n} sampled QC reviews. The numbers below
            reflect real Civica-served outcomes.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-warning/30 bg-warning/[0.06] p-4">
          <p className="text-sm font-semibold text-warning">Pre-production — not yet a Civica signal</p>
          <p className="mt-1 text-sm leading-relaxed text-graphite">
            The live engagement-implied figure currently reflects pre-production /
            test traffic (verification coverage is near zero, and measured QC
            sampling has not reached n=30). Cite the methodology and the published
            reference layer below — not a live reduction — until production
            applicants flow through verification.
          </p>
        </div>
      )}

      {/* ── Headline metrics ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-graphite">
          The number, today
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="CA baseline" value={pct(tp.baselineCa)} sub="FY2024 · USDA FNS-380" />
          <Metric label="Projected" value={pct(tp.projected)} sub="engine · full engagement" />
          <Metric label="Engagement-implied" value={pct(tp.engagementImplied)} sub="live · current coverage" />
          <Metric
            label="Measured"
            value={productionSignal ? pct(tp.measured?.perPct) : "pending"}
            sub={productionSignal ? `n=${tp.measured?.n}` : `n=${tp.measured?.n ?? 0} of 30`}
          />
        </div>
      </section>

      {/* ── The method (3 layers) ──────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-graphite">
          Why it is auditable
        </h2>
        <ol className="space-y-3">
          <Layer n="1" title="Pre-registered regression">
            The measurement plan was locked before the data — see{" "}
            <Link href="/findings/regression" className="text-pine underline-offset-2 hover:underline">
              the regression
            </Link>
            . You cannot fish for a result you committed to in advance.
          </Layer>
          <Layer n="2" title="Canonical truth point">
            One engine-computed, provenanced number every surface reads. A
            deterministic job computes it; the model only explains it.
          </Layer>
          <Layer n="3" title="Honest guardrail">
            The first live reading flagged its own number as test-data rather than
            a result — the banner above is that guardrail, automated.
          </Layer>
        </ol>
      </section>

      {/* ── Reference: where errors live ───────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-graphite">
          Where CA errors live (USDA FY2023)
        </h2>
        <p className="mb-3 text-sm text-graphite">
          Published microdata, independent of Civica traffic. Shelter + wages —
          Civica&rsquo;s two primary pillars — are the majority of the error surface.
        </p>
        <div className="overflow-hidden rounded-lg border border-graphite/15">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary text-left text-xs uppercase tracking-wide text-graphite">
              <tr>
                <th className="px-3 py-2 font-medium">Element</th>
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
      </section>

      {/* ── Reference: who has them (TAM) ──────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-graphite">
          Who has them — the TAM (national FY2023)
        </h2>
        <p className="mb-3 text-sm text-graphite">
          {tamRatio ? (
            <>
              The earned-income cohort Civica targets runs{" "}
              <span className="font-semibold text-ink">{tamRatio}×</span> the
              no-earned rate — a structurally larger error surface than the
              statewide average implies.
            </>
          ) : (
            <>PER by income cohort.</>
          )}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tp.incomeGroups
            .slice()
            .sort((a, b) => (b.perPct ?? 0) - (a.perPct ?? 0))
            .map((g) => (
              <Metric
                key={g.sliceValue}
                label={(g.sliceValue ?? "").replace(/_/g, " ")}
                value={pct(g.perPct)}
                sub={g.sliceValue === "civica_tam" ? "Civica TAM" : ""}
                highlight={g.sliceValue === "civica_tam"}
              />
            ))}
        </div>
      </section>

      {/* ── Reference: pillar attribution ──────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-graphite">
          Per-pillar reduction at current coverage
        </h2>
        <div className="overflow-hidden rounded-lg border border-graphite/15">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary text-left text-xs uppercase tracking-wide text-graphite">
              <tr>
                <th className="px-3 py-2 font-medium">Pillar</th>
                <th className="px-3 py-2 text-right font-medium">USDA share</th>
                <th className="px-3 py-2 text-right font-medium">Coverage</th>
                <th className="px-3 py-2 text-right font-medium">Reduction</th>
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
      </section>

      {/* ── What we will not claim yet ─────────────────────────────────── */}
      <section className="rounded-lg border border-graphite/15 bg-surface-secondary p-4">
        <h2 className="text-sm font-semibold text-ink">What we will not claim yet</h2>
        <p className="mt-1 text-sm leading-relaxed text-graphite">
          No live reduction is claimed until production traffic exists and measured
          QC sampling clears n=30. The restraint is the point: the same machinery
          that will prove a reduction is the machinery that refuses to assert one
          early.
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

function Layer({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-pine/10 font-mono text-xs font-semibold text-pine">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm leading-relaxed text-graphite">{children}</p>
      </div>
    </li>
  );
}
