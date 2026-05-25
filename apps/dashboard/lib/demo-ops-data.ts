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
  MedicareAdvantageData,
  EligibilityQueueData,
  DistressOverlayData,
  RevenueLinesData,
  LTVData,
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

// Medicare Advantage referrals — Panel 8.
//   - 750 of 3,412 trackers (22%) are 60+ → eligible cohort
//   - 470 of 750 routed to Medi-Cal first (zero Civica fee · political defense)
//   - 280 remain non-Medi-Cal → MA referral funnel
//     · 120 referred to MA partners
//     · 38 enrolled (31.7% referred→enrolled)
//   - $850 avg fee / enrollment × 38 = $32,300 total revenue
//   - CMS-compliant; last audit ~14 days ago (Title 42 CFR §422.2274)
export const DEMO_MEDICARE_ADVANTAGE: MedicareAdvantageData = {
  available: true,
  active_trackers: 3_412,
  eligible_seniors: 750,
  medi_cal_routed_count: 470,
  eligible_non_medi_cal: 280,
  referred_to_partners: 120,
  enrolled: 38,
  revenue_cents: 32_300_00,             // $32,300
  avg_fee_per_enrollment_cents: 850_00, // $850 / enrollment
  cms_compliant: true,
  last_cms_audit_at: new Date(Date.now() - 14 * 86_400_000).toISOString(),
  disclosure_version: "v2.3 · 2026-Q2",
};

// Eligibility queue — Panel 9.
//
// Per-program "what's next" view: how many tracked HHs are eligible but not
// yet referred, with an expected-value projection (in_queue × conv × $/conv).
//
// Sized realistically against the 3,412 active-tracker population:
//   - WOTC referral (job placement, 18-39):   840 eligible · 560 in queue → ~$98.6K
//   - Medicare Advantage (60+ non-Medi-Cal):  280 eligible · 160 in queue → ~$43.5K
//   - Partner offers (ads, un-served counties):  2,840 elig · 2,120 in queue → ~$2.9K
//   - Tax prep / Refund Advance (working SNAP): 1,420 elig · 1,420 in queue → ~$12.3K
//   - LIHEAP / utility assistance (eligible by income): 1,180 elig · 1,090 in queue → $0 (non-monetized)
//
// LIHEAP demonstrates a non-monetized "right-thing" referral — surfaces in
// the panel with a subtle pine tag and an outlined action chip.
export const DEMO_ELIGIBILITY_QUEUE: EligibilityQueueData = {
  available: true,
  rows: [
    {
      program_id: "wotc_job_placement",
      program_name: "WOTC referral · job placement (age 18–39)",
      eligible: 840,
      contacted: 280,
      in_queue: 560,
      conv_pct: 11,
      dollars_per_conversion_cents: 1_600_00,  // $1,600 / hire
      projected_revenue_cents: 98_560_00,      // 560 × 0.11 × $1,600 = $98,560
      monetized: true,
      suggested_action: "Run outreach",
    },
    {
      program_id: "medicare_advantage",
      program_name: "Medicare Advantage · 60+ non-Medi-Cal",
      eligible: 280,
      contacted: 120,
      in_queue: 160,
      conv_pct: 32,
      dollars_per_conversion_cents: 850_00,    // $850 / enrollment
      projected_revenue_cents: 43_520_00,      // 160 × 0.32 × $850 = $43,520
      monetized: true,
      suggested_action: "Schedule batch",
    },
    {
      program_id: "partner_offers_ads",
      program_name: "Partner offers (ads) · un-served counties",
      eligible: 2_840,
      contacted: 720,
      in_queue: 2_120,
      conv_pct: 4,
      dollars_per_conversion_cents: 35_00,     // $35 / conv
      projected_revenue_cents: 2_968_00,       // 2,120 × 0.04 × $35 = $2,968
      monetized: true,
      suggested_action: "Run outreach",
    },
    {
      program_id: "tax_prep_refund_advance",
      program_name: "Tax prep / Refund Advance · working SNAP",
      eligible: 1_420,
      contacted: 0,
      in_queue: 1_420,
      conv_pct: 18,
      dollars_per_conversion_cents: 48_00,     // $48 / conv
      projected_revenue_cents: 12_268_80,      // 1,420 × 0.18 × $48 = $12,268.80
      monetized: true,
      suggested_action: "Run outreach",
    },
    {
      program_id: "liheap_utility",
      program_name: "LIHEAP / utility assistance (income-eligible)",
      eligible: 1_180,
      contacted: 90,
      in_queue: 1_090,
      conv_pct: 24,
      dollars_per_conversion_cents: 0,         // no fee — recipient benefit
      projected_revenue_cents: 0,
      monetized: false,
      suggested_action: "Schedule batch",
    },
  ],
};

