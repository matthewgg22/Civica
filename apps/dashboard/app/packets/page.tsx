import { cookies } from "next/headers";
import Link from "next/link";
import { createServerClientFromCookies } from "../../lib/supabase";
import StatusPill from "../../components/StatusPill";
import FilterChips from "../../components/FilterChips";
import AppHeader from "../../components/AppHeader";
import { timeAgo, decryptDemoName, firstNameLastInitial, shortId } from "../../lib/format";

type Filter = "all" | "mine" | "needs-attention" | "in-progress" | "ready" | "complete" | "draft";

const FILTER_STATUSES: Record<Filter, string[]> = {
  "all": [],
  "mine": [],
  "needs-attention": ["Needs Documents", "Needs Applicant Clarification"],
  "in-progress": ["Submitted for Review", "In Navigator Review"],
  "ready": ["Ready for Handoff"],
  "complete": ["Handed Off", "Closed"],
  "draft": ["Draft"],
};

const BUCKETS: { key: Filter; label: string; statuses: string[]; defaultOpen: boolean; accent: string }[] = [
  { key: "needs-attention", label: "Needs Attention",   statuses: ["Needs Documents", "Needs Applicant Clarification"], defaultOpen: true,  accent: "bg-amber"    },
  { key: "in-progress",     label: "In Progress",       statuses: ["Submitted for Review", "In Navigator Review"],      defaultOpen: true,  accent: "bg-indigo"   },
  { key: "ready",           label: "Ready for Handoff", statuses: ["Ready for Handoff"],                                 defaultOpen: true,  accent: "bg-teal"     },
  { key: "draft",           label: "Draft",             statuses: ["Draft"],                                             defaultOpen: false, accent: "bg-graphite" },
  { key: "complete",        label: "Complete",          statuses: ["Handed Off", "Closed"],                              defaultOpen: false, accent: "bg-pine"     },
];

type Packet = {
  packet_id: string;
  status: string;
  state_code: string;
  county: string | null;
  updated_at: string;
  applicants: { preferred_language: string; full_name_ciphertext: string | null } | null;
};

type RiskTier = "low" | "medium" | "high";

