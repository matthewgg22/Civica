// /qc-review — QC sampling task queue for navigators.
//
// Plan: docs/plans/error-rate-engine-falsification.md (T5).
// Design: DES-D1 (IA + FIFO sort), DES-D5 (column collapse <1024px),
// DES-D6 (full-row click + chevron). Calibrated against
// apps/dashboard/DESIGN.md.
//
// RLS scopes packet_qc_samples to the navigator's org via
// is_navigator_in_org(org_id) — see migration 20260590. No client-side
// filtering needed for the cross-org case.

import { cookies } from "next/headers";
import Link from "next/link";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import { timeAgo, decryptDemoName, firstNameLastInitial, shortId } from "../../lib/format";

export const dynamic = "force-dynamic";

const N_TO_VALIDATE = 30; // D3 validation gate target

type SampleRow = {
  sample_id: string;
  packet_id: string;
  sample_stage: "creation" | "submission";
  sampled_at: string;
  completed_at: string | null;
};

type PacketJoin = {
  packet_id: string;
  status: string;
  county: string | null;
  applicants: { full_name_ciphertext: string | null } | null;
};

export default async function QcReviewQueuePage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  // Pending submission-stage samples for the navigator's org (FIFO).
  // RLS narrows the result set; we sort by sampled_at ASC so the oldest
  // sample is at the top — prevents navigators from cherry-picking
  // newly-flagged easy packets (sample-bias mitigation).
  const { data: pendingSamples } = await supabase
    .schema("snap_enrollment")
    .from("packet_qc_samples")
    .select("sample_id, packet_id, sample_stage, sampled_at, completed_at")
    .eq("sample_stage", "submission")
    .is("completed_at", null)
    .order("sampled_at", { ascending: true })
    .limit(100)
    .returns<SampleRow[]>();
  const pending = pendingSamples ?? [];

  // Completed samples this week (Mon 00:00 UTC -> now).
  const startOfWeek = new Date();
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - ((startOfWeek.getUTCDay() + 6) % 7));
  startOfWeek.setUTCHours(0, 0, 0, 0);
  const { count: completedThisWeek } = await supabase
    .schema("snap_enrollment")
    .from("packet_qc_samples")
    .select("sample_id", { count: "exact", head: true })
    .eq("sample_stage", "submission")
    .gte("completed_at", startOfWeek.toISOString());

  // Validation-gate progress: total completed submission-stage samples ever
  // (the D3 stopping rule fires at >= 30 + back-test + residual <= 1pt).
  const { count: completedTotal } = await supabase
    .schema("snap_enrollment")
    .from("packet_qc_samples")
    .select("sample_id", { count: "exact", head: true })
    .eq("sample_stage", "submission")
    .not("completed_at", "is", null);

  // Sample coverage: completed / submitted packets in the org. We
  // approximate "submitted packets" with snap_packets where submitted_at
  // is not null. RLS auto-scopes.
  const { count: submittedTotal } = await supabase
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id", { count: "exact", head: true })
    .not("submitted_at" as never, "is", null);

  // Hydrate the queue with packet metadata.
  const packetIds = pending.map((s) => s.packet_id);
  let packetById = new Map<string, PacketJoin>();
  if (packetIds.length > 0) {
    const { data: packetRows } = await supabase
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("packet_id, status, county, applicants(full_name_ciphertext)")
      .in("packet_id", packetIds)
      .returns<PacketJoin[]>();
    packetById = new Map((packetRows ?? []).map((p) => [p.packet_id, p]));
  }

  const pendingCount = pending.length;
  const completedWeekCount = completedThisWeek ?? 0;
  const completedTotalCount = completedTotal ?? 0;
  const submittedTotalCount = submittedTotal ?? 0;
  const coveragePct = submittedTotalCount > 0
    ? Math.round((completedTotalCount / submittedTotalCount) * 100)
    : 0;
  const gateMet = completedTotalCount >= N_TO_VALIDATE;

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active="qc" />

      <main className="max-w-5xl mx-auto px-8 py-10">
        {/* Header strip (DES-D1) */}
        <div className="mb-8">
          <p className="eyebrow mb-2">QC · Sampling queue</p>
          <h1 className="text-[26px] font-semibold tracking-tight leading-tight text-ink">
            QC Review Queue
          </h1>
          <p className="text-[14px] text-graphite mt-1 max-w-2xl leading-relaxed">
            Random sample of submitted packets flagged for navigator QC review.
            Sampling cadence is roughly 1 in 10 — oldest first to prevent
            selection bias.
          </p>
        </div>

        {/* Aggregate strip — 4 metric tiles (DES-D1) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <MetricTile
            eyebrow="Pending in my org"
            value={pendingCount}
            valueClass="text-ink"
          />
          <MetricTile
            eyebrow="Completed this week"
            value={completedWeekCount}
            valueClass="text-ink"
          />
          <MetricTile
            eyebrow={`Sample coverage of target ${10}%`}
            value={`${coveragePct}%`}
            valueClass="text-ink"
          />
          <MetricTile
            eyebrow="Validation gate"
            value={`${completedTotalCount}/${N_TO_VALIDATE}`}
            valueClass="text-ink"
            badge={gateMet ? "gate met" : undefined}
          />
        </div>

        {/* Queue table or empty state */}
        {pending.length === 0 ? (
          <EmptyState />
        ) : (
          <QueueTable rows={pending} packetById={packetById} />
        )}
      </main>
    </div>
  );
}

