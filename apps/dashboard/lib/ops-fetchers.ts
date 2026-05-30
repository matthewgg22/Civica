/**
 * Server-side data fetchers for /ops dashboard panels.
 *
 * Each fetcher catches "relation does not exist" errors (migrations not yet
 * applied) and returns an explicit `{ available: false, ... }` shape so the
 * UI can render an "apply migrations" empty state instead of a 500.
 *
 * Uses createServiceClient() — RLS bypassed. The /ops middleware gate is the
 * single source of authorization; once it passes, the data layer is open.
 *
 * See ceo-plans/2026-05-25-ebt-monetization-dashboard.md for panel design.
 */

import { createServiceClient } from "./supabase";
import {
  DEMO_EBT_AGGREGATE,
  DEMO_PLACEMENTS,
  DEMO_NOTIFICATION_OUTLAY,
  DEMO_COHORTS,
  DEMO_TTFD,
  DEMO_PARTNER_PNL,
  DEMO_MEDICARE_ADVANTAGE,
  DEMO_ELIGIBILITY_QUEUE,
  DEMO_REVENUE_LINES,
  DEMO_LTV,
  DEMO_DISTRESS_OVERLAY,
  isDemoOpsFallbackEnabled,
} from "./demo-ops-data";

const MISSING_RELATION_MARKERS = [
  "does not exist",
  "relation",
  "Could not find the table",
];

function isMissingRelationError(err: { message?: string } | null | undefined): boolean {
  if (!err?.message) return false;
  return MISSING_RELATION_MARKERS.some((m) => err.message!.toLowerCase().includes(m.toLowerCase()));
}

// Service-role client is required for cross-user aggregates. If the env var
// is missing locally, the page should render unavailable empty states rather
// than 500. This wraps createServiceClient so each fetcher can short-circuit
// instead of throwing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeServiceClient(): any | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

// ── Panel 1: EBT Balance Aggregate ──────────────────────────────────────────

export interface EbtAggregateData {
  available: boolean;
  total_balance_cents: number;
  active_tracker_count: number;
  total_card_count: number;
  latest_balance_at: string | null;
}

const EBT_UNAVAILABLE: EbtAggregateData = {
  available: false, total_balance_cents: 0, active_tracker_count: 0, total_card_count: 0, latest_balance_at: null,
};

export async function fetchEbtAggregate(): Promise<EbtAggregateData> {
  if (isDemoOpsFallbackEnabled()) return DEMO_EBT_AGGREGATE;
  const db = safeServiceClient();
  if (!db) return EBT_UNAVAILABLE;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("ebt_card_aggregates_v" as any) as any)
    .select("total_balance_cents, active_tracker_count, total_card_count, latest_balance_at")
    .maybeSingle();

  if (isMissingRelationError(error)) return EBT_UNAVAILABLE;
  return {
    available: true,
    total_balance_cents: data?.total_balance_cents ?? 0,
    active_tracker_count: data?.active_tracker_count ?? 0,
    total_card_count: data?.total_card_count ?? 0,
    latest_balance_at: data?.latest_balance_at ?? null,
  };
}

// ── Panel 2: Placement Map ──────────────────────────────────────────────────

export interface PlacementsData {
  available: boolean;
  placements: Array<{
    county_fips: string;
    placement_count: number;
    expected_revenue_cents: number;
    categories: string[];
  }>;
  total_active_offers: number;
}

const PLACEMENTS_UNAVAILABLE: PlacementsData = { available: false, placements: [], total_active_offers: 0 };

