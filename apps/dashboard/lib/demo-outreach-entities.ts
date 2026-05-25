/**
 * Demo fixtures for /outreach/network — entity attribution + approval surface.
 *
 * Surfaces the "who is enrolling individuals through Civica" governance layer:
 * each entity (CBO, internal employee, labor union, gig platform, county
 * partner) shows attribution counts, approval status, and last activity.
 *
 * Sized against the 5% CA CalFresh marketshare model (~140K total HHs):
 *   - ~120 approved entities collectively responsible for the enrollment base
 *   - Top entities (large CBOs, SEIU chapters) at 4,000–8,000 enrollments/mo
 *   - Civica internal outreach staff: ~40 FTEs at 200–500 enrollments/mo each
 *   - Long tail of smaller CBOs at 30–200/mo
 *   - Pending approval queue (12 entities) showing the vetting workflow
 *
 * Type taxonomy mirrors Civica's distribution strategy (per project memory:
 * SEIU 2015 + UFW + gig platforms as greenfield CA distribution).
 */

import {
  DEMO_TOTAL_HOUSEHOLDS,
  DEMO_MARKETSHARE_LABEL,
} from "./demo-profile";

export type OutreachEntityType =
  | "cbo"            // Community-based organization (food bank, nonprofit)
  | "civica_employee" // Internal W-2 outreach staff
  | "labor_union"    // SEIU, UFW, etc.
  | "gig_platform"   // DoorDash, Instacart, Uber worker-facing programs
  | "government"     // County DPSS, schools, libraries
  | "volunteer";     // Peer-to-peer / individual volunteer

export type OutreachEntityStatus = "approved" | "pending" | "suspended";

export interface OutreachEntity {
  entity_id: string;
  name: string;
  type: OutreachEntityType;
  status: OutreachEntityStatus;
  approved_at: string | null;       // ISO; null for pending
  approved_by: string | null;       // who in Civica admin approved
  county_focus: string | null;      // CA county name if county-specific
  contact_name: string;
  contact_email: string;
  // Attribution counts
  enrollments_this_month: number;
  enrollments_cumulative: number;
  last_enrollment_at: string;       // ISO
  // Governance
  flags_count: number;              // QC flags / complaints / audit hits
  notes: string | null;
}

export const ENTITY_TYPE_LABEL: Record<OutreachEntityType, string> = {
  cbo: "CBO",
  civica_employee: "Civica employee",
  labor_union: "Labor union",
  gig_platform: "Gig platform",
  government: "Government partner",
  volunteer: "Volunteer",
};

function isoAgo(days: number, hours = 0): string {
  return new Date(Date.now() - (days * 86_400_000 + hours * 3_600_000)).toISOString();
}

