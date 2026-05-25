// TODO-QC-SUSPENSE (eng review 2026-05-25): async server component that
// fetches the cohort-level aggregates FormulaHero + PillarTracking share,
// then renders both. Wrapped in <Suspense> at the page level so the rest
// of /qc (header, OBBBA strip with static data) paints immediately.
//
// Why share a section: both components need the same 4 numbers (totalPackets,
// argyleConnected, shelterDocCount, suaAnswered). Splitting them into
// separate Suspense boundaries would either duplicate the query or require
// a context provider — neither cleaner than co-locating them.

import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../../lib/supabase";
import FormulaHero from "../FormulaHero";
import PillarTracking from "../PillarTracking";

export default async function ThesisAggregatesSection() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);

  const [packetsRes, argyleRes, shelterDocsRes, answersRes] = await Promise.all([
    supabase
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("packet_id")
      .is("deleted_at", null)
      .limit(5000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.schema("snap_enrollment") as any)
      .from("argyle_connections")
      .select("packet_id")
      .not("connected_at", "is", null)
      .limit(5000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.schema("snap_enrollment") as any)
      .from("uploaded_documents")
      .select("packet_id")
      .eq("document_kind", "lease")
      .eq("processing_status", "confirmed")
      .is("deleted_at", null)
      .limit(10000),
    supabase
      .schema("snap_enrollment")
      .from("packet_answers")
      .select("packet_id, question_key")
      .in("question_key", [
        "has_heating_costs",
        "has_electric_or_gas",
        "has_phone",
      ])
      .not("applicant_answer", "is", null)
      .limit(10000),
  ]);

  const packets = packetsRes.data ?? [];
  const totalPackets = packets.length;

  const argylePacketIds = new Set(
    (argyleRes.data ?? []).map(
      (r: { packet_id: string }) => r.packet_id,
    ),
  );
  const shelterDocPacketIds = new Set(
    (shelterDocsRes.data ?? []).map(
      (r: { packet_id: string }) => r.packet_id,
    ),
  );
  const suaAnsweredPacketIds = new Set(
    (answersRes.data ?? []).map(
      (r: { packet_id: string }) => r.packet_id,
    ),
  );

  const argyleConnected = argylePacketIds.size;
  const shelterDocCount = shelterDocPacketIds.size;
  const suaAnswered = suaAnsweredPacketIds.size;

  return (
    <>
      <FormulaHero
        totalPackets={totalPackets}
        argyleConnected={argyleConnected}
        shelterDocCount={shelterDocCount}
        suaAnswered={suaAnswered}
      />
      <PillarTracking
        totalPackets={totalPackets}
        argyleConnected={argyleConnected}
        shelterDocCount={shelterDocCount}
        suaAnswered={suaAnswered}
      />
    </>
  );
}

export function ThesisAggregatesSkeleton() {
  return (
    <>
      <SkeletonCard heightPx={420} />
      <SkeletonCard heightPx={520} />
    </>
  );
}

function SkeletonCard({ heightPx }: { heightPx: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading thesis aggregates"
      className="bg-surface border border-hairline border-t-2 border-t-pine-surface rounded-[4px] p-7"
      style={{ minHeight: heightPx }}
    >
      <div className="space-y-2">
        <div className="h-3 w-48 bg-hairline/40 rounded-sm animate-pulse" />
        <div className="h-5 w-96 bg-hairline/40 rounded-sm animate-pulse" />
        <div className="h-3 w-72 bg-hairline/30 rounded-sm animate-pulse" />
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-hairline/20 rounded-sm animate-pulse"
            style={{ width: `${85 - i * 8}%` }}
          />
        ))}
      </div>
    </div>
  );
}
