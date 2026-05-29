/**
 * /tools/cliff-preview — T10 proof-of-life surface.
 *
 * Renders `analytics.section10105.fy29Cliff()` (the states delayed to FY29
 * under §10105(B)(iii)) as a static HTML table with provenance footnotes.
 *
 * Gated three ways:
 *   1. Env: only enabled when `ENABLE_ANALYTICS_PREVIEW=1`.
 *   2. Query: must include `?devtools=1`.
 *   3. Server-rendered only; never streamed to clients with creds.
 *
 * If the analytics tier is not yet provisioned (env missing or bucket empty),
 * the page renders an actionable "not ready" panel instead of throwing.
 */
import { analytics } from "@civica/analytics-engine";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ devtools?: string }>;
}

export default async function CliffPreview({ searchParams }: PageProps) {
  const params = await searchParams;
  if (process.env.ENABLE_ANALYTICS_PREVIEW !== "1" || params.devtools !== "1") {
    return (
      <main className="px-8 py-8 max-w-3xl mx-auto">
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">
          cliff-preview disabled
        </h1>
        <p className="text-[14px] text-graphite mt-3 leading-relaxed">
          Set <code className="font-mono text-[12px] bg-surface-secondary px-1.5 py-0.5 rounded">ENABLE_ANALYTICS_PREVIEW=1</code> and append{" "}
          <code className="font-mono text-[12px] bg-surface-secondary px-1.5 py-0.5 rounded">?devtools=1</code>.
        </p>
      </main>
    );
  }

  let result;
  try {
    result = await analytics.section10105.fy29Cliff();
  } catch (err) {
    return (
      <main className="px-8 py-8 max-w-3xl mx-auto">
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">
          analytics tier not ready
        </h1>
        <pre className="bg-surface-secondary border border-hairline rounded-[3px] p-3 text-[12px] overflow-auto mt-4 font-mono">
          {(err as Error).message}
        </pre>
        <p className="text-[14px] text-graphite mt-4 leading-relaxed">
          Run the smoke test in <code className="font-mono text-[12px] bg-surface-secondary px-1.5 py-0.5 rounded">data-ops/SMOKE_TEST.md</code>, then
          execute <code className="font-mono text-[12px] bg-surface-secondary px-1.5 py-0.5 rounded">pnpm tsx data-ops/parsers/section_10105_to_parquet.ts</code>
          {" "}and <code className="font-mono text-[12px] bg-surface-secondary px-1.5 py-0.5 rounded">pnpm tsx scripts/sync-to-supabase-storage.ts</code>.
        </p>
      </main>
    );
  }

  const { rows, provenance } = result;

  return (
    <main className="px-8 py-8 max-w-[1100px] mx-auto">
      <h1 className="text-[22px] font-semibold tracking-tight text-ink">
        §10105 FY29 Cliff — delayed-implementation cohort
      </h1>
      <p className="text-[14px] text-graphite mt-1 leading-relaxed">
        States whose FY24 PER × 1.5 ≥ 20% are delayed from FY28 to FY29 per
        §10105(B)(iii). {rows.length} jurisdictions in the cliff cohort.
      </p>

      <table className="mt-6 border-collapse w-full text-[13px]">
        <thead>
          <tr className="bg-surface-secondary text-left">
            <th className="px-3 py-2 font-semibold text-graphite border-b border-hairline">State</th>
            <th className="px-3 py-2 font-semibold text-graphite border-b border-hairline">FY24 PER %</th>
            <th className="px-3 py-2 font-semibold text-graphite border-b border-hairline">FY24 benefits ($M)</th>
            <th className="px-3 py-2 font-semibold text-graphite border-b border-hairline">Tier</th>
            <th className="px-3 py-2 font-semibold text-graphite border-b border-hairline">Delayed to FY29</th>
            <th className="px-3 py-2 font-semibold text-graphite border-b border-hairline">Annualized liability ($M)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.state}>
              <td className="px-3 py-1.5 text-ink border-b border-hairline/60">{r.state}</td>
              <td className="px-3 py-1.5 text-ink tabular-nums border-b border-hairline/60">{r.fy24_per_pct.toFixed(2)}</td>
              <td className="px-3 py-1.5 text-ink tabular-nums border-b border-hairline/60">{r.fy24_benefits_millions.toLocaleString()}</td>
              <td className="px-3 py-1.5 text-ink border-b border-hairline/60">{r.tier}</td>
              <td className="px-3 py-1.5 text-ink border-b border-hairline/60">{r.delayed_to_fy29 ? "yes" : "no"}</td>
              <td className="px-3 py-1.5 text-ink tabular-nums border-b border-hairline/60">
                {r.annualized_liability_at_tier_millions.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-8">
        <h2 className="text-[16px] font-semibold text-ink">Provenance</h2>
        {provenance.map((p) => (
          <p key={p.bucket_path ?? p.source_url} className="text-[12px] text-graphite mt-1 leading-relaxed">
            <strong className="text-ink">{p.source_kind}</strong> · {p.source_url} · published{" "}
            {p.publication_date} · pulled {p.pulled_at} · parser {p.parser_path}@
            {p.parser_version} · {p.row_count} rows
          </p>
        ))}
      </section>
    </main>
  );
}