export async function fetchPlacements(): Promise<PlacementsData> {
  if (isDemoOpsFallbackEnabled()) return DEMO_PLACEMENTS;
  const db = safeServiceClient();
  if (!db) return PLACEMENTS_UNAVAILABLE;
  const nowIso = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("partner_offers" as any) as any)
    .select("offer_id, category, county_fips_list, expected_revenue_cents")
    .eq("active", true)
    .or(`start_at.is.null,start_at.lte.${nowIso}`)
    .or(`end_at.is.null,end_at.gt.${nowIso}`);

  if (isMissingRelationError(error)) return PLACEMENTS_UNAVAILABLE;

  const offers = (data ?? []) as Array<{ offer_id: string; category: string; county_fips_list: string[]; expected_revenue_cents: number }>;

  const byCounty = new Map<string, { count: number; revenue: number; categories: Set<string> }>();
  for (const o of offers) {
    const counties = o.county_fips_list.length > 0 ? o.county_fips_list : ["STATEWIDE"];
    for (const fips of counties) {
      const existing = byCounty.get(fips) ?? { count: 0, revenue: 0, categories: new Set<string>() };
      existing.count += 1;
      existing.revenue += o.expected_revenue_cents;
      existing.categories.add(o.category);
      byCounty.set(fips, existing);
    }
  }

  const placements = [...byCounty.entries()]
    .map(([county_fips, v]) => ({
      county_fips,
      placement_count: v.count,
      expected_revenue_cents: v.revenue,
      categories: [...v.categories].sort(),
    }))
    .sort((a, b) => b.placement_count - a.placement_count);

  return { available: true, placements, total_active_offers: offers.length };
}

// ── Panel 3: Notification Outlay ────────────────────────────────────────────

export interface NotificationOutlayData {
  available: boolean;
  cells: Array<{ channel: string; category: string; count: number; cost_cents: number }>;
  total_count: number;
  total_cost_cents: number;
}

const NOTIF_UNAVAILABLE: NotificationOutlayData = { available: false, cells: [], total_count: 0, total_cost_cents: 0 };

export async function fetchNotificationOutlay(days = 30): Promise<NotificationOutlayData> {
  if (isDemoOpsFallbackEnabled()) return DEMO_NOTIFICATION_OUTLAY;
  const db = safeServiceClient();
  if (!db) return NOTIF_UNAVAILABLE;
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("notification_outlay_events" as any) as any)
    .select("channel, category, cost_cents")
    .gte("sent_at", sinceIso);

  if (isMissingRelationError(error)) return NOTIF_UNAVAILABLE;

  const rows = (data ?? []) as Array<{ channel: string; category: string; cost_cents: number }>;
  const matrix = new Map<string, Map<string, { count: number; cost_cents: number }>>();
  let totalCount = 0;
  let totalCostCents = 0;
  for (const r of rows) {
    if (!matrix.has(r.channel)) matrix.set(r.channel, new Map());
    const channelMap = matrix.get(r.channel)!;
    const cell = channelMap.get(r.category) ?? { count: 0, cost_cents: 0 };
    cell.count += 1;
    cell.cost_cents += r.cost_cents;
    channelMap.set(r.category, cell);
    totalCount += 1;
    totalCostCents += r.cost_cents;
  }
  const cells: Array<{ channel: string; category: string; count: number; cost_cents: number }> = [];
  for (const [channel, byCat] of matrix) {
    for (const [category, v] of byCat) {
      cells.push({ channel, category, count: v.count, cost_cents: v.cost_cents });
    }
  }
  return { available: true, cells, total_count: totalCount, total_cost_cents: totalCostCents };
}

// ── Panel 4: Cohort Retention ───────────────────────────────────────────────

export interface CohortData {
  available: boolean;
  cohorts: Array<{ enrollment_month: string; packet_count: number; currently_active: number; active_pct: number }>;
}

const COHORTS_UNAVAILABLE: CohortData = { available: false, cohorts: [] };

