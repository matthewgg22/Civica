import type { TTFDData } from "../../lib/ops-fetchers";
import { caCountyToFips } from "../../lib/caCounties";

function fipsToCountyName(fips: string): string {
  if (fips === "00000") return "Unknown";
  for (const [name, code] of Object.entries(caCountyToFips)) {
    if (code === fips) return name;
  }
  return fips;
}

export default function TTFDPanel({ data }: { data: TTFDData }) {
  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Panel 5 · Speed-to-value</p>
          <h2 className="text-[18px] font-bold tracking-tight text-ink">Time to first deposit</h2>
          <p className="text-[12px] text-graphite mt-1">
            Median days · packet submitted → first SNAP deposit on tracked card
          </p>
        </div>
      </div>

      {!data.available ? (
        <EmptyState
          message="Apply migrations to populate this panel."
          detail="snap_packets / ebt_deposits required."
        />
      ) : (
        <div className="mt-5 pt-5 border-t border-hairline grid grid-cols-3 gap-6">
          <div className="col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1">Median</p>
            <p className="text-[40px] font-bold tracking-tight text-ink leading-none tabular-nums">
              {data.median_days !== null ? `${data.median_days.toFixed(1)}` : "—"}
            </p>
            <p className="text-[12px] text-graphite mt-1">
              {data.median_days !== null ? `days · n=${data.n} journeys` : "no completed journeys yet"}
            </p>
          </div>

          <div className="col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-2">Top counties (by n)</p>
            {data.county_trend.length === 0 ? (
              <p className="text-[12px] text-graphite">No county data yet.</p>
            ) : (
              <table className="w-full text-[12px]">
                <tbody className="divide-y divide-hairline">
                  {data.county_trend.map((row) => (
                    <tr key={row.county_fips}>
                      <td className="py-1.5 text-ink font-semibold">{fipsToCountyName(row.county_fips)}</td>
                      <td className="py-1.5 text-right tabular-nums text-graphite">n={row.n}</td>
                      <td className="py-1.5 pl-3 text-right tabular-nums font-mono text-ink">
                        {row.median_days !== null ? `${row.median_days.toFixed(1)}d` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function EmptyState({ message, detail }: { message: string; detail: string }) {
  return (
    <div className="mt-5 pt-5 border-t border-hairline">
      <p className="text-[14px] font-semibold text-ink">{message}</p>
      <p className="text-[12px] text-graphite mt-1 font-mono">{detail}</p>
    </div>
  );
}
