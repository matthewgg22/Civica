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

interface PillarCoverageRow {
  total_packets: number;
  argyle_connected_packets: number;
  shelter_doc_packets: number;
  sua_answered_packets: number;
}

/**
 * Fetch the aggregate counts via T9's v_qc_pillar_coverage view (single
 * SELECT). Returns null on any failure — the caller falls back to the
 * legacy per-table aggregation path. This makes the view a pure
 * optimization, safe even before the migration is applied to staging/prod.
 */
async function fetchFromCoverageView(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<PillarCoverageRow | null> {
  try {
    const { data, error } = await supabase
      .schema("snap_enrollment")
      .from("v_qc_pillar_coverage")
      .select(
        "total_packets, argyle_connected_packets, shelter_doc_packets, sua_answered_packets",
      )
      .single();
    if (error || !data) return null;
    return data as PillarCoverageRow;
  } catch {
    // View doesn't exist yet (migration not applied) — fall through to legacy.
    return null;
  }
}

export default async function ThesisAggregatesSection() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);

  // FAST PATH (T9): single SELECT against the pre-aggregated view.
  const viewRow = await fetchFromCoverageView(supabase);

  let totalPackets: number;
  let argyleConnected: number;
  let shelterDocCount: number;
  let suaAnswered: number;

  if (viewRow) {
    totalPackets = viewRow.total_packets;
    argyleConnected = viewRow.argyle_connected_packets;
    shelterDocCount = viewRow.shelter_doc_packets;
    suaAnswered = viewRow.sua_answered_packets;
  } else {
    // LEGACY FALLBACK: 4 parallel queries + JS aggregation. Used when the
    // T9 migration hasn't been applied to this environment yet.
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

    totalPackets = (packetsRes.data ?? []).length;
    argyleConnected = new Set(
      (argyleRes.data ?? []).map((r: { packet_id: string }) => r.packet_id),
    ).size;
    shelterDocCount = new Set(
      (shelterDocsRes.data ?? []).map(
        (r: { packet_id: string }) => r.packet_id,
      ),
    ).size;
    suaAnswered = new Set(
      (answersRes.data ?? []).map(
        (r: { packet_id: string }) => r.packet_id,
      ),
    ).size;
  }

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
