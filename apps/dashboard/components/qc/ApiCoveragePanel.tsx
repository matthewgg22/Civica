type ApiEntry = {
  id: string;
  name: string;
  status: "live" | "phase2";
  purpose: string;
  flow: string;
  weight: number;
  connectedPct: number;
  connectedN: number;
  totalN: number;
  detail: string;
  since: string;
};

const FLOW_COLOR: Record<string, string> = {
  sua: "#9C3A24", gig: "#2A6F66", lease: "#9A5A14", assets: "#5A544D", calc: "#4F46A5",
};

export default function ApiCoveragePanel({ apis, totalPackets }: { apis: ApiEntry[]; totalPackets: number }) {
  const liveFlows = new Set(apis.filter((a) => a.status === "live").map((a) => a.flow));
  const deterministicFlows = new Set(["calc"]);

  const FLOWS = [
    { id: "sua",    label: "Shelter / Utility (SUA)", weight: 50.5 },
    { id: "gig",    label: "Earned income · gig",     weight: 26.8 },
    { id: "lease",  label: "Shared lease",             weight: 11.4 },
    { id: "assets", label: "Assets",                   weight: 8.2  },
    { id: "calc",   label: "Benefit calculation",      weight: 3.1  },
  ];

  const coveredWeight = FLOWS
    .filter((f) => liveFlows.has(f.id) || deterministicFlows.has(f.id))
    .reduce((s, f) => s + f.weight, 0);
  const uncoveredWeight = 100 - coveredWeight;

  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-7">
      <div className="flex items-start justify-between gap-6 mb-6 flex-wrap">
        <div>
          <p className="eyebrow mb-1.5">API integration · weighted coverage</p>
          <h3 className="text-[20px] font-semibold tracking-tight text-ink leading-tight">
            {uncoveredWeight.toFixed(1)}% of USDA-weighted error risk has no live API signal
          </h3>
          <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
            Each USDA error category has a fixed weight in California's payment-error rate.
            The bar below shows which categories Civica can independently verify today.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="eyebrow">APIs · 1 live · 2 pending</p>
          <p className="text-[11px] text-muted font-mono tracking-wide mt-1">n = {totalPackets.toLocaleString()} packets · 90d</p>
        </div>
      </div>

      {/* Covered / uncovered headline */}
      <div className="flex gap-10 mb-6 flex-wrap">
        <div>
          <p className="eyebrow text-teal">Covered by live signal</p>
          <p className="text-[36px] font-bold tabular-nums leading-none text-teal mt-1">{coveredWeight.toFixed(1)}%</p>
          <p className="text-[11px] text-muted font-mono tracking-wide mt-1.5">of weighted error risk</p>
        </div>
        <div className="w-px bg-hairline self-stretch" />
        <div>
          <p className="eyebrow text-amber">Not yet covered</p>
          <p className="text-[36px] font-bold tabular-nums leading-none text-amber mt-1">{uncoveredWeight.toFixed(1)}%</p>
          <p className="text-[11px] text-muted font-mono tracking-wide mt-1.5">awaiting Phase 2 integration</p>
        </div>
      </div>

      {/* Coverage bar */}
      <CoverageBar flows={FLOWS} liveFlows={liveFlows} deterministicFlows={deterministicFlows} />

      {/* API cards */}
      <div className="grid grid-cols-3 gap-4 mt-7">
        {apis.map((api) => <ApiCard key={api.id} api={api} />)}
      </div>
    </section>
  );
}

