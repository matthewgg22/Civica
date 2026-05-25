// TODO-QC-SUSPENSE: async server component for IncomingDataFeed.
// Fetches the last 20 packets + their per-pillar engagement signals, then
// renders the (client-side) IncomingDataFeed component which owns filter
// chip state.

import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../../lib/supabase";
import IncomingDataFeed, { type FeedPacket } from "../IncomingDataFeed";
import { deriveObbbaImpact, isObbbaChainEngaged } from "../../../lib/analytics/obbba";

const FEED_LIMIT = 20;

function initialsForPacket(packetId: string): string {
  const tail = packetId.slice(-4).toUpperCase();
  return `${tail[0] ?? "?"}.${tail[1] ?? "?"}.`;
}

export default async function IncomingDataFeedSection() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);

  // Pull last-touched packets via packet_error_risk.created_at desc (proxy
  // for recent activity). Limit narrowed from 5000 to 200 since we only
  // need the top 20 after sort — the wider limit is for ranking when
  // multiple risk rows exist per packet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const riskRes = await (supabase.schema("snap_enrollment") as any)
    .from("packet_error_risk")
    .select("packet_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const riskRows: { packet_id: string; created_at: string }[] = riskRes.data ?? [];

  // Dedupe to most-recent per packet_id, preserve sort order.
  const seen = new Set<string>();
  const topPacketIds: string[] = [];
  const lastTouchedById = new Map<string, string>();
  for (const r of riskRows) {
    if (!seen.has(r.packet_id)) {
      seen.add(r.packet_id);
      topPacketIds.push(r.packet_id);
      lastTouchedById.set(r.packet_id, r.created_at);
      if (topPacketIds.length >= FEED_LIMIT) break;
    }
  }

  if (topPacketIds.length === 0) {
    // Fallback: no risk rows yet — pull most-recent packets by packet_id desc.
    const packetsRes = await supabase
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("packet_id")
      .is("deleted_at", null)
      .order("packet_id", { ascending: false })
      .limit(FEED_LIMIT);
    for (const p of packetsRes.data ?? []) {
      topPacketIds.push(p.packet_id);
    }
  }

  // Pull per-packet engagement signals only for the top N packets.
  const [argyleRes, shelterDocsRes, answersRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.schema("snap_enrollment") as any)
      .from("argyle_connections")
      .select("packet_id")
      .in("packet_id", topPacketIds)
      .not("connected_at", "is", null),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.schema("snap_enrollment") as any)
      .from("uploaded_documents")
      .select("packet_id")
      .in("packet_id", topPacketIds)
      .eq("document_kind", "lease")
      .eq("processing_status", "confirmed")
      .is("deleted_at", null),
    supabase
      .schema("snap_enrollment")
      .from("packet_answers")
      .select("packet_id, question_key, applicant_answer")
      .in("packet_id", topPacketIds)
      .in("question_key", [
        "has_heating_costs",
        "has_electric_or_gas",
        "has_phone",
        "date_of_birth",
        "caregiver_status",
        "claims_disability_exemption",
        "claims_pregnant",
        "housing_situation",
        "veteran_status",
        "tribal_member",
        "distress_self_attestation",
      ]),
  ]);

  const argylePacketIds = new Set(
    (argyleRes.data ?? []).map((r: { packet_id: string }) => r.packet_id),
  );
  const shelterDocPacketIds = new Set(
    (shelterDocsRes.data ?? []).map(
      (r: { packet_id: string }) => r.packet_id,
    ),
  );

  const answersByPacket = new Map<string, Record<string, string>>();
  for (const a of answersRes.data ?? []) {
    const m = answersByPacket.get(a.packet_id) ?? {};
    if (a.applicant_answer != null) m[a.question_key] = a.applicant_answer;
    answersByPacket.set(a.packet_id, m);
  }

  function daysSince(packetId: string): number {
    const ts = lastTouchedById.get(packetId);
    if (!ts) return 0;
    const ms = Date.now() - new Date(ts).getTime();
    if (!Number.isFinite(ms)) return 0;
    return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  }

  const feedPackets: FeedPacket[] = topPacketIds.map((packetId) => {
    const pa = answersByPacket.get(packetId) ?? {};
    const hasSuaAnswer = Boolean(
      pa["has_heating_costs"] ||
        pa["has_electric_or_gas"] ||
        pa["has_phone"],
    );
    const obbbaState = deriveObbbaImpact({ packetAnswers: pa });
    return {
      packetId,
      applicantInitials: initialsForPacket(packetId),
      daysPending: daysSince(packetId),
      engagement: {
        income: argylePacketIds.has(packetId),
        shelter: shelterDocPacketIds.has(packetId),
        suaFlags: hasSuaAnswer,
        obbbaImpactTagged: isObbbaChainEngaged(obbbaState),
      },
    };
  });

  return <IncomingDataFeed packets={feedPackets} />;
}

export function IncomingDataFeedSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading per-applicant data feed"
      className="bg-surface border border-hairline border-t-2 border-t-pine-surface rounded-[4px] p-5"
      style={{ minHeight: 480 }}
    >
      <div className="space-y-2 mb-4">
        <div className="h-3 w-56 bg-hairline/40 rounded-sm animate-pulse" />
        <div className="h-5 w-80 bg-hairline/40 rounded-sm animate-pulse" />
        <div className="h-3 w-96 bg-hairline/30 rounded-sm animate-pulse" />
      </div>
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-6 bg-hairline/30 rounded-full animate-pulse"
            style={{ width: 110 + i * 12 }}
          />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-12 bg-hairline/15 rounded-sm animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
