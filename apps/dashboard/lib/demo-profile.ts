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

export const DEMO_COUNTY_SHARES: Array<{ fips: string; name: string; share: number }> = [
  { fips: "06037", name: "Los Angeles",      share: 0.345 }, // LA
  { fips: "06065", name: "Riverside",        share: 0.062 },
  { fips: "06071", name: "San Bernardino",   share: 0.068 },
  { fips: "06019", name: "Fresno",           share: 0.045 },
  { fips: "06059", name: "Orange",           share: 0.038 },
  { fips: "06073", name: "San Diego",        share: 0.052 },
  { fips: "06067", name: "Sacramento",       share: 0.040 },
  { fips: "06029", name: "Kern",             share: 0.029 },
  { fips: "06107", name: "Tulare",           share: 0.024 },
  { fips: "06077", name: "San Joaquin",      share: 0.028 },
  { fips: "06099", name: "Stanislaus",       share: 0.021 },
  { fips: "06085", name: "Santa Clara",      share: 0.024 },
  { fips: "06001", name: "Alameda",          share: 0.027 },
  { fips: "06013", name: "Contra Costa",     share: 0.019 },
  { fips: "06075", name: "San Francisco",    share: 0.016 },
];

/** HH count per county at current marketshare. */
export function householdsInCounty(fips: string): number {
  const entry = DEMO_COUNTY_SHARES.find((c) => c.fips === fips);
  if (!entry) return 0;
  return Math.round(DEMO_TOTAL_HOUSEHOLDS * entry.share);
}