function CoverageBar({
  flows,
  liveFlows,
  deterministicFlows,
}: {
  flows: { id: string; label: string; weight: number }[];
  liveFlows: Set<string>;
  deterministicFlows: Set<string>;
}) {
  const sorted = [...flows].sort((a, b) => b.weight - a.weight);
  return (
    <div>
      <div className="flex h-9 rounded-[3px] overflow-hidden border border-hairline">
        {sorted.map((f, i) => {
          const covered = liveFlows.has(f.id) || deterministicFlows.has(f.id);
          const baseColor = covered ? "#2A6F66" : f.id === "sua" ? "#9C3A24" : "#9A5A14";
          return (
            <div
              key={f.id}
              style={{
                width: `${f.weight}%`,
                background: covered
                  ? baseColor
                  : `repeating-linear-gradient(135deg, ${baseColor} 0 6px, ${baseColor}CC 6px 12px)`,
                borderRight: i < sorted.length - 1 ? "1px solid rgba(255,255,255,0.35)" : "none",
              }}
            />
          );
        })}
      </div>

      {/* Segment labels */}
      <div className="flex mt-2 text-[11px]">
        {sorted.map((f) => {
          const covered = liveFlows.has(f.id) || deterministicFlows.has(f.id);
          const color = covered ? "#2A6F66" : f.id === "sua" ? "#9C3A24" : "#9A5A14";
          const narrow = f.weight < 6;
          return (
            <div
              key={f.id}
              style={{ width: `${f.weight}%`, borderLeft: `2px solid ${color}`, minWidth: 0 }}
              className="pl-1.5 flex flex-col gap-0.5 overflow-hidden"
            >
              {!narrow && (
                <>
                  <span className="text-ink font-medium truncate">{f.label}</span>
                  <span className="text-muted font-mono text-[10px] tracking-wide truncate">
                    {f.weight}% · {covered ? "✓ live" : "no signal"}
                  </span>
                </>
              )}
              {narrow && <span className="text-muted font-mono text-[10px]">{f.weight}%</span>}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-5 mt-4 text-[12px] text-graphite flex-wrap">
        <LegendSwatch color="#2A6F66" label="Covered by live API or deterministic engine" />
        <LegendSwatch color="#9A5A14" striped label="Awaiting Phase 2 integration" />
        <LegendSwatch color="#9C3A24" striped label="Largest gap · highest weight" />
      </div>
    </div>
  );
}

function LegendSwatch({ color, label, striped }: { color: string; label: string; striped?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-4 h-2.5 rounded-sm shrink-0"
        style={{
          background: striped
            ? `repeating-linear-gradient(135deg, ${color} 0 4px, ${color}AA 4px 8px)`
            : color,
        }}
      />
      <span>{label}</span>
    </div>
  );
}

function ApiCard({ api }: { api: ApiEntry }) {
  const isLive = api.status === "live";
  const flowColor = FLOW_COLOR[api.flow] ?? "#5A544D";
  return (
    <article
      className={`rounded-[3px] p-5 flex flex-col gap-3 border ${isLive ? "bg-surface border-hairline" : "bg-paper border-hairline"}`}
      style={{ borderTop: `3px solid ${isLive ? "#2A6F66" : "#9A5A14"}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-ink">{api.name}</p>
          <p className="text-[12px] text-graphite mt-0.5">{api.purpose}</p>
        </div>
        <StatusPill status={api.status} />
      </div>

      <div className="flex items-baseline gap-2 mt-1">
        <span className={`text-[28px] font-bold tabular-nums leading-none ${isLive ? "text-ink" : "text-ink/30"}`}>
          {isLive ? `${api.connectedPct}%` : "—"}
        </span>
        <span className="text-[12px] text-graphite">
          {isLive
            ? `of packets connected · ${api.connectedN.toLocaleString()}/${api.totalN.toLocaleString()}`
            : "not connected on any packet"}
        </span>
      </div>

      <div className="h-1 bg-paper border border-hairline rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${api.connectedPct}%`,
            background: isLive ? "#2A6F66" : "rgba(154,90,20,0.35)",
          }}
        />
      </div>

      <div className="flex items-baseline justify-between pt-2 border-t border-hairline/50 mt-1">
        <div>
          <p className="eyebrow text-[10px]">USDA weight</p>
          <p className="text-[14px] font-bold tabular-nums mt-0.5" style={{ color: flowColor }}>{api.weight}%</p>
        </div>
        <span className="text-[11px] text-muted font-mono tracking-wide">{api.since}</span>
      </div>

      <p
        className="text-[12px] text-graphite leading-relaxed rounded-[2px] px-2.5 py-2 mt-1"
        style={{ background: isLive ? "#F5F2EC" : "rgba(154,90,20,0.06)" }}
      >
        {api.detail}
      </p>
    </article>
  );
}

function StatusPill({ status }: { status: "live" | "phase2" }) {
  return status === "live" ? (
    <span className="text-[10px] font-bold uppercase tracking-wider text-pine bg-pine/10 px-2 py-0.5 rounded-sm">Live</span>
  ) : (
    <span className="text-[10px] font-bold uppercase tracking-wider text-amber bg-amber/10 px-2 py-0.5 rounded-sm">Phase 2</span>
  );
}
