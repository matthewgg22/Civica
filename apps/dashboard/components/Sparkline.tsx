export default function Sparkline({
  data,
  label,
  unit,
  goal,
}: {
  data: { label: string; value: number }[];
  label: string;
  unit: string;
  goal?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="py-6 px-5 bg-paper border border-dashed border-hairline rounded-[4px] flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-teal/15 flex items-center justify-center shrink-0">
          <span className="text-teal text-[18px]">◷</span>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-ink">No completed handoffs yet</p>
          <p className="text-[13px] text-graphite mt-1 leading-snug">
            Median time-to-handoff will appear here once packets move from <em>Submitted</em> → <em>Handed Off</em>. Target: under {goal ?? 7}{unit}.
          </p>
        </div>
      </div>
    );
  }

  const w = 380;
  const h = 80;
  const pad = 6;
  const values = data.map((d) => d.value);
  const min = Math.min(...values, goal ?? Infinity);
  const max = Math.max(...values, goal ?? -Infinity);
  const range = Math.max(1, max - min);
  const stepX = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const y = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);

  const points = data.map((d, i) => `${pad + i * stepX},${y(d.value)}`).join(" ");
  const areaPoints = `${pad},${h - pad} ${points} ${pad + (data.length - 1) * stepX},${h - pad}`;

  const latest = values[values.length - 1];
  const prev = values.length > 1 ? values[values.length - 2] : latest;
  const delta = latest - prev;
  const trendDown = delta < 0;
  const goalMet = goal != null && latest <= goal;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <p className="text-[32px] font-semibold tabular-nums leading-none text-ink">
            {latest.toFixed(1)}<span className="text-[14px] text-graphite font-medium ml-1">{unit}</span>
          </p>
          <p className="text-[13px] text-ink mt-1.5 font-medium">{label}</p>
        </div>
        <div className="text-right">
          <span className={`text-[14px] font-bold tabular-nums ${
            // Lower-is-better metric (time-to-handoff). When over goal, any upward
            // trend is "bad" — show brick. Otherwise the smaller-better rule applies.
            goal != null && latest > goal
              ? "text-brick"
              : trendDown
                ? "text-teal"
                : delta === 0
                  ? "text-graphite"
                  : "text-amber"
          }`}>
            {trendDown ? "▼" : delta === 0 ? "—" : "▲"} {Math.abs(delta).toFixed(1)}{unit}
          </span>
          <p className="text-[12px] text-graphite mt-0.5 font-medium">vs last week</p>
          {goal != null && (
            <p className={`text-[12px] mt-1.5 font-semibold ${goalMet ? "text-teal" : "text-brick"}`}>
              {goalMet ? "✓ at goal" : `${(latest - goal).toFixed(1)}${unit} over goal (${goal}${unit})`}
            </p>
          )}
        </div>
      </div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full">
        <polygon points={areaPoints} fill="rgba(42,111,102,0.22)" />
        <polyline points={points} fill="none" stroke="#2A6F66" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {goal != null && (
          <line x1={pad} x2={w - pad} y1={y(goal)} y2={y(goal)} stroke="var(--color-amber-dark)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
        )}
        <circle cx={pad + (data.length - 1) * stepX} cy={y(latest)} r="3.5" fill="#2A6F66" />
      </svg>
    </div>
  );
}