export async function fetchCohorts(months = 6): Promise<CohortData> {
  if (isDemoOpsFallbackEnabled()) return DEMO_COHORTS;
  const db = safeServiceClient();
  if (!db) return COHORTS_UNAVAILABLE;
  const sinceIso = new Date(Date.now() - months * 31 * 86_400_000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packets, error: pErr } = await (db.schema("snap_enrollment").from("snap_packets" as any) as any)
    .select("packet_id, submitted_at, applicant_id")
    .gte("submitted_at", sinceIso)
    .is("deleted_at", null)
    .not("submitted_at", "is", null);
  if (isMissingRelationError(pErr)) return COHORTS_UNAVAILABLE;

  const packetRows = (packets ?? []) as Array<{ packet_id: string; submitted_at: string; applicant_id: string }>;
  if (packetRows.length === 0) return { available: true, cohorts: [] };

  const applicantIds = [...new Set(packetRows.map((p) => p.applicant_id))];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: applicants } = await (db.schema("snap_enrollment").from("applicants" as any) as any)
    .select("applicant_id, auth_uid")
    .in("applicant_id", applicantIds);

  const authUidByApplicant = new Map<string, string>();
  for (const a of (applicants ?? []) as Array<{ applicant_id: string; auth_uid: string | null }>) {
    if (a.auth_uid) authUidByApplicant.set(a.applicant_id, a.auth_uid);
  }

  const authUids = [...authUidByApplicant.values()];
  const activeUsers = new Set<string>();
  if (authUids.length > 0) {
    const cutoffIso = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const nowIso = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cards, error: cErr } = await (db.schema("snap_enrollment").from("ebt_cards" as any) as any)
      .select("user_id, last_synced_at, session_cookie_expires_at")
      .in("user_id", authUids)
      .gte("last_synced_at", cutoffIso)
      .gt("session_cookie_expires_at", nowIso);
    if (!isMissingRelationError(cErr)) {
      for (const card of (cards ?? []) as Array<{ user_id: string }>) {
        activeUsers.add(card.user_id);
      }
    }
  }

  const cohortMap = new Map<string, { packet_count: number; currently_active: number }>();
  for (const p of packetRows) {
    const bucket = p.submitted_at.slice(0, 7);
    const existing = cohortMap.get(bucket) ?? { packet_count: 0, currently_active: 0 };
    existing.packet_count += 1;
    const authUid = authUidByApplicant.get(p.applicant_id);
    if (authUid && activeUsers.has(authUid)) existing.currently_active += 1;
    cohortMap.set(bucket, existing);
  }

  const cohorts = [...cohortMap.entries()]
    .map(([enrollment_month, v]) => ({
      enrollment_month,
      packet_count: v.packet_count,
      currently_active: v.currently_active,
      active_pct: v.packet_count > 0 ? Math.round((v.currently_active / v.packet_count) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.enrollment_month.localeCompare(b.enrollment_month));

  return { available: true, cohorts };
}

// ── Panel 5: Time-to-First-Deposit ──────────────────────────────────────────

export interface TTFDData {
  available: boolean;
  median_days: number | null;
  n: number;
  county_trend: Array<{ county_fips: string; n: number; median_days: number | null }>;
}

const TTFD_UNAVAILABLE: TTFDData = { available: false, median_days: null, n: 0, county_trend: [] };

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const lo = sorted[mid - 1];
    const hi = sorted[mid];
    if (lo === undefined || hi === undefined) return null;
    return (lo + hi) / 2;
  }
  return sorted[mid] ?? null;
}

