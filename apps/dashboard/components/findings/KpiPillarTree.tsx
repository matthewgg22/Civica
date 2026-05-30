// KPI steering-tree panel — presentational (server component).
//
// Renders the LIVE KPI truth point (lib/analytics/kpi-snapshot getKpiTruthPoint)
// as the three-pillar tree. Phase 1 holds Pillar 1 (Get In); Pillars 2/3 are
// scaffolded as "not yet instrumented" (TODO-42). The self-upgrading hybrid is
// visible here: each KPI shows a "leading" (in-app proxy) or "measured" (real
// lagging outcome) badge, and measured_per stays "pending" until authoritative
// outcomes exist — it never borrows the self-reported figure (premise P2).

import type { KpiTruthPoint, KpiView } from "../../lib/analytics/kpi-snapshot";

const MIN_N = 30;

function pct(x: number | null | undefined): string {
  return x == null ? "—" : `${x.toFixed(1)}%`;
}

function Badge({ kind }: { kind: string }) {
  const measured = kind === "measured";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        measured ? "bg-pine/10 text-pine" : "bg-indigo/10 text-indigo"
      }`}
    >
      {measured ? "measured" : "leading"}
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
  badge,
}: {
  label: string;
  value: string;
  sub?: string;
  badge?: string;
}) {
  return (
    <div className="rounded-lg border border-graphite/15 bg-surface-secondary p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-graphite">{label}</p>
        {badge ? <Badge kind={badge} /> : null}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{value}</p>
      {sub ? <p className="mt-1 text-xs text-graphite">{sub}</p> : null}
    </div>
  );
}

/** A measured KPI: value + Wilson band at/above the n-gate, else honest "pending". */
function measuredView(v: KpiView | null, pendingNote: string): { value: string; sub: string } {
  if (!v) return { value: "—", sub: "no data" };
  const status = typeof v.meta?.status === "string" ? v.meta.status : "";
  if (status === "measured" && v.valuePct != null) {
    const ci =
      v.ciLow != null && v.ciHigh != null
        ? ` · 95% CI ${v.ciLow.toFixed(1)}–${v.ciHigh.toFixed(1)}`
        : "";
    return { value: pct(v.valuePct), sub: `n=${v.n ?? 0}${ci}` };
  }
  return { value: "pending", sub: `n=${v.n ?? 0} of ${MIN_N}${pendingNote}` };
}

export default function KpiPillarTree({ truthPoint }: { truthPoint: KpiTruthPoint }) {
  const tp = truthPoint;

  if (!tp.available) {
    return (
      <div className="rounded-lg border border-graphite/20 bg-surface-secondary p-8 text-center">
        <p className="text-graphite">
          The KPI snapshot is not populated yet. Once the daily refresh runs (and
          the first packets are scored), the live pillar tree appears here.
        </p>
      </div>
    );
  }

  const cpr = tp.cleanPacketRate;
  const perMeasured = tp.measuredPer?.meta?.status === "measured";
  const denial = measuredView(tp.denialRate, "");
  const per = measuredView(tp.measuredPer, " authoritative");
  const elements = [...tp.elementClean].sort((a, b) => (a.valuePct ?? 0) - (b.valuePct ?? 0));

  return (
    <div className="space-y-10">
      {/* ── Status banner (flips when measured PER clears the gate) ───────── */}
      {perMeasured ? (
        <div className="rounded-lg border border-pine/30 bg-pine/[0.06] p-4">
          <p className="text-sm font-semibold text-pine">Live reading — measured outcome rate</p>
          <p className="mt-1 text-sm leading-relaxed text-graphite">
            The error rate below is measured on {tp.measuredPer?.n} authoritative
            outcomes — real Civica-served results, not a proxy.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-warning/30 bg-warning/[0.06] p-4">
          <p className="text-sm font-semibold text-warning">
            Leading indicators — measured error rate pending
          </p>
          <p className="mt-1 text-sm leading-relaxed text-graphite">
            We show the <span className="text-ink">Clean-Packet Rate</span> we can
            compute today (how clean applications look at submission). The{" "}
            <span className="text-ink">measured</span> error rate stays{" "}
            <span className="text-ink">pending</span> until authoritative county /
            QC outcomes arrive — self-reported outcomes feed denial &amp; churn, but
            never the measured PER.
          </p>
        </div>
      )}

      {/* ── Pillar 1 — Get In ──────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-ink">Pillar 1 · Get In</h2>
        <p className="mb-3 text-xs text-graphite">
          A clean application in, approved at the right amount. The leading proxy is
          the Clean-Packet Rate; the lagging outcomes are denial and measured PER.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Clean-Packet Rate"
            value={pct(cpr?.valuePct)}
            sub={
              cpr?.valuePct == null
                ? "no packets scored yet"
                : `n=${cpr.n ?? 0}${cpr.baselineRef != null ? ` · vs ${cpr.baselineRef.toFixed(2)}% CA baseline` : ""}`
            }
            badge="leading"
          />
          <Stat label="Denial rate" value={denial.value} sub={denial.sub} badge="measured" />
          <Stat label="Measured PER" value={per.value} sub={per.sub} badge="measured" />
          <Stat
            label="Engine"
            value={tp.engineVersion ?? "—"}
            sub={tp.computedAt ? `as of ${new Date(tp.computedAt).toISOString().slice(0, 10)}` : "—"}
          />
        </div>

        {elements.length > 0 ? (
          <div className="mt-4 rounded-lg border border-graphite/15 bg-surface-secondary p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-graphite">
              Element-clean rate (lowest first)
            </p>
            <ul className="mt-2 space-y-1.5">
              {elements.map((e) => (
                <li key={e.element} className="flex items-center justify-between text-sm">
                  <span className="text-graphite">{e.element}</span>
                  <span className="tabular-nums text-ink">{pct(e.valuePct)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* ── Pillars 2 & 3 — scaffolded (TODO-42) ───────────────────────────── */}
      <section className="rounded-lg border border-graphite/15 bg-surface-secondary p-4">
        <h2 className="text-sm font-semibold text-ink">Pillars 2 &amp; 3 — coming next</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-graphite">
          <span className="font-semibold text-ink">Stay Engaged</span>{" "}
          (Active-Relationship Rate) and{" "}
          <span className="font-semibold text-ink">Stay On</span> (Reporting-Moment
          Coverage + churn) are scaffolded in the schema but not yet instrumented.
          The table already supports them — only the builder + data sources remain
          (TODO-42).
        </p>
      </section>
    </div>
  );
}
