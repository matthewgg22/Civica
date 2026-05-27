/**
 * Single source of truth for demo data scale.
 *
 * Sized to 5% CA CalFresh marketshare. CA has ~2.8M CalFresh households, so
 * 5% = 140,000 HHs (~336,000 individuals at avg HH size 2.4). All aggregate
 * demo fixtures derive from this constant so the demo reads internally
 * consistent across every tab. Flex the marketshare assumption by changing
 * `DEMO_TOTAL_HOUSEHOLDS` here — everything else recomputes.
 *
 * Per-unit metrics (TTFD median, LTV per tracker, redistribution %, CTR,
 * conversion rates, retention curve shapes) do NOT scale with HH count.
 *
 * Framing: this represents Civica's projected steady-state at category-leader
 * marketshare, not current run rate. Hero strips should display the
 * `DEMO_MARKETSHARE_LABEL` so demo viewers see the assumption explicitly.
 */

// ── Headline assumption ─────────────────────────────────────────────────────

/** 5% of CA's ~2.8M CalFresh households. Flex this to model other scales. */
export const DEMO_TOTAL_HOUSEHOLDS = 140_000;
export const DEMO_AVG_HH_SIZE = 2.4;
export const DEMO_TOTAL_INDIVIDUALS = Math.round(DEMO_TOTAL_HOUSEHOLDS * DEMO_AVG_HH_SIZE);

export const DEMO_MARKETSHARE_LABEL = "Projected · 5% CA CalFresh marketshare";
export const DEMO_MARKETSHARE_SHORT = "5% CA · 140K HHs";

// ── SNAP benefit assumptions ────────────────────────────────────────────────

/** CA CalFresh statewide avg per-person monthly benefit, 2025 (USD). */
export const DEMO_BENEFIT_PER_PERSON_MONTHLY_USD = 192;
export const DEMO_BENEFIT_PER_HH_MONTHLY_USD =
  DEMO_BENEFIT_PER_PERSON_MONTHLY_USD * DEMO_AVG_HH_SIZE;
export const DEMO_TOTAL_BENEFIT_MONTHLY_USD =
  DEMO_TOTAL_HOUSEHOLDS * DEMO_BENEFIT_PER_HH_MONTHLY_USD;
export const DEMO_TOTAL_BENEFIT_ANNUAL_USD = DEMO_TOTAL_BENEFIT_MONTHLY_USD * 12;
export const DEMO_MEALS_PER_DOLLAR = 0.5; // ~$2/meal, national avg
export const DEMO_TOTAL_MEALS_MONTHLY = Math.round(DEMO_TOTAL_BENEFIT_MONTHLY_USD * DEMO_MEALS_PER_DOLLAR);

// ── EBT tracker assumptions ─────────────────────────────────────────────────

/** Fraction of HHs with a tracker whose Supabase Vault cookie hasn't expired. */
export const DEMO_ACTIVE_TRACKER_RATE = 0.83;
export const DEMO_ACTIVE_TRACKERS = Math.round(DEMO_TOTAL_HOUSEHOLDS * DEMO_ACTIVE_TRACKER_RATE);

/** Linked cards per HH (some HHs have a primary + an authorized-rep card). */
export const DEMO_LINKED_CARDS_PER_HH = 1.20;
export const DEMO_TOTAL_LINKED_CARDS = Math.round(DEMO_TOTAL_HOUSEHOLDS * DEMO_LINKED_CARDS_PER_HH);

/** Mid-cycle avg balance per active tracked card (USD). */
export const DEMO_AVG_BALANCE_PER_ACTIVE_TRACKER_USD = 250;
export const DEMO_TOTAL_BALANCE_USD =
  DEMO_ACTIVE_TRACKERS * DEMO_AVG_BALANCE_PER_ACTIVE_TRACKER_USD;
export const DEMO_TOTAL_BALANCE_CENTS = DEMO_TOTAL_BALANCE_USD * 100;

// ── Notification volume + cost ──────────────────────────────────────────────

export const DEMO_NOTIFICATIONS_PER_HH_MONTHLY = 4.4;
export const DEMO_TOTAL_NOTIFICATIONS_MONTHLY =
  Math.round(DEMO_TOTAL_HOUSEHOLDS * DEMO_NOTIFICATIONS_PER_HH_MONTHLY);

/** Channel split; push dominates because APNs is free. */
export const DEMO_NOTIF_PUSH_SHARE = 0.70;
export const DEMO_NOTIF_SMS_SHARE = 0.14;
export const DEMO_NOTIF_EMAIL_SHARE = 0.16;

/** Per-message cost (cents). Twilio US SMS ~$0.0075, Resend ~$0.0004. */
export const DEMO_SMS_COST_CENTS = 0.75;
export const DEMO_EMAIL_COST_CENTS = 0.04;

