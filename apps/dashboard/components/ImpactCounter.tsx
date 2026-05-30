"use client";

import { useEffect, useState } from "react";

const CA_SNAP_AVG_BENEFIT_PER_PERSON = 192; // USD/mo, CA CalFresh avg 2025
const AVG_HOUSEHOLD_SIZE = 2.4;
const MEALS_PER_DOLLAR = 0.5; // ~$2 per meal nationally

function useCountUp(target: number, durationMs = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target === 0) { setV(0); return; }
    // Respect prefers-reduced-motion: opt-out users see the final value with
    // no count-up (WCAG 2.3.3 + DESIGN.md motion rules). Without this, the
    // band also opens on a literal "0" for the animation's duration.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setV(target);
      return;
    }
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

/**
 * CIVICA IMPACT band on /dashboard.
 *
 * Color treatment: light warm-gray surface with dark ink text, matched to
 * OpsHeroStrip on /ops. Pine stays only as the LIVE pulse so the brand
 * color still touches the strip without the page opening on a slab of
 * saturated green.
 */
export default function ImpactCounter({
  enrolledPackets,
  projectionLabel,
}: {
  enrolledPackets: number;
  /** Optional small footer (e.g. "Projected · 5% CA CalFresh marketshare").
      When present, signals to the viewer that the numbers reflect a model
      assumption rather than current run rate. */
  projectionLabel?: string;
}) {
  const families = useCountUp(enrolledPackets);
  const people = Math.round(enrolledPackets * AVG_HOUSEHOLD_SIZE);
  const monthlyBenefits = people * CA_SNAP_AVG_BENEFIT_PER_PERSON;
  const monthlyMeals = Math.round(monthlyBenefits * MEALS_PER_DOLLAR);

  const dollars = useCountUp(monthlyBenefits);
  const meals = useCountUp(monthlyMeals);

  return (
    <div
      className="text-ink rounded-[6px] overflow-hidden border border-hairline"
      style={{ backgroundColor: "#E7E5E2" }}
    >
      <div className="px-7 py-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {/* LIVE pulse stays pine — the brand color touchpoint on the strip. */}
            <span className="relative flex items-center justify-center w-2.5 h-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-pine opacity-70 animate-ping"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pine"></span>
            </span>
            <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-graphite">Civica Impact</p>
          </div>
          <p className="text-[12px] uppercase tracking-[0.15em] font-medium text-muted">California · live</p>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <Stat value={families.toLocaleString()} label="Families Enrolled" sub={`~${people.toLocaleString()} individuals served`} />
          <Stat value={`$${formatCompact(dollars)}`} label="Monthly Benefits Unlocked" sub={`~$${formatCompact(monthlyBenefits * 12)} annualized`} divider />
          <Stat value={formatCompact(meals)} label="Estimated Meals / Month" sub={`${formatCompact(meals * 12)} per year`} divider />
        </div>
      </div>
      {projectionLabel && (
        <div
          className="px-7 py-2 border-t border-hairline text-[10px] uppercase tracking-[0.16em] font-mono text-graphite"
          style={{ backgroundColor: "#DCD9D2" }}
        >
          {projectionLabel}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, sub, divider }: { value: string; label: string; sub: string; divider?: boolean }) {
  return (
    <div className={divider ? "pl-6 border-l border-hairline" : ""}>
      <p className="text-[36px] font-bold tabular-nums tracking-tight leading-none text-ink">{value}</p>
      <p className="text-[13px] font-semibold text-graphite mt-3 uppercase tracking-wider">{label}</p>
      <p className="text-[12px] text-muted mt-1">{sub}</p>
    </div>
  );
}
