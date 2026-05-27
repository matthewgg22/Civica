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
 *
 * Sections that own their fetch (true Suspense deferral):
 *   getNotes       → NotesSection    (navigator_notes)
 *   getStatusHistory → TimelineSection (packet_status_history)
 *   getDocItems    → DocumentsSection (required_document_items)
 * Sections using cache dedup (data also needed above-fold by page):
 *   getWrStatus    → WorkRequirementsSection + TimelineSection
 */

export const getNotes = cache(async (packetId: string) => {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data } = await supabase
    .schema("snap_enrollment")
    .from("navigator_notes")
    .select("*")
    .eq("packet_id", packetId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
});

export const getStatusHistory = cache(async (packetId: string) => {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data } = await supabase
    .schema("snap_enrollment")
    .from("packet_status_history")
    .select("*")
    .eq("packet_id", packetId)
    .order("occurred_at", { ascending: false });
  return data ?? [];
});

export const getDocItems = cache(async (packetId: string) => {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data } = await supabase
    .schema("snap_enrollment")
    .from("required_document_items")
    .select("*")
    .eq("packet_id", packetId)
    .order("created_at");
  return data ?? [];
});

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