export default async function PacketsPage({ searchParams }: { searchParams: Promise<{ filter?: string; county?: string }> }) {
  const params = await searchParams;
  const filter = (params.filter as Filter) ?? "all";
  const countyFilter = params.county?.trim() || null;
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const { data: packets, error } = await supabase
    .schema("snap_enrollment")
    .from("snap_packets")
    .select(`packet_id, status, state_code, county, created_at, updated_at, applicants(preferred_language, full_name_ciphertext)`)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);

  const allRaw = (packets ?? []) as Packet[];

  // Fetch the most recent error-risk tier for each packet in one round trip.
  // Multiple rows per packet are possible (one per scoring event); we take
  // the first per packet_id after sorting by created_at DESC.
  const packetIds = allRaw.map((p) => p.packet_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: riskRows } = packetIds.length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await supabase.schema("snap_enrollment").from("packet_error_risk" as any)
        .select("packet_id, tier, created_at")
        .in("packet_id", packetIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const riskTierByPacket = new Map<string, RiskTier>();
  const riskScoredAtByPacket = new Map<string, string>();
  for (const row of (riskRows ?? []) as unknown as Array<{ packet_id: string; tier: string | null; created_at: string }>) {
    if (!riskTierByPacket.has(row.packet_id) && row.tier) {
      riskTierByPacket.set(row.packet_id, row.tier as RiskTier);
      riskScoredAtByPacket.set(row.packet_id, row.created_at);
    }
  }

  // Compute "mine" = packets the current user has personally touched (status changes or notes authored)
  let minePacketIds = new Set<string>();
  if (user) {
    const { data: staff } = await supabase.schema("snap_enrollment").from("staff_users").select("staff_id").eq("auth_uid", user.id).maybeSingle();
    if (staff) {
      const [histRes, notesRes] = await Promise.all([
        supabase.schema("snap_enrollment").from("packet_status_history").select("packet_id").eq("changed_by_staff_id", staff.staff_id),
        supabase.schema("snap_enrollment").from("navigator_notes").select("packet_id").eq("author_staff_id", staff.staff_id).is("deleted_at", null),
      ]);
      minePacketIds = new Set([
        ...(histRes.data ?? []).map((r) => r.packet_id),
        ...(notesRes.data ?? []).map((r) => r.packet_id),
      ]);
    }
  }

  const all = countyFilter
    ? allRaw.filter((p) => (p.county ?? "").toLowerCase() === countyFilter.toLowerCase())
    : allRaw;

  const needsAttentionCount = all.filter((p) => FILTER_STATUSES["needs-attention"].includes(p.status)).length;
  const inProgressCount = all.filter((p) => FILTER_STATUSES["in-progress"].includes(p.status)).length;
  const readyCount = all.filter((p) => FILTER_STATUSES["ready"].includes(p.status)).length;
  const completeCount = all.filter((p) => FILTER_STATUSES["complete"].includes(p.status)).length;
  const draftCount = all.filter((p) => FILTER_STATUSES["draft"].includes(p.status)).length;
  const activeCount = all.filter((p) => !["Closed", "Handed Off"].includes(p.status)).length;

  const mineCount = all.filter((p) => minePacketIds.has(p.packet_id)).length;

  const filterOptions = [
    { key: "all", label: "All", count: all.length },
    { key: "mine", label: "Mine", count: mineCount },
    { key: "needs-attention", label: "Needs Attention", count: needsAttentionCount },
    { key: "in-progress", label: "In Progress", count: inProgressCount },
    { key: "ready", label: "Ready", count: readyCount },
    { key: "draft", label: "Draft", count: draftCount },
    { key: "complete", label: "Complete", count: completeCount },
  ];

  const visible = filter === "all"
    ? all
    : filter === "mine"
      ? all.filter((p) => minePacketIds.has(p.packet_id))
      : all.filter((p) => FILTER_STATUSES[filter]?.includes(p.status));
  const showBuckets = filter === "all" || filter === "mine";

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active="queue" />

      <main className="max-w-5xl mx-auto px-8 py-10">
        {/* Overview stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard label="Needs Attention" value={needsAttentionCount} accent="text-amber" bg="bg-amber/8" />
          <StatCard label="In Progress" value={inProgressCount} accent="text-ink" bg="bg-paper" />
          <StatCard label="Ready for Handoff" value={readyCount} accent="text-teal" bg="bg-teal/8" />
          <StatCard label="Active Total" value={activeCount} accent="text-ink" bg="bg-surface-secondary" />
        </div>

        <div className="mb-4">
          <p className="eyebrow mb-2">Queue</p>
          <h2 className="text-[26px] font-semibold tracking-tight leading-tight text-ink">
            {countyFilter ? `Packets in ${countyFilter}` : "All Packets"}
          </h2>
          <p className="text-[14px] text-muted mt-1">
            {countyFilter
              ? `${all.length} packet${all.length === 1 ? "" : "s"} matching this county`
              : "Grouped by urgency · Most recent first"}
          </p>
        </div>

        {countyFilter && (
          <div className="mb-5 inline-flex items-center gap-3 bg-brick/8 border border-brick/20 rounded-full pl-4 pr-2 py-1.5">
            <span className="text-[13px] text-ink">
              Filtered by county: <span className="font-semibold">{countyFilter}</span>
            </span>
            <Link
              href={filter === "all" ? "/packets" : `/packets?filter=${filter}`}
              className="text-[12px] font-semibold text-brick hover:bg-brick/10 px-2 py-0.5 rounded-full transition-colors"
              aria-label="Clear county filter"
            >
              clear ×
            </Link>
          </div>
        )}

        <div className="mb-6">
          <FilterChips options={filterOptions} active={filter} />
        </div>

        {error && (
          <div className="bg-error/10 border border-error text-error rounded-[4px] p-4 mb-6 text-[13px]">
            {error.message}
          </div>
        )}

        {visible.length === 0 && !error && (
          <EmptyQueueState filter={filter} />
        )}

        {showBuckets && visible.length > 0 ? (
          <div className="space-y-5">
            {BUCKETS.map((bucket) => {
              const bucketPackets = visible.filter((p) => bucket.statuses.includes(p.status));
              if (bucketPackets.length === 0) return null;
              return <Bucket key={bucket.key} label={bucket.label} count={bucketPackets.length} defaultOpen={bucket.defaultOpen} packets={bucketPackets} accent={bucket.accent} riskTiers={riskTierByPacket} riskScoredAt={riskScoredAtByPacket} />;
            })}
          </div>
        ) : (
          visible.length > 0 && <PacketList packets={visible} riskTiers={riskTierByPacket} riskScoredAt={riskScoredAtByPacket} />
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, accent, bg }: { label: string; value: number; accent: string; bg: string }) {
  return (
    <div className={`${bg} border border-hairline rounded-[4px] px-5 py-4`}>
      <p className={`text-[32px] font-semibold tabular-nums leading-none ${accent}`}>{value}</p>
      <p className="text-[14px] text-ink mt-2 font-semibold">{label}</p>
    </div>
  );
}

function Bucket({ label, count, defaultOpen, packets, accent, riskTiers, riskScoredAt }: { label: string; count: number; defaultOpen: boolean; packets: Packet[]; accent: string; riskTiers: Map<string, RiskTier>; riskScoredAt: Map<string, string> }) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex items-center gap-3 mb-3 cursor-pointer select-none">
        <span className={`block w-1 h-5 rounded-full ${accent}`} />
        <span className="text-[15px] font-bold tracking-tight text-ink">{label}</span>
        <span className="text-[13px] text-muted tabular-nums font-semibold">{count}</span>
        <span className="text-[12px] text-muted ml-auto group-open:rotate-90 transition-transform">▶</span>
      </summary>
      <PacketList packets={packets} riskTiers={riskTiers} riskScoredAt={riskScoredAt} />
    </details>
  );
}

const STALE_DAYS = 7;
const INACTIVE_STATUSES = new Set(["Handed Off", "Closed"]);

const RISK_DOT: Record<RiskTier, { bg: string; label: string }> = {
  low: { bg: "bg-teal", label: "Low risk" },
  medium: { bg: "bg-amber", label: "Medium risk" },
  high: { bg: "bg-brick", label: "High risk" },
};

const SCORE_STALE_DAYS = 3;

function PacketList({ packets, riskTiers, riskScoredAt }: { packets: Packet[]; riskTiers: Map<string, RiskTier>; riskScoredAt: Map<string, string> }) {
  const now = Date.now();
  return (
    <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
      {packets.map((packet, i) => {
        const applicantName = packet.applicants
          ? firstNameLastInitial(decryptDemoName(packet.applicants.full_name_ciphertext))
          : null;
        const daysOld = (now - new Date(packet.updated_at).getTime()) / 86_400_000;
        const isStale = daysOld > STALE_DAYS && !INACTIVE_STATUSES.has(packet.status);
        const riskTier = riskTiers.get(packet.packet_id) ?? null;
        const riskDot = riskTier ? RISK_DOT[riskTier] : null;
        const scoredAt = riskScoredAt.get(packet.packet_id);
        const isScoreStale = scoredAt
          ? new Date(packet.updated_at).getTime() > new Date(scoredAt).getTime()
            && (now - new Date(scoredAt).getTime()) / 86_400_000 > SCORE_STALE_DAYS
          : false;
        return (
          <Link
            key={packet.packet_id}
            href={`/packets/${packet.packet_id}`}
            className={`flex items-center gap-4 px-5 py-4 hover:bg-paper transition-colors ${i > 0 ? "border-t border-hairline" : ""} ${isStale ? "bg-amber/[0.04]" : ""}`}
          >
            <StatusBadge status={packet.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                {applicantName && (
                  <p className="text-[15px] font-semibold text-ink">{applicantName}</p>
                )}
                <p className="text-[14px] text-graphite">
                  {packet.county ?? "Unknown county"}, {packet.state_code}
                </p>
                <span className="text-[11px] text-muted font-mono tabular-nums">
                  {shortId(packet.packet_id)}
                </span>
                {isStale && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber bg-amber/15 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    ⏱ Stale
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <StatusPill status={packet.status} />
                {riskDot && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider`}
                    title={isScoreStale
                      ? `${riskDot.label} — score may be stale (packet updated after last scoring)`
                      : riskDot.label}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isScoreStale ? "ring-1 ring-amber ring-offset-1" : ""} ${riskDot.bg}`} />
                    <span className="text-muted">{riskDot.label}</span>
                    {isScoreStale && <span className="text-amber">·</span>}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-[13px] tabular-nums font-medium ${isStale ? "text-amber" : "text-graphite"}`}>
                {timeAgo(packet.updated_at)}
              </p>
              <p className="text-[11px] text-muted uppercase tracking-wider mt-0.5">updated</p>
            </div>
            <span className="text-muted text-[18px] shrink-0">›</span>
          </Link>
        );
      })}
    </div>
  );
}

function EmptyQueueState({ filter }: { filter: Filter }) {
  const messages: Record<Filter, { title: string; sub: string }> = {
    "all": { title: "No packets yet", sub: "Packets will appear here when applicants start enrollment" },
    "mine": { title: "You haven't worked on any packets yet", sub: "Once you change a status or add a note, those packets will appear here" },
    "needs-attention": { title: "All caught up", sub: "No packets currently need your attention" },
    "in-progress": { title: "Nothing in progress", sub: "No packets are currently being reviewed" },
    "ready": { title: "Nothing ready", sub: "No packets are ready for handoff yet" },
    "complete": { title: "No completed packets", sub: "Completed packets will be listed here" },
    "draft": { title: "No drafts", sub: "Applicant drafts appear here" },
  };
  const msg = messages[filter];
  return (
    <div className="text-center py-20 bg-surface border border-hairline rounded-[4px]">
      <p className="text-[17px] font-medium text-graphite">{msg.title}</p>
      <p className="text-[13px] mt-1.5 text-muted">{msg.sub}</p>
    </div>
  );
}

const STATUS_BADGE: Record<string, { bg: string; icon: string }> = {
  "Draft": { bg: "bg-graphite", icon: "✎" },
  "Submitted for Review": { bg: "bg-teal", icon: "↑" },
  "Needs Documents": { bg: "bg-amber", icon: "!" },
  "Needs Applicant Clarification": { bg: "bg-amber", icon: "?" },
  "In Navigator Review": { bg: "bg-indigo", icon: "◉" },
  "Ready for Handoff": { bg: "bg-teal", icon: "✓" },
  "Handed Off": { bg: "bg-pine", icon: "→" },
  "Closed": { bg: "bg-graphite", icon: "•" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE["Draft"];
  return (
    <div className={`w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center text-white text-[15px] font-semibold shrink-0`}>
      {cfg.icon}
    </div>
  );
}
