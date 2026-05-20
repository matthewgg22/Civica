"use client";

import { useCallback, useRef, useState } from "react";
import CountyDetailDrawer, { type CountyPacket } from "./CountyDetailDrawer";
import CaliforniaMap from "./CaliforniaMap";
import type { MapMode, CountyRiskStats, PacketRiskEntry } from "./mapTypes";

export type { MapMode, CountyRiskStats, PacketRiskEntry };

export default function MapInteractiveWrapper({
  byCountyPackets,
  byCountyFips,
  byCountyRisk,
  packetRiskMap,
}: {
  byCountyPackets: Record<string, CountyPacket[]>;
  byCountyFips: Record<string, { count: number; draft: number; inProgress: number; needsAttention: number; ready: number; enrolled: number }>;
  byCountyRisk?: Record<string, CountyRiskStats>;
  packetRiskMap?: Record<string, PacketRiskEntry>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>("packets");
  const ref = useRef<HTMLDivElement>(null);

  const onClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const el = target.closest<HTMLElement>("[data-county]");
    if (!el) return;
    const county = el.getAttribute("data-county");
    const active = el.getAttribute("data-county-active") === "true";
    if (!county || !active) return;
    e.preventDefault();
    setSelected(county);
  }, []);

  return (
    <div ref={ref} onClick={onClick}>
      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-paper border border-hairline rounded-[4px] p-0.5 self-start w-fit mb-4">
        <button
          onClick={(e) => { e.stopPropagation(); setMode("packets"); }}
          className={`px-3 py-1 text-[12px] font-medium rounded-[3px] transition-colors ${
            mode === "packets" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-graphite"
          }`}
        >
          Volume
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setMode("risk"); }}
          className={`px-3 py-1 text-[12px] font-medium rounded-[3px] transition-colors ${
            mode === "risk" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-graphite"
          }`}
        >
          Error Risk
        </button>
      </div>

      <CaliforniaMap byCountyFips={byCountyFips} byCountyRisk={byCountyRisk} mode={mode} />

      {selected && (
        <CountyDetailDrawer
          countyName={selected}
          packets={byCountyPackets[selected] ?? []}
          packetRiskMap={packetRiskMap}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
