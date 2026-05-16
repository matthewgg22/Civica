"use client";

import { useEffect, useState } from "react";

const CA_SNAP_AVG_BENEFIT_PER_PERSON = 192; // USD/mo, CA CalFresh avg 2025
const AVG_HOUSEHOLD_SIZE = 2.4;
const MEALS_PER_DOLLAR = 0.5; // ~$2 per meal nationally

function useCountUp(target: number, durationMs = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target === 0) { setV(0); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return v;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
}

export default function ImpactCounter({ enrolledPackets }: { enrolledPackets: number }) {
  const families = useCountUp(enrolledPackets);
  const people = Math.round(enrolledPackets * AVG_HOUSEHOLD_SIZE);
  const monthlyBenefits = people * CA_SNAP_AVG_BENEFIT_PER_PERSON;
  const monthlyMeals = Math.round(monthlyBenefits * MEALS_PER_DOLLAR);

  const dollars = useCountUp(monthlyBenefits);
  const meals = useCountUp(monthlyMeals);

  return (
    <div className="bg-gradient-to-br from-brick to-brick-soft text-white rounded-[6px] shadow-sm overflow-hidden relative">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle at 85% 15%, white 0%, transparent 50%)",
      }} />
      <div className="relative px-7 py-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[12px] uppercase tracking-[0.15em] font-semibold opacity-85">Civica Impact</p>
          <p className="text-[12px] uppercase tracking-[0.15em] font-medium opacity-70">California · live</p>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <Stat value={families.toLocaleString()} label="Families Enrolled" sub={`~${people.toLocaleString()} individuals served`} />
          <Stat value={`$${formatCompact(dollars)}`} label="Monthly Benefits Unlocked" sub={`~$${formatCompact(monthlyBenefits * 12)} annualized`} divider />
          <Stat value={formatCompact(meals)} label="Estimated Meals / Month" sub={`${formatCompact(meals * 12)} per year`} divider />
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, sub, divider }: { value: string; label: string; sub: string; divider?: boolean }) {
  return (
    <div className={divider ? "pl-6 border-l border-white/15" : ""}>
      <p className="text-[36px] font-semibold tabular-nums tracking-tight leading-none">{value}</p>
      <p className="text-[13px] font-semibold opacity-95 mt-3 uppercase tracking-wider">{label}</p>
      <p className="text-[12px] opacity-75 mt-1">{sub}</p>
    </div>
  );
}
