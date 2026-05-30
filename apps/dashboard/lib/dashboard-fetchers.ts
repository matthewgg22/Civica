/**
 * Request-cached fetchers for the /dashboard sections.
 *
 * Each fetcher is wrapped in React.cache() so multiple sections calling the
 * same fetcher within one request trigger only ONE Supabase query. The cache
 * is request-scoped, so this is safe under per-request auth contexts.
 *
 * Why per-section fetchers (not a shared page-level Promise.all): the page
 * shell + UrgentBanner must paint before the slow sections (map, funnel)
 * resolve. Each section owns its own fetch + Suspense boundary; cache()
 * means independence costs zero duplicate queries. (Greenlit in PR4 D2;
 * the /qc page uses the same template.)
 *
 * ── Demo-fallback authority ──────────────────────────────────────────────
 * The original monolithic page derived `useDemoFallback` ONCE from
 * "DEMO_FALLBACK flag is on AND the live packets query came back empty",
 * then swapped ALL six datasources + the projection counts together.
 *
 * fetchPackets() is the single authority here: it returns { packets, isDemo }.
 * Every other fetcher calls fetchPackets() (cached → free) to read isDemo and
 * swaps to its demo fixture in lockstep. This preserves the "all swap
 * together" semantics exactly, while still streaming per-section. In
 * production DEMO_FALLBACK is never set, so isDemo is always false and each
 * section is a pure independent live fetch.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "./supabase";
import {
  isDemoFallbackEnabled,
  DEMO_PACKETS,
  DEMO_APPLICANTS,
  DEMO_HISTORY,
  DEMO_DOCS,
  DEMO_RISK_ROWS,
  DEMO_QC_ROWS,
} from "./demo-data";

export type DashboardPacket = {
  packet_id: string;
  status: string;
  state_code: string;
  county: string | null;
  county_fips: string | null;
  submitted_at: string | null;
  handed_off_at: string | null;
  created_at: string;
  updated_at: string;
  applicants: { full_name_ciphertext: string | null; preferred_language: string } | null;
};

export type DashboardApplicant = { applicant_id: string; preferred_language: string };
export type DashboardHistory = {
  history_id: string;
  packet_id: string;
  from_status: string | null;
  to_status: string;
  occurred_at: string;
};
export type DashboardDoc = {
  document_id: string;
  document_kind: string;
  classification_confidence: number | null;
  processing_status: string;
  uploaded_at: string;
  packet_id: string;
};
export type DashboardRiskRow = {
  packet_id: string;
  score: number | null;
  tier: string;
  created_at: string;
};
export type DashboardQcRow = {
  packet_id: string;
  qc_sampled: boolean;
  error_found: boolean | null;
  error_type: string | null;
  error_amount: number | null;
};

/**
 * The demo-mode authority. Runs the live packets query once (cached); if the
 * DEMO_FALLBACK flag is on AND the live query is empty, returns the demo
 * packet fixtures with isDemo=true. Otherwise returns live packets with
 * isDemo=false. Every other fetcher + every projection count reads isDemo
 * from here so demo mode swaps in lockstep.
 */
export const fetchPackets = cache(
  async (): Promise<{ packets: DashboardPacket[]; isDemo: boolean }> => {
    const cookieStore = await cookies();
    const supabase = createServerClientFromCookies(cookieStore);
    const { data } = await supabase
      .schema("snap_enrollment")
      .from("snap_packets")
      .select(
        "packet_id, status, state_code, county, county_fips, submitted_at, handed_off_at, created_at, updated_at, applicants(full_name_ciphertext, preferred_language)"
      )
      .is("deleted_at", null)
      .limit(2000);

    const liveEmpty = (data?.length ?? 0) === 0;
    const isDemo = isDemoFallbackEnabled() && liveEmpty;

    if (isDemo) {
      const packets = DEMO_PACKETS.map((p) => ({
        packet_id: p.packet_id,
        status: p.status,
        state_code: p.state_code,
        county: p.county,
        county_fips: p.county_fips,
        submitted_at: p.submitted_at,
        handed_off_at: p.handed_off_at,
        created_at: p.created_at,
        updated_at: p.updated_at,
        applicants: p.applicants,
      })) as DashboardPacket[];
      return { packets, isDemo: true };
    }
    return { packets: (data ?? []) as DashboardPacket[], isDemo: false };
  }
);

