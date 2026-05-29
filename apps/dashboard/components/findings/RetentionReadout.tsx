// Retention readout — CDSS CF-18 procedural churn, rendered like the error-rate
// one-pager: every section paired with a plain-language "what this means" read
// for someone who did casework, not data science. All figures are PUBLISHED CA
// state data (CDSS CF-18) via the cited const lib/analytics/cf18-churn — static,
// no live snapshot. The ethos: a perfect application is only half the job; the
// other half is the perfect renewal.

import Link from "next/link";
import { CF18_CHURN as C } from "../../lib/analytics/cf18-churn";

export default function RetentionReadout() {
  return (
    <div className="space-y-10">
      {/* ── Provenance banner — real published state data ───────────────── */}
      <div className="rounded-lg border border-pine/30 bg-pine/[0.06] p-4">
        <p className="text-sm font-semibold text-pine">Published California state data</p>
        <p className="mt-1 text-sm leading-relaxed text-graphite">
          Every figure below is from CDSS&rsquo;s monthly CalFresh Churn report
          (CF&nbsp;18), {C.latestFy}. These are eligible households losing benefits
          at renewal — not a model, not a projection.
        </p>
      </div>

      {/* ── The number ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-graphite">
          Lost at renewal ({C.latestFy})
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric
            label="Recertifications"
            value={`${C.statewide.rrrLossPct}%`}
            sub="lost benefits, still eligible"
            highlight
          />
          <Metric
            label="Semi-annual reports"
            value={`${C.statewide.sar7LossPct}%`}
            sub="lost benefits, still eligible"
          />
          <Metric
            label="In one year"
            value={`${Math.round(C.statewide.eventsWithLoss / 1000)}K`}
            sub="benefit interruptions"
          />
        </div>
        <Means>
          About <span className="text-ink">1 in 20</span> recertifications and{" "}
          <span className="text-ink">roughly 1 in 12</span> semi-annual reports end
          with an eligible family losing benefits — because the paperwork came in
          late, not because they stopped qualifying. Statewide that is{" "}
          <span className="text-ink">{C.statewide.eventsWithLoss.toLocaleString()}</span>{" "}
          interruptions in a single year, and the recert rate is{" "}
          <span className="text-ink">rising</span> — up from{" "}
          {C.statewide.rrrLossPctPrior}% the year before.
        </Means>
      </section>

      {/* ── County spread — same rules, different results ───────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-graphite">
          Same rules, very different results
        </h2>
        <div className="overflow-hidden rounded-lg border border-graphite/15">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary text-left text-xs uppercase tracking-wide text-graphite">
              <tr>
                <th className="px-3 py-2 font-medium">County (highest churn)</th>
                <th className="px-3 py-2 text-right font-medium">Recert</th>
                <th className="px-3 py-2 text-right font-medium">Semi-annual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite/10">
              {C.worstCounties.map((c) => (
                <tr key={c.county}>
                  <td className="px-3 py-1.5 text-ink">{c.county}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-graphite">{c.rrr}%</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-graphite">{c.sar7}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Means>
          Every county runs the same program under the same state rules — yet recert
          loss ranges from <span className="text-ink">{C.county.minRrr}%</span> to{" "}
          <span className="text-ink">{C.county.maxRrr}%</span> across{" "}
          {C.county.nCounties} counties. A roughly <span className="text-ink">8×</span>{" "}
          gap with identical rules is the signature of an <em>operational</em>
          problem, not a policy one — the kind a tool levels out. (Los Angeles, the
          largest caseload, sits at {C.county.losAngelesRrr}%.)
        </Means>
      </section>

      {/* ── The close ──────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-pine/25 bg-pine/[0.04] p-5">
        <h2 className="text-base font-semibold text-ink">A perfect application is only half the job.</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-graphite">
          The other half is the perfect renewal. A family can be approved flawlessly
          and still fall off months later because a semi-annual report was a few days
          late. That is not a question of eligibility — it is a deadline, a form, and
          a reminder that never landed. Civica carries the case past approval:
          tracking the next report date, prompting before the wall, and helping
          re-enter the moment a benefit lapses. The same discipline that perfects the
          application keeps it alive.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-graphite">
          See also the application side:{" "}
          <Link href="/findings/error-rate" className="text-pine underline-offset-2 hover:underline">
            where California&rsquo;s SNAP errors come from
          </Link>
          .
        </p>
      </section>

      {/* ── Provenance footer ──────────────────────────────────────────── */}
      <footer className="border-t border-graphite/15 pt-4 text-xs text-graphite">
        <p>
          Source: CDSS CalFresh Churn Monthly Report (CF&nbsp;18), {C.latestFy},
          California statewide + by county. Method:{" "}
          <Link
            href={`/findings/${C.findingId}`}
            className="text-pine underline-offset-2 hover:underline"
          >
            CF-18 churn finding
          </Link>
          . A benefit interruption is a lapse at a reporting moment, not necessarily
          a permanent exit.
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
