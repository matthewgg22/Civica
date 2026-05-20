import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countiesData from "us-atlas/counties-10m.json";
import statesData from "us-atlas/states-10m.json";
import type { MapMode, CountyRiskStats } from "./mapTypes";

// Minimal local types — avoid pulling in @types/topojson-specification + @types/geojson
type AnyFeature = { id?: string | number; properties: { name: string }; geometry: unknown };
type AnyFC = { type: "FeatureCollection"; features: AnyFeature[] };
type AnyTopology = { type: "Topology"; objects: Record<string, unknown>; arcs: unknown };

type CountyStats = {
  count: number;
  draft: number;
  inProgress: number;
  needsAttention: number;
  ready: number;
  enrolled: number;
};

const CA_STATE_FIPS = "06";
// Generous projection canvas — we tighten the viewBox to CA's actual bounds below.
const PROJ_W = 520;
const PROJ_H = 620;
const PAD = 4;

function colorFor(count: number, max: number): string {
  if (count === 0) return "#EEEAE0";
  const t = max > 0 ? count / max : 0;
  if (t < 0.15) return "#F5D8CF";
  if (t < 0.35) return "#E8A493";
  if (t < 0.6)  return "#D27158";
  if (t < 0.85) return "#B0492F";
  return "#7A2D1B";
}

function riskColorFor(risk: CountyRiskStats | undefined): string {
  if (!risk || risk.scored === 0) return "#EEEAE0";
  const avg = risk.avgScore ?? 0;
  if (avg < 20) return "#C8E6D4";
  if (avg < 35) return "#A3D1B5";
  if (avg < 50) return "#E8C97A";
  if (avg < 65) return "#D4A033";
  if (avg < 80) return "#C06030";
  return "#8B2A18";
}

