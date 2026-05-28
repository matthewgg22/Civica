import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "./supabase";
import {
  isDemoFallbackEnabled,
  getDemoPacketDetail,
  DEMO_HISTORY,
} from "./demo-data";

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
 *
 * Demo-mode short-circuit: when packetId starts with `demo-pkt-` AND
 * isDemoFallbackEnabled() is true, return synthesized fixture data
 * instead of hitting Supabase. The public /cbo-preview queue links
 * directly into the navigator review surface using these IDs; the
 * previewer has no Supabase session, and the pre-existing RLS
 * recursion bug would otherwise hang every query → Vercel 504. See
 * docs/plans/packet-detail-decide-evidence-layout.md (follow-up) and
 * lib/demo-data.ts (single source of truth for demo fixtures).
 */

function isDemoPacket(packetId: string): boolean {
  return isDemoFallbackEnabled() && packetId.startsWith("demo-pkt-");
}

export const getNotes = cache(async (packetId: string) => {
  if (isDemoPacket(packetId)) return [];
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
  if (isDemoPacket(packetId)) {
    return DEMO_HISTORY.filter((h) => h.packet_id === packetId);
  }
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
  if (isDemoPacket(packetId)) return [];
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
  if (isDemoPacket(packetId)) {
    return getDemoPacketDetail(packetId)?.wrStatus ?? null;
  }
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
