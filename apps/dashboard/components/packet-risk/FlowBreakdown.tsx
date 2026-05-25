import type { RiskFlow } from "./types";

const DEF_TONE = {
  strong:       { color: "#2A6F66", label: "Strong",     bg: "rgba(42,111,102,0.10)"  },
  moderate:     { color: "#9A5A14", label: "Moderate",   bg: "rgba(154,90,20,0.10)"   },
  weak:         { color: "#9C3A24", label: "Weak",       bg: "rgba(156,58,36,0.10)"   },
  "not-scored": { color: "#5A544D", label: "Not scored", bg: "rgba(90,84,77,0.10)"    },
} as const;

const TIER_TONE = {
  high:       { color: "#9C3A24", label: "High risk"   },
  medium:     { color: "#9A5A14", label: "Medium risk"  },
  low:        { color: "#2A6F66", label: "Low risk"     },
  incomplete: { color: "#5A544D", label: "Incomplete"   },
} as const;

function tierFromScore(s: number): "high" | "medium" | "low" {
  if (s >= 60) return "high";
  if (s >= 35) return "medium";
  return "low";
}

export default function FlowBreakdown({ flows }: { flows: RiskFlow[] }) {
  const sorted = [...flows].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  const totalPoints = sorted.reduce((s, f) => s + (f.points ?? 0), 0);
  const scored = sorted.filter((f) => f.defensibility !== "not-scored").length;
  const notScored = sorted.length - scored;

  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-7">
      <div className="flex items-start justify-between gap-6 mb-5 flex-wrap">
        <div>
          <p className="eyebrow mb-1.5">Flow-by-flow breakdown</p>
          <h3 className="text-[20px] font-semibold tracking-tight text-ink">
            How the {totalPoints}-point score is composed
          </h3>
          <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
            Each factor contributes points based on verification strength × federal-audit importance.
            Sorted by contribution. Weakly-verified factors with high audit weight are the highest priority
            to firm up before county submission.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-muted font-mono tracking-wide">{sorted.length} factors · {scored} reviewed · {notScored} pending</p>
        </div>
      </div>

      <ParetoStack flows={sorted} total={totalPoints} />

      <div className="flex flex-col mt-6">
        {sorted.map((f, i) => (
          <FlowRow
            key={f.id}
            flow={f}
            index={i}
            priority={f.defensibility === "weak" && f.weight > 20}
          />
        ))}
      </div>

      {/* Total row */}
      <div className="mt-2 pt-4 border-t-2 border-hairline flex justify-between items-center pl-5">
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-semibold text-ink">Total · scoreErrorRisk</span>
          <span
            className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm"
            style={{ color: TIER_TONE[tierFromScore(totalPoints)].color, background: totalPoints >= 60 ? "rgba(156,58,36,0.10)" : totalPoints >= 35 ? "rgba(154,90,20,0.10)" : "rgba(42,111,102,0.10)" }}
          >
            {TIER_TONE[tierFromScore(totalPoints)].label}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[28px] font-bold tabular-nums text-ink" style={{ letterSpacing: -0.6 }}>{totalPoints}</span>
          <span className="text-[12px] text-muted font-mono">/ 100</span>
        </div>
      </div>
    </section>
  );
}

function ParetoStack({ flows, total }: { flows: RiskFlow[]; total: number }) {
  if (total === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex justify-between items-baseline">
        <p className="eyebrow">Contribution to score</p>
        <span className="text-[11px] text-muted font-mono tracking-wide">{total} of 100 points</span>
      </div>
      <div className="flex h-7 rounded-sm overflow-hidden border border-hairline">
        {flows.map((f, i) => {
          const pct = total > 0 ? (f.points ?? 0) / total * 100 : 0;
          const def = DEF_TONE[f.defensibility];
          return (
            <div
              key={f.id}
              style={{
                width: `${pct}%`,
                background: def.color,
                borderRight: i < flows.length - 1 ? "1px solid rgba(255,255,255,0.4)" : "none",
              }}
              className="flex items-center justify-center text-white text-[11px] font-bold overflow-hidden"
            >
              {pct >= 8 ? `${f.points}` : ""}
            </div>
          );
        })}
      </div>
      <div className="flex">
        {flows.map((f) => {
          const pct = total > 0 ? (f.points ?? 0) / total * 100 : 0;
          const def = DEF_TONE[f.defensibility];
          return (
            <div
              key={f.id}
              style={{ width: `${pct}%`, borderLeft: `2px solid ${def.color}`, minWidth: 0 }}
              className="pl-1.5 flex flex-col gap-0.5 overflow-hidden py-1"
            >
              <span className="text-[11px] font-medium text-ink truncate">{f.label}</span>
              <span className="text-[10px] text-muted font-mono tracking-wide">w {f.weight}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlowRow({ flow, index, priority }: { flow: RiskFlow; index: number; priority: boolean }) {
  const def = DEF_TONE[flow.defensibility];
  const notScored = flow.defensibility === "not-scored";

  return (
    <div
      className="grid gap-4 py-5"
      style={{
        gridTemplateColumns: "3px 1fr",
        borderTop: index === 0 ? "none" : "1px solid rgba(26,23,20,0.06)",
      }}
    >
      {/* Priority strip */}
      <div style={{ background: priority ? "#9C3A24" : "transparent", borderRadius: 2 }} />

      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[16px] font-semibold text-ink">{flow.label}</span>
            <span className="text-[11px] text-muted font-mono tracking-wide">w {flow.weight}%</span>
            <span
              className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm"
              style={{ color: def.color, background: def.bg }}
            >
              {def.label}
            </span>
            {priority && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-brick bg-brick/10">
                priority
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span
              className="text-[22px] font-bold tabular-nums"
              style={{ letterSpacing: -0.4, color: notScored ? "#5A544D" : "#1A1714" }}
            >
              {notScored ? "—" : `+${flow.points}`}
            </span>
            {!notScored && <span className="text-[11px] text-muted font-mono">pts</span>}
          </div>
        </div>

        {/* Detail */}
        <p className="text-[13px] text-graphite leading-relaxed max-w-3xl">{flow.detail}</p>

        {/* Evidence grid */}
        <div
          className="grid gap-x-6 gap-y-3 mt-1 pt-3"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            borderTop: "1px dashed rgba(26,23,20,0.06)",
          }}
        >
          {flow.evidence.map((e, i) => {
            const isMissing =
              e.value === "missing" ||
              e.value.includes("not connected") ||
              e.value.includes("not uploaded") ||
              e.value.includes("phase 2") ||
              e.value.toLowerCase() === "none";
            return (
              <div key={i} className="flex flex-col gap-1">
                <span className="eyebrow text-[10px] tracking-[0.12em]">{e.label}</span>
                <span
                  className="text-[13px] font-medium"
                  style={{ color: isMissing ? "#9C3A24" : "#1A1714" }}
                >
                  {e.value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
