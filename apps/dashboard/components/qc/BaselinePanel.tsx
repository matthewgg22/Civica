const NOISE_THRESHOLD = 2.0;
const SAMPLE_THRESHOLD = 30;

type ComparisonRow = {
  flow: string;
  label: string;
  weight: number;
  baseline: number;
  observed: number | null;
};

export default function BaselinePanel({
  comparison,
  sampleN,
}: {
  comparison: ComparisonRow[];
  sampleN: number;
}) {
  const sufficient = sampleN >= SAMPLE_THRESHOLD;

  return (
    <section className="bg-surface border border-hairline border-t-2 border-t-pine-surface rounded-[4px] p-5">
      <div className="flex items-baseline justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          <p className="eyebrow mb-1">Calibration · USDA observed vs Civica observed</p>
          <h3 className="text-[16px] font-semibold tracking-tight text-ink leading-tight">
            Are observed errors distributing as the formula predicts?
          </h3>
          <p className="text-[12px] text-graphite mt-1 leading-snug">
            When QC sampling reaches n ≥ {SAMPLE_THRESHOLD}, this falsifies (or
            confirms) the formula&apos;s pillar weights. Material disagreement
            means the engine needs recalibration.
          </p>
        </div>
        <div className="text-right shrink-0">
          <SampleChip n={sampleN} sufficient={sufficient} />
          <p className="text-[10px] text-muted font-mono tracking-wide mt-1">source: qc_outcomes · 90d</p>
        </div>
      </div>

      {sampleN === 0 ? (
        <div className="border border-dashed border-hairline/60 rounded-[3px] px-4 py-3 text-center">
          <p className="text-[12px] text-graphite">
            Awaiting QC sampling · dumbbell renders at n ≥ {SAMPLE_THRESHOLD}.
          </p>
        </div>
      ) : (
        <DumbbellChart rows={comparison} />
      )}
    </section>
  );
}

function DumbbellChart({ rows }: { rows: ComparisonRow[] }) {
  const max = 60;
  const xPct = (v: number) => (v / max) * 100;
  const ticks = [0, 15, 30, 45, 60];

  return (
    <div>
      {/* Axis */}
      <div className="grid gap-4 mb-3" style={{ gridTemplateColumns: "220px 64px 1fr 80px" }}>
        <span />
        <span />
        <div className="relative h-5 font-mono text-[10px] text-muted tracking-wide">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2"
              style={{ left: `${xPct(t)}%` }}
            >
              {t}%
            </span>
          ))}
        </div>
        <span />
      </div>

      {rows.map((row) => {
        const observed = row.observed;
        const hasData = observed !== null;
        const delta = hasData ? observed! - row.baseline : null;
        const dir =
          delta === null ? "nodata"
            : delta > NOISE_THRESHOLD ? "over"
            : delta < -NOISE_THRESHOLD ? "under"
            : "noise";

        const dotColor =
          dir === "over" ? "#9C3A24"
            : dir === "under" ? "#2A6F66"
            : "#5A544D";

        const baselineX = xPct(row.baseline);
        const observedX = hasData ? xPct(observed!) : baselineX;
        const lo = Math.min(baselineX, observedX);
        const width = Math.abs(observedX - baselineX);

        return (
          <div
            key={row.flow}
            className="grid gap-4 py-4 border-t border-hairline/50 items-center"
            style={{ gridTemplateColumns: "220px 64px 1fr 80px" }}
          >
            {/* Label */}
            <div>
              <p className="text-[13px] font-medium text-ink">{row.label}</p>
              <p className="text-[10px] text-muted font-mono tracking-wide">w {row.weight}%</p>
            </div>

            {/* Numbers */}
            <div className="font-mono text-[11px] tracking-wide flex flex-col gap-0.5">
              <span className="text-graphite">{row.baseline.toFixed(1)}%</span>
              {hasData ? (
                <span className="font-bold" style={{ color: dotColor }}>{observed!.toFixed(1)}%</span>
              ) : (
                <span className="text-muted">—</span>
              )}
            </div>

            {/* Dumbbell track */}
            <div className="relative h-6">
              {/* Grid ticks */}
              {[15, 30, 45].map((t) => (
                <span
                  key={t}
                  className="absolute top-1 bottom-1 w-px"
                  style={{ left: `${xPct(t)}%`, background: "rgba(26,23,20,0.06)" }}
                />
              ))}
              {/* Connector line */}
              {hasData && width > 0.5 && (
                <span
                  className="absolute top-1/2 -translate-y-1/2 h-0.5 opacity-50"
                  style={{ left: `${lo}%`, width: `${width}%`, background: dotColor }}
                />
              )}
              {/* Baseline dot (hollow) */}
              <span
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-surface border-2 border-graphite"
                style={{ left: `${baselineX}%` }}
              />
              {/* Observed dot */}
              {hasData && (
                <span
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-surface"
                  style={{
                    left: `${observedX}%`,
                    background: dotColor,
                    boxShadow: `0 0 0 1px ${dotColor}`,
                  }}
                />
              )}
            </div>

            {/* Delta */}
            <div className="flex items-center justify-end gap-1 font-bold text-[13px] tabular-nums" style={{ color: dotColor }}>
              {dir === "over"   && <span>▲</span>}
              {dir === "under"  && <span>▼</span>}
              {dir === "noise"  && <span className="text-graphite">≈</span>}
              {dir === "nodata" && <span className="text-muted text-[12px] font-normal">no data</span>}
              {delta !== null && (
                <span>{delta >= 0 ? "+" : ""}{delta.toFixed(1)} pts</span>
              )}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex gap-6 pt-4 border-t border-hairline mt-1 text-[12px] text-graphite flex-wrap">
        <DumbbellLegend kind="baseline" />
        <DumbbellLegend kind="over" />
        <DumbbellLegend kind="under" />
        <DumbbellLegend kind="noise" />
      </div>
    </div>
  );
}

function SampleChip({ n, sufficient }: { n: number; sufficient: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold ${
        sufficient ? "bg-teal/10 text-teal" : "bg-amber/10 text-amber"
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      n = {n} · {sufficient ? "above" : "below"} {SAMPLE_THRESHOLD}-case threshold
    </span>
  );
}

function DumbbellLegend({ kind }: { kind: "baseline" | "over" | "under" | "noise" }) {
  if (kind === "baseline") {
    return (
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-surface border-2 border-graphite" />
        <span>USDA FY2024 CA baseline</span>
      </div>
    );
  }
  const map = {
    over:  { c: "#9C3A24", label: "Civica observed · over baseline (+>2pts)" },
    under: { c: "#2A6F66", label: "Civica observed · under baseline (−>2pts)" },
    noise: { c: "#5A544D", label: "Within ±2pts · noise" },
  };
  const m = map[kind];
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-3 h-3 rounded-full border-2 border-surface"
        style={{ background: m.c, boxShadow: `0 0 0 1px ${m.c}` }}
      />
      <span>{m.label}</span>
    </div>
  );
}