// Revenue lines rollup — Panel 10.
//
// Single unified view of every monetization line, plus notification outlay as
// a negative. Drives the "where the money comes from" headline.
//
// Numbers are anchored to the Panel-6/Panel-8 fixtures so this rollup stays
// internally consistent:
//   - Medicare Advantage (Panel 8):  $32,300  · live, dominant revenue line
//   - Partner offers     (Panel 6):  $812     · live, impressions-only v1
//   - WOTC referral fees:            $0       · pre-launch · gated on H.R. 1177 extension
//   - Tax prep partnerships:         —        · planned (eligibility queue projects $12.3K)
//   - LIHEAP routing:                —        · recipient-benefit, no Civica fee
//   - Notification outlay (Panel 3): $9.67    · cost (drawn negative)
//
// Net: $33,112.00 revenue − $9.67 outlay = $33,102.33 → displayed as "$33.1K net / 30d".
// WoW delta: +4.8% (demo trendline).
export const DEMO_REVENUE_LINES: RevenueLinesData = {
  available: true,
  lines: [
    {
      key: "medicare_advantage",
      label: "Medicare Advantage referrals",
      status: "live",
      gross_cents: 32_300_00,                  // $32,300
      share_pct: 28.8,
    },
    {
      key: "wotc_referral",
      label: "WOTC referral fees",
      status: "gated",
      gross_cents: 0,
      share_pct: null,
      note: "Pre-launch · H.R. 1177 gated",
    },
    {
      key: "partner_offers",
      label: "Partner offers (ads)",
      status: "live",
      gross_cents: 812_00,                      // $812
      share_pct: 0.7,
      note: "Impressions-only v1",
    },
    {
      key: "tax_prep",
      label: "Tax prep partnerships",
      status: "planned",
      gross_cents: 0,
      share_pct: null,
    },
    {
      key: "liheap_routing",
      label: "LIHEAP routing",
      status: "no_fee",
      gross_cents: 0,
      share_pct: null,
      note: "Recipient-benefit (no fee)",
    },
    {
      key: "notification_outlay",
      label: "Notification outlay (cost)",
      status: "cost",
      gross_cents: 9_67,                        // $9.67 cost — drawn negative in the UI
      share_pct: null,
    },
  ],
  net_cents: 33_102_33,                         // $33,112.00 revenue − $9.67 outlay
  wow_delta_pct: 4.8,
};