export const DEMO_TOTAL_NOTIF_COST_CENTS = Math.round(
  DEMO_TOTAL_NOTIFICATIONS_MONTHLY * DEMO_NOTIF_SMS_SHARE * DEMO_SMS_COST_CENTS
    + DEMO_TOTAL_NOTIFICATIONS_MONTHLY * DEMO_NOTIF_EMAIL_SHARE * DEMO_EMAIL_COST_CENTS
);

// ── Eligibility cohort ratios (anchored to ACTIVE TRACKERS) ─────────────────
//
// Cohort eligibility is computed against the active-tracker base — these are
// the HHs Civica can actually act on for monetization (the inactive 17%
// haven't synced recently and aren't reachable via push/SMS reliably).
// Anchoring eligibility to active-tracker count keeps LTV-per-tracker
// internally consistent across panels.

/** 60+ cohort: ~22% of CalFresh HHs per CDSS demographics. */
export const DEMO_SENIOR_PCT = 0.22;
export const DEMO_SENIOR_HHS = Math.round(DEMO_ACTIVE_TRACKERS * DEMO_SENIOR_PCT);

/** Of seniors, share that are Medi-Cal dual-eligible (routed to Medi-Cal first). */
export const DEMO_MEDI_CAL_DUAL_RATE = 0.63;
export const DEMO_MEDI_CAL_FIRST_HHS = Math.round(DEMO_SENIOR_HHS * DEMO_MEDI_CAL_DUAL_RATE);
export const DEMO_MA_ELIGIBLE_NON_MEDI_CAL_HHS = DEMO_SENIOR_HHS - DEMO_MEDI_CAL_FIRST_HHS;

/** Working-age 18-39 (WOTC target window when H.R. 1177 lands). */
export const DEMO_WORKING_AGE_PCT = 0.30;
export const DEMO_WORKING_AGE_HHS = Math.round(DEMO_ACTIVE_TRACKERS * DEMO_WORKING_AGE_PCT);
/** Subset of working-age that meet WOTC employer-side criteria. */
export const DEMO_WOTC_ELIGIBLE_HHS = Math.round(DEMO_WORKING_AGE_HHS * 0.67);

/** Tax-prep eligible (working SNAP HHs with anticipated refund). */
export const DEMO_TAX_PREP_ELIGIBLE_HHS = Math.round(DEMO_ACTIVE_TRACKERS * 0.30);

/** LIHEAP / utility assistance income-eligible. Almost all SNAP HHs qualify. */
export const DEMO_LIHEAP_ELIGIBLE_HHS = Math.round(DEMO_ACTIVE_TRACKERS * 0.85);

/** Partner-offer ad placements — all active trackers are eligible. */
export const DEMO_PARTNER_OFFER_ELIGIBLE_HHS = DEMO_ACTIVE_TRACKERS;

// ── Funnel conversion rates (per-unit, do not scale) ────────────────────────

export const DEMO_WOTC_CONV_RATE = 0.11;
export const DEMO_WOTC_FEE_CENTS = 1600_00;

export const DEMO_MA_REFERRAL_RATE = 0.43;        // eligible (non-Medi-Cal) → referred
export const DEMO_MA_ENROLL_RATE = 0.317;         // referred → enrolled
export const DEMO_MA_FEE_CENTS = 850_00;

export const DEMO_TAX_PREP_CONV_RATE = 0.18;
export const DEMO_TAX_PREP_FEE_CENTS = 48_00;

export const DEMO_AD_IMPRESSIONS_PER_HH_MONTHLY = 7.1;
export const DEMO_AD_CTR = 0.034;
export const DEMO_AD_CLICK_CONV_RATE = 0.153;
/** Cents per impression. Back-derived from prior demo: $812.40 / 24,180 = ~3.36¢. */
export const DEMO_AD_REV_PER_IMPRESSION_CENTS = 3.36;

// ── Distress + compliance ───────────────────────────────────────────────────

/** Share of HHs flagged with an active distress signal in any 30d window. */
export const DEMO_DISTRESS_30D_FLAG_RATE = 0.15;
export const DEMO_DISTRESS_30D_FLAGGED_HHS = Math.round(
  DEMO_TOTAL_HOUSEHOLDS * DEMO_DISTRESS_30D_FLAG_RATE
);

// ── Retention curve (per-unit, do not scale) ────────────────────────────────

export const DEMO_RETENTION_D30 = 0.95;
export const DEMO_RETENTION_D60 = 0.88;
export const DEMO_RETENTION_D90 = 0.78;
export const DEMO_RETENTION_D180 = 0.64;

// ── Operational speed (per-unit, do not scale) ──────────────────────────────

