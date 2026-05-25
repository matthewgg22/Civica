import type { RiskFlow } from "./types";

const TIER_TONE = {
  high:       { color: "#9C3A24", label: "High risk",   bg: "rgba(156,58,36,0.10)"  },
  medium:     { color: "#9A5A14", label: "Medium risk",  bg: "rgba(154,90,20,0.10)"  },
  low:        { color: "#2A6F66", label: "Low risk",     bg: "rgba(42,111,102,0.10)" },
  incomplete: { color: "#5A544D", label: "Incomplete",   bg: "rgba(90,84,77,0.10)"   },
} as const;

export default function RiskScoreHero({
  score,
  tier,
  engineVersion,
  evaluatedAt,
  flows,
}: {
  score: number | null;
  tier: "high" | "medium" | "low" | "incomplete";
  engineVersion: string;
  evaluatedAt: string | null;
  flows: RiskFlow[];
}) {
  const tone = TIER_TONE[tier];
  const weakFlows = flows.filter((f) => f.defensibility === "weak");
  const topWeakWeight = weakFlows.reduce((s, f) => s + f.weight, 0);
  const topWeakPoints = weakFlows.reduce((s, f) => s + (f.points ?? 0), 0);
  const totalPoints = flows.reduce((s, f) => s + (f.points ?? 0), 0);
  const topWeakPctOfScore = totalPoints > 0 ? Math.round((topWeakPoints / totalPoints) * 100) : 0;
  const actionsCount = flows.filter((f) => f.defensibility === "weak" && f.actionable).length;
  const projectedReduction = flows
    .filter((f) => f.defensibility === "weak" && f.actionable)
    .reduce((s, f) => s + (f.impactIfImproved ?? 0), 0);
  const projected = score != null ? Math.max(0, score - projectedReduction) : null;
  const projectedTier = projected == null ? "incomplete" : projected >= 60 ? "high" : projected >= 35 ? "medium" : "low";

  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-7">
      <div className="flex items-start justify-between gap-6 mb-6">
        <p className="eyebrow">Error risk assessment</p>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-[11px] text-muted tabular-nums tracking-wide">
            Civica · {engineVersion}{evaluatedAt ? ` · ${evaluatedAt}` : ""}
          </span>
        </div>
      </div>

      <div className="grid gap-10" style={{ gridTemplateColumns: "320px 1fr" }}>
        {/* Left — score + tier band */}
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-4">
            <span
              className="font-bold tabular-nums leading-none"
              style={{ fontSize: 84, letterSpacing: -3, color: "#1A1714" }}
            >
              {score ?? "—"}
            </span>
            <div className="flex flex-col gap-2 mt-3">
              <span className="text-[13px] text-muted font-mono tracking-wide">/ 100</span>
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm"
                style={{ color: tone.color, background: tone.bg }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone.color }} />
                {tone.label}
              </span>
            </div>
          </div>
          <TierBand score={score ?? 0} tier={tier} />
        </div>

        {/* Right — summary */}
        <div className="flex flex-col gap-4">
          <p className="eyebrow">Summary</p>
          {score == null ? (
            <p className="text-[15px] text-graphite leading-relaxed">
              Not enough data to score this packet yet. Complete the eligibility questionnaire and
              connect Argyle to generate a risk score.
            </p>
          ) : (
            <>
              <p className="text-[16px] text-ink leading-relaxed" style={{ letterSpacing: -0.1 }}>
                This packet is flagged{" "}
                <strong style={{ color: tone.color }}>{tone.label.toLowerCase()}</strong>{" "}
                {weakFlows.length > 0 && (
                  <>
                    primarily because{" "}
                    {weakFlows.slice(0, 2).map((f, i) => (
                      <span key={f.id}>
                        {i > 0 && " and "}<strong className="text-ink">{f.label.toLowerCase()}</strong>
                      </span>
                    ))}{" "}
                    {weakFlows.length === 1 ? "cannot be independently verified" : "have no independent verification signal"}.
                    {topWeakWeight > 0 && (
                      <> These factors account for{" "}
                        <strong className="tabular-nums">{topWeakWeight.toFixed(1)}%</strong>{" "}
                        of the federal audit weight.
                      </>
                    )}
                  </>
                )}
              </p>
              {projected != null && projectedReduction > 0 && (
                <p className="text-[14px] text-graphite leading-relaxed">
                  {actionsCount} recommended action{actionsCount !== 1 ? "s" : ""} below can bring the
                  score to roughly{" "}
                  <strong className="tabular-nums" style={{ color: TIER_TONE[projectedTier].color }}>
                    {projected}
                  </strong>{" "}
                  ({TIER_TONE[projectedTier].label.toLowerCase()}) before submission to the county.
                </p>
              )}
            </>
          )}

          <div className="flex items-center gap-4 pt-3 border-t border-hairline/50 text-[12px] text-graphite flex-wrap">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal" style={{ boxShadow: "0 0 0 3px rgba(42,111,102,0.15)" }} />
              Auto-updates as data is added
            </span>
            <span className="w-px h-3 bg-hairline" />
            <span className="font-mono tracking-wide">{weakFlows.length} risk factor{weakFlows.length !== 1 ? "s" : ""} logged</span>
            {topWeakPctOfScore > 0 && (
              <>
                <span className="w-px h-3 bg-hairline" />
                <span className="font-mono tracking-wide">{topWeakPctOfScore}% of score from weak signals</span>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TierBand({ score, tier }: { score: number; tier: string }) {
  const xPct = (score / 100) * 100;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative" style={{ height: 34 }}>
        {/* Band */}
        <div className="absolute inset-x-0 rounded-sm overflow-hidden border border-hairline/50" style={{ top: 10, height: 12, display: "flex" }}>
          <div style={{ width: "35%", background: "rgba(42,111,102,0.20)" }} />
          <div style={{ width: "25%", background: "rgba(154,90,20,0.22)" }} />
          <div style={{ width: "40%", background: "rgba(156,58,36,0.22)" }} />
        </div>
        {/* Needle */}
        <div className="absolute w-0.5 bg-ink" style={{ top: 4, height: 22, left: `${xPct}%`, transform: "translateX(-50%)" }} />
        <div
          className="absolute bg-ink"
          style={{
            top: 0, left: `${xPct}%`, transform: "translateX(-50%)",
            width: 12, height: 8,
            clipPath: "polygon(50% 100%, 0 0, 100% 0)",
          }}
        />
      </div>
      <div className="flex justify-between">
        <BandLabel label="Low"    range="0–34"   color="#2A6F66" active={tier === "low"}    />
        <BandLabel label="Medium" range="35–59"  color="#9A5A14" active={tier === "medium"} />
        <BandLabel label="High"   range="60–100" color="#9C3A24" active={tier === "high"}   />
      </div>
    </div>
  );
}

function BandLabel({ label, range, color, active }: { label: string; range: string; color: string; active: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 ${active ? "" : "opacity-60"}`}>
      <span className="text-[12px] font-semibold" style={{ color: active ? color : "#5A544D" }}>{label}</span>
      <span className="text-[10px] text-muted font-mono tracking-wide">{range}</span>
    </div>
  );
}
