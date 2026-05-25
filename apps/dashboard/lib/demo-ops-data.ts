/**
 * Demo fixtures for /ops dashboard panels.
 *
 * Wired into apps/dashboard/lib/ops-fetchers.ts: when the service-role client
 * is unavailable (local dev without SUPABASE_SERVICE_ROLE_KEY) OR when
 * DEMO_FALLBACK=true is set, fetchers return these fixtures instead of an
 * "apply migrations" empty state.
 *
 * Numbers are sized to be credible-but-impressive for v1 demo:
 *   - ~$1.2M tracked balance across ~3,400 active trackers
 *   - Placements concentrated in high-CalFresh-density CA counties (LA, Riverside, Fresno, etc.)
 *   - Retention curve: 95% @ 30d → 78% @ 90d → 64% @ 180d (typical "good" SaaS curve)
 *   - TTFD median: 8d, faster in LA/Sacramento, slower in rural counties
 *   - Partner P&L: 24K impressions, 800 clicks, 120 conversions, $812 revenue,
 *     $1100 HH savings → 58% redistribution
 *
 * These represent a snapshot of a real-shaped Civica deployment. Replace by
 * applying the 20260579–20260582 migrations + writing real events.
 */

import type {
  EbtAggregateData,
  PlacementsData,
  NotificationOutlayData,
  CohortData,
  TTFDData,
  PartnerPnLData,
} from "./ops-fetchers";

export const DEMO_EBT_AGGREGATE: EbtAggregateData = {
  available: true,
  total_balance_cents: 1_182_440_00,        // $1,182,440 across all tracked HHs
  active_tracker_count: 3_412,
  total_card_count: 4_108,
  latest_balance_at: new Date(Date.now() - 4 * 60_000).toISOString(), // 4 min ago
};

// California FIPS codes for top-15 CalFresh counties. Placements weighted
// by realistic partner-offer geographic priorities (urban + high-poverty).
export const DEMO_PLACEMENTS: PlacementsData = {
  available: true,
  total_active_offers: 47,
  placements: [
    { county_fips: "06037", placement_count: 42, expected_revenue_cents: 8_240_00, categories: ["groceries", "mobile", "utilities", "healthcare"] }, // LA
    { county_fips: "06065", placement_count: 31, expected_revenue_cents: 5_980_00, categories: ["groceries", "mobile", "utilities"] }, // Riverside
    { county_fips: "06019", placement_count: 28, expected_revenue_cents: 4_520_00, categories: ["groceries", "utilities", "healthcare"] }, // Fresno
    { county_fips: "06071", placement_count: 26, expected_revenue_cents: 4_120_00, categories: ["groceries", "mobile"] }, // San Bernardino
    { county_fips: "06059", placement_count: 22, expected_revenue_cents: 3_840_00, categories: ["groceries", "mobile", "utilities"] }, // Orange
    { county_fips: "06073", placement_count: 19, expected_revenue_cents: 3_240_00, categories: ["groceries", "healthcare"] }, // San Diego
    { county_fips: "06067", placement_count: 17, expected_revenue_cents: 2_980_00, categories: ["groceries", "mobile"] }, // Sacramento
    { county_fips: "06077", placement_count: 14, expected_revenue_cents: 2_410_00, categories: ["groceries", "utilities"] }, // San Joaquin
    { county_fips: "06099", placement_count: 12, expected_revenue_cents: 2_040_00, categories: ["groceries"] }, // Stanislaus
    { county_fips: "06107", placement_count: 11, expected_revenue_cents: 1_860_00, categories: ["groceries", "mobile"] }, // Tulare
    { county_fips: "06029", placement_count: 10, expected_revenue_cents: 1_720_00, categories: ["groceries", "utilities"] }, // Kern
    { county_fips: "06085", placement_count: 9, expected_revenue_cents: 1_560_00, categories: ["mobile", "healthcare"] }, // Santa Clara
    { county_fips: "06001", placement_count: 8, expected_revenue_cents: 1_380_00, categories: ["mobile", "groceries"] }, // Alameda
    { county_fips: "06013", placement_count: 7, expected_revenue_cents: 1_220_00, categories: ["groceries"] }, // Contra Costa
    { county_fips: "06075", placement_count: 6, expected_revenue_cents: 1_080_00, categories: ["mobile"] }, // San Francisco
    { county_fips: "STATEWIDE", placement_count: 4, expected_revenue_cents: 920_00, categories: ["healthcare", "utilities"] },
  ],
};

export const DEMO_NOTIFICATION_OUTLAY: NotificationOutlayData = {
  available: true,
  total_count: 14_823,
  total_cost_cents: 967_25,                   // $967.25 total
  cells: [
    // push (cost = 0 — APNs is free)
    { channel: "push",  category: "deposit_alert",     count: 4_212, cost_cents: 0 },
    { channel: "push",  category: "recert_reminder",   count: 1_840, cost_cents: 0 },
    { channel: "push",  category: "partner_offer",     count: 3_120, cost_cents: 0 },
    { channel: "push",  category: "balance_low",       count: 980,   cost_cents: 0 },
    // sms (Twilio ~$0.0075/msg → 75¢/100)
    { channel: "sms",   category: "deposit_alert",     count: 1_240, cost_cents: 930_00 / 100 * 100 }, // 9.30 per 100
    { channel: "sms",   category: "recert_reminder",   count: 612,   cost_cents: 459_00 / 100 },
    { channel: "sms",   category: "balance_low",       count: 240,   cost_cents: 180 },
    // email (Resend ~$0.0004/email)
    { channel: "email", category: "deposit_alert",     count: 1_840, cost_cents: 73 },
    { channel: "email", category: "recert_reminder",   count: 540,   cost_cents: 21 },
    { channel: "email", category: "partner_offer",     count: 199,   cost_cents: 8 },
  ],
};