export const DEMO_TTFD_MEDIAN_DAYS = 8.4;
/** Cumulative completed submit→deposit journeys for TTFD n. */
export const DEMO_TTFD_JOURNEYS = Math.round(DEMO_TOTAL_HOUSEHOLDS * 0.59);

// ── Cohort sizing (last 6 months of enrollment, ramping toward steady state) ──

/** Approximate distribution of recent monthly enrollment intake, oldest→newest. */
const COHORT_RAMP = [0.057, 0.080, 0.105, 0.135, 0.158, 0.115];
export const DEMO_COHORT_MONTHLY_COUNTS = COHORT_RAMP.map((share) =>
  Math.round(DEMO_TOTAL_HOUSEHOLDS * share)
);

// ── Geographic distribution shares (top CA CalFresh counties) ───────────────
// Real CalFresh county-share-of-state figures (CDSS 2024 published totals).
//
// Per-county `mix` carries operational variance — mature urban counties
// (LA, Bay Area) skew toward higher Enrolled % and lower in-progress; newer
// counties or those with higher recert friction show more Attention or
// In Progress. Without per-county variance, the status bars below the map
// all render as visually identical stacked clones, which reads as fake
// data and creates a "symmetrical outline" effect down the row column.
//
// Mix tuples sum to 1.00: [draft, in_progress, needs_attention, ready, enrolled]
export const DEMO_COUNTY_SHARES: Array<{
  fips: string;
  name: string;
  share: number;
  mix: [number, number, number, number, number];
}> = [
  // LA — most mature, big operations team, high throughput
  { fips: "06037", name: "Los Angeles",      share: 0.345, mix: [0.07, 0.13, 0.04, 0.03, 0.73] },
  // Riverside — fast-growing, some bottlenecks
  { fips: "06065", name: "Riverside",        share: 0.062, mix: [0.11, 0.20, 0.07, 0.04, 0.58] },
  // San Bernardino — newer rollout, heavier in-progress queue
  { fips: "06071", name: "San Bernardino",   share: 0.068, mix: [0.13, 0.24, 0.06, 0.05, 0.52] },
  // Fresno — Central Valley, more attention from doc-verification challenges
  { fips: "06019", name: "Fresno",           share: 0.045, mix: [0.10, 0.18, 0.11, 0.04, 0.57] },
  // Orange — affluent county, low draft abandonment, high enrolled
  { fips: "06059", name: "Orange",           share: 0.038, mix: [0.06, 0.11, 0.04, 0.03, 0.76] },
  // San Diego — large, balanced
  { fips: "06073", name: "San Diego",        share: 0.052, mix: [0.09, 0.15, 0.05, 0.04, 0.67] },
  // Sacramento — mature, good navigator workflow
  { fips: "06067", name: "Sacramento",       share: 0.040, mix: [0.08, 0.14, 0.05, 0.04, 0.69] },
  // Kern — agricultural/seasonal, more attention
  { fips: "06029", name: "Kern",             share: 0.029, mix: [0.12, 0.21, 0.10, 0.04, 0.53] },
  // Tulare — Central Valley, similar to Fresno
  { fips: "06107", name: "Tulare",           share: 0.024, mix: [0.11, 0.20, 0.09, 0.04, 0.56] },
  // San Joaquin — newer, heavy in-progress
  { fips: "06077", name: "San Joaquin",      share: 0.028, mix: [0.14, 0.25, 0.07, 0.05, 0.49] },
  // Stanislaus — Central Valley
  { fips: "06099", name: "Stanislaus",       share: 0.021, mix: [0.12, 0.22, 0.08, 0.04, 0.54] },
  // Santa Clara — tech-heavy, smooth digital pipeline
  { fips: "06085", name: "Santa Clara",      share: 0.024, mix: [0.05, 0.10, 0.03, 0.03, 0.79] },
  // Alameda — mature Bay Area, high enrolled
  { fips: "06001", name: "Alameda",          share: 0.027, mix: [0.06, 0.12, 0.04, 0.04, 0.74] },
  // Contra Costa — Bay Area, similar to Alameda
  { fips: "06013", name: "Contra Costa",     share: 0.019, mix: [0.07, 0.13, 0.04, 0.04, 0.72] },
  // San Francisco — smallest, very mature, dense
  { fips: "06075", name: "San Francisco",    share: 0.016, mix: [0.05, 0.11, 0.03, 0.04, 0.77] },
];

/** HH count per county at current marketshare. */
export function householdsInCounty(fips: string): number {
  const entry = DEMO_COUNTY_SHARES.find((c) => c.fips === fips);
  if (!entry) return 0;
  return Math.round(DEMO_TOTAL_HOUSEHOLDS * entry.share);
}

