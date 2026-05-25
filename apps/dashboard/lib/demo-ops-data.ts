/**
 * Demo fixtures for /ops Performance panels.
 *
 * Wired into apps/dashboard/lib/ops-fetchers.ts: when the service-role client
 * is unavailable (local dev without SUPABASE_SERVICE_ROLE_KEY) OR when
 * DEMO_FALLBACK=true is set, fetchers return these fixtures instead of an
 * "apply migrations" empty state.
 *
 * **All aggregates derive from apps/dashboard/lib/demo-profile.ts.** Flex the
 * `DEMO_TOTAL_HOUSEHOLDS` constant there (currently 140K = 5% CA CalFresh
 * marketshare) to rescale every panel proportionally.
 *
 * Per-unit metrics (TTFD median, LTV per tracker, redistribution %, CTR,
 * conversion rates, retention curve shapes) do NOT scale with HH count —
 * they stay constant as marketshare grows.
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
import {
  DEMO_ACTIVE_TRACKERS,
  DEMO_TOTAL_LINKED_CARDS,
  DEMO_TOTAL_BALANCE_CENTS,
  DEMO_TOTAL_NOTIFICATIONS_MONTHLY,
  DEMO_NOTIF_PUSH_SHARE,
  DEMO_NOTIF_SMS_SHARE,
  DEMO_NOTIF_EMAIL_SHARE,
  DEMO_SMS_COST_CENTS,
  DEMO_EMAIL_COST_CENTS,
  DEMO_COHORT_MONTHLY_COUNTS,
  DEMO_RETENTION_D30,
  DEMO_RETENTION_D60,
  DEMO_RETENTION_D90,
  DEMO_RETENTION_D180,
  DEMO_TTFD_MEDIAN_DAYS,
  DEMO_TTFD_JOURNEYS,
  DEMO_TOTAL_HOUSEHOLDS,
  DEMO_SENIOR_HHS,
  DEMO_MEDI_CAL_FIRST_HHS,
  DEMO_MA_ELIGIBLE_NON_MEDI_CAL_HHS,
  DEMO_MA_REFERRAL_RATE,
  DEMO_MA_ENROLL_RATE,
  DEMO_MA_FEE_CENTS,
  DEMO_WOTC_ELIGIBLE_HHS,
  DEMO_WOTC_CONV_RATE,
  DEMO_WOTC_FEE_CENTS,
  DEMO_TAX_PREP_ELIGIBLE_HHS,
  DEMO_TAX_PREP_CONV_RATE,
  DEMO_TAX_PREP_FEE_CENTS,
  DEMO_LIHEAP_ELIGIBLE_HHS,
  DEMO_PARTNER_OFFER_ELIGIBLE_HHS,
  DEMO_AD_IMPRESSIONS_PER_HH_MONTHLY,
  DEMO_AD_CTR,
  DEMO_AD_CLICK_CONV_RATE,
  DEMO_AD_REV_PER_IMPRESSION_CENTS,
  DEMO_DISTRESS_30D_FLAGGED_HHS,
  DEMO_COUNTY_SHARES,
} from "./demo-profile";

// ── Panel 1: EBT Balance Aggregate ──────────────────────────────────────────

export const DEMO_EBT_AGGREGATE: EbtAggregateData = {
  available: true,
  total_balance_cents: DEMO_TOTAL_BALANCE_CENTS,
  active_tracker_count: DEMO_ACTIVE_TRACKERS,
  total_card_count: DEMO_TOTAL_LINKED_CARDS,
  latest_balance_at: new Date(Date.now() - 4 * 60_000).toISOString(),
};

// ── Panel 2: Placement map ──────────────────────────────────────────────────
//
// Catalog-level counts: number of partner-offer placements per county. The
// per-county placement_count is NOT a per-HH metric — it reflects how many
// distinct offers Civica has configured in that county. Stays in the
// 40-200 range across counties. expected_revenue_cents scales with the
// county's HH share × Civica's avg revenue-per-active-tracker.

const PLACEMENT_RICH_CATEGORIES: Record<string, string[]> = {
  "06037": ["groceries", "mobile", "utilities", "healthcare", "pharmacy"],
  "06065": ["groceries", "mobile", "utilities", "pharmacy"],
  "06019": ["groceries", "utilities", "healthcare"],
  "06071": ["groceries", "mobile", "utilities"],
  "06059": ["groceries", "mobile", "utilities", "healthcare"],
  "06073": ["groceries", "healthcare", "pharmacy"],
  "06067": ["groceries", "mobile", "utilities"],
  "06077": ["groceries", "utilities"],
  "06099": ["groceries", "utilities"],
  "06107": ["groceries", "mobile"],
  "06029": ["groceries", "utilities"],
  "06085": ["mobile", "healthcare", "pharmacy"],
  "06001": ["mobile", "groceries", "healthcare"],
  "06013": ["groceries", "mobile"],
  "06075": ["mobile", "healthcare"],
};

// Per-county placement count scales sub-linearly with county HH count.
const PLACEMENT_COUNT_BY_FIPS: Record<string, number> = {
  "06037": 42, "06065": 31, "06019": 28, "06071": 26, "06059": 22,
  "06073": 19, "06067": 17, "06077": 14, "06099": 12, "06107": 11,
  "06029": 10, "06085": 9, "06001": 8, "06013": 7, "06075": 6,
};

const TOTAL_ACTIVE_OFFERS = 47; // catalog-level — number of distinct partner offers
const REVENUE_PER_PLACEMENT_CENTS = 196_000; // ~$1,960 expected revenue per per-county placement at 5% marketshare

export const DEMO_PLACEMENTS: PlacementsData = {
  available: true,
  total_active_offers: TOTAL_ACTIVE_OFFERS,
  placements: [
    ...DEMO_COUNTY_SHARES.map((c) => ({
      county_fips: c.fips,
      placement_count: PLACEMENT_COUNT_BY_FIPS[c.fips] ?? 5,
      expected_revenue_cents: Math.round((PLACEMENT_COUNT_BY_FIPS[c.fips] ?? 5) * REVENUE_PER_PLACEMENT_CENTS),
      categories: PLACEMENT_RICH_CATEGORIES[c.fips] ?? ["groceries"],
    })),
    {
      county_fips: "STATEWIDE",
      placement_count: 4,
      expected_revenue_cents: 4 * REVENUE_PER_PLACEMENT_CENTS,
      categories: ["healthcare", "utilities"],
    },
  ],
};

// ── Panel 3: Notification Outlay ────────────────────────────────────────────
//
// Channel × category counts derived from total monthly notification volume
// (DEMO_TOTAL_NOTIFICATIONS_MONTHLY) × channel share × category mix.
// Cost computed from per-message rates (Twilio + Resend).

const CATEGORY_MIX: Record<string, number> = {
  deposit_alert: 0.495,    // dominant — every monthly issuance fires one
  recert_reminder: 0.205,
  partner_offer: 0.215,
  balance_low: 0.085,
};

function buildNotifCells(): NotificationOutlayData["cells"] {
  const cells: NotificationOutlayData["cells"] = [];
  // Push: free; dominant volume
  for (const cat of ["deposit_alert", "recert_reminder", "partner_offer", "balance_low"] as const) {
    cells.push({
      channel: "push",
      category: cat,
      count: Math.round(DEMO_TOTAL_NOTIFICATIONS_MONTHLY * DEMO_NOTIF_PUSH_SHARE * CATEGORY_MIX[cat]),
      cost_cents: 0,
    });
  }
  // SMS: $0.0075/msg (Twilio US list price)
  for (const cat of ["deposit_alert", "recert_reminder", "balance_low"] as const) {
    const count = Math.round(DEMO_TOTAL_NOTIFICATIONS_MONTHLY * DEMO_NOTIF_SMS_SHARE * (CATEGORY_MIX[cat] / (CATEGORY_MIX.deposit_alert + CATEGORY_MIX.recert_reminder + CATEGORY_MIX.balance_low)));
    cells.push({
      channel: "sms",
      category: cat,
      count,
      cost_cents: Math.round(count * DEMO_SMS_COST_CENTS),
    });
  }
  // Email: $0.0004/msg (Resend)
  for (const cat of ["deposit_alert", "recert_reminder", "partner_offer"] as const) {
    const count = Math.round(DEMO_TOTAL_NOTIFICATIONS_MONTHLY * DEMO_NOTIF_EMAIL_SHARE * (CATEGORY_MIX[cat] / (CATEGORY_MIX.deposit_alert + CATEGORY_MIX.recert_reminder + CATEGORY_MIX.partner_offer)));
    cells.push({
      channel: "email",
      category: cat,
      count,
      cost_cents: Math.round(count * DEMO_EMAIL_COST_CENTS),
    });
  }
  return cells;
}

const NOTIF_CELLS = buildNotifCells();

export const DEMO_NOTIFICATION_OUTLAY: NotificationOutlayData = {
  available: true,
  cells: NOTIF_CELLS,
  total_count: NOTIF_CELLS.reduce((s, c) => s + c.count, 0),
  total_cost_cents: NOTIF_CELLS.reduce((s, c) => s + c.cost_cents, 0),
};

// ── Panel 4: Cohort Retention ───────────────────────────────────────────────
//
// 6 most recent enrollment months. `currently_active` derived from each
// cohort's age × retention curve.

const MONTHS: string[] = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
// Approximate age of each cohort in months (oldest to newest).
const COHORT_AGES_MONTHS = [6, 5, 4, 3, 2, 1];

function cohortActiveRate(ageMonths: number): number {
  // Pick the closest retention bucket.
  const ageDays = ageMonths * 30;
  if (ageDays >= 180) return DEMO_RETENTION_D180;
  if (ageDays >= 90) return DEMO_RETENTION_D90;
  if (ageDays >= 60) return DEMO_RETENTION_D60;
  return DEMO_RETENTION_D30;
}

export const DEMO_COHORTS: CohortData = {
  available: true,
  cohorts: MONTHS.map((m, i) => {
    const packet_count = DEMO_COHORT_MONTHLY_COUNTS[i] ?? 0;
    const active_rate = cohortActiveRate(COHORT_AGES_MONTHS[i] ?? 1);
    const currently_active = Math.round(packet_count * active_rate);
    return {
      enrollment_month: m,
      packet_count,
      currently_active,
      active_pct: Math.round(active_rate * 1000) / 10,
    };
  }),
};

// Extended cohort data for the v1.1-shaped curve visualization.
// Older cohorts have full 180d data; newest cohorts terminate at the latest
// bucket they've reached. Retention curve shape is per-unit and doesn't
// scale with marketshare.
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

// ── Panel 5: Time to First Deposit ──────────────────────────────────────────
//
// Median days is per-unit (8.4d). n scales with cumulative HH journeys.
// Per-county trend scales by county's HH share.

export const DEMO_TTFD: TTFDData = {
  available: true,
  median_days: DEMO_TTFD_MEDIAN_DAYS,
  n: DEMO_TTFD_JOURNEYS,
  county_trend: [
    { county_fips: "06037", n: Math.round(DEMO_TTFD_JOURNEYS * 0.215), median_days: 7.2 },
    { county_fips: "06067", n: Math.round(DEMO_TTFD_JOURNEYS * 0.147), median_days: 6.8 },
    { county_fips: "06059", n: Math.round(DEMO_TTFD_JOURNEYS * 0.110), median_days: 7.4 },
    { county_fips: "06073", n: Math.round(DEMO_TTFD_JOURNEYS * 0.101), median_days: 8.1 },
    { county_fips: "06065", n: Math.round(DEMO_TTFD_JOURNEYS * 0.093), median_days: 8.6 },
    { county_fips: "06071", n: Math.round(DEMO_TTFD_JOURNEYS * 0.085), median_days: 9.2 },
    { county_fips: "06019", n: Math.round(DEMO_TTFD_JOURNEYS * 0.070), median_days: 9.8 },
    { county_fips: "06085", n: Math.round(DEMO_TTFD_JOURNEYS * 0.050), median_days: 7.6 },
    { county_fips: "06001", n: Math.round(DEMO_TTFD_JOURNEYS * 0.045), median_days: 8.0 },
    { county_fips: "06077", n: Math.round(DEMO_TTFD_JOURNEYS * 0.037), median_days: 11.2 },
  ],
};

// Synthetic histogram: distribution shape stays constant; counts scale to
// match DEMO_TTFD_JOURNEYS.
const TTFD_HISTOGRAM_SHARES = [
  { day_bucket: "1-2",   share: 0.0144 },
  { day_bucket: "3-4",   share: 0.0657 },
  { day_bucket: "5-6",   share: 0.1447 },
  { day_bucket: "7-8",   share: 0.2191 },
  { day_bucket: "9-10",  share: 0.2062 },
  { day_bucket: "11-12", share: 0.1517 },
  { day_bucket: "13-14", share: 0.0987 },
  { day_bucket: "15-18", share: 0.0646 },
  { day_bucket: "19-25", share: 0.0256 },
  { day_bucket: "26+",   share: 0.0091 },
];
export const DEMO_TTFD_HISTOGRAM: Array<{ day_bucket: string; count: number }> = TTFD_HISTOGRAM_SHARES.map((b) => ({
  day_bucket: b.day_bucket,
  count: Math.round(DEMO_TTFD_JOURNEYS * b.share),
}));

// ── Panel 6: Partner-offer P&L (impressions-only v1) ────────────────────────

const AD_IMPRESSIONS_MONTHLY = Math.round(DEMO_ACTIVE_TRACKERS * DEMO_AD_IMPRESSIONS_PER_HH_MONTHLY);
const AD_CLICKS_MONTHLY = Math.round(AD_IMPRESSIONS_MONTHLY * DEMO_AD_CTR);
const AD_CONVERSIONS_MONTHLY = Math.round(AD_CLICKS_MONTHLY * DEMO_AD_CLICK_CONV_RATE);
const AD_REVENUE_CENTS = Math.round(AD_IMPRESSIONS_MONTHLY * DEMO_AD_REV_PER_IMPRESSION_CENTS);
const AD_HH_SAVINGS_CENTS = Math.round(AD_REVENUE_CENTS * 1.362); // empirical ratio from prior demo
const AD_REV_PER_TRACKER_CENTS = DEMO_ACTIVE_TRACKERS > 0
  ? Math.round(AD_REVENUE_CENTS / DEMO_ACTIVE_TRACKERS)
  : 0;
const AD_REDISTRIBUTION_PCT = (AD_REVENUE_CENTS + AD_HH_SAVINGS_CENTS) > 0
  ? Math.round((AD_HH_SAVINGS_CENTS / (AD_REVENUE_CENTS + AD_HH_SAVINGS_CENTS)) * 1000) / 10
  : 0;

export const DEMO_PARTNER_PNL: PartnerPnLData = {
  available: true,
  impressions: AD_IMPRESSIONS_MONTHLY,
  clicks: AD_CLICKS_MONTHLY,
  conversions: AD_CONVERSIONS_MONTHLY,
  revenue_cents: AD_REVENUE_CENTS,
  saved_cents: AD_HH_SAVINGS_CENTS,
  revenue_per_active_tracker_cents: AD_REV_PER_TRACKER_CENTS,
  redistribution_pct: AD_REDISTRIBUTION_PCT,
  active_trackers: DEMO_ACTIVE_TRACKERS,
};

// ── Panel 8: Medicare Advantage referrals ───────────────────────────────────

const MA_REFERRED = Math.round(DEMO_MA_ELIGIBLE_NON_MEDI_CAL_HHS * DEMO_MA_REFERRAL_RATE);
const MA_ENROLLED = Math.round(MA_REFERRED * DEMO_MA_ENROLL_RATE);
const MA_REVENUE_CENTS = MA_ENROLLED * DEMO_MA_FEE_CENTS;

export const DEMO_MEDICARE_ADVANTAGE: MedicareAdvantageData = {
  available: true,
  active_trackers: DEMO_ACTIVE_TRACKERS,
  eligible_seniors: DEMO_SENIOR_HHS,
  medi_cal_routed_count: DEMO_MEDI_CAL_FIRST_HHS,
  eligible_non_medi_cal: DEMO_MA_ELIGIBLE_NON_MEDI_CAL_HHS,
  referred_to_partners: MA_REFERRED,
  enrolled: MA_ENROLLED,
  revenue_cents: MA_REVENUE_CENTS,
  avg_fee_per_enrollment_cents: DEMO_MA_FEE_CENTS,
  cms_compliant: true,
  last_cms_audit_at: new Date(Date.now() - 14 * 86_400_000).toISOString(),
  disclosure_version: "v2.3 · 2026-Q2",
};

// ── Panel 9: Eligibility Queue ──────────────────────────────────────────────
//
// Per-program eligible counts scale with HH count × program eligibility %.
// "Contacted" assumed at ~33% of eligible (operator outreach hasn't caught up
// to all of TAM yet — that's the "queue" point of this panel).

function makeQueueRow(
  programId: string,
  programName: string,
  eligible: number,
  contactedRatio: number,
  convPct: number,
  feeCents: number,
  monetized: boolean,
  suggestedAction: string,
): EligibilityQueueData["rows"][number] {
  const contacted = Math.round(eligible * contactedRatio);
  const in_queue = eligible - contacted;
  const projected = Math.round(in_queue * (convPct / 100) * feeCents);
  return {
    program_id: programId,
    program_name: programName,
    eligible,
    contacted,
    in_queue,
    conv_pct: convPct,
    dollars_per_conversion_cents: feeCents,
    projected_revenue_cents: projected,
    monetized,
    suggested_action: suggestedAction,
  };
}

export const DEMO_ELIGIBILITY_QUEUE: EligibilityQueueData = {
  available: true,
  rows: [
    makeQueueRow("wotc_job_placement", "WOTC referral · job placement (age 18–39)",
      DEMO_WOTC_ELIGIBLE_HHS, 0.33, DEMO_WOTC_CONV_RATE * 100, DEMO_WOTC_FEE_CENTS, true, "Run outreach"),
    makeQueueRow("medicare_advantage", "Medicare Advantage · 60+ non-Medi-Cal",
      DEMO_MA_ELIGIBLE_NON_MEDI_CAL_HHS, 0.43, DEMO_MA_ENROLL_RATE * 100, DEMO_MA_FEE_CENTS, true, "Schedule batch"),
    makeQueueRow("partner_offers_ads", "Partner offers (ads) · un-served counties",
      Math.round(DEMO_PARTNER_OFFER_ELIGIBLE_HHS * 0.20), 0.25, DEMO_AD_CTR * DEMO_AD_CLICK_CONV_RATE * 100, 35_00, true, "Run outreach"),
    makeQueueRow("tax_prep_refund_advance", "Tax prep / Refund Advance · working SNAP",
      DEMO_TAX_PREP_ELIGIBLE_HHS, 0, DEMO_TAX_PREP_CONV_RATE * 100, DEMO_TAX_PREP_FEE_CENTS, true, "Run outreach"),
    makeQueueRow("liheap_utility", "LIHEAP / utility assistance (income-eligible)",
      DEMO_LIHEAP_ELIGIBLE_HHS, 0.08, 24, 0, false, "Schedule batch"),
  ],
};

// ── Panel 10: Revenue lines rollup ──────────────────────────────────────────

const TOTAL_REVENUE_CENTS = MA_REVENUE_CENTS + AD_REVENUE_CENTS;
const TOTAL_NOTIF_COST_CENTS = NOTIF_CELLS.reduce((s, c) => s + c.cost_cents, 0);
const NET_REVENUE_CENTS = TOTAL_REVENUE_CENTS - TOTAL_NOTIF_COST_CENTS;
const MA_SHARE_PCT = TOTAL_REVENUE_CENTS > 0 ? Math.round((MA_REVENUE_CENTS / TOTAL_REVENUE_CENTS) * 1000) / 10 : 0;
const AD_SHARE_PCT = TOTAL_REVENUE_CENTS > 0 ? Math.round((AD_REVENUE_CENTS / TOTAL_REVENUE_CENTS) * 1000) / 10 : 0;

export const DEMO_REVENUE_LINES: RevenueLinesData = {
  available: true,
  lines: [
    {
      key: "medicare_advantage",
      label: "Medicare Advantage referrals",
      status: "live",
      gross_cents: MA_REVENUE_CENTS,
      share_pct: MA_SHARE_PCT,
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
      gross_cents: AD_REVENUE_CENTS,
      share_pct: AD_SHARE_PCT,
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
      gross_cents: TOTAL_NOTIF_COST_CENTS,
      share_pct: null,
    },
  ],
  net_cents: NET_REVENUE_CENTS,
  wow_delta_pct: 4.8,
};

// ── Panel 11: LTV per active tracker ────────────────────────────────────────

const MA_PER_TRACKER_YR = DEMO_ACTIVE_TRACKERS > 0
  ? Math.round((MA_REVENUE_CENTS * 12) / DEMO_ACTIVE_TRACKERS) / 100
  : 0;
const AD_PER_TRACKER_YR = DEMO_ACTIVE_TRACKERS > 0
  ? Math.round((AD_REVENUE_CENTS * 12) / DEMO_ACTIVE_TRACKERS) / 100
  : 0;
const HEADLINE_LTV = MA_PER_TRACKER_YR + AD_PER_TRACKER_YR;

// Projected roadmap lines (estimates — these don't scale from profile because
// they're forward-looking assumptions about Civica's roadmap).
const PROJECTED_WOTC_YR = 63.00;
const PROJECTED_TAX_PREP_YR = 40.80;
const PROJECTED_OTHER_YR = 116.00;
const PROJECTED_TOTAL_LTV = HEADLINE_LTV + PROJECTED_WOTC_YR + PROJECTED_TAX_PREP_YR + PROJECTED_OTHER_YR;

export const DEMO_LTV: LTVData = {
  available: true,
  headline_dollars_per_tracker_year: HEADLINE_LTV,
  trajectory_mom_pct: 18,
  active_trackers: DEMO_ACTIVE_TRACKERS,
  live_lines: [
    {
      key: "medicare_advantage",
      label: "Medicare Advantage",
      dollars_per_tracker_year: MA_PER_TRACKER_YR,
      share_pct: Math.round((MA_PER_TRACKER_YR / PROJECTED_TOTAL_LTV) * 1000) / 10,
    },
    {
      key: "partner_offers",
      label: "Partner offers (ads)",
      dollars_per_tracker_year: AD_PER_TRACKER_YR,
      share_pct: Math.round((AD_PER_TRACKER_YR / PROJECTED_TOTAL_LTV) * 1000) / 10,
    },
  ],
  projected_lines: [
    {
      key: "wotc",
      label: "WOTC (post-1177)",
      dollars_per_tracker_year: PROJECTED_WOTC_YR,
      share_pct: Math.round((PROJECTED_WOTC_YR / PROJECTED_TOTAL_LTV) * 1000) / 10,
    },
    {
      key: "tax_prep",
      label: "Tax prep partnerships",
      dollars_per_tracker_year: PROJECTED_TAX_PREP_YR,
      share_pct: Math.round((PROJECTED_TAX_PREP_YR / PROJECTED_TOTAL_LTV) * 1000) / 10,
    },
    {
      key: "other_verticals",
      label: "Other (LIHEAP, banking, …)",
      dollars_per_tracker_year: PROJECTED_OTHER_YR,
      share_pct: Math.round((PROJECTED_OTHER_YR / PROJECTED_TOTAL_LTV) * 1000) / 10,
    },
  ],
};

// ── Panel 12: Distress overlay (honor flag) ─────────────────────────────────
//
// Scaled to ~15% of HHs flagged with an active distress signal in any 30d
// window. Withhold counts derived from per-monetization-line caps.

export const DEMO_DISTRESS_OVERLAY: DistressOverlayData = {
  available: true,
  total_active_flags: DEMO_DISTRESS_30D_FLAGGED_HHS,
  flag_window_days: 30,
  withheld_by_line: [
    {
      line_key: "ads",
      line_label: "Partner offers (ads)",
      withheld_count: Math.round(DEMO_DISTRESS_30D_FLAGGED_HHS * DEMO_AD_IMPRESSIONS_PER_HH_MONTHLY * 0.18),
      unit: "impressions",
    },
    {
      line_key: "ma",
      line_label: "Medicare Advantage",
      withheld_count: Math.round(MA_REFERRED * (DEMO_DISTRESS_30D_FLAGGED_HHS / DEMO_TOTAL_HOUSEHOLDS)),
      unit: "referrals",
    },
    { line_key: "wotc",    line_label: "WOTC referral",        withheld_count: null, unit: "—" },
    { line_key: "taxprep", line_label: "Tax prep",             withheld_count: null, unit: "—" },
  ],
  recent_events: [
    { ts: new Date(Date.now() - 12 * 60_000).toISOString(),                   flag_type: "denial_appeal_opened",  county_fips: "06037" },
    { ts: new Date(Date.now() - 47 * 60_000).toISOString(),                   flag_type: "obbba_distress_prompt", county_fips: "06065" },
    { ts: new Date(Date.now() - Math.round(1.8 * 60) * 60_000).toISOString(), flag_type: "recert_lapse_14d",      county_fips: "06067" },
    { ts: new Date(Date.now() - Math.round(3.2 * 60) * 60_000).toISOString(), flag_type: "denial_appeal_opened",  county_fips: "06059" },
    { ts: new Date(Date.now() - Math.round(5.4 * 60) * 60_000).toISOString(), flag_type: "obbba_distress_prompt", county_fips: "06037" },
  ],
};

// ── Fallback gate ───────────────────────────────────────────────────────────

export function isDemoOpsFallbackEnabled(): boolean {
  // Activate demo fixtures when:
  //   (a) DEMO_FALLBACK=true (intentional demo mode in prod-like environments), OR
  //   (b) SUPABASE_SERVICE_ROLE_KEY is missing locally (so the page never renders
  //       all-empty states during dev — see /ops route demo posture).
  return process.env.DEMO_FALLBACK === "true"
      || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}