export async function fetchTTFD(): Promise<TTFDData> {
  if (isDemoOpsFallbackEnabled()) return DEMO_TTFD;
  const db = safeServiceClient();
  if (!db) return TTFD_UNAVAILABLE;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packets, error: pErr } = await (db.schema("snap_enrollment").from("snap_packets" as any) as any)
    .select("packet_id, submitted_at, applicant_id, county_fips")
    .is("deleted_at", null)
    .not("submitted_at", "is", null);
  if (isMissingRelationError(pErr)) return TTFD_UNAVAILABLE;

  const packetRows = (packets ?? []) as Array<{ packet_id: string; submitted_at: string; applicant_id: string; county_fips: string | null }>;
  if (packetRows.length === 0) return { available: true, median_days: null, n: 0, county_trend: [] };

  const applicantIds = [...new Set(packetRows.map((p) => p.applicant_id))];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: applicants } = await (db.schema("snap_enrollment").from("applicants" as any) as any)
    .select("applicant_id, auth_uid")
    .in("applicant_id", applicantIds);
  const authUidByApplicant = new Map<string, string>();
  for (const a of (applicants ?? []) as Array<{ applicant_id: string; auth_uid: string | null }>) {
    if (a.auth_uid) authUidByApplicant.set(a.applicant_id, a.auth_uid);
  }

  const authUids = [...new Set([...authUidByApplicant.values()])];
  const cardIdsByUser = new Map<string, string[]>();
  if (authUids.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cards, error: cErr } = await (db.schema("snap_enrollment").from("ebt_cards" as any) as any)
      .select("id, user_id")
      .in("user_id", authUids);
    if (!isMissingRelationError(cErr)) {
      for (const card of (cards ?? []) as Array<{ id: string; user_id: string }>) {
        const arr = cardIdsByUser.get(card.user_id) ?? [];
        arr.push(card.id);
        cardIdsByUser.set(card.user_id, arr);
      }
    }
  }

  const allCardIds = [...cardIdsByUser.values()].flat();
  const firstDepositByCard = new Map<string, string>();
  if (allCardIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deposits, error: dErr } = await (db.schema("snap_enrollment").from("ebt_deposits" as any) as any)
      .select("card_id, posted_at")
      .in("card_id", allCardIds)
      .not("posted_at", "is", null);
    if (!isMissingRelationError(dErr)) {
      for (const d of (deposits ?? []) as Array<{ card_id: string; posted_at: string }>) {
        const existing = firstDepositByCard.get(d.card_id);
        if (!existing || d.posted_at < existing) firstDepositByCard.set(d.card_id, d.posted_at);
      }
    }
  }

  const allDays: number[] = [];
  const byCounty = new Map<string, number[]>();
  for (const p of packetRows) {
    const authUid = authUidByApplicant.get(p.applicant_id);
    if (!authUid) continue;
    const cardIds = cardIdsByUser.get(authUid) ?? [];
    let firstAt: string | null = null;
    for (const cid of cardIds) {
      const dep = firstDepositByCard.get(cid);
      if (dep && (!firstAt || dep < firstAt)) firstAt = dep;
    }
    if (!firstAt) continue;
    const days = (new Date(firstAt).getTime() - new Date(p.submitted_at).getTime()) / 86_400_000;
    if (days < 0) continue;
    allDays.push(days);
    const county = p.county_fips ?? "00000";
    const list = byCounty.get(county) ?? [];
    list.push(days);
    byCounty.set(county, list);
  }

  const county_trend = [...byCounty.entries()]
    .map(([county_fips, days]) => ({ county_fips, n: days.length, median_days: median(days) }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);

  return { available: true, median_days: median(allDays), n: allDays.length, county_trend };
}

// ── Panel 6: Partner-Offer P&L ──────────────────────────────────────────────

export interface PartnerPnLData {
  available: boolean;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue_cents: number;
  saved_cents: number;
  revenue_per_active_tracker_cents: number;
  redistribution_pct: number;
  active_trackers: number;
}

function pnlUnavailable(activeTrackers: number): PartnerPnLData {
  return {
    available: false, impressions: 0, clicks: 0, conversions: 0,
    revenue_cents: 0, saved_cents: 0,
    revenue_per_active_tracker_cents: 0, redistribution_pct: 0,
    active_trackers: activeTrackers,
  };
}

