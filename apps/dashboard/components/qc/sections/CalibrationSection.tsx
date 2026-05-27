// TODO-QC-SUSPENSE: async server component for BaselinePanel.
// Fetches qc_outcomes and computes the USDA-vs-Civica observed comparison
// the dumbbell chart consumes. Wrapped in <Suspense> so the page shell
// renders without waiting on qc sampling data (which is typically n=0
// at UAT scale anyway).

import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../../lib/supabase";
import BaselinePanel from "../BaselinePanel";
import { PROJECTED_PER_AT_FULL_ENGAGEMENT } from "@civica/snap-qc-engine";

const FLOWS = [
  { id: "sua", label: "Shelter / Utility (SUA)", weight: 50.5 },
  { id: "gig", label: "Earned income · gig", weight: 26.8 },
  { id: "lease", label: "Shared lease", weight: 11.4 },
  { id: "assets", label: "Assets", weight: 8.2 },
  { id: "calc", label: "Benefit calculation", weight: 3.1 },
] as const;

const USDA_BASELINE: Record<string, number> = {
  sua: 50.5,
  gig: 26.8,
  lease: 11.4,
  assets: 8.2,
  calc: 3.1,
};

const FLOW_TO_ERROR_KEY: Record<string, string> = {
  sua: "utility_sua",
  gig: "gig_income",
  lease: "shared_lease",
  assets: "assets",
  calc: "benefit_impact_projection",
};

export default async function CalibrationSection() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);

  type QcRow = {
    packet_id: string;
    qc_sampled: boolean;
    error_found: boolean | null;
    error_type: string | null;
    logged_at: string;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qcRes = await (supabase.schema("snap_enrollment") as any)
    .from("qc_outcomes")
    .select("packet_id, qc_sampled, error_found, error_type, logged_at")
    .order("logged_at", { ascending: false })
    .limit(2000);

  const qcRows: QcRow[] = qcRes.data ?? [];
  const sampledWithError = qcRows.filter(
    (q) => q.qc_sampled && q.error_found === true,
  );
  const sampleN = qcRows.filter((q) => q.qc_sampled).length;

  const errorTypeCounts: Record<string, number> = {};
  for (const q of sampledWithError) {
    const t = q.error_type ?? "unknown";
    errorTypeCounts[t] = (errorTypeCounts[t] ?? 0) + 1;
  }
  const errorTotal = sampledWithError.length;

  const comparison = FLOWS.map((f) => {
    const key = FLOW_TO_ERROR_KEY[f.id];
    const count = errorTypeCounts[key] ?? 0;
    const observed = errorTotal > 0 ? (count / errorTotal) * 100 : null;
    return {
      flow: f.id,
      label: f.label,
      weight: f.weight,
      baseline: USDA_BASELINE[f.id],
      observed,
    };
  });

  // Measured PER = fraction of sampled packets where error_found=true.
  // Null when no samples — BaselinePanel falls back to the sampling state.
  // Per plan §17 + DES-D2: render null/garbage as "Sampling — X/30",
  // never half-render measured numbers from a NULL view.
  const measuredPer = sampleN > 0
    ? (sampledWithError.length / sampleN) * 100
    : null;

  return (
    <BaselinePanel
      comparison={comparison}
      sampleN={sampleN}
      measuredPer={measuredPer}
      projectedPer={PROJECTED_PER_AT_FULL_ENGAGEMENT}
    />
  );
}

export function CalibrationSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading calibration data"
      className="bg-surface border border-hairline border-t-2 border-t-pine-surface rounded-[4px] p-5"
      style={{ minHeight: 160 }}
    >
      <div className="space-y-2">
        <div className="h-3 w-64 bg-hairline/40 rounded-sm animate-pulse" />
        <div className="h-5 w-80 bg-hairline/40 rounded-sm animate-pulse" />
        <div className="h-3 w-72 bg-hairline/30 rounded-sm animate-pulse" />
      </div>
      <div className="mt-4 h-16 bg-hairline/15 rounded-sm animate-pulse" />
    </div>
  );
}