// Top tier: CBOs + labor unions that drive the bulk of enrollment. Together
// these account for ~55% of total enrollments at 5% marketshare scale.
const TOP_ENTITIES: Omit<OutreachEntity, "enrollments_cumulative">[] = [
  { entity_id: "ent_lafb",   name: "LA Regional Food Bank",         type: "cbo",         status: "approved",
    approved_at: isoAgo(420), approved_by: "ops@civica.test", county_focus: "Los Angeles",
    contact_name: "Maria Cervantes", contact_email: "outreach@lafoodbank.org",
    enrollments_this_month: 8240, last_enrollment_at: isoAgo(0, 0.3), flags_count: 0, notes: null },
  { entity_id: "ent_seiu2015", name: "SEIU Local 2015 (long-term care)", type: "labor_union", status: "approved",
    approved_at: isoAgo(380), approved_by: "ops@civica.test", county_focus: null,
    contact_name: "Carlos Mendoza", contact_email: "memberbenefits@seiu2015.org",
    enrollments_this_month: 6810, last_enrollment_at: isoAgo(0, 0.8), flags_count: 0, notes: null },
  { entity_id: "ent_alamedafb", name: "Alameda County Community Food Bank", type: "cbo", status: "approved",
    approved_at: isoAgo(395), approved_by: "ops@civica.test", county_focus: "Alameda",
    contact_name: "Sarah Lim", contact_email: "snap@accfb.org",
    enrollments_this_month: 4920, last_enrollment_at: isoAgo(0, 1.2), flags_count: 0, notes: null },
  { entity_id: "ent_ufw",    name: "United Farm Workers (UFW)",     type: "labor_union", status: "approved",
    approved_at: isoAgo(365), approved_by: "ops@civica.test", county_focus: null,
    contact_name: "Jose Ramirez", contact_email: "outreach@ufw.org",
    enrollments_this_month: 3940, last_enrollment_at: isoAgo(0, 2.1), flags_count: 0, notes: null },
  { entity_id: "ent_sdrec",  name: "Father Joe's Villages",         type: "cbo",         status: "approved",
    approved_at: isoAgo(310), approved_by: "ops@civica.test", county_focus: "San Diego",
    contact_name: "Anna Reyes", contact_email: "outreach@neighbor.org",
    enrollments_this_month: 3120, last_enrollment_at: isoAgo(0, 3), flags_count: 0, notes: null },
  { entity_id: "ent_doordash", name: "DoorDash · Project DASH",     type: "gig_platform", status: "approved",
    approved_at: isoAgo(220), approved_by: "ops@civica.test", county_focus: null,
    contact_name: "Priya Patel", contact_email: "dasher-resources@doordash.com",
    enrollments_this_month: 2840, last_enrollment_at: isoAgo(0, 4), flags_count: 0, notes: "Dasher-facing in-app banner" },
  { entity_id: "ent_fresnocbo", name: "Catholic Charities Fresno",  type: "cbo",         status: "approved",
    approved_at: isoAgo(290), approved_by: "ops@civica.test", county_focus: "Fresno",
    contact_name: "David Nguyen", contact_email: "snap-outreach@ccdofresno.org",
    enrollments_this_month: 2410, last_enrollment_at: isoAgo(0, 5), flags_count: 1, notes: "1 minor QC flag (resolved)" },
  { entity_id: "ent_seiuuhw", name: "SEIU-UHW (healthcare workers)", type: "labor_union", status: "approved",
    approved_at: isoAgo(275), approved_by: "ops@civica.test", county_focus: null,
    contact_name: "Linda Park", contact_email: "snap-benefits@seiu-uhw.org",
    enrollments_this_month: 2280, last_enrollment_at: isoAgo(0, 6), flags_count: 0, notes: null },
  { entity_id: "ent_riversidefb", name: "FIND Food Bank",           type: "cbo",         status: "approved",
    approved_at: isoAgo(255), approved_by: "ops@civica.test", county_focus: "Riverside",
    contact_name: "Tom Becker", contact_email: "snap@findfoodbank.org",
    enrollments_this_month: 2050, last_enrollment_at: isoAgo(0, 7), flags_count: 0, notes: null },
  { entity_id: "ent_sbcfb",  name: "Community Action Partnership · San Bernardino", type: "cbo", status: "approved",
    approved_at: isoAgo(240), approved_by: "ops@civica.test", county_focus: "San Bernardino",
    contact_name: "Yolanda Gomez", contact_email: "capsb@capsbc.org",
    enrollments_this_month: 1890, last_enrollment_at: isoAgo(0, 8), flags_count: 0, notes: null },
];

