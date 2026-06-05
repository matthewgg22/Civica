// KPI steering-tree — presentational server component.
//
// Renders the live KPI truth point as three pillars. Pillar 1 (Get In) is live;
// Pillars 2 and 3 are planned and shown as structured scaffolds so the shape of
// the full tree is visible even before data sources are wired (TODO-42).
//
// Self-upgrading: each KPI carries a "leading" (in-app proxy) or "measured"
// (real lagging outcome) badge. measured_per stays pending until n ≥ 30
// authoritative county outcomes arrive — self-reported figures never fill that slot.

import type { KpiTruthPoint, KpiView } from "../../lib/analytics/kpi-snapshot";

const N_GATE = 30;

// ─── Utility ─────────────────────────────────────────────────────────────────

function pct(x: number | null | undefined, decimals = 1): string {
  return x == null ? "—" : `${x.toFixed(decimals)}%`;
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function measuredStatus(v: KpiView | null): "measured" | "pending" | "empty" {
  if (!v) return "empty";
  return typeof v.meta?.status === "string" && v.meta.status === "measured"
    ? "measured"
    : "pending";
}

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ kind }: { kind: "leading" | "measured" | "not-collecting" }) {
  const styles: Record<typeof kind, string> = {
    leading: "bg-indigo/10 text-indigo",
    measured: "bg-pine/10 text-pine",
    "not-collecting": "bg-graphite/10 text-graphite",
  };
  const labels: Record<typeof kind, string> = {
    leading: "leading",
    measured: "measured",
    "not-collecting": "not yet collecting",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[kind]}`}
    >
      {labels[kind]}
    </span>
  );
}

// ─── Fill bar ─────────────────────────────────────────────────────────────────
// fillPct:      0–100 display fill
// baselinePct:  optional tick mark position (0–100)
// color:        Tailwind bg class for the fill

function FillBar({
  fillPct,
  baselinePct,
  color = "bg-graphite/40",
  baselineLabel,
}: {
  fillPct: number;
  baselinePct?: number;
  color?: string;
  baselineLabel?: string;
}) {
  return (
    <div className="mt-4 space-y-1">
      <div className="relative h-[5px] w-full overflow-hidden rounded-full bg-surface-secondary">
        {baselinePct != null && (
          <div
            className="absolute top-0 h-full w-px bg-graphite/50"
            style={{ left: `${clamp(baselinePct, 0, 99)}%` }}
            aria-hidden="true"
          />
        )}
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${clamp(fillPct, 0, 100)}%` }}
        />
      </div>
      {baselineLabel && (
        <p className="text-[10px] text-graphite">{baselineLabel}</p>
      )}
    </div>
  );
}

// ─── Hero card ────────────────────────────────────────────────────────────────