export async function fetchPartnerPnL(days = 30): Promise<PartnerPnLData> {
  if (isDemoOpsFallbackEnabled()) return DEMO_PARTNER_PNL;
  // PnL's denominator (revenue_per_active_tracker_cents) depends on the
  // active_tracker_count from EBT. Per /plan-eng-review D2 we fetch our own
  // EBT aggregate here rather than threading it through callers — the cost
  // (~5ms duplicate query) buys full per-panel decoupling so the /ops page
  // can stream each panel independently in Suspense boundaries.
  const ebt = await fetchEbtAggregate();
  const activeTrackers = ebt.active_tracker_count;
  const db = safeServiceClient();
  if (!db) return pnlUnavailable(activeTrackers);
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events, error: eErr } = await (db.schema("snap_enrollment").from("partner_offer_events_aggregate" as any) as any)
    .select("offer_id, event_type, revenue_cents")
    .gte("occurred_at", sinceIso);

  if (isMissingRelationError(eErr)) return pnlUnavailable(activeTrackers);

  const eventRows = (events ?? []) as Array<{ offer_id: string; event_type: string; revenue_cents: number }>;
  const offerIds = [...new Set(eventRows.map((e) => e.offer_id))];
  const savingsByOffer = new Map<string, number>();
  if (offerIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: offers } = await (db.schema("snap_enrollment").from("partner_offers" as any) as any)
      .select("offer_id, expected_savings_cents")
      .in("offer_id", offerIds);
    for (const o of (offers ?? []) as Array<{ offer_id: string; expected_savings_cents: number }>) {
      savingsByOffer.set(o.offer_id, o.expected_savings_cents);
    }
  }

  let impressions = 0, clicks = 0, conversions = 0;
  let revenue_cents = 0, saved_cents = 0;
  for (const ev of eventRows) {
    if (ev.event_type === "impression") {
      impressions += 1;
      saved_cents += savingsByOffer.get(ev.offer_id) ?? 0;
    } else if (ev.event_type === "click") clicks += 1;
    else conversions += 1;
    revenue_cents += ev.revenue_cents;
  }

  const revenue_per_active_tracker_cents = activeTrackers > 0
    ? Math.round(revenue_cents / activeTrackers)
    : 0;
  const redistribution_pct = (revenue_cents + saved_cents) > 0
    ? Math.round((saved_cents / (revenue_cents + saved_cents)) * 1000) / 10
    : 0;

  return {
    available: true, impressions, clicks, conversions,
    revenue_cents, saved_cents,
    revenue_per_active_tracker_cents, redistribution_pct,
    active_trackers: activeTrackers,
  };
}

// ── Panel 8: Medicare Advantage Referrals ───────────────────────────────────

export interface MedicareAdvantageData {
  available: boolean;
  // Cohort sizing
  active_trackers: number;
  eligible_seniors: number;            // 60+ HHs in tracker population
  // Political-defense surface: Medi-Cal-first routing
  medi_cal_routed_count: number;       // routed to Medi-Cal (zero Civica fee)
  // Funnel (non-Medi-Cal cohort)
  eligible_non_medi_cal: number;
  referred_to_partners: number;
  enrolled: number;
  // Revenue
  revenue_cents: number;
  avg_fee_per_enrollment_cents: number;
  // CMS marketing-rule compliance (Title 42 CFR §422.2274)
  cms_compliant: boolean;
  last_cms_audit_at: string;
  disclosure_version: string;
}

const MEDICARE_ADVANTAGE_UNAVAILABLE: MedicareAdvantageData = {
  available: false,
  active_trackers: 0,
  eligible_seniors: 0,
  medi_cal_routed_count: 0,
  eligible_non_medi_cal: 0,
  referred_to_partners: 0,
  enrolled: 0,
  revenue_cents: 0,
  avg_fee_per_enrollment_cents: 0,
  cms_compliant: false,
  last_cms_audit_at: new Date(0).toISOString(),
  disclosure_version: "—",
};

export async function fetchMedicareAdvantage(): Promise<MedicareAdvantageData> {
  if (isDemoOpsFallbackEnabled()) return DEMO_MEDICARE_ADVANTAGE;
  // No real DB query yet — the medicare_advantage_referrals aggregate view
  // ships in a later migration. Return the unavailable shape so the panel
  // renders the "apply migrations" empty state.
  return MEDICARE_ADVANTAGE_UNAVAILABLE;
}

// ── Panel 9: Eligibility Queue (Opportunity queue) ──────────────────────────

export interface EligibilityQueueData {
  available: boolean;
  rows: Array<{
    program_id: string;
    program_name: string;
    eligible: number;
    contacted: number;
    in_queue: number;
    conv_pct: number;                 // 0..100, expected conversion rate of queued HHs
    dollars_per_conversion_cents: number; // average revenue per converted HH (0 if non-monetized)
    projected_revenue_cents: number;  // in_queue × conv_pct/100 × dollars_per_conversion_cents
    monetized: boolean;               // false = referral-only / no Civica fee
    suggested_action: string;         // visual chip label (e.g. "Run outreach")
  }>;
}

const ELIGIBILITY_QUEUE_UNAVAILABLE: EligibilityQueueData = {
  available: false,
  rows: [],
};