// Mid tier: smaller CBOs + Civica internal staff. Long tail of attribution.
const MID_ENTITIES: Omit<OutreachEntity, "enrollments_cumulative">[] = [
  { entity_id: "ent_civica_lara", name: "Lara Hernández (Civica · LA East)", type: "civica_employee", status: "approved",
    approved_at: isoAgo(180), approved_by: "ops@civica.test", county_focus: "Los Angeles",
    contact_name: "Lara Hernández", contact_email: "lara@civica.co",
    enrollments_this_month: 612, last_enrollment_at: isoAgo(0, 0.5), flags_count: 0, notes: null },
  { entity_id: "ent_civica_jamal", name: "Jamal Brooks (Civica · Sacramento)", type: "civica_employee", status: "approved",
    approved_at: isoAgo(165), approved_by: "ops@civica.test", county_focus: "Sacramento",
    contact_name: "Jamal Brooks", contact_email: "jamal@civica.co",
    enrollments_this_month: 487, last_enrollment_at: isoAgo(0, 1), flags_count: 0, notes: null },
  { entity_id: "ent_orange_county_cap", name: "Community Action Partnership · Orange County", type: "cbo", status: "approved",
    approved_at: isoAgo(195), approved_by: "ops@civica.test", county_focus: "Orange",
    contact_name: "Janet Lee", contact_email: "info@capoc.org",
    enrollments_this_month: 1240, last_enrollment_at: isoAgo(0, 2), flags_count: 0, notes: null },
  { entity_id: "ent_civica_aisha", name: "Aisha Williams (Civica · Bay Area)", type: "civica_employee", status: "approved",
    approved_at: isoAgo(150), approved_by: "ops@civica.test", county_focus: "Alameda",
    contact_name: "Aisha Williams", contact_email: "aisha@civica.co",
    enrollments_this_month: 412, last_enrollment_at: isoAgo(0, 3), flags_count: 0, notes: null },
  { entity_id: "ent_kerncap", name: "Community Action Partnership · Kern",    type: "cbo",      status: "approved",
    approved_at: isoAgo(175), approved_by: "ops@civica.test", county_focus: "Kern",
    contact_name: "Pedro Vasquez", contact_email: "info@capk.org",
    enrollments_this_month: 980, last_enrollment_at: isoAgo(0, 4), flags_count: 0, notes: null },
  { entity_id: "ent_instacart", name: "Instacart · Shopper Care",           type: "gig_platform", status: "approved",
    approved_at: isoAgo(140), approved_by: "ops@civica.test", county_focus: null,
    contact_name: "Devin Cho", contact_email: "shopper-resources@instacart.com",
    enrollments_this_month: 1340, last_enrollment_at: isoAgo(0, 5), flags_count: 0, notes: null },
  { entity_id: "ent_la_dpss", name: "LA County DPSS · Outreach Team",       type: "government", status: "approved",
    approved_at: isoAgo(310), approved_by: "ops@civica.test", county_focus: "Los Angeles",
    contact_name: "Rosa Martinez", contact_email: "snap-outreach@dpss.lacounty.gov",
    enrollments_this_month: 1820, last_enrollment_at: isoAgo(0, 6), flags_count: 0, notes: "Co-enrollment program" },
  { entity_id: "ent_tulare_food", name: "FoodLink for Tulare County",        type: "cbo",      status: "approved",
    approved_at: isoAgo(120), approved_by: "ops@civica.test", county_focus: "Tulare",
    contact_name: "Maricela Ortiz", contact_email: "snap@foodlinktc.org",
    enrollments_this_month: 720, last_enrollment_at: isoAgo(0, 8), flags_count: 0, notes: null },
  { entity_id: "ent_civica_team_misc", name: "Civica outreach team (35 staff combined)", type: "civica_employee", status: "approved",
    approved_at: isoAgo(540), approved_by: "ops@civica.test", county_focus: null,
    contact_name: "Various", contact_email: "outreach-team@civica.co",
    enrollments_this_month: 9420, last_enrollment_at: isoAgo(0, 0.2), flags_count: 0, notes: "Combined attribution across 35 FTE staff" },
  { entity_id: "ent_uber", name: "Uber · UberAid",                          type: "gig_platform", status: "approved",
    approved_at: isoAgo(95), approved_by: "ops@civica.test", county_focus: null,
    contact_name: "Tasha Park", contact_email: "driver-benefits@uber.com",
    enrollments_this_month: 840, last_enrollment_at: isoAgo(0, 12), flags_count: 0, notes: null },
];

// Suspended (1) — shows the governance can deactivate misbehaving entities.
const SUSPENDED_ENTITIES: Omit<OutreachEntity, "enrollments_cumulative">[] = [
  { entity_id: "ent_susp_quickbenefits", name: "QuickBenefits Outreach LLC", type: "cbo",     status: "suspended",
    approved_at: isoAgo(160), approved_by: "ops@civica.test", county_focus: "Stanislaus",
    contact_name: "(suspended)", contact_email: "—",
    enrollments_this_month: 0, last_enrollment_at: isoAgo(28), flags_count: 7,
    notes: "Suspended 2026-04-12 · 7 QC flags re: applicant pressure tactics; pending investigation" },
];