function HeroCard({
  label,
  value,
  sub,
  badge,
  bar,
  faded,
}: {
  label: string;
  value: string;
  sub?: string;
  badge: "leading" | "measured" | "not-collecting";
  bar?: React.ComponentProps<typeof FillBar>;
  faded?: boolean;
}) {
  return (
    <div
      className={`rounded-[4px] border border-hairline bg-surface p-5 transition-opacity ${faded ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">
          {label}
        </p>
        <SourceBadge kind={badge} />
      </div>
      <p className="mt-3 text-[32px] font-semibold leading-none tabular-nums text-ink">
        {value}
      </p>
      {sub && <p className="mt-1.5 text-xs text-graphite">{sub}</p>}
      {bar && <FillBar {...bar} />}
    </div>
  );
}

// ─── Planned KPI card (Pillars 2 & 3) ────────────────────────────────────────

function PlannedCard({
  label,
  description,
  unlock,
}: {
  label: string;
  description: string;
  unlock: string;
}) {
  return (
    <div className="rounded-[4px] border border-dashed border-graphite/25 bg-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">
          {label}
        </p>
        <SourceBadge kind="not-collecting" />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-graphite">{description}</p>
      <p className="mt-3 text-[10px] text-muted">
        <span className="font-semibold uppercase tracking-wider">Unlocks when:</span>{" "}
        {unlock}
      </p>
    </div>
  );
}

// ─── Self-upgrading Pillar 2/3 KPI card ──────────────────────────────────────
// Renders a real KpiView when the snapshot has the row (leading or measured,
// self-upgrading exactly like Pillar 1). Falls back to the PlannedCard scaffold
// when the key is absent — i.e. the cron hasn't yet written this KPI. So the
// moment the engine emits the row, the card flips from "planned" to live.

function Pillar23Card({
  view,
  label,
  planned,
}: {
  view: KpiView | null | undefined;
  label: string;
  planned: { description: string; unlock: string };
}) {
  // No row yet → the honest "not yet collecting" scaffold.
  if (!view) {
    return <PlannedCard label={label} description={planned.description} unlock={planned.unlock} />;
  }

  const measured = view.sourceKind === "measured";
  const status = typeof view.meta?.status === "string" ? view.meta.status : "";
  const hasValue = view.valuePct != null;

  // Measured rows below the n-gate, or leading rows with no population yet,
  // read "pending" with their sample size — never a fabricated number.
  let value: string;
  let sub: string | undefined;
  if (hasValue) {
    value = pct(view.valuePct);
    sub = measured
      ? `n=${view.n ?? 0}${
          view.ciLow != null ? ` · 95% CI ${view.ciLow.toFixed(1)}–${view.ciHigh?.toFixed(1)}` : ""
        }`
      : `n=${view.n ?? 0}`;
  } else {
    value = measured ? "pending" : "—";
    const EMPTY_NOTE: Record<string, string> = {
      no_active_packets: "no active packets yet",
      no_upcoming_recerts: "no upcoming recertifications yet",
    };
    sub = measured
      ? `n=${view.n ?? 0} of ${N_GATE}`
      : EMPTY_NOTE[status] ?? planned.description;
  }

  return (
    <HeroCard
      label={label}
      badge={measured ? "measured" : "leading"}
      value={value}
      sub={sub}
      bar={
        hasValue
          ? { fillPct: view.valuePct ?? 0, color: measured ? "bg-graphite/40" : "bg-pine/50" }
          : undefined
      }
    />
  );
}

// ─── Status banner ────────────────────────────────────────────────────────────

function StatusBanner({
  perMeasured,
  n,
  measuredN,
}: {
  perMeasured: boolean;
  n: number;
  measuredN?: number | null;
}) {
  if (perMeasured) {
    return (
      <div className="rounded-[4px] border border-pine/30 bg-pine/[0.06] px-5 py-4">
        <p className="text-sm font-semibold text-pine">
          Live reading — measured outcome rate
        </p>
        <p className="mt-1 text-sm leading-relaxed text-graphite">
          The error rate below is measured on{" "}
          <span className="font-semibold text-ink">{measuredN}</span> authoritative
          outcomes — real Civica-served results, not a proxy.
        </p>
      </div>
    );
  }

  const progress = clamp((n / N_GATE) * 100, 0, 100);

  return (
    <div className="rounded-[4px] border border-warning/30 bg-warning/[0.06] px-5 py-4">
      <p className="text-sm font-semibold text-warning">
        Leading indicators — measured error rate pending
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-graphite">
        We show the <span className="font-semibold text-ink">Clean-Packet Rate</span>{" "}
        computed at submission as a leading proxy. The{" "}
        <span className="font-semibold text-ink">measured</span> error rate stays{" "}
        <span className="font-semibold text-ink">pending</span> until authoritative
        county or QC outcomes arrive — self-reported outcomes never fill that slot.
      </p>
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-graphite">QC reviews collected toward measurement</span>
          <span className="tabular-nums font-semibold text-ink">
            {n} / {N_GATE}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper">
          <div
            className="h-full rounded-full bg-warning/60 transition-all duration-500"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={n}
            aria-valuemin={0}
            aria-valuemax={N_GATE}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Pillar header ────────────────────────────────────────────────────────────

function PillarHeader({
  eyebrow,
  title,
  description,
  live,
}: {
  eyebrow: string;
  title: string;
  description: string;
  live: boolean;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">
          {eyebrow}
        </p>
        <span
          className={`inline-flex h-1.5 w-1.5 rounded-full ${live ? "bg-pine" : "bg-graphite/30"}`}
          aria-hidden="true"
        />
        <span className={`text-[10px] font-semibold ${live ? "text-pine" : "text-graphite/60"}`}>
          {live ? "live" : "planned"}
        </span>
      </div>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-graphite">{description}</p>
    </div>
  );
}

// ─── Element-clean bar rows ───────────────────────────────────────────────────

function ElementBar({ label, valuePct }: { label: string; valuePct: number | null }) {
  const v = valuePct ?? 0;
  const color =
    v >= 80 ? "bg-pine/40" : v >= 60 ? "bg-warning/50" : "bg-brick/50";
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs text-graphite">{label}</p>
        <div className="mt-1 h-[5px] w-full overflow-hidden rounded-full bg-surface-secondary">
          <div
            className={`h-full rounded-full ${color}`}
            style={{ width: `${clamp(v, 0, 100)}%` }}
          />
        </div>
      </div>
      <span className="text-sm tabular-nums text-ink">{pct(valuePct)}</span>
    </li>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function KpiPillarTree({ truthPoint }: { truthPoint: KpiTruthPoint }) {
  const tp = truthPoint;

  if (!tp.available) {
    return (
      <div className="rounded-[4px] border border-graphite/20 bg-surface-secondary p-8 text-center">
        <p className="text-sm text-graphite">
          The KPI snapshot is not populated yet. Once the daily refresh runs and
          the first packets are scored, the live pillar tree appears here.
        </p>
      </div>
    );
  }

  const cpr = tp.cleanPacketRate;
  const perStatus = measuredStatus(tp.measuredPer);
  const perMeasured = perStatus === "measured";
  const n = tp.measuredPer?.n ?? 0;
  const elements = [...tp.elementClean].sort(
    (a, b) => (a.valuePct ?? 0) - (b.valuePct ?? 0),
  );

  // Pillar 2/3 KPIs — present once the cron writes them; null → planned scaffold.
  const arr = tp.byKey?.active_relationship_rate ?? null;
  const rmc = tp.byKey?.reporting_moment_coverage ?? null;
  const churn = tp.byKey?.churn_rate ?? null;

  // CPR bar: 0-100%, color by threshold
  const cprVal = cpr?.valuePct ?? 0;
  const cprColor =
    cprVal >= 80 ? "bg-pine/60" : cprVal >= 60 ? "bg-warning/60" : "bg-brick/60";

  // Denial bar: 0-40% scale; lower = better; brick if high
  const denialVal = tp.denialRate?.valuePct ?? 0;
  const denialBarFill = clamp((denialVal / 40) * 100, 0, 100);
  const denialColor =
    denialVal >= 20 ? "bg-brick/60" : denialVal >= 10 ? "bg-warning/60" : "bg-pine/40";

  // PER bar: 0-15% scale; CA baseline tick at 10.98 / 15 * 100 ≈ 73.2%
  const CA_PER = 10.98;
  const PER_SCALE = 15;
  const perVal = tp.measuredPer?.valuePct ?? 0;
  const perBarFill = clamp((perVal / PER_SCALE) * 100, 0, 100);
  const perBaselineTick = clamp((CA_PER / PER_SCALE) * 100, 0, 100);
  const perColor =
    perVal < CA_PER ? "bg-pine/60" : perVal < CA_PER + 2 ? "bg-warning/60" : "bg-brick/60";

  // Denial view
  const denialStatus = measuredStatus(tp.denialRate);
  const denialValue =
    denialStatus === "measured" ? pct(tp.denialRate?.valuePct) : "pending";
  const denialSub =
    denialStatus === "measured"
      ? `n=${tp.denialRate?.n ?? 0}${
          tp.denialRate?.ciLow != null
            ? ` · 95% CI ${tp.denialRate.ciLow.toFixed(1)}–${tp.denialRate.ciHigh?.toFixed(1)}`
            : ""
        }`
      : `n=${tp.denialRate?.n ?? 0} of ${N_GATE}`;

  // PER view
  const perValue = perMeasured ? pct(tp.measuredPer?.valuePct) : "pending";
  const perSub = perMeasured
    ? `n=${tp.measuredPer?.n ?? 0}${
        tp.measuredPer?.ciLow != null
          ? ` · 95% CI ${tp.measuredPer.ciLow.toFixed(1)}–${tp.measuredPer.ciHigh?.toFixed(1)}`
          : ""
      }`
    : `n=${n} of ${N_GATE} authoritative`;

  return (
    <div className="space-y-12">
      {/* ── Status banner ─────────────────────────────────────────────────── */}
      <StatusBanner perMeasured={perMeasured} n={n} measuredN={tp.measuredPer?.n} />

      {/* ── Pillar 1 — Get In ─────────────────────────────────────────────── */}
      <section>
        <PillarHeader
          eyebrow="Pillar 1"
          title="Get In"
          description="A clean application in, approved at the right amount. Leading proxy: Clean-Packet Rate. Lagging outcomes: denial rate and measured payment error rate."
          live
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HeroCard
            label="Clean-Packet Rate"
            badge="leading"
            value={pct(cpr?.valuePct)}
            sub={
              cpr?.valuePct == null
                ? "no packets scored yet"
                : `n=${cpr.n ?? 0}${
                    cpr.baselineRef != null
                      ? ` · vs ${cpr.baselineRef.toFixed(1)}% CA baseline`
                      : ""
                  }`
            }
            bar={
              cpr?.valuePct != null
                ? { fillPct: cprVal, color: cprColor }
                : undefined
            }
          />
          <HeroCard
            label="Denial rate"
            badge="measured"
            value={denialValue}
            sub={denialSub}
            bar={
              denialStatus === "measured"
                ? { fillPct: denialBarFill, color: denialColor }
                : { fillPct: clamp(((tp.denialRate?.n ?? 0) / N_GATE) * 100, 0, 100), color: "bg-graphite/30" }
            }
          />
          <HeroCard
            label="Measured PER"
            badge="measured"
            value={perValue}
            sub={perSub}
            bar={
              perMeasured
                ? {
                    fillPct: perBarFill,
                    baselinePct: perBaselineTick,
                    color: perColor,
                    baselineLabel: `CA bar ${pct(CA_PER, 2)}`,
                  }
                : { fillPct: clamp((n / N_GATE) * 100, 0, 100), color: "bg-graphite/30" }
            }
          />
        </div>

        {/* Engine metadata — footer line, not a card slot */}
        <p className="mt-3 text-[11px] text-muted">
          Engine {tp.engineVersion ?? "—"} ·{" "}
          {tp.computedAt
            ? `snapshot ${new Date(tp.computedAt).toISOString().slice(0, 10)}`
            : "snapshot date unknown"}
        </p>

        {/* Element-clean bar chart */}
        {elements.length > 0 && (
          <div className="mt-5 rounded-[4px] border border-hairline bg-surface p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">
              Element-clean rate — highest-risk first
            </p>
            <p className="mt-1 text-xs text-graphite">
              % of scored packets where this QC element was clean. Lower = more
              frequent QC flag.
            </p>
            <ul className="mt-4 space-y-3">
              {elements.map((e) => (
                <ElementBar
                  key={e.element}
                  label={e.element ?? "unknown"}
                  valuePct={e.valuePct}
                />
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── Pillar 2 — Stay Engaged ───────────────────────────────────────── */}
      <section>
        <PillarHeader
          eyebrow="Pillar 2"
          title="Stay Engaged"
          description="Keep approved households actively connected through their certification period so issues surface before a denial, not after."
          live={arr != null}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Pillar23Card
            view={arr}
            label="Active-Relationship Rate"
            planned={{
              description:
                "What share of active households had a navigator touchpoint in the last 30 days.",
              unlock: "The daily KPI cron ships the Pillar-2 read (navigator_outreach_queue).",
            }}
          />
        </div>
      </section>

      {/* ── Pillar 3 — Stay On ────────────────────────────────────────────── */}
      <section>
        <PillarHeader
          eyebrow="Pillar 3"
          title="Stay On"
          description="Ensure eligible households don't fall off benefits at recertification — the retention pillar that closes the Type-1 error gap."
          live={rmc != null || churn != null}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Pillar23Card
            view={rmc}
            label="Reporting-Moment Coverage"
            planned={{
              description:
                "What share of upcoming recertifications have prep activity started at least 14 days before the deadline.",
              unlock: "The first recertifications enter the window (recertifications table).",
            }}
          />
          <Pillar23Card
            view={churn}
            label="Churn Rate"
            planned={{
              description:
                "What share of resolved recertifications lapsed or opted out — the procedural Type-1 fall-off.",
              unlock: "≥30 recertifications reach a terminal outcome (n-gated, measured).",
            }}
          />
        </div>
      </section>
    </div>
  );
}