export default function CaliforniaMap({
  byCountyFips,
  byCountyRisk,
  mode = "packets",
}: {
  byCountyFips: Record<string, CountyStats>;
  byCountyRisk?: Record<string, CountyRiskStats>;
  mode?: MapMode;
}) {
  // us-atlas counties-10m.json has objects.counties with FIPS id (state+county = 5-digit)
  const topo = countiesData as unknown as AnyTopology;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countiesFC = feature(topo as any, topo.objects.counties as any) as unknown as AnyFC;
  const statesTopo = statesData as unknown as AnyTopology;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statesFC = feature(statesTopo as any, statesTopo.objects.states as any) as unknown as AnyFC;

  const caCounties: AnyFeature[] = countiesFC.features.filter(
    (f) => String(f.id ?? "").padStart(5, "0").startsWith(CA_STATE_FIPS)
  );
  const caState = statesFC.features.find((f) => String(f.id ?? "").padStart(2, "0") === CA_STATE_FIPS);

  if (!caState) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projection = geoMercator().fitSize([PROJ_W, PROJ_H], caState as any);
  const path = geoPath(projection);
  // Tight viewBox: shrink to the projected bounds of CA so there's no dead whitespace.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [[x0, y0], [x1, y1]] = path.bounds(caState as any);
  const vb = `${x0 - PAD} ${y0 - PAD} ${(x1 - x0) + PAD * 2} ${(y1 - y0) + PAD * 2}`;

  const counts = Object.values(byCountyFips).map((s) => s.count);
  const max = counts.length > 0 ? Math.max(...counts) : 0;
  const totalPackets = counts.reduce((a, b) => a + b, 0);
  const activeCounties = counts.filter((c) => c > 0).length;

  // FIPS → name map for the "top counties" status mix
  const fipsToName = new Map<string, string>();
  for (const f of caCounties) fipsToName.set(String(f.id ?? "").padStart(5, "0"), f.properties.name);
  const topCounties = Object.entries(byCountyFips)
    .filter(([, s]) => s.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([fips, s]) => ({ name: fipsToName.get(fips) ?? "", stats: s }));

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <p className="text-[14px] text-graphite">
            <span className="font-bold text-ink tabular-nums text-[16px]">{activeCounties}</span> of 58 California counties active · <span className="font-semibold text-ink tabular-nums">{totalPackets.toLocaleString()}</span> packets placed
          </p>
          <p className="inline-flex items-center gap-1.5 mt-2 text-[12px] font-semibold text-teal bg-teal/10 px-2.5 py-1 rounded-full">
            <span className="text-[13px]">⌕</span>
            Click any shaded county for a snapshot
          </p>
        </div>
        {mode === "risk" ? <RiskLegend /> : <Legend max={max} />}
      </div>
      <div className="relative mx-auto" style={{ maxWidth: 240 }}>
        <svg viewBox={vb} className="w-full h-auto block">
          <g>
            {caCounties.map((f) => {
              const fips = String(f.id ?? "").padStart(5, "0");
              const stats = byCountyFips[fips];
              const risk = byCountyRisk?.[fips];
              const count = stats?.count ?? 0;
              const fill = mode === "risk" ? riskColorFor(risk) : colorFor(count, max);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const d = path(f as any) ?? "";
              const isActive = mode === "risk" ? (risk?.scored ?? 0) > 0 : count > 0;
              const href = isActive ? `#county-${encodeURIComponent(f.properties.name)}` : "#";
              const tooltip = mode === "risk"
                ? `${f.properties.name} County — avg risk score ${risk?.avgScore != null ? risk.avgScore : "n/a"} · ${risk?.high ?? 0} high, ${risk?.medium ?? 0} medium, ${risk?.low ?? 0} low${isActive ? " · click for detail" : ""}`
                : `${f.properties.name} County — ${count} packet${count === 1 ? "" : "s"}${stats?.needsAttention ? ` · ${stats.needsAttention} need attention` : ""}${isActive ? " · click for detail" : ""}`;
              return (
                <a
                  key={fips}
                  href={href}
                  data-county={f.properties.name}
                  data-county-active={isActive ? "true" : "false"}
                  className="group"
                  style={{ cursor: isActive ? "pointer" : "default" }}
                >
                  <path
                    d={d}
                    fill={fill}
                    stroke="#FFFFFF"
                    strokeWidth={0.5}
                    className={isActive ? "transition-all group-hover:stroke-[#2A6F66] group-hover:[stroke-width:1.5]" : ""}
                  >
                    <title>{tooltip}</title>
                  </path>
                </a>
              );
            })}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <path d={path(caState as any) ?? ""} fill="none" stroke="#1A1714" strokeWidth="1" opacity="0.4" />
          </g>
        </svg>
      </div>
      {topCounties.length > 0 && (
        <div className="mt-5 pt-4 border-t border-hairline">
          <div className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
            <p className="text-[12px] uppercase tracking-wider font-bold text-ink">Top Counties · Status Mix</p>
            <div className="flex items-center gap-3 text-[12px] text-graphite font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-graphite" />Draft</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo" />In Progress</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber" />Attention</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal" />Ready</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brick" />Enrolled</span>
            </div>
          </div>
          <ul className="space-y-2.5">
            {topCounties.map((c) => {
              const total = c.stats.count;
              const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
              return (
                <li key={c.name}>
                  <a
                    href={`/dashboard?county=${encodeURIComponent(c.name)}`}
                    data-county={c.name}
                    data-county-active="true"
                    className="block hover:bg-paper -mx-2 px-2 py-1.5 rounded-[3px] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[13px] font-semibold text-ink group-hover:text-pine transition-colors">{c.name}</span>
                      <span className="text-[12px] text-graphite tabular-nums font-semibold">{total}</span>
                    </div>
                    {/* 2px gaps (via gap-0.5) on a white-track parent give visible dividers between segments */}
                    <div className="relative h-3 rounded-full overflow-hidden flex gap-0.5 bg-white">
                      {c.stats.draft > 0          && <div className="bg-graphite h-full" style={{ width: `${pct(c.stats.draft)}%` }} />}
                      {c.stats.inProgress > 0     && <div className="bg-indigo h-full"   style={{ width: `${pct(c.stats.inProgress)}%` }} />}
                      {c.stats.needsAttention > 0 && <div className="bg-amber h-full"    style={{ width: `${pct(c.stats.needsAttention)}%` }} />}
                      {c.stats.ready > 0          && <div className="bg-teal h-full"     style={{ width: `${pct(c.stats.ready)}%` }} />}
                      {c.stats.enrolled > 0       && <div className="bg-brick h-full"    style={{ width: `${pct(c.stats.enrolled)}%` }} />}
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Legend({ max }: { max: number }) {
  if (max === 0) {
    return <p className="text-[11px] text-muted">No packets yet</p>;
  }
  const stops = [
    { color: "#EEEAE0", label: "0" },
    { color: "#F5D8CF", label: "" },
    { color: "#E8A493", label: "" },
    { color: "#D27158", label: "" },
    { color: "#B0492F", label: "" },
    { color: "#7A2D1B", label: `${max}+` },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted uppercase tracking-wider font-medium">Packets</span>
      <div className="flex">
        {stops.map((s, i) => (
          <div key={i} className="w-5 h-3" style={{ background: s.color }} />
        ))}
      </div>
      <span className="text-[10px] text-muted tabular-nums">{stops[0].label}–{stops[stops.length - 1].label}</span>
    </div>
  );
}

function RiskLegend() {
  const stops = [
    { color: "#C8E6D4", label: "Low" },
    { color: "#E8C97A", label: "Med" },
    { color: "#C06030", label: "" },
    { color: "#8B2A18", label: "High" },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted uppercase tracking-wider font-medium">Risk</span>
      <div className="flex">
        {stops.map((s, i) => (
          <div key={i} className="w-5 h-3" style={{ background: s.color }} />
        ))}
      </div>
      <span className="text-[10px] text-muted">{stops[0].label}→{stops[stops.length - 1].label}</span>
    </div>
  );
}
