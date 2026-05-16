"use client";

import { useCallback, useRef, useState } from "react";
import CountyDetailDrawer, { type CountyPacket } from "./CountyDetailDrawer";

export default function MapInteractiveWrapper({
  byCountyPackets,
  children,
}: {
  byCountyPackets: Record<string, CountyPacket[]>;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const onClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Walk up to find the nearest [data-county] anchor
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
      {children}
      {selected && (
        <CountyDetailDrawer
          countyName={selected}
          packets={byCountyPackets[selected] ?? []}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