// ── Packet lifecycle distribution (per-HH percentages of the active base) ───
//
// Used to derive at-scale county status-mix bars + dashboard urgent banner
// when demo fallback is on. Percentages sum to 1.00.
export const DEMO_PACKET_STATUS_MIX = {
  draft: 0.10,             // mid-application abandonment
  in_progress: 0.18,       // submitted/in nav review
  needs_attention: 0.06,   // needs docs / needs applicant clarification
  ready: 0.04,             // ready for handoff, not yet sent to county
  enrolled: 0.62,          // handed off / closed
};

/** Total at-scale packet count = households at marketshare. */
export const DEMO_TOTAL_PACKETS = DEMO_TOTAL_HOUSEHOLDS;
export const DEMO_PACKETS_DRAFT = Math.round(DEMO_TOTAL_PACKETS * DEMO_PACKET_STATUS_MIX.draft);
export const DEMO_PACKETS_IN_PROGRESS = Math.round(DEMO_TOTAL_PACKETS * DEMO_PACKET_STATUS_MIX.in_progress);
export const DEMO_PACKETS_NEEDS_ATTENTION = Math.round(DEMO_TOTAL_PACKETS * DEMO_PACKET_STATUS_MIX.needs_attention);
export const DEMO_PACKETS_READY = Math.round(DEMO_TOTAL_PACKETS * DEMO_PACKET_STATUS_MIX.ready);
export const DEMO_PACKETS_ENROLLED = Math.round(DEMO_TOTAL_PACKETS * DEMO_PACKET_STATUS_MIX.enrolled);

/** Per-county status mix, scaled from DEMO_COUNTY_SHARES × per-county mix tuples.
    Each county has its own [draft, in_progress, needs_attention, ready, enrolled]
    proportions so the status bars are visually distinct, not stacked clones. */
export function buildDemoCountyStatusMix(): Record<string, {
  count: number;
  draft: number;
  inProgress: number;
  needsAttention: number;
  ready: number;
  enrolled: number;
}> {
  const out: Record<string, { count: number; draft: number; inProgress: number; needsAttention: number; ready: number; enrolled: number }> = {};
  for (const c of DEMO_COUNTY_SHARES) {
    const total = Math.round(DEMO_TOTAL_PACKETS * c.share);
    const [draftPct, inProgressPct, needsAttnPct, readyPct, enrolledPct] = c.mix;
    out[c.fips] = {
      count: total,
      draft: Math.round(total * draftPct),
      inProgress: Math.round(total * inProgressPct),
      needsAttention: Math.round(total * needsAttnPct),
      ready: Math.round(total * readyPct),
      enrolled: Math.round(total * enrolledPct),
    };
  }
  return out;
}

// ── Urgent banner counts (dashboard "Needs Action Now") ─────────────────────
//
// Operational counts for the urgent action banner. Percentages are
// per-enrolled-HH (not total HHs) so they scale with the enrolled cohort.
export const DEMO_OVERDUE_RECERT_RATE = 0.012;          // ~1.2% of enrolled overdue on recert
export const DEMO_EXPIRING_THIS_MONTH_RATE = 0.055;     // ~5.5% have 12mo anniversary in next 30d
export const DEMO_NEEDS_ATTENTION_RATE = DEMO_PACKET_STATUS_MIX.needs_attention;

export const DEMO_OVERDUE_RECERTS_COUNT = Math.round(DEMO_PACKETS_ENROLLED * DEMO_OVERDUE_RECERT_RATE);
export const DEMO_EXPIRING_THIS_MONTH_COUNT = Math.round(DEMO_PACKETS_ENROLLED * DEMO_EXPIRING_THIS_MONTH_RATE);
export const DEMO_NEEDS_ATTENTION_COUNT = DEMO_PACKETS_NEEDS_ATTENTION;

// ── Enrollment funnel (cumulative reach per stage) ──────────────────────────
//
// Every HH is at some lifecycle stage. The funnel shows cumulative reach:
// packets that EVER reached a given stage. Drop-off rates between stages
// represent real-world abandonment (re-uploads requested, navigator review
// kicks back, county denials, etc.).
export const DEMO_FUNNEL_STAGES = {
  draft:              DEMO_TOTAL_PACKETS,                                  // 140,000 — all start
  submitted:          Math.round(DEMO_TOTAL_PACKETS * 0.92),               // 90-92% submit
  in_nav_review:      Math.round(DEMO_TOTAL_PACKETS * 0.86),               // 86% reach review
  ready_for_handoff:  Math.round(DEMO_TOTAL_PACKETS * 0.71),               // 71% reach ready
  handed_off:         DEMO_PACKETS_ENROLLED,                               // 62% — matches enrolled
};

/** Avg days in stage. Per-unit, doesn't scale with marketshare. */
export const DEMO_FUNNEL_AVG_DAYS = {
  draft:              2.1,
  submitted:          1.4,
  in_nav_review:      2.8,
  ready_for_handoff:  0.6,
  handed_off:         null,
};
