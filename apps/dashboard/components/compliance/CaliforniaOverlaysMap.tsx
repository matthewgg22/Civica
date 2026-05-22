"use client";

/**
 * CaliforniaOverlaysMap — pillar 1, Section C interactive surface.
 *
 * Renders a US map where every state except California is grayed-out and
 * non-interactive. Tapping California reveals the CA-specific overlay rows
 * (BBCE, SB 1090 asset elimination, HCSUA) below the map.
 *
 * As Civica adds launch states, add their FIPS code to SUPPORTED_STATE_FIPS
 * and provide an `overlaysByState` prop. For now the panel only ships CA
 * overlays so a single-state pass is sufficient.
 *
 * Map-rendering pattern mirrors components/CaliforniaMap.tsx (topojson +
 * d3-geo + us-atlas). This file is a client component because it owns the
 * selected-state state; the parent panel stays a server component.
 */

import { useMemo, useState } from "react";
import { geoAlbers, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import statesData from "us-atlas/states-10m.json";
import type {
  FrameworkItem,
  FrameworkStatus,
} from "../../lib/analytics/snap-framework";

// Minimal local types — match the pattern in components/CaliforniaMap.tsx
// to avoid pulling in @types/topojson-specification + @types/geojson.
type AnyFeature = {
  id?: string | number;
  properties: { name: string };
  geometry: unknown;
};
type AnyFC = { type: "FeatureCollection"; features: AnyFeature[] };
type AnyTopology = {
  type: "Topology";
  objects: Record<string, unknown>;
  arcs: unknown;
};

const CA_FIPS = "06";
const SUPPORTED_STATE_FIPS = new Set([CA_FIPS]);

// Lower-48 only — drop AK (02), HI (15), and all US territories from the
// projection. Tighter aspect ratio, no floating insets, no tiny dots.
// FIPS:  02 AK · 15 HI · 60 AS · 66 Guam · 69 NMI · 72 PR · 74 Minor
//        Outlying Islands · 78 USVI
const EXCLUDED_FIPS = new Set(["02", "15", "60", "66", "69", "72", "74", "78"]);

const STATUS_META: Record<FrameworkStatus, { color: string; bg: string }> = {
  Implemented:    { color: "#C9922A", bg: "rgba(201,146,42,0.10)" },
  Partial:        { color: "#9A5A14", bg: "rgba(154,90,20,0.10)" },
  Discretionary:  { color: "#9C3A24", bg: "rgba(156,58,36,0.10)" },
};

// Inline overlay-row pattern matches the Subsection rows inside
// RulesFrameworkPanel — kept here in lockstep so the look is identical when
// the dropdown expands.
function OverlayRow({ item }: { item: FrameworkItem }) {
  const statusMeta = STATUS_META[item.status];
  return (
    <li className="grid grid-cols-[36px_1fr_auto] gap-x-3.5 py-3 border-b border-hairline last:border-0">
      <div className="pt-0.5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber/5 border border-hairline font-mono text-[10px] font-semibold text-graphite tabular-nums">
          {item.step.toString().padStart(2, "0")}
        </span>
      </div>

      <div className="min-w-0">
        <h5 className="text-[16px] font-semibold tracking-tight text-ink leading-snug">
          {item.statement}
        </h5>
        <p className="text-[14px] text-graphite mt-1.5 leading-relaxed max-w-2xl">
          {item.explainer}
        </p>
        <p className="text-[12px] font-medium text-ink mt-1.5 tabular-nums">
          {item.figures}
        </p>
        <p className="mt-1.5 font-mono text-[10px] tracking-wide text-muted leading-snug">
          <span className="text-graphite">{item.authorities.join(" · ")}</span>
          <span className="mx-2 text-muted/50">·</span>
          <span className="break-all">{item.source}</span>
        </p>
      </div>

      <div className="pt-0.5">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-normal whitespace-nowrap"
          style={{ color: statusMeta.color, background: statusMeta.bg }}
        >
          <span className="w-1 h-1 rounded-full" style={{ background: statusMeta.color }} />
          {item.status}
        </span>
      </div>
    </li>
  );
}

// Projection canvas — lower-48 natural ratio (~1.65:1). ViewBox is
// auto-tightened to the actual projection bounds below to kill dead
// whitespace. Container max-width controls on-screen size.
const PROJ_W = 660;
const PROJ_H = 400;
const PAD = 6;

export default function CaliforniaOverlaysMap({
  overlays,
}: {
  overlays: FrameworkItem[];
}) {
  const [selectedFips, setSelectedFips] = useState<string | null>(null);

  const { stateFeatures, pathGen, viewBox, supportedCentroids } = useMemo(() => {
    const topo = statesData as unknown as AnyTopology;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fcRaw = feature(topo as any, topo.objects.states as any) as unknown as AnyFC;

    // Lower-48 only — drop AK/HI/PR before fitting the projection so the
    // contiguous 48 fills the canvas with no floating-inset whitespace.
    const features = fcRaw.features.filter((f) => {
      const fips = String(f.id ?? "").padStart(2, "0");
      return !EXCLUDED_FIPS.has(fips);
    });
    const fc: AnyFC = { type: "FeatureCollection", features };

    // geoAlbers is the standard contiguous-48 projection — fitSize handles
    // rotation/parallels automatically against the feature collection bounds.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projection = geoAlbers().fitSize([PROJ_W, PROJ_H], fc as any);
    const path = geoPath(projection);

    // Tight viewBox: shrink to the projected bounds so the SVG has minimal
    // dead margin around the continent shape.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [[x0, y0], [x1, y1]] = path.bounds(fc as any);
    const vb = `${x0 - PAD} ${y0 - PAD} ${(x1 - x0) + PAD * 2} ${(y1 - y0) + PAD * 2}`;

    // Pre-compute centroids for supported states (CA today) so labels
    // render on top of the polygons in a separate <g> pass.
    const centroids: Array<{ fips: string; name: string; x: number; y: number }> = [];
    for (const f of features) {
      const fips = String(f.id ?? "").padStart(2, "0");
      if (!SUPPORTED_STATE_FIPS.has(fips)) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [cx, cy] = path.centroid(f as any);
      centroids.push({ fips, name: f.properties.name, x: Math.round(cx * 1000) / 1000, y: Math.round(cy * 1000) / 1000 });
    }

    return {
      stateFeatures: features,
      pathGen: path,
      viewBox: vb,
      supportedCentroids: centroids,
    };
  }, []);

  const caSelected = selectedFips === CA_FIPS;

  return (
    <div>
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-1">
          Section C · California overlays
        </p>
        <h4 className="text-[16px] font-semibold tracking-tight text-ink leading-tight">
          What California changes on top of the federal baseline
        </h4>
        <p className="text-[13px] text-graphite mt-1 leading-snug max-w-2xl">
          States can expand who qualifies and adjust certain numbers on top of
          the federal baseline above. Civica supports California today; other
          states light up here as launch coverage expands.
          {caSelected
            ? " California is selected below — tap it again to collapse."
            : " Tap California on the map to see its three overlays."}
        </p>
      </div>

      <div className="relative mx-auto mt-2" style={{ maxWidth: 720 }}>
        <svg
          viewBox={viewBox}
          className="w-full h-auto block"
          role="img"
          aria-label="Contiguous US map. California is interactive; other states are not yet supported by Civica."
          style={{ overflow: "hidden" }}
        >
          {/* State polygons */}
          <g>
            {stateFeatures.map((f) => {
              const fips = String(f.id ?? "").padStart(2, "0");
              const isSupported = SUPPORTED_STATE_FIPS.has(fips);
              const isSelected = selectedFips === fips;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const d = pathGen(f as any) ?? "";

              // Color palette:
              //  - supported + selected:   solid teal fill, thick teal border
              //  - supported + unselected: 22% teal fill, 1.75px teal border
              //  - unsupported:            cream fill, 0.18-opacity gray border
              const fill = isSupported
                ? isSelected
                  ? "#C9922A"
                  : "rgba(201,146,42,0.22)"
                : "rgba(0,0,0,0.035)";
              const stroke = isSupported ? "#C9922A" : "rgba(0,0,0,0.18)";
              const strokeWidth = isSupported ? 1.75 : 0.6;
              const cursor = isSupported ? "pointer" : "default";
              const label = isSupported
                ? `${f.properties.name} — tap to ${
                    isSelected ? "collapse" : "view CA overlays"
                  }`
                : `${f.properties.name} — not yet supported by Civica`;

              return (
                <path
                  key={fips}
                  d={d}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  className="focus:outline-none focus-visible:outline-none [&:focus-visible]:[stroke:#9A5A14] [&:focus-visible]:[stroke-width:2.25]"
                  style={{ cursor, outline: "none" }}
                  tabIndex={isSupported ? 0 : -1}
                  role={isSupported ? "button" : undefined}
                  aria-label={label}
                  aria-pressed={isSupported ? isSelected : undefined}
                  onClick={() => {
                    if (!isSupported) return;
                    setSelectedFips(isSelected ? null : fips);
                  }}
                  onKeyDown={(e) => {
                    if (!isSupported) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedFips(isSelected ? null : fips);
                    }
                  }}
                >
                  <title>{label}</title>
                </path>
              );
            })}
          </g>

          {/* Supported-state labels — drawn on top of polygons so the
              name reads regardless of fill darkness. */}
          <g style={{ pointerEvents: "none" }}>
            {supportedCentroids.map((c) => {
              const isSelected = selectedFips === c.fips;
              return (
                <text
                  key={c.fips}
                  x={c.x}
                  y={c.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[10px] font-semibold tracking-wide"
                  style={{
                    fill: isSelected ? "#FFFFFF" : "#C9922A",
                    paintOrder: "stroke",
                    stroke: isSelected ? "transparent" : "rgba(248,245,239,0.92)",
                    strokeWidth: 3,
                    strokeLinejoin: "round",
                  }}
                >
                  {c.name}
                </text>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: "rgba(201,146,42,0.22)", border: "1px solid #C9922A" }} />
          Supported state — tap to expand
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: "rgba(0,0,0,0.035)", border: "1px solid rgba(0,0,0,0.18)" }} />
          Not yet supported
        </span>
        <span className="text-muted/60">·</span>
        <span className="italic text-muted">
          AK + HI omitted; future launch states slot into this map
        </span>
      </div>

      {caSelected && (
        <div className="mt-5 pt-4 border-t border-hairline/50">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-amber mb-3">
            California overlays — {overlays.length} active
          </p>
          <ol className="border-t border-hairline">
            {overlays.map((item) => (
              <OverlayRow key={item.step} item={item} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