export const fetchApplicants = cache(async (): Promise<DashboardApplicant[]> => {
  const { isDemo } = await fetchPackets();
  if (isDemo) return DEMO_APPLICANTS;
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data } = await supabase
    .schema("snap_enrollment")
    .from("applicants")
    .select("applicant_id, preferred_language");
  return (data ?? []) as DashboardApplicant[];
});

export const fetchHistory = cache(async (): Promise<DashboardHistory[]> => {
  const { isDemo } = await fetchPackets();
  if (isDemo) return DEMO_HISTORY;
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data } = await supabase
    .schema("snap_enrollment")
    .from("packet_status_history")
    .select("history_id, packet_id, from_status, to_status, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(500);
  return (data ?? []) as DashboardHistory[];
});

export const fetchDocs = cache(async (): Promise<DashboardDoc[]> => {
  const { isDemo } = await fetchPackets();
  if (isDemo) {
    return DEMO_DOCS.map((d) => ({
      document_id: d.document_id,
      document_kind: d.document_kind,
      classification_confidence: d.classification_confidence,
      processing_status: d.processing_status,
      uploaded_at: d.uploaded_at,
      packet_id: d.packet_id,
    }));
  }
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data } = await supabase
    .schema("snap_enrollment")
    .from("uploaded_documents")
    .select(
      "document_id, document_kind, classification_confidence, processing_status, uploaded_at, packet_id"
    )
    .is("deleted_at", null)
    .limit(2000);
  return (data ?? []) as DashboardDoc[];
});

export const fetchRiskRows = cache(async (): Promise<DashboardRiskRow[]> => {
  const { isDemo } = await fetchPackets();
  if (isDemo) {
    return DEMO_RISK_ROWS.map((r) => ({
      packet_id: r.packet_id,
      score: r.score,
      tier: r.tier,
      created_at: r.created_at,
    }));
  }
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.schema("snap_enrollment") as any)
    .from("packet_error_risk")
    .select("packet_id, score, tier, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  return (data ?? []) as DashboardRiskRow[];
});

export const fetchQcRows = cache(async (): Promise<DashboardQcRow[]> => {
  const { isDemo } = await fetchPackets();
  if (isDemo) return DEMO_QC_ROWS;
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.schema("snap_enrollment") as any)
    .from("qc_outcomes")
    .select("packet_id, qc_sampled, error_found, error_type, error_amount")
    .eq("qc_sampled", true)
    .limit(2000);
  return (data ?? []) as DashboardQcRow[];
});

/**
 * "Mine Today" — narrow, per-user query. NOT cached (different users see
 * different data) and returns zeros for unauthenticated users. Demo mode
 * doesn't apply: this is always the real logged-in navigator's activity.
 */
export async function fetchMineToday(): Promise<{
  transitions: number;
  notes: number;
  touchedPackets: number;
}> {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { transitions: 0, notes: 0, touchedPackets: 0 };

  const { data: staff } = await supabase
    .schema("snap_enrollment")
    .from("staff_users")
    .select("staff_id")
    .eq("auth_uid", user.id)
    .maybeSingle();
  if (!staff) return { transitions: 0, notes: 0, touchedPackets: 0 };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sinceISO = startOfDay.toISOString();

  const [myHist, myNotes] = await Promise.all([
    supabase
      .schema("snap_enrollment")
      .from("packet_status_history")
      .select("packet_id")
      .eq("changed_by_staff_id", staff.staff_id)
      .gte("occurred_at", sinceISO),
    supabase
      .schema("snap_enrollment")
      .from("navigator_notes")
      .select("packet_id")
      .eq("author_staff_id", staff.staff_id)
      .gte("created_at", sinceISO)
      .is("deleted_at", null),
  ]);
  const transitions = (myHist.data ?? []).length;
  const notes = (myNotes.data ?? []).length;
  const touchedSet = new Set<string>([
    ...(myHist.data ?? []).map((r) => r.packet_id),
    ...(myNotes.data ?? []).map((r) => r.packet_id),
  ]);
  return { transitions, notes, touchedPackets: touchedSet.size };
}