// LTV per active tracker — Panel 11.
//
// The headline composite: every Civica-tracked HH is worth $X/yr to the
// company. Annualized from current 30d run-rate, decomposed by revenue
// line. Sized to be internally consistent with Panel 6 + Panel 8 demo:
//
//   30d revenue from MA referrals (Panel 8):  $32,300
//   30d revenue from partner offers (Panel 6): $812
//   ────────────────────────────────────────────────
//   30d total live revenue:                    $33,112
//   ÷ 3,412 active trackers                  = $9.70 / tracker / 30d
//   × 12 annualized                          = $116.43 / tracker / yr
//
// Per-line breakdown (annualized):
//   Medicare Advantage:  $32,300 / 3412 × 12 = $113.55
//   Partner offers:         $812 / 3412 × 12 =   $2.86
//   ──────────────────────────────────────────────────
//   Live total:                                $116.41
//
// Projected roadmap lines (assume FY26 ships):
//   WOTC (H.R. 1177):     est $63.00 / tracker / yr
//   Tax prep partners:    est $40.80 / tracker / yr
//   Other (LIHEAP routing fees, banking, etc.): est $116.00 / tracker / yr
//   ──────────────────────────────────────────────────
//   Projected total LTV:                       $336.21
//
// Trajectory: +18% MoM (demo trendline — vs prior 30d revenue base).
export const DEMO_LTV: LTVData = {
  available: true,
  headline_dollars_per_tracker_year: 116.41,
  trajectory_mom_pct: 18,
  active_trackers: 3_412,
  live_lines: [
    {
      key: "medicare_advantage",
      label: "Medicare Advantage",
      dollars_per_tracker_year: 113.55,
      share_pct: 33.8,                          // of $336.21 projected total
    },
    {
      key: "partner_offers",
      label: "Partner offers (ads)",
      dollars_per_tracker_year: 2.86,
      share_pct: 0.9,
    },
  ],
  projected_lines: [
    {
      key: "wotc",
      label: "WOTC (post-1177)",
      dollars_per_tracker_year: 63.00,
      share_pct: 18.7,
    },
    {
      key: "tax_prep",
      label: "Tax prep partnerships",
      dollars_per_tracker_year: 40.80,
      share_pct: 12.1,
    },
    {
      key: "other_verticals",
      label: "Other (LIHEAP, banking, …)",
      dollars_per_tracker_year: 116.00,
      share_pct: 34.5,
    },
  ],
};

// Distress-flag honor commitment — Panel 12.
//
// Political-defense surface: for every monetization line (ads, MA referrals,
// future WOTC/tax-prep), Civica excludes HHs in active distress states
// (denials, appeals, OBBBA §10102 distress prompts, recert lapses).
//
// Sized against the 3,412 active-tracker population:
//   - 523 active distress flags (~15% of trackers)
//   - 612 ad impressions withheld in 30d (would otherwise have been served)
//   - 47 Medicare Advantage referrals withheld (subset of 750-eligible senior cohort)
//   - WOTC + tax prep are placeholders — those monetization lines aren't live yet
//
// Recent events strip uses county_fips only (D13: no user identifiers).
export const DEMO_DISTRESS_OVERLAY: DistressOverlayData = {
  available: true,
  total_active_flags: 523,
  flag_window_days: 30,
  withheld_by_line: [
    { line_key: "ads",     line_label: "Partner offers (ads)", withheld_count: 612,  unit: "impressions" },
    { line_key: "ma",      line_label: "Medicare Advantage",   withheld_count: 47,   unit: "referrals" },
    { line_key: "wotc",    line_label: "WOTC referral",        withheld_count: null, unit: "—" }, // placeholder · not yet live
    { line_key: "taxprep", line_label: "Tax prep",             withheld_count: null, unit: "—" }, // placeholder · not yet live
  ],
  recent_events: [
    { ts: new Date(Date.now() - 12 * 60_000).toISOString(),                   flag_type: "denial_appeal_opened",  county_fips: "06037" }, // 12 min ago · LA
    { ts: new Date(Date.now() - 47 * 60_000).toISOString(),                   flag_type: "obbba_distress_prompt", county_fips: "06065" }, // 47 min ago · Riverside
    { ts: new Date(Date.now() - Math.round(1.8 * 60) * 60_000).toISOString(), flag_type: "recert_lapse_14d",      county_fips: "06067" }, // 1h48m ago · Sacramento
    { ts: new Date(Date.now() - Math.round(3.2 * 60) * 60_000).toISOString(), flag_type: "denial_appeal_opened",  county_fips: "06059" }, // 3h12m ago · Orange
    { ts: new Date(Date.now() - Math.round(5.4 * 60) * 60_000).toISOString(), flag_type: "obbba_distress_prompt", county_fips: "06037" }, // 5h24m ago · LA
  ],
};

export function isDemoOpsFallbackEnabled(): boolean {
  // Activate demo fixtures when:
  //   (a) DEMO_FALLBACK=true (intentional demo mode in prod-like environments), OR
  //   (b) SUPABASE_SERVICE_ROLE_KEY is missing locally (so the page never renders
  //       all-empty states during dev — see /ops route demo posture).
  return process.env.DEMO_FALLBACK === "true"
      || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}
