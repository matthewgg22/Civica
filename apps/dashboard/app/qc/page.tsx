export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import Link from "next/link";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";

type RiskTier = "low" | "medium" | "high";
type TierCounts = Record<RiskTier, number>;

const ENGINE_VERSION_DISPLAY = "0.2.0";

// API coverage — updated after UtilityAPI was eliminated in favour of SUA rules
const API_COVERAGE = [
  { api: "SUA Rules Engine",  status: "Phase 1 ✓", phase: 1, notes: "determineSUATier() from @civica/snap-rules; deterministic, no external API needed" },
  { api: "Smarty (address)",  status: "Phase 1 ✓", phase: 1, notes: "DPV validation wired in verification-summary route" },
  { api: "HUD FMR",           status: "Phase 1 ✓", phase: 1, notes: "Rent vs FMR ratio wired in verification-summary route" },
  { api: "Argyle (payroll)",  status: "Phase 2",   phase: 2, notes: "argyle_connections read; marketplace_paychecks monthly total vs reported" },
  { api: "FOIA Error Rates",  status: "Phase 3",   phase: 3, notes: "Not yet started — will feed ERROR_WEIGHT retraining pipeline" },
];

const TIER_STYLE: Record<RiskTier, { bg: string; text: string; bar: string }> = {
  high:   { bg: "bg-brick/10",  text: "text-brick",  bar: "bg-brick" },
  medium: { bg: "bg-amber/15",  text: "text-amber",  bar: "bg-amber" },
  low:    { bg: "bg-teal/10",   text: "text-teal",   bar: "bg-teal"  },
};

const PHASE_BADGE: Record<number, { cls: string; label: string }> = {
  1: { cls: "bg-teal/10 text-teal",      label: "Phase 1 ✓" },
  2: { cls: "bg-amber/15 text-amber",    label: "Phase 2" },
  3: { cls: "bg-graphite/10 text-muted", label: "Phase 3" },
};