export async function fetchEligibilityQueue(): Promise<EligibilityQueueData> {
  if (isDemoOpsFallbackEnabled()) return DEMO_ELIGIBILITY_QUEUE;
  // No real DB query yet — the program_eligibility_v view + referral_events
  // table ship in a later migration. Return the unavailable shape so the
  // panel renders the "apply migrations" empty state.
  return ELIGIBILITY_QUEUE_UNAVAILABLE;
}

// ── Panel 10: Revenue Lines Rollup ──────────────────────────────────────────

export type RevenueLineStatus = "live" | "gated" | "planned" | "no_fee" | "cost";

export interface RevenueLine {
  key: string;
  label: string;
  status: RevenueLineStatus;
  gross_cents: number;     // positive for revenue, positive magnitude for cost (status="cost")
  share_pct: number | null; // share of revenue mix (null = N/A / planned / no_fee / cost)
  note?: string;
}

export interface RevenueLinesData {
  available: boolean;
  lines: RevenueLine[];
  net_cents: number;        // revenue minus outlay (cents)
  wow_delta_pct: number;    // week-over-week delta on net, e.g. +4.8
}

const REVENUE_LINES_UNAVAILABLE: RevenueLinesData = {
  available: false,
  lines: [],
  net_cents: 0,
  wow_delta_pct: 0,
};

export async function fetchRevenueLines(): Promise<RevenueLinesData> {
  if (isDemoOpsFallbackEnabled()) return DEMO_REVENUE_LINES;
  // No real DB query yet — this view rolls up MA referrals + partner-offer
  // events + notification outlay. Returns unavailable until those underlying
  // aggregates land in production.
  return REVENUE_LINES_UNAVAILABLE;
}

// ── Panel 11: LTV per active tracker ─────────────────────────────────────────

export interface LTVRevenueLine {
  key: string;
  label: string;
  dollars_per_tracker_year: number;
  share_pct: number;
}

export interface LTVData {
  available: boolean;
  headline_dollars_per_tracker_year: number;
  trajectory_mom_pct: number;
  active_trackers: number;
  live_lines: LTVRevenueLine[];
  projected_lines: LTVRevenueLine[];
}

const LTV_UNAVAILABLE: LTVData = {
  available: false,
  headline_dollars_per_tracker_year: 0,
  trajectory_mom_pct: 0,
  active_trackers: 0,
  live_lines: [],
  projected_lines: [],
};

export async function fetchLTV(): Promise<LTVData> {
  if (isDemoOpsFallbackEnabled()) return DEMO_LTV;
  // No real rollup view yet — LTV is composed downstream from MA referrals
  // + partner-offer P&L + (future) WOTC + tax-prep revenue lines. Returns
  // unavailable until those component aggregates have a unifying view.
  return LTV_UNAVAILABLE;
}

// ── Panel 12: Distress-Flag Honor Commitment ────────────────────────────────

export interface DistressOverlayData {
  available: boolean;
  total_active_flags: number;
  flag_window_days: number;
  withheld_by_line: Array<{
    line_key: string;
    line_label: string;
    withheld_count: number | null; // null = placeholder / line not yet live
    unit: string;                  // "impressions" | "referrals" | "—"
  }>;
  recent_events: Array<{
    ts: string;
    flag_type: string;             // "denial_appeal_opened" | "obbba_distress_prompt" | "recert_lapse_14d" | ...
    county_fips: string;           // D13: county only — never user_id / name
  }>;
}

const DISTRESS_OVERLAY_UNAVAILABLE: DistressOverlayData = {
  available: false,
  total_active_flags: 0,
  flag_window_days: 30,
  withheld_by_line: [],
  recent_events: [],
};

export async function fetchDistressOverlay(): Promise<DistressOverlayData> {
  if (isDemoOpsFallbackEnabled()) return DEMO_DISTRESS_OVERLAY;
  // No real DB query yet — the distress_flag_events table + withhold rollup
  // view ship in a later migration. Until then, return the unavailable shape
  // so the panel renders the "apply migrations" empty state instead of 500.
  return DISTRESS_OVERLAY_UNAVAILABLE;
}
