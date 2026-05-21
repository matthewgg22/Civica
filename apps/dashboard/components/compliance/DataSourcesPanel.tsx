/**
 * DataSourcesPanel — public + FOIA data sources feeding the QC framework.
 * Static, source-of-truth lives in `lib/analytics/obbba.ts`.
 */
import type { DataSourceStatus, PublicDataSource } from "../../lib/analytics/obbba";

const STATUS_META: Record<DataSourceStatus, { color: string; bg: string }> = {
  Live:            { color: "#C9922A", bg: "rgba(201,146,42,0.10)" },
  Static:          { color: "#5A544D", bg: "rgba(90,84,77,0.10)" },
  "Planned FOIA":  { color: "#9A5A14", bg: "rgba(154,90,20,0.10)" },
};

export default function DataSourcesPanel({
  sources,
}: {
  sources: PublicDataSource[];
}) {
  return (
    <section
      aria-labelledby="data-sources-title"
      className="bg-surface border border-hairline rounded-[4px] p-7"
    >
      <div className="flex items-start justify-between gap-6 mb-5 flex-wrap">
        <div>
          <p className="eyebrow mb-1.5">Provenance · public data sources behind all five pillars</p>
          <h3
            id="data-sources-title"
            className="text-[20px] font-semibold tracking-tight text-ink leading-tight"
          >
            Where the QC numbers come from
          </h3>
          <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
            Every external dataset Civica leans on for the compliance dashboards, plus
            the FOIA targets that close the remaining gaps. Refresh dates marked
            <span className="font-mono"> 2026-05-20</span> are sources we don&apos;t refresh on a schedule yet.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-hairline">
              <th className="text-left text-[11px] text-muted uppercase tracking-wider font-semibold pb-2 pr-4">
                Source
              </th>
              <th className="text-left text-[11px] text-muted uppercase tracking-wider font-semibold pb-2 pr-4">
                Notes
              </th>
              <th className="text-left text-[11px] text-muted uppercase tracking-wider font-semibold pb-2 pr-4 w-[140px]">
                Last refreshed
              </th>
              <th className="text-left text-[11px] text-muted uppercase tracking-wider font-semibold pb-2 w-[140px]">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => {
              const meta = STATUS_META[s.status];
              return (
                <tr key={s.name} className="border-b border-hairline/50 last:border-0 align-top">
                  <td className="py-3 pr-4">
                    <p className="text-[13px] text-ink">{s.name}</p>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono text-amber hover:underline tracking-wide break-all"
                    >
                      {s.url}
                    </a>
                  </td>
                  <td className="py-3 pr-4 text-graphite leading-relaxed">{s.note}</td>
                  <td className="py-3 pr-4 font-mono text-[11px] text-graphite tracking-wide">
                    {s.lastRefreshed}
                  </td>
                  <td className="py-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ color: meta.color, background: meta.bg }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: meta.color }}
                      />
                      {s.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
