const FLOW_META: Record<string, { label: string; weight: number; color: string }> = {
  sua:    { label: "Shelter / Utility (SUA)", weight: 50.5, color: "#9C3A24" },
  gig:    { label: "Earned income · gig",     weight: 26.8, color: "#2A6F66" },
  lease:  { label: "Shared lease",             weight: 11.4, color: "#9A5A14" },
  assets: { label: "Assets",                   weight: 8.2,  color: "#5A544D" },
  calc:   { label: "Benefit calculation",      weight: 3.1,  color: "#4F46A5" },
};

type DefRow = { flow: string; strong: number; moderate: number; weak: number; source: string };

export default function ScoringPanel({
  total,
  complete,
  incomplete,
  defensibility,
}: {
  total: number;
  complete: number;
  incomplete: number;
  defensibility: DefRow[];
}) {
  const completePct = total > 0 ? (complete / total) * 100 : 0;

  // SVG donut
  const r = 52, stroke = 13;
  const C = 2 * Math.PI * r;
  const dash = (completePct / 100) * C;

  return (
    <section className="bg-surface border border-hairline border-t-2 border-t-pine-surface rounded-[4px] p-7">
      <div className="flex items-start justify-between gap-6 mb-5 flex-wrap">
        <div>
          <p className="eyebrow mb-1.5">Scoring soundness · scoreErrorRisk()</p>
          <h3 className="text-[20px] font-semibold tracking-tight text-ink leading-tight">
            Confidence in current QC scores
          </h3>
          <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
            Current scoring derives defensibility from Argyle income verification plus deterministic
            rules. Per-flow signals from UtilityAPI + the sublease classifier upgrade shelter and
            lease scores from heuristic to verified as those integrations ship.
          </p>
        </div>
        <PhaseLadder current={1} />
      </div>

      {/* Scoring scope caveat */}
      <div className="flex gap-3 items-start bg-amber/7 border border-amber/20 rounded-[3px] p-4 mb-6">
        <svg width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0">
          <path d="M8 1.5 L15 14 L1 14 Z" fill="none" stroke="#9A5A14" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M8 6.5 V 10" stroke="#9A5A14" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="12" r="0.8" fill="#9A5A14"/>
        </svg>
        <p className="text-[13px] text-graphite leading-relaxed">
          <strong className="text-ink font-semibold">Scoring scope.</strong>{" "}
          Shelter/SUA, Shared Lease, and Assets flows are scored from the applicant's intake
          answers plus Argyle income signal. As UtilityAPI and the sublease classifier
          come online, each flow's defensibility tier upgrades from heuristic to independently
          verified.
        </p>
      </div>

      <div className="grid grid-cols-[300px_1fr] gap-7">
        {/* Completeness donut */}
        <div className="border border-hairline rounded-[3px] p-5 bg-paper flex flex-col gap-4">
          <p className="eyebrow">Score completeness</p>
          <div className="flex items-center gap-5">
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r={r} fill="none" stroke="#EDE8DD" strokeWidth={stroke} />
              <circle
                cx="65" cy="65" r={r} fill="none" stroke="#2A6F66" strokeWidth={stroke}
                strokeDasharray={`${dash} ${C - dash}`}
                transform="rotate(-90 65 65)"
                strokeLinecap="butt"
              />
              <text x="65" y="63" textAnchor="middle" fontSize="22" fontWeight="600" fill="#1A1714" style={{ letterSpacing: -0.4 }}>
                {completePct.toFixed(1)}%
              </text>
              <text x="65" y="79" textAnchor="middle" fontSize="9" fill="#5A544D" letterSpacing="0.6" style={{ textTransform: "uppercase" }}>
                COMPLETE
              </text>
            </svg>
            <div className="flex flex-col gap-3 flex-1">
              <DonutLegend color="#2A6F66" label="Complete score" value={complete} hint="all signals present" />
              <DonutLegend color="#EDE8DD" label="Incomplete" value={incomplete} hint="missing inputs" />
              <div className="pt-2 border-t border-hairline/50 flex justify-between text-[11px] text-muted font-mono tracking-wide">
                <span>n = {total.toLocaleString()}</span>
                <span>90-day window</span>
              </div>
            </div>
          </div>
        </div>

        {/* Defensibility stacked bars */}
        <div className="border border-hairline rounded-[3px] p-5 bg-surface flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">Defensibility per error flow</p>
            <div className="flex gap-4 text-[11px] text-graphite">
              <DefLegend color="#2A6F66" label="Strong" />
              <DefLegend color="#9A5A14" label="Moderate" />
              <DefLegend color="#9C3A24" striped label="Weak" />
            </div>
          </div>
          <div className="flex flex-col gap-3 mt-1">
            {defensibility.map((d) => {
              const meta = FLOW_META[d.flow];
              if (!meta) return null;
              return (
                <div key={d.flow} className="flex items-center gap-4">
                  <div className="w-44 shrink-0">
                    <p className="text-[13px] font-medium text-ink">{meta.label}</p>
                    <p className="text-[10px] text-muted font-mono tracking-wide">{d.source}</p>
                  </div>
                  <div className="flex-1 flex h-3.5 rounded-sm overflow-hidden border border-hairline/50">
                    {d.strong > 0 && (
                      <div
                        className="flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ width: `${d.strong}%`, background: "#2A6F66" }}
                      >
                        {d.strong >= 12 ? `${d.strong}%` : ""}
                      </div>
                    )}
                    {d.moderate > 0 && (
                      <div
                        className="flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ width: `${d.moderate}%`, background: "#9A5A14" }}
                      >
                        {d.moderate >= 12 ? `${d.moderate}%` : ""}
                      </div>
                    )}
                    {d.weak > 0 && (
                      <div
                        className="flex items-center justify-center text-white text-[10px] font-bold"
                        style={{
                          width: `${d.weak}%`,
                          background: `repeating-linear-gradient(135deg, rgba(156,58,36,0.6) 0 5px, rgba(156,58,36,0.35) 5px 10px)`,
                        }}
                      >
                        {d.weak >= 14 ? `${d.weak}%` : ""}
                      </div>
                    )}
                  </div>
                  <span
                    className="text-[11px] font-bold font-mono tracking-wide w-14 text-right shrink-0"
                    style={{ color: meta.color }}
                  >
                    w {meta.weight}%
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[12px] text-graphite leading-relaxed mt-2 pt-3 border-t border-hairline/50">
            Rows weighted by USDA payment-error contribution (right column). A flow with 100% weak defensibility
            and high USDA weight (e.g. Shelter/SUA at 50.5%) is the biggest gap in scoring credibility.
          </p>
        </div>
      </div>
    </section>
  );
}

function DonutLegend({ color, label, value, hint }: { color: string; label: string; value: number; hint: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-3 h-3 rounded-sm shrink-0 mt-0.5 border border-hairline" style={{ background: color }} />
      <div className="flex-1">
        <div className="flex justify-between items-baseline">
          <span className="text-[13px] font-medium text-ink">{label}</span>
          <span className="text-[14px] font-bold tabular-nums text-ink">{value.toLocaleString()}</span>
        </div>
        <p className="text-[11px] text-muted">{hint}</p>
      </div>
    </div>
  );
}

function DefLegend({ color, label, striped }: { color: string; label: string; striped?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-3 h-2 rounded-sm"
        style={{ background: striped ? `repeating-linear-gradient(135deg, ${color} 0 4px, ${color}88 4px 8px)` : color }}
      />
      <span>{label}</span>
    </div>
  );
}

function PhaseLadder({ current }: { current: number }) {
  const steps = [
    { n: 1, label: "Heuristic",       sub: "Argyle-only" },
    { n: 2, label: "Multi-signal",    sub: "+ Utility · Sublease" },
    { n: 3, label: "Full evaluation", sub: "all flows scored" },
  ];
  return (
    <div className="shrink-0">
      <p className="eyebrow text-right mb-2">Scoring maturity</p>
      <div className="flex items-start bg-paper border border-hairline rounded-[4px] px-5 py-3 gap-0">
        {steps.map((s, i) => {
          const active = s.n === current;
          const passed = s.n < current;
          const dotColor = active ? "#9A5A14" : passed ? "#2A6F66" : "rgba(90,84,77,0.3)";
          return (
            <div key={s.n} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5 w-28">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: dotColor,
                    boxShadow: active ? `0 0 0 4px rgba(154,90,20,0.15)` : "none",
                  }}
                />
                <span className={`text-[12px] text-center whitespace-nowrap ${active ? "font-semibold text-ink" : "text-graphite"}`}>
                  Phase {s.n} · {s.label}
                </span>
                <span className="text-[10px] text-muted font-mono tracking-wide whitespace-nowrap">{s.sub}</span>
              </div>
              {i < steps.length - 1 && <div className="w-5 h-px bg-hairline -mt-5" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
