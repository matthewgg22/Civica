"use client";

import { useEffect, useState } from "react";

const PILLARS = [
  { id: "pillar-1", label: "Rules" },
  { id: "pillar-2", label: "OBBBA" },
  { id: "pillar-3", label: "Coverage" },
  { id: "pillar-4", label: "Verification" },
  { id: "pillar-5", label: "Outcomes" },
];

export default function PillarNav() {
  const [active, setActive] = useState<string>("pillar-1");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    PILLARS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id);
        },
        { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <nav className="sticky top-0 z-40 bg-paper/95 backdrop-blur-sm border-b border-hairline">
      <div className="max-w-6xl mx-auto px-8 py-2 flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted mr-3 whitespace-nowrap">
          Jump to
        </span>
        {PILLARS.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide transition-colors whitespace-nowrap"
            style={
              active === id
                ? { background: "rgba(201,146,42,0.12)", color: "#C9922A" }
                : { color: "#6B655C" }
            }
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}
