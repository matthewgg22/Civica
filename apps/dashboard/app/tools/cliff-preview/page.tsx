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
      <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>cliff-preview disabled</h1>
        <p style={{ color: "#555", fontSize: 14 }}>
          Set <code>ENABLE_ANALYTICS_PREVIEW=1</code> and append{" "}
          <code>?devtools=1</code>.
        </p>
      </main>
    );
  }

  let result;
  try {
    result = await analytics.section10105.fy29Cliff();
  } catch (err) {
    return (
      <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>analytics tier not ready</h1>
        <pre
          style={{
            background: "#fafafa",
            border: "1px solid #eee",
            padding: 12,
            fontSize: 12,
            overflow: "auto",
          }}
        >
          {(err as Error).message}
        </pre>
        <p style={{ fontSize: 14, color: "#555", marginTop: 12 }}>
          Run the smoke test in <code>data-ops/SMOKE_TEST.md</code>, then
          execute <code>pnpm tsx data-ops/parsers/section_10105_to_parquet.ts</code>
          and <code>pnpm tsx scripts/sync-to-supabase-storage.ts</code>.
        </p>
      </main>
    );
  }

  const { rows, provenance } = result;

  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>
        §10105 FY29 Cliff — delayed-implementation cohort
      </h1>
      <p style={{ color: "#555", fontSize: 14, marginTop: 4 }}>
        States whose FY24 PER × 1.5 ≥ 20% are delayed from FY28 to FY29 per
        §10105(B)(iii). {rows.length} jurisdictions in the cliff cohort.
      </p>

      <table
        style={{
          marginTop: 24,
          borderCollapse: "collapse",
          width: "100%",
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
            <th style={th}>State</th>
            <th style={th}>FY24 PER %</th>
            <th style={th}>FY24 benefits ($M)</th>
            <th style={th}>Tier</th>
            <th style={th}>Delayed to FY29</th>
            <th style={th}>Annualized liability ($M)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.state}>
              <td style={td}>{r.state}</td>
              <td style={td}>{r.fy24_per_pct.toFixed(2)}</td>
              <td style={td}>{r.fy24_benefits_millions.toLocaleString()}</td>
              <td style={td}>{r.tier}</td>
              <td style={td}>{r.delayed_to_fy29 ? "yes" : "no"}</td>
              <td style={td}>
                {r.annualized_liability_at_tier_millions.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Provenance</h2>
        {provenance.map((p) => (
          <p key={p.bucket_path ?? p.source_url} style={{ fontSize: 12, color: "#555" }}>
            <strong>{p.source_kind}</strong> · {p.source_url} · published{" "}
            {p.publication_date} · pulled {p.pulled_at} · parser {p.parser_path}@
            {p.parser_version} · {p.row_count} rows
          </p>
        ))}
      </section>
    </main>
  );
}

const th: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #ddd",
  fontWeight: 600,
};
const td: React.CSSProperties = {
  padding: "6px 12px",
  borderBottom: "1px solid #eee",
};
