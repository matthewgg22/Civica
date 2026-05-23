import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "./supabase";

/**
 * React `cache()`-deduplicated server-side fetchers for packet-detail
 * data. Calling any of these multiple times during a single server
 * render returns the same Promise (and runs the underlying query once)
 * — safe to invoke from multiple components without N+1 fanout, which
 * is what makes the per-section Suspense pattern viable.
 *
 * Adding a new fetcher here is the first step in deferring a section
 * out of the page-level Promise.all batch into its own Suspense
 * boundary. Each fetcher should mirror the SELECT columns the section
 * actually needs (avoid over-fetching).
 */

/**
 * Latest work-requirement status row for a packet (OBBBA §10102
 * evaluation). One row per evaluation; we take the most recent.
 * Returns null when the packet has never been evaluated.
 */
export const getWrStatus = cache(async (packetId: string) => {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data } = await supabase
    .schema("snap_enrollment")
    .from("work_requirement_statuses")
    .select(
      "wr_status_id, is_subject, compliance_status, exemption_type, months_used_in_window, next_review_due, determined_at, determination_basis",
    )
    .eq("packet_id", packetId)
    .order("determined_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
});