function MetricTile({
  eyebrow,
  value,
  valueClass,
  badge,
}: {
  eyebrow: string;
  value: string | number;
  valueClass: string;
  badge?: string;
}) {
  return (
    <div className="bg-surface-secondary rounded-[4px] p-4 border border-hairline">
      <p className="eyebrow text-[11px] uppercase tracking-wider text-muted mb-1">
        {eyebrow}
      </p>
      <p className={`text-[24px] font-semibold leading-none ${valueClass}`}>
        {value}
      </p>
      {badge && (
        <span className="inline-block mt-2 text-[10px] uppercase tracking-wider font-semibold text-pine bg-pine-surface rounded-full px-2 py-0.5">
          {badge}
        </span>
      )}
    </div>
  );
}

function QueueTable({
  rows,
  packetById,
}: {
  rows: SampleRow[];
  packetById: Map<string, PacketJoin>;
}) {
  return (
    <div className="bg-surface rounded-[4px] border border-hairline overflow-hidden">
      {/* Header — semantic <table> for screen-reader correctness (DES-D5 a11y) */}
      <table className="w-full text-[14px]">
        <thead className="bg-surface-secondary text-[11px] uppercase tracking-wider text-muted">
          <tr>
            <th className="text-left font-medium px-4 py-3">Sampled</th>
            <th className="text-left font-medium px-4 py-3">Packet</th>
            <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">
              County
            </th>
            <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">
              Status
            </th>
            <th className="text-left font-medium px-4 py-3">Stage</th>
            <th className="text-right font-medium px-4 py-3 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pkt = packetById.get(row.packet_id);
            const name = decryptDemoName(pkt?.applicants?.full_name_ciphertext ?? null);
            const display = name ? firstNameLastInitial(name) : shortId(row.packet_id);
            return (
              <tr
                key={row.sample_id}
                className="border-t border-hairline hover:bg-paper transition-colors"
                style={{ height: 56 }}
              >
                <td className="px-4 py-3 text-graphite whitespace-nowrap">
                  {timeAgo(row.sampled_at)}
                </td>
                <td className="px-4 py-3 text-ink font-medium">
                  <Link
                    href={`/packets/${row.packet_id}?qc=1`}
                    className="hover:text-pine-pressed focus-visible:outline focus-visible:outline-2 focus-visible:outline-pine"
                  >
                    {display}
                    <span className="text-graphite font-normal ml-2">
                      {shortId(row.packet_id)}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-graphite hidden lg:table-cell">
                  {pkt?.county ?? "—"}
                </td>
                <td className="px-4 py-3 text-graphite hidden lg:table-cell">
                  {pkt?.status ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StageBadge stage={row.sample_stage} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/packets/${row.packet_id}?qc=1`}
                    aria-label={`Review packet ${shortId(row.packet_id)}`}
                    className="text-pine hover:text-pine-pressed focus-visible:outline focus-visible:outline-2 focus-visible:outline-pine inline-block"
                  >
                    ›
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StageBadge({ stage }: { stage: "creation" | "submission" }) {
  const label = stage === "submission" ? "Submission" : "Creation";
  return (
    <span className="inline-block text-[11px] uppercase tracking-wider font-medium text-graphite bg-surface-secondary border border-hairline rounded-full px-2 py-0.5">
      {label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="bg-surface rounded-[4px] border border-hairline px-6 py-10">
      <p className="text-[15px] text-ink font-medium">No packets pending QC review.</p>
      <p className="text-[14px] text-graphite mt-1">
        New samples flow in as packets are submitted — roughly 1 in 10.
      </p>
      <Link
        href="/qc"
        className="inline-block mt-4 text-[14px] text-pine hover:text-pine-pressed font-medium"
      >
        View Error Rate Intelligence →
      </Link>
    </div>
  );
}
