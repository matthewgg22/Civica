import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export interface AdminCostExposure {
  stateCode: string;
  federalAdminCostDollars: number; // from SNAP FNS data
  perFy2024Pct: number;            // payment error rate %
  exposureDollars: number;         // 25% share (post-OBBBA §10106 rate)
  demoMode: boolean;               // true if real data unavailable
}

// ---------------------------------------------------------------------------
// Demo data per state (FY2024 placeholders from FNS/HHS QC reports)
// ---------------------------------------------------------------------------
const DEMO_DATA: Record<string, Omit<AdminCostExposure, "stateCode" | "demoMode">> = {
  CA: {
    federalAdminCostDollars: 850_000_000,
    perFy2024Pct: 7.2,
    exposureDollars: 212_500_000,
  },
  MA: {
    federalAdminCostDollars: 52_000_000,
    perFy2024Pct: 6.1,
    exposureDollars: 13_000_000,
  },
};

// Cost per active packet used to estimate federal admin cost from live data.
// Derived from FNS admin cost benchmarks (~$400 per case federally subsidised).
const ADMIN_COST_PER_PACKET_DOLLARS = 400;

// Statuses that represent in-progress (not yet closed/handed-off) packets.
const ACTIVE_STATUSES = [
  "Draft",
  "Submitted for Review",
  "Needs Documents",
  "Needs Applicant Clarification",
  "In Navigator Review",
  "Ready for Handoff",
] as const;

function getDemoData(stateCode: string): AdminCostExposure {
  const demo = DEMO_DATA[stateCode] ?? DEMO_DATA["CA"];
  return { stateCode, ...demo, demoMode: true };
}

/**
 * Returns admin cost exposure data for the given state.
 *
 * Live path: queries `snap_enrollment.snap_packets` via service role to count
 * active packets and derive an admin cost estimate. Falls back to demo data if
 * the query fails or returns fewer than 10 rows (not enough signal).
 *
 * Post-MVP: replace the packet-count estimate with a real FNS cost-report feed
 * stored in a `snap_analytics.admin_cost_by_state` table.
 *
 * Note: Uses the raw Supabase client (not the typed Database generic) so that
 * this module compiles independently of the generated DB types — the snap_packets
 * schema access uses `.schema()` which requires a runtime schema switch not
 * representable in the static Database type without a separate schema type file.
 */
export async function adminCostExposure(
  stateCode = "CA"
): Promise<AdminCostExposure> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("[analytics:section10106] Missing Supabase env vars, using demo data", {
      stateCode,
    });
    return getDemoData(stateCode);
  }

  try {
    // Use the raw (untyped) client to avoid compile errors from schema switching.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    }) as any;

    const { count, error } = await supabase
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("*", { count: "exact", head: true })
      .in("status", ACTIVE_STATUSES);

    if (error) {
      console.warn("[analytics:section10106] DB query failed, using demo data", {
        error: error.message,
        stateCode,
      });
      return getDemoData(stateCode);
    }

    const activePackets: number = count ?? 0;

    if (activePackets < 10) {
      // Not enough real data — fall back to demo.
      return getDemoData(stateCode);
    }

    const federalAdminCostDollars = activePackets * ADMIN_COST_PER_PACKET_DOLLARS;
    const demo = DEMO_DATA[stateCode] ?? DEMO_DATA["CA"];
    const perFy2024Pct = demo.perFy2024Pct; // PER from FNS reports — static until feed exists
    const exposureDollars = federalAdminCostDollars * 0.25;

    return {
      stateCode,
      federalAdminCostDollars,
      perFy2024Pct,
      exposureDollars,
      demoMode: false,
    };
  } catch (err) {
    console.warn("[analytics:section10106] Unexpected error, using demo data", {
      err,
      stateCode,
    });
    return getDemoData(stateCode);
  }
}