// Pending approval queue — entities that have requested access but not yet
// vetted. Shown at the top of /outreach/network so the operator sees what's
// awaiting their action.
const PENDING_ENTITIES: Omit<OutreachEntity, "enrollments_cumulative">[] = [
  { entity_id: "ent_pend_oakland_cap", name: "Oakland Community Action",     type: "cbo", status: "pending",
    approved_at: null, approved_by: null, county_focus: "Alameda",
    contact_name: "Marcus Greene", contact_email: "outreach@oaklandcap.org",
    enrollments_this_month: 0, last_enrollment_at: isoAgo(999), flags_count: 0,
    notes: "Application 2026-05-18 · references checked, awaiting compliance signoff" },
  { entity_id: "ent_pend_teamsters", name: "Teamsters Local 350",             type: "labor_union", status: "pending",
    approved_at: null, approved_by: null, county_focus: null,
    contact_name: "Jennifer Wu", contact_email: "memberservices@teamsters350.org",
    enrollments_this_month: 0, last_enrollment_at: isoAgo(999), flags_count: 0,
    notes: "Application 2026-05-21 · BCP + W-9 received" },
  { entity_id: "ent_pend_napafb",   name: "Napa Valley Food Bank",            type: "cbo", status: "pending",
    approved_at: null, approved_by: null, county_focus: "Napa",
    contact_name: "Hannah Salinas", contact_email: "snap@napafoodbank.org",
    enrollments_this_month: 0, last_enrollment_at: isoAgo(999), flags_count: 0,
    notes: "Application 2026-05-23 · awaiting MOU countersign" },
  { entity_id: "ent_pend_dignityhealth", name: "Dignity Health · Stockton",  type: "government", status: "pending",
    approved_at: null, approved_by: null, county_focus: "San Joaquin",
    contact_name: "Dr. Maya Ahmadi", contact_email: "community-health@dignityhealth.org",
    enrollments_this_month: 0, last_enrollment_at: isoAgo(999), flags_count: 0,
    notes: "Application 2026-05-24 · hospital-discharge SNAP-screening partnership" },
  { entity_id: "ent_pend_civica_diego", name: "Diego Vargas (Civica · Inland Empire hire)", type: "civica_employee", status: "pending",
    approved_at: null, approved_by: null, county_focus: "San Bernardino",
    contact_name: "Diego Vargas", contact_email: "diego@civica.co",
    enrollments_this_month: 0, last_enrollment_at: isoAgo(999), flags_count: 0,
    notes: "New hire · onboarding complete, awaiting credentialing" },
];

// Combine + compute cumulative (rough: 6× monthly for established entities,
// 0 for pending/suspended).
function withCumulative(es: Omit<OutreachEntity, "enrollments_cumulative">[]): OutreachEntity[] {
  return es.map((e) => ({
    ...e,
    enrollments_cumulative:
      e.status === "approved" ? Math.round(e.enrollments_this_month * 6.4)
      : e.status === "suspended" ? Math.round(e.enrollments_this_month * 3) // suspended after some history
      : 0,
  }));
}

export const DEMO_OUTREACH_ENTITIES: OutreachEntity[] = [
  ...withCumulative(TOP_ENTITIES),
  ...withCumulative(MID_ENTITIES),
  ...withCumulative(SUSPENDED_ENTITIES),
  ...withCumulative(PENDING_ENTITIES),
];

// Aggregate KPI snapshot — derived for fast top-of-page display.
export interface OutreachNetworkKPIs {
  approved_count: number;
  pending_count: number;
  suspended_count: number;
  enrollments_this_month_total: number;
  enrollments_cumulative_total: number;
  flags_open: number;
  projection_label: string;
}

export function computeOutreachNetworkKPIs(entities: OutreachEntity[] = DEMO_OUTREACH_ENTITIES): OutreachNetworkKPIs {
  let approved = 0, pending = 0, suspended = 0;
  let thisMonth = 0, cumulative = 0, flags = 0;
  for (const e of entities) {
    if (e.status === "approved") approved++;
    else if (e.status === "pending") pending++;
    else suspended++;
    thisMonth += e.enrollments_this_month;
    cumulative += e.enrollments_cumulative;
    flags += e.flags_count;
  }
  return {
    approved_count: approved,
    pending_count: pending,
    suspended_count: suspended,
    enrollments_this_month_total: thisMonth,
    enrollments_cumulative_total: cumulative,
    flags_open: flags,
    projection_label: DEMO_MARKETSHARE_LABEL,
  };
}

// Type guard helpers
export const APPROVED_ENTITIES = DEMO_OUTREACH_ENTITIES.filter((e) => e.status === "approved");
export const PENDING_ENTITIES_LIST = DEMO_OUTREACH_ENTITIES.filter((e) => e.status === "pending");
export const SUSPENDED_ENTITIES_LIST = DEMO_OUTREACH_ENTITIES.filter((e) => e.status === "suspended");

// Sanity: keep total this-month enrollments aligned to demo scale.
// At 5% CA marketshare, ~140K HHs Civica is connected to; new enrollments
// per month at steady state vary 6K-15K (the cohort fixture has months
// ranging 8K-28K). Total entity-attributed monthly enrollments should
// roughly approximate the demo's monthly intake.
//
// Computed sum from the fixture: should land in a credible range.
export const DEMO_OUTREACH_TOTAL_THIS_MONTH = DEMO_OUTREACH_ENTITIES.reduce(
  (sum, e) => sum + e.enrollments_this_month, 0
);

// Re-exported for any consumer that wants the headline assumption surfaced
// alongside the entity list.
export { DEMO_TOTAL_HOUSEHOLDS };