export default async function QcPage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: riskRows } = await supabase.schema("snap_enrollment").from("packet_error_risk" as any)
    .select("packet_id, tier, score, created_at")
    .order("created_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outcomesRows } = await supabase.schema("snap_enrollment").from("qc_outcomes" as any)
    .select("qc_outcome_id, error_found, error_type, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packetCount } = await supabase.schema("snap_enrollment").from("snap_packets" as any)
    .select("packet_id", { count: "exact", head: true })
    .is("deleted_at", null);

  const allRisk = (riskRows ?? []) as Array<{ packet_id: string; tier: string | null; score: number | null; created_at: string }>;

  // Deduplicate to latest score per packet
  const latestByPacket = new Map<string, typeof allRisk[0]>();
  for (const row of allRisk) {
    if (!latestByPacket.has(row.packet_id)) latestByPacket.set(row.packet_id, row);
  }
  const scored = [...latestByPacket.values()];

  const tierCounts: TierCounts = { low: 0, medium: 0, high: 0 };
  let scoreSum = 0;
  for (const r of scored) {
    if (r.tier === "low" || r.tier === "medium" || r.tier === "high") {
      tierCounts[r.tier]++;
    }
    if (r.score !== null) scoreSum += r.score;
  }
  const avgScore = scored.length > 0 ? Math.round(scoreSum / scored.length) : null;
  const totalPackets = (packetCount as unknown as { count?: number } | null)?.count ?? 0;
  const completeness = totalPackets > 0 ? Math.round((scored.length / totalPackets) * 100) : 0;

  const allOutcomes = (outcomesRows ?? []) as Array<{ qc_outcome_id: string; error_found: boolean | null; error_type: string | null; created_at: string }>;
  const sampledCount = allOutcomes.length;
  const errorCount = allOutcomes.filter((o) => o.error_found).length;
  const baselineRate = sampledCount >= 30 ? ((errorCount / sampledCount) * 100).toFixed(1) : null;

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} active="qc" />

      <main className="max-w-5xl mx-auto px-8 py-10 space-y-8">

        {/* Header */}
        <div>
          <p className="eyebrow mb-1">Quality Control</p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-[26px] font-semibold tracking-tight text-ink">QC Dashboard</h1>
            <span className="text-[12px] font-mono text-muted bg-paper border border-hairline px-2 py-0.5 rounded">engine v{ENGINE_VERSION_DISPLAY}</span>
          </div>
          <p className="text-[14px] text-muted mt-1">
            Pre-submission error risk distribution · USDA FY2024 QC weights · CA pilot cohort
          </p>
        </div>

        {/* Score completeness callout */}
        {completeness < 100 && (
          <div className="bg-amber/8 border border-amber/25 rounded-[4px] px-5 py-4 flex items-start gap-3">
            <span className="text-amber text-[18px] shrink-0 mt-0.5">⚑</span>
            <div>
              <p className="text-[14px] font-semibold text-ink">Score completeness: {completeness}%</p>
              <p className="text-[13px] text-graphite mt-0.5">
                {scored.length} of {totalPackets} packets have been scored. Unscored packets won&apos;t appear in the distribution below.
                Scores are generated automatically on submission; use the iOS app or POST&nbsp;/me/packets/:id/error-risk for older packets.
              </p>
            </div>
          </div>
        )}

        {/* Overview stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Scored Packets" value={String(scored.length)} />
          <StatCard label="High Risk" value={String(tierCounts.high)} accent="text-brick" bg="bg-brick/8" />
          <StatCard label="Avg Score" value={avgScore !== null ? String(avgScore) : "—"} accent="text-ink" />
          <StatCard label="QC Baseline" value={baselineRate !== null ? `${baselineRate}%` : `Need ${30 - sampledCount} more`} accent={baselineRate !== null ? "text-teal" : "text-muted"} />
        </div>

        {/* Risk distribution */}
        <section className="bg-surface border border-hairline rounded-[4px] p-6">
          <h2 className="section-title mb-1">Risk Distribution</h2>
          <p className="section-sub mb-5">Latest score per packet · scored packets only</p>

          {scored.length === 0 ? (
            <p className="text-[14px] text-muted italic">No packets scored yet. Scores generate automatically on submission.</p>
          ) : (
            <div className="space-y-3">
              {(["high", "medium", "low"] as RiskTier[]).map((tier) => {
                const count = tierCounts[tier];
                const pct = scored.length > 0 ? (count / scored.length) * 100 : 0;
                const s = TIER_STYLE[tier];
                return (
                  <div key={tier}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[12px] font-semibold uppercase tracking-wider ${s.text}`}>{tier}</span>
                      <span className="text-[13px] text-graphite tabular-nums">{count} <span className="text-muted">({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div className="h-2.5 bg-paper rounded-full overflow-hidden">
                      <div className={`h-full ${s.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* API Coverage */}
        <section className="bg-surface border border-hairline rounded-[4px] p-6">
          <h2 className="section-title mb-1">API Integration Coverage</h2>
          <p className="section-sub mb-5">Data sources feeding the defensibility scoring model</p>

          <div className="overflow-hidden rounded border border-hairline">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-paper border-b border-hairline">
                  <th className="text-left px-4 py-2.5 font-semibold text-muted uppercase tracking-wider text-[11px]">Data Source</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted uppercase tracking-wider text-[11px]">Status</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted uppercase tracking-wider text-[11px]">Notes</th>
                </tr>
              </thead>
              <tbody>
                {API_COVERAGE.map((row, i) => {
                  const badge = PHASE_BADGE[row.phase];
                  return (
                    <tr key={row.api} className={i > 0 ? "border-t border-hairline" : ""}>
                      <td className="px-4 py-3 font-medium text-ink">{row.api}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-graphite">{row.notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* QC Outcomes baseline */}
        <section className="bg-surface border border-hairline rounded-[4px] p-6">
          <div className="flex items-baseline justify-between gap-4 mb-1">
            <h2 className="section-title">QC Outcomes Baseline</h2>
            <Link href="/qc/outcomes" className="text-[13px] font-semibold text-brick hover:underline">
              Log outcomes →
            </Link>
          </div>
          <p className="section-sub mb-5">
            Sampled packets reviewed post-handoff · baseline triggers at 30+ cases
          </p>

          {sampledCount === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[15px] font-medium text-graphite">No QC outcomes logged yet</p>
              <p className="text-[13px] mt-1.5 text-muted">Use the outcomes page to log results from post-handoff case reviews.</p>
            </div>
          ) : baselineRate !== null ? (
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <p className="text-[40px] font-semibold tabular-nums text-brick leading-none">{baselineRate}%</p>
                <div>
                  <p className="text-[14px] font-semibold text-ink">Observed error rate</p>
                  <p className="text-[13px] text-muted">{errorCount} errors in {sampledCount} sampled packets</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 py-2">
              <div className="h-2 flex-1 bg-paper rounded-full overflow-hidden">
                <div className="h-full bg-graphite/30 rounded-full" style={{ width: `${(sampledCount / 30) * 100}%` }} />
              </div>
              <span className="text-[13px] text-muted tabular-nums shrink-0">{sampledCount}/30 cases</span>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

function StatCard({ label, value, accent = "text-ink", bg = "bg-paper" }: { label: string; value: string; accent?: string; bg?: string }) {
  return (
    <div className={`${bg} border border-hairline rounded-[4px] px-5 py-4`}>
      <p className={`text-[32px] font-semibold tabular-nums leading-none ${accent}`}>{value}</p>
      <p className="text-[14px] text-ink mt-2 font-semibold">{label}</p>
    </div>
  );
}
