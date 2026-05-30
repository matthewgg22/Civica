// CA county churn choropleth — the "heatmap" for /findings/retention.
//
// Server component (renders the SVG at build time — no client JS). Mirrors the
// proven d3-geo + us-atlas setup of components/CaliforniaMap.tsx, but colors
// each county by its CDSS CF-18 recertification benefit-loss rate (green = low,
// brick = high) instead of packet counts, joining by county NAME. Counties below
// the CF-18 volume threshold render gray. Data: lib/analytics/cf18-county-map.

import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countiesData from "us-atlas/counties-10m.json";
import statesData from "us-atlas/states-10m.json";
import { CF18_COUNTY_MAP, type CountyChurn } from "../../lib/analytics/cf18-county-map";

type AnyFeature = { id?: string | number; properties: { name: string }; geometry: unknown };
type AnyFC = { type: "FeatureCollection"; features: AnyFeature[] };
type AnyTopology = { type: "Topology"; objects: Record<string, unknown>; arcs: unknown };

const CA_STATE_FIPS = "06";
const PROJ_W = 520;
const PROJ_H = 620;
const PAD = 4;

// Churn ramp: low (good) green → amber → brick (bad). Brick is the iOS design
// system's reserved color for SNAP denial/loss/distress — churn IS benefit loss,
// so brick at the high end is on-semantics here. No-data counties are cream.
function churnColor(rate: number | undefined): string {
  if (rate == null) return "#EEEAE0";
  if (rate < 2.5) return "#C8E6D4";
  if (rate < 4) return "#A3D1B5";
  if (rate < 6) return "#E8C97A";
  if (rate < 8) return "#C06030";
  return "#8B2A18";
}

export default function ChurnHeatmap() {
  const topo = countiesData as unknown as AnyTopology;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countiesFC = feature(topo as any, topo.objects.counties as any) as unknown as AnyFC;
  const statesTopo = statesData as unknown as AnyTopology;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statesFC = feature(statesTopo as any, statesTopo.objects.states as any) as unknown as AnyFC;

  const caCounties: AnyFeature[] = countiesFC.features.filter(
    (f) => String(f.id ?? "").padStart(5, "0").startsWith(CA_STATE_FIPS),
  );
  const caState = statesFC.features.find((f) => String(f.id ?? "").padStart(2, "0") === CA_STATE_FIPS);
  if (!caState) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projection = geoMercator().fitSize([PROJ_W, PROJ_H], caState as any);
  const path = geoPath(projection);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [[x0, y0], [x1, y1]] = path.bounds(caState as any);
  const vb = `${x0 - PAD} ${y0 - PAD} ${(x1 - x0) + PAD * 2} ${(y1 - y0) + PAD * 2}`;

  const norm = (s: string) => s.trim().toLowerCase();
  const byName = new Map<string, CountyChurn>();
  for (const c of CF18_COUNTY_MAP.byCounty) byName.set(norm(c.county), c);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-graphite">
          <span className="font-semibold text-ink tabular-nums">{CF18_COUNTY_MAP.byCounty.length}</span>{" "}
          of 58 counties rated · recert benefit-loss, {CF18_COUNTY_MAP.fiscalYear}
        </p>
        <ChurnLegend />
      </div>
      <div className="relative mx-auto" style={{ maxWidth: 260 }}>
        <svg viewBox={vb} className="block h-auto w-full">
          <g>
            {caCounties.map((f) => {
              const fips = String(f.id ?? "").padStart(5, "0");
              const data = byName.get(norm(f.properties.name));
              const fill = churnColor(data?.rrr);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const d = path(f as any) ?? "";
              const tip = data
                ? `${f.properties.name} County — ${data.rrr}% recert churn · ${data.retailers.toLocaleString()} SNAP retailers`
                : `${f.properties.name} County — insufficient volume to rate`;
              return (
                <path key={fips} d={d} fill={fill} stroke="#FFFFFF" strokeWidth={0.5}>
                  <title>{tip}</title>
                </path>
              );
            })}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <path d={path(caState as any) ?? ""} fill="none" stroke="#1A1714" strokeWidth="1" opacity="0.4" />
          </g>
        </svg>
      </div>
      <p className="mt-3 text-center text-xs text-graphite">
        Deepest brick: {CF18_COUNTY_MAP.worst.county} ({CF18_COUNTY_MAP.worst.rrr}%) · palest green:{" "}
        {CF18_COUNTY_MAP.best.county} ({CF18_COUNTY_MAP.best.rrr}%) · hover a county for detail
      </p>
    </div>
  );
}

function ChurnLegend() {
  const stops = ["#C8E6D4", "#A3D1B5", "#E8C97A", "#C06030", "#8B2A18"];
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-graphite">Recert churn</span>
      <div className="flex">
        {stops.map((c, i) => (
          <div key={i} className="h-3 w-5" style={{ background: c }} />
        ))}
      </div>
      <span className="text-[10px] text-graphite">low→high</span>
    </div>
  );
}