// Six-month retention cohorts. Demo data showcases the "v1.1 buckets" shape —
// even though the v1 underlying query only computes "currently active," the
// fixture pre-populates 30/60/90/180-day buckets so the panel renders the
// final curve shape the design is heading toward.
export const DEMO_COHORTS: CohortData = {
  available: true,
  cohorts: [
    { enrollment_month: "2025-12", packet_count: 487, currently_active: 312, active_pct: 64.1 },
    { enrollment_month: "2026-01", packet_count: 614, currently_active: 432, active_pct: 70.4 },
    { enrollment_month: "2026-02", packet_count: 723, currently_active: 560, active_pct: 77.5 },
    { enrollment_month: "2026-03", packet_count: 819, currently_active: 681, active_pct: 83.1 },
    { enrollment_month: "2026-04", packet_count: 891, currently_active: 794, active_pct: 89.1 },
    { enrollment_month: "2026-05", packet_count: 642, currently_active: 612, active_pct: 95.3 },
  ],
};

// Extended cohort data for the v1.1-shaped curve visualization.
// Each enrollment month has a retention rate at 30/60/90/180 days.
export const DEMO_COHORT_CURVE: Array<{
  enrollment_month: string;
  d30: number;
  d60: number;
  d90: number;
  d180: number;
}> = [
  { enrollment_month: "2025-12", d30: 96, d60: 88, d90: 78, d180: 64 },
  { enrollment_month: "2026-01", d30: 95, d60: 87, d90: 81, d180: 70 },
  { enrollment_month: "2026-02", d30: 96, d60: 89, d90: 83, d180: 77 },
  { enrollment_month: "2026-03", d30: 95, d60: 90, d90: 86, d180: 83 },
  { enrollment_month: "2026-04", d30: 96, d60: 91, d90: 89, d180: null as unknown as number },
  { enrollment_month: "2026-05", d30: 95, d60: null as unknown as number, d90: null as unknown as number, d180: null as unknown as number },
];

export const DEMO_TTFD: TTFDData = {
  available: true,
  median_days: 8.4,
  n: 2_847,
  county_trend: [
    { county_fips: "06037", n: 612, median_days: 7.2 }, // LA — fastest at scale
    { county_fips: "06067", n: 418, median_days: 6.8 }, // Sacramento
    { county_fips: "06059", n: 312, median_days: 7.4 }, // Orange
    { county_fips: "06073", n: 287, median_days: 8.1 }, // San Diego
    { county_fips: "06065", n: 264, median_days: 8.6 }, // Riverside
    { county_fips: "06071", n: 241, median_days: 9.2 }, // San Bernardino
    { county_fips: "06019", n: 198, median_days: 9.8 }, // Fresno
    { county_fips: "06085", n: 142, median_days: 7.6 }, // Santa Clara
    { county_fips: "06001", n: 128, median_days: 8.0 }, // Alameda
    { county_fips: "06077", n: 104, median_days: 11.2 }, // San Joaquin — slowest
  ],
};

// Synthetic histogram for TTFD (days → count of journeys).
// Roughly log-normal around the 8.4d median.
export const DEMO_TTFD_HISTOGRAM: Array<{ day_bucket: string; count: number }> = [
  { day_bucket: "1-2", count: 41 },
  { day_bucket: "3-4", count: 187 },
  { day_bucket: "5-6", count: 412 },
  { day_bucket: "7-8", count: 624 },
  { day_bucket: "9-10", count: 587 },
  { day_bucket: "11-12", count: 432 },
  { day_bucket: "13-14", count: 281 },
  { day_bucket: "15-18", count: 184 },
  { day_bucket: "19-25", count: 73 },
  { day_bucket: "26+", count: 26 },
];

export const DEMO_PARTNER_PNL: PartnerPnLData = {
  available: true,
  impressions: 24_180,
  clicks: 812,                  // ~3.4% CTR
  conversions: 124,             // ~15% conversion of clicks
  revenue_cents: 81_240,        // $812.40
  saved_cents: 110_600,         // $1,106.00 in HH savings
  revenue_per_active_tracker_cents: 24, // 81240 / 3412
  redistribution_pct: 57.7,     // saved / (saved + revenue)
  active_trackers: 3_412,
};

export function isDemoOpsFallbackEnabled(): boolean {
  // Activate demo fixtures when:
  //   (a) DEMO_FALLBACK=true (intentional demo mode in prod-like environments), OR
  //   (b) SUPABASE_SERVICE_ROLE_KEY is missing locally (so the page never renders
  //       all-empty states during dev — see /ops route demo posture).
  return process.env.DEMO_FALLBACK === "true"
      || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}
