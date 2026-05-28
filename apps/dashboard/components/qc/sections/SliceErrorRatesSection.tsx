// TODO-QC-SUSPENSE: async server component for the per-slice error-rate panel.
// Single SELECT against the A1 view snap_enrollment.v_qc_error_rate_by_slice
// (migration 20260596), then buildSliceGroups attaches the Wilson band per
// slice. Wrapped in <Suspense> at the page level so the rest of /qc paints
// without waiting on QC sampling data.
//
// The view is security_invoker, so this SELECT runs with the navigator's own
// RLS context — rows are already scoped to their org. If the migration hasn't
// been applied (or RLS denies), fetchSliceRows returns null and the panel
// renders an explanatory empty state instead of throwing.

import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../../lib/supabase";
import SliceErrorRates from "../SliceErrorRates";
import { buildSliceGroups, type SliceViewRow } from "../../../lib/qc/slice-rates";

async function fetchSliceRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<SliceViewRow[] | null> {
  try {
    const { data, error } = await supabase
      .schema("snap_enrollment")
      .from("v_qc_error_rate_by_slice")
      .select("slice_dim, slice_value, n, errors");
    if (error) return null; // view missing / RLS denies -> empty state
    return (data ?? []) as SliceViewRow[];
  } catch {
    // View doesn't exist yet (migration not applied to this environment).
    return null;
  }
}

export default async function SliceErrorRatesSection() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);

  const rows = await fetchSliceRows(supabase);
  const groups = rows === null ? null : buildSliceGroups(rows);

  return <SliceErrorRates groups={groups} />;
}

export function SliceErrorRatesSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading per-slice error rates"
      className="bg-surface border border-hairline border-t-2 border-t-pine-surface rounded-[4px] p-7"
      style={{ minHeight: 420 }}
    >
      <div className="space-y-2 mb-5">
        <div className="h-3 w-64 bg-hairline/40 rounded-sm animate-pulse" />
        <div className="h-5 w-80 bg-hairline/40 rounded-sm animate-pulse" />
        <div className="h-3 w-96 bg-hairline/30 rounded-sm animate-pulse" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-10 bg-hairline/15 rounded-sm animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
