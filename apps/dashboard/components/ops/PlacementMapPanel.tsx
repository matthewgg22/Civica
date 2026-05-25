import type { PlacementsData } from "../../lib/ops-fetchers";
import CaliforniaMap from "../CaliforniaMap";

function formatUSD(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function PlacementMapPanel({ data }: { data: PlacementsData }) {
  // Adapt PlacementsData to the CaliforniaMap's `byCountyFips: Record<string, CountyStats>` shape.
  // Map uses CountyStats.count for choropleth intensity; we set the other status
  // fields to 0 since placements aren't packet-status-shaped data.
  const byCountyFips: Record<string, { count: number; draft: number; inProgress: number; needsAttention: number; ready: number; enrolled: number }> = {};
  for (const p of data.placements) {
    if (p.county_fips === "STATEWIDE") continue; // skip non-county bucket for the map
    byCountyFips[p.county_fips] = {
      count: p.placement_count,
      draft: 0, inProgress: 0, needsAttention: 0, ready: 0, enrolled: p.placement_count,
    };
  }

  const totalRevenue = data.placements.reduce((s, p) => s + p.expected_revenue_cents, 0);

  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="eyebrow mb-1">Panel 2 · Monetization geography</p>
          <h3 className="text-[18px] font-bold tracking-tight text-ink">Ad / discount placement map</h3>
          <p className="text-[12px] text-graphite mt-1">
            <span className="font-semibold text-ink tabular-nums">{data.total_active_offers}</span> active offers · <span className="font-semibold text-ink tabular-nums">{formatUSD(totalRevenue)}</span> projected revenue
          </p>
        </div>
        <span className="text-[10px] font-mono text-muted uppercase tracking-wider whitespace-nowrap">
          Planned placements (v1)
        </span>
      </div>

      {!data.available ? (
        <EmptyState
          message="Apply migrations to populate this panel."
          detail="partner_offers (20260579) not present locally."
        />
      ) : data.placements.length === 0 ? (
        <EmptyState
          message="No offers configured."
          detail="Upload partner offer placements via admin to populate the map."
        />
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-6">
          {/* California choropleth */}
          <div className="border border-hairline rounded-[4px] bg-paper p-3">
            <CaliforniaMap byCountyFips={byCountyFips} mode="packets" />
          </div>

          {/* Top counties + category mix — right rail */}
          <div className="w-72 space-y-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Top placements</p>
              <TopCountiesList placements={data.placements} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Category mix</p>
              <CategoryMix placements={data.placements} />
            </div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-graphite mt-4 italic">
        Showing planned placements. Served-impression data pending iOS click-event instrumentation.
      </p>
    </section>
  );
}

function TopCountiesList({ placements }: { placements: PlacementsData["placements"] }) {
  // CA FIPS → name lookup, mirrored from CaliforniaMap. Includes STATEWIDE.
  const top = placements.slice(0, 6);
  const max = Math.max(1, ...top.map((p) => p.placement_count));
  return (
    <ul className="space-y-1.5">
      {top.map((p) => (
        <li key={p.county_fips}>
          <div className="flex items-baseline justify-between text-[12px] mb-0.5">
            <span className="font-semibold text-ink truncate">{fipsLabel(p.county_fips)}</span>
            <span className="font-mono text-ink tabular-nums">{p.placement_count}</span>
          </div>
          <div className="h-1.5 bg-paper rounded-full overflow-hidden">
            <div
              className="h-full bg-pine"
              style={{ width: `${Math.max(8, (p.placement_count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function CategoryMix({ placements }: { placements: PlacementsData["placements"] }) {
  const tally = new Map<string, number>();
  for (const p of placements) {
    for (const c of p.categories) {
      tally.set(c, (tally.get(c) ?? 0) + p.placement_count);
    }
  }
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, n]) => s + n, 0);
  if (total === 0) return <p className="text-[12px] text-graphite">No categories yet.</p>;
  return (
    <ul className="space-y-1.5">
      {sorted.map(([cat, n]) => (
        <li key={cat}>
          <div className="flex items-baseline justify-between text-[12px] mb-0.5">
            <span className="font-semibold text-ink capitalize">{cat.replace(/_/g, " ")}</span>
            <span className="font-mono text-graphite tabular-nums">{Math.round((n / total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-paper rounded-full overflow-hidden">
            <div
              className="h-full bg-pine/60"
              style={{ width: `${Math.max(8, (n / total) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Small FIPS → friendly name. Match the CaliforniaMap's name source where
// possible. For brevity we hard-code the top-15 CA counties + STATEWIDE.
const CA_FIPS_NAMES: Record<string, string> = {
  "06037": "Los Angeles",
  "06065": "Riverside",
  "06019": "Fresno",
  "06071": "San Bernardino",
  "06059": "Orange",
  "06073": "San Diego",
  "06067": "Sacramento",
  "06077": "San Joaquin",
  "06099": "Stanislaus",
  "06107": "Tulare",
  "06029": "Kern",
  "06085": "Santa Clara",
  "06001": "Alameda",
  "06013": "Contra Costa",
  "06075": "San Francisco",
  "STATEWIDE": "Statewide",
};

function fipsLabel(fips: string): string {
  return CA_FIPS_NAMES[fips] ?? fips;
}

function EmptyState({ message, detail }: { message: string; detail: string }) {
  return (
    <div className="pt-5 border-t border-hairline">
      <p className="text-[14px] font-semibold text-ink">{message}</p>
      <p className="text-[12px] text-graphite mt-1 font-mono">{detail}</p>
    </div>
  );
}
