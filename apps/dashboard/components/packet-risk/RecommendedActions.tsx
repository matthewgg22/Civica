import type { RiskAction } from "./types";

const TIER_TONE = {
  high:       { color: "#9C3A24", label: "High risk",   bg: "rgba(156,58,36,0.10)"  },
  medium:     { color: "var(--color-amber-dark)", label: "Medium risk",  bg: "rgba(154,90,20,0.10)"  },
  low:        { color: "#2A6F66", label: "Low risk",     bg: "rgba(42,111,102,0.10)" },
  incomplete: { color: "#5A544D", label: "Incomplete",   bg: "rgba(90,84,77,0.10)"   },
} as const;

function tierFromScore(s: number): keyof typeof TIER_TONE {
  if (s >= 60) return "high";
  if (s >= 35) return "medium";
  return "low";
}

export default function RecommendedActions({
  actions,
  currentScore,
}: {
  actions: RiskAction[];
  currentScore: number | null;
}) {
  if (actions.length === 0) {
    return (
      <section className="bg-surface border border-hairline rounded-[4px] p-7">
        <p className="eyebrow mb-3">Recommended actions</p>
        <div className="border border-dashed border-hairline rounded-[3px] p-6 text-center">
          <p className="text-[14px] font-semibold text-teal">No actions needed — all flows are well-defended.</p>
          <p className="text-[12px] text-muted mt-1">This packet is ready for county submission from a QC risk standpoint.</p>
        </div>
      </section>
    );
  }

  const totalImpact = actions.reduce((s, a) => s + a.impact, 0);
  const projected = currentScore != null ? Math.max(0, currentScore - totalImpact) : null;
  const projectedTier = projected != null ? TIER_TONE[tierFromScore(projected)] : null;

  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-7">
      <div className="flex items-start justify-between gap-6 mb-5 flex-wrap">
        <div>
          <p className="eyebrow mb-1.5">Recommended actions · {actions.length} of {actions.length}</p>
          <h3 className="text-[20px] font-semibold tracking-tight text-ink">Reduce risk before submission</h3>
          <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
            Each action targets the highest-leverage gaps. Estimated impact reflects each factor&apos;s
            federal-audit weight and how much firmer the verification would get. Sorted by impact.
          </p>
        </div>
        {projected != null && projectedTier && (
          <div className="flex flex-col items-end gap-2 shrink-0">
            <p className="eyebrow">If all completed</p>
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] text-muted font-mono tabular-nums line-through">{currentScore}</span>
              <span className="text-graphite">→</span>
              <span
                className="text-[22px] font-bold tabular-nums"
                style={{ color: projectedTier.color, letterSpacing: -0.4 }}
              >
                {projected}
              </span>
              <span
                className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm"
                style={{ color: projectedTier.color, background: projectedTier.bg }}
              >
                {projectedTier.label}
              </span>
            </div>
            <span className="text-[11px] text-pine font-mono tracking-wide">−{totalImpact} pts combined</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {actions.map((a) => <ActionRow key={a.id} action={a} />)}
      </div>

      {/* Disclosure */}
      <div className="flex gap-3 items-start bg-paper border border-hairline/50 rounded-[3px] p-4 mt-5">
        <svg width="14" height="14" viewBox="0 0 14 14" className="mt-0.5 shrink-0">
          <circle cx="7" cy="7" r="6" fill="none" stroke="#5A544D" strokeWidth="1.25"/>
          <path d="M7 4 V 7" stroke="#5A544D" strokeWidth="1.25" strokeLinecap="round" />
          <circle cx="7" cy="10" r="0.7" fill="#5A544D"/>
        </svg>
        <p className="text-[12px] text-graphite leading-relaxed">
          <strong className="text-ink font-semibold">About these estimates.</strong>{" "}
          Impact figures are the score reduction if each factor&apos;s verification moves up one level
          (weak → partial, or partial → verified) at its current federal-audit weight. Actual reductions
          vary based on the evidence Civica receives. Estimates re-compute every time new data is attached.
        </p>
      </div>
    </section>
  );
}

function ActionRow({ action: a }: { action: RiskAction }) {
  return (
    <article
      className="border border-hairline rounded-[3px] p-5 grid gap-5 items-start"
      style={{ gridTemplateColumns: "36px 1fr 130px" }}
    >
      {/* Number marker */}
      <div className="w-8 h-8 rounded-sm bg-paper border border-hairline flex items-center justify-center text-[14px] font-bold text-ink tabular-nums mt-0.5">
        {a.n}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2">
        <h4 className="text-[16px] font-semibold text-ink" style={{ letterSpacing: -0.2 }}>{a.title}</h4>
        <div className="flex items-center gap-3 flex-wrap text-[11px] text-graphite font-mono tracking-wide">
          <span>{a.flowLabel}</span>
          <span className="w-px h-3 bg-hairline" />
          <span>audit weight {a.weight}%</span>
          <span className="w-px h-3 bg-hairline" />
          <span className="flex items-center gap-1">
            <ClockIcon />
            {a.timeEst}
          </span>
          <span className="w-px h-3 bg-hairline" />
          <span>{a.actor}</span>
        </div>
        <p className="text-[13px] text-graphite leading-relaxed max-w-2xl mt-1">{a.body}</p>
      </div>

      {/* Impact + CTA */}
      <div className="flex flex-col items-end gap-3 pt-0.5">
        <div className="flex flex-col items-end gap-0.5">
          <p className="eyebrow text-pine text-[10px] tracking-[0.12em]">est. impact</p>
          <span className="text-[28px] font-bold tabular-nums text-pine leading-none" style={{ letterSpacing: -0.6 }}>
            −{a.impact}
          </span>
          <span className="text-[11px] text-graphite font-mono">pts</span>
        </div>
        <button className="bg-pine text-white text-[13px] font-medium px-3 py-2 rounded-[3px] hover:bg-pine/90 transition-colors whitespace-nowrap w-full text-center">
          {a.cta}
        </button>
        <span className="text-[10px] text-graphite font-mono tracking-wide text-right">{a.ctaSub}</span>
      </div>
    </article>
  );
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" className="inline-block">
      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1"/>
      <path d="M6 3 V 6 L 8 7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none"/>
    </svg>
  );
}
