/**
 * Rich hardcoded fixtures for the navigator dashboard demo mode.
 *
 * Activated by setting DEMO_FALLBACK=true in .env.local. Each consuming
 * page checks isDemoFallbackEnabled() and merges the demo fixtures in
 * when its real DB query comes back empty (which it does locally because
 * of a pre-existing RLS recursion bug on `applicants`). In production
 * the env var is never set, so the fixtures are inert.
 *
 * Single source of truth: the same packets/applicants/risk rows feed
 * Dashboard home (funnel, language, activity), Queue, Enrollments,
 * Outreach, and the packet-detail demo IDs. Keep names + IDs consistent
 * across pages so a demo viewer can navigate from Queue → packet detail
 * without seeing "unknown applicant" jumps.
 */

export function isDemoFallbackEnabled(): boolean {
  return process.env.DEMO_FALLBACK === "true";
}

// Deterministic timestamps anchored relative to today so the demo
// renders coherent "x days ago" / countdown values without drifting.
function daysAgo(d: number): string {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}
function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}
function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}
function monthsAgo(m: number): string {
  return new Date(Date.now() - m * 30 * 24 * 60 * 60 * 1000).toISOString();
}

// Demo names are stored as snap_v1::DEMO:Name tokens so format.ts's
// decryptDemoName() roundtrips them to a human-readable string. Real
// production data uses Fernet ciphertext via the backend audit path.
function demoName(name: string): string {
  return `snap_v1::DEMO:${name}`;
}

// ─────────────────────────────────────────────────────────────────────
// Applicants
// ─────────────────────────────────────────────────────────────────────

export const DEMO_APPLICANTS = [
  { applicant_id: "app-001", full_name_ciphertext: demoName("Maria Gonzalez"), preferred_language: "es" },
  { applicant_id: "app-002", full_name_ciphertext: demoName("Carlos Ramirez"), preferred_language: "es" },
  { applicant_id: "app-003", full_name_ciphertext: demoName("Jasmine Thompson"), preferred_language: "en" },
  { applicant_id: "app-004", full_name_ciphertext: demoName("David Liu"), preferred_language: "zh" },
  { applicant_id: "app-005", full_name_ciphertext: demoName("Anh Nguyen"), preferred_language: "vi" },
  { applicant_id: "app-006", full_name_ciphertext: demoName("Robert Johnson"), preferred_language: "en" },
  { applicant_id: "app-007", full_name_ciphertext: demoName("Sofia Pena"), preferred_language: "es" },
  { applicant_id: "app-008", full_name_ciphertext: demoName("Kenji Mori"), preferred_language: "en" },
  { applicant_id: "app-009", full_name_ciphertext: demoName("Elena Vasquez"), preferred_language: "es" },
  { applicant_id: "app-010", full_name_ciphertext: demoName("Marcus Williams"), preferred_language: "en" },
  { applicant_id: "app-011", full_name_ciphertext: demoName("Priya Patel"), preferred_language: "en" },
  { applicant_id: "app-012", full_name_ciphertext: demoName("Tomas Mendez"), preferred_language: "es" },
  // Added 2026-05-25 to populate post-handoff lifecycle buckets on /enrollments
  // (interview at risk, interview pending, verification outstanding, expiring).
  { applicant_id: "app-013", full_name_ciphertext: demoName("Aisha Khan"), preferred_language: "en" },
  { applicant_id: "app-014", full_name_ciphertext: demoName("James Park"), preferred_language: "ko" },
  { applicant_id: "app-015", full_name_ciphertext: demoName("Lucia Rivera"), preferred_language: "es" },
  { applicant_id: "app-016", full_name_ciphertext: demoName("Daniel Foster"), preferred_language: "en" },
  // ── Scale cohort (2026-05-25) — 24 more enrolled households so /enrollments
  // reads as a CBO managing real caseload, not a 9-household pilot.
  { applicant_id: "app-017", full_name_ciphertext: demoName("Yusuf Rahman"),     preferred_language: "en" },
  { applicant_id: "app-018", full_name_ciphertext: demoName("Mei Chen"),         preferred_language: "zh" },
  { applicant_id: "app-019", full_name_ciphertext: demoName("Diego Santos"),     preferred_language: "es" },
  { applicant_id: "app-020", full_name_ciphertext: demoName("Aaliyah Williams"), preferred_language: "en" },
  { applicant_id: "app-021", full_name_ciphertext: demoName("Reza Karimi"),      preferred_language: "en" },
  { applicant_id: "app-022", full_name_ciphertext: demoName("Camila Reyes"),     preferred_language: "es" },
  { applicant_id: "app-023", full_name_ciphertext: demoName("Hyeon Jung"),       preferred_language: "ko" },
  { applicant_id: "app-024", full_name_ciphertext: demoName("Quynh Tran"),       preferred_language: "vi" },
  { applicant_id: "app-025", full_name_ciphertext: demoName("Brianna Davis"),    preferred_language: "en" },
  { applicant_id: "app-026", full_name_ciphertext: demoName("Linh Pham"),        preferred_language: "vi" },
  { applicant_id: "app-027", full_name_ciphertext: demoName("Eduardo Mendez"),   preferred_language: "es" },
  { applicant_id: "app-028", full_name_ciphertext: demoName("Naomi Watson"),     preferred_language: "en" },
  { applicant_id: "app-029", full_name_ciphertext: demoName("Joon Park"),        preferred_language: "ko" },
  { applicant_id: "app-030", full_name_ciphertext: demoName("Esther Lim"),       preferred_language: "zh" },
  { applicant_id: "app-031", full_name_ciphertext: demoName("Adriana Garcia"),   preferred_language: "es" },
  { applicant_id: "app-032", full_name_ciphertext: demoName("Tyrese Brooks"),    preferred_language: "en" },
  { applicant_id: "app-033", full_name_ciphertext: demoName("Mohammed Ahmadi"),  preferred_language: "en" },
  { applicant_id: "app-034", full_name_ciphertext: demoName("Karina Cruz"),      preferred_language: "tl" },
  { applicant_id: "app-035", full_name_ciphertext: demoName("Olivia Torres"),    preferred_language: "es" },
  { applicant_id: "app-036", full_name_ciphertext: demoName("Jorge Vega"),       preferred_language: "es" },
  { applicant_id: "app-037", full_name_ciphertext: demoName("Aiyana Cloud"),     preferred_language: "en" },
  { applicant_id: "app-038", full_name_ciphertext: demoName("Soo-Yeon Kim"),     preferred_language: "ko" },
  { applicant_id: "app-039", full_name_ciphertext: demoName("Mateo Lopez"),      preferred_language: "es" },
  { applicant_id: "app-040", full_name_ciphertext: demoName("Hannah Cohen"),     preferred_language: "en" },
  // Added 2026-05-25 to spread the recert cadence across 60/30/14/7-day stages
  // (existing expiring packets are all clustered in stage_30).
  { applicant_id: "app-041", full_name_ciphertext: demoName("Wei Chen"),         preferred_language: "zh" },
  { applicant_id: "app-042", full_name_ciphertext: demoName("Beatrice Ortiz"),   preferred_language: "es" },
  { applicant_id: "app-043", full_name_ciphertext: demoName("Felix Romano"),     preferred_language: "en" },
];

// ─────────────────────────────────────────────────────────────────────
// Packets — spread across all statuses, counties, languages, risk tiers
// ─────────────────────────────────────────────────────────────────────

export type DemoPacket = {
  packet_id: string;
  applicant_id: string;
  status: string;
  state_code: "CA" | "MA";
  county: string | null;
  county_fips: string | null;
  is_expedited: boolean | null;
  submitted_at: string | null;
  handed_off_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: null;
  applicants: { full_name_ciphertext: string | null; preferred_language: string } | null;
  // Post-handoff lifecycle (optional — only set on Handed Off / Closed
  // packets that have progressed past the agency-receipt step). Absent
  // means "no signal yet"; the enrollments page degrades gracefully and
  // falls back to handed_off_at + 12mo math.
  cert_period_months?: number;
  interview_scheduled_at?: string | null;
  interview_completed_at?: string | null;
  verification_requested_at?: string | null;
  verification_resolved_at?: string | null;
  last_outreach_at?: string | null;
  last_outreach_channel?: "sms" | "call" | "email" | "in_person" | null;
  outreach_attempts?: number;
};

export const DEMO_PACKETS: DemoPacket[] = [
  // 1. Maria — Ready for Handoff (the hero demo packet — all green)
  {
    packet_id: "demo-pkt-001-maria", applicant_id: "app-001",
    status: "Ready for Handoff", state_code: "CA", county: "Alameda", county_fips: "06001",
    is_expedited: false,
    submitted_at: daysAgo(4), handed_off_at: null, closed_at: null,
    created_at: daysAgo(7), updated_at: hoursAgo(2), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[0]!.full_name_ciphertext, preferred_language: "es" },
  },
  // 2. Carlos — In Review (the mid-review demo: 2 actions, no Argyle)
  {
    packet_id: "demo-pkt-002-carlos", applicant_id: "app-002",
    status: "In Navigator Review", state_code: "CA", county: "Fresno", county_fips: "06019",
    is_expedited: false,
    submitted_at: daysAgo(2), handed_off_at: null, closed_at: null,
    created_at: daysAgo(3), updated_at: hoursAgo(5), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[1]!.full_name_ciphertext, preferred_language: "es" },
  },
  // 3. Jasmine — Needs Documents
  {
    packet_id: "demo-pkt-003-jasmine", applicant_id: "app-003",
    status: "Needs Documents", state_code: "CA", county: "Los Angeles", county_fips: "06037",
    is_expedited: false,
    submitted_at: daysAgo(5), handed_off_at: null, closed_at: null,
    created_at: daysAgo(6), updated_at: daysAgo(1), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[2]!.full_name_ciphertext, preferred_language: "en" },
  },
  // 4. David — Submitted for Review (fresh)
  {
    packet_id: "demo-pkt-004-david", applicant_id: "app-004",
    status: "Submitted for Review", state_code: "CA", county: "Sacramento", county_fips: "06067",
    is_expedited: false,
    submitted_at: hoursAgo(8), handed_off_at: null, closed_at: null,
    created_at: daysAgo(2), updated_at: hoursAgo(8), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[3]!.full_name_ciphertext, preferred_language: "zh" },
  },
  // 5. Anh — Handed Off recently, interview scheduled in 4 days (interview_pending bucket)
  {
    packet_id: "demo-pkt-005-anh", applicant_id: "app-005",
    status: "Handed Off", state_code: "CA", county: "Santa Clara", county_fips: "06085",
    is_expedited: false,
    submitted_at: daysAgo(12), handed_off_at: daysAgo(10), closed_at: null,
    created_at: daysAgo(14), updated_at: daysAgo(10), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[4]!.full_name_ciphertext, preferred_language: "vi" },
    cert_period_months: 12,
    interview_scheduled_at: hoursFromNow(96),
    last_outreach_at: hoursAgo(20),
    last_outreach_channel: "call",
    outreach_attempts: 1,
  },
  // 6. Robert — Handed Off ~10mo ago, active mid-cycle (no recert action yet)
  {
    packet_id: "demo-pkt-006-robert", applicant_id: "app-006",
    status: "Handed Off", state_code: "CA", county: "San Diego", county_fips: "06073",
    is_expedited: false,
    submitted_at: monthsAgo(10), handed_off_at: monthsAgo(10), closed_at: null,
    created_at: monthsAgo(10), updated_at: monthsAgo(10), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[5]!.full_name_ciphertext, preferred_language: "en" },
    cert_period_months: 12,
    interview_completed_at: monthsAgo(10),
  },
  // 7. Sofia — Handed Off 13mo ago (OVERDUE recert), 3 outreach attempts logged
  {
    packet_id: "demo-pkt-007-sofia", applicant_id: "app-007",
    status: "Handed Off", state_code: "CA", county: "Riverside", county_fips: "06065",
    is_expedited: false,
    submitted_at: monthsAgo(13), handed_off_at: monthsAgo(13), closed_at: null,
    created_at: monthsAgo(13), updated_at: monthsAgo(13), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[6]!.full_name_ciphertext, preferred_language: "es" },
    cert_period_months: 12,
    interview_completed_at: monthsAgo(13),
    last_outreach_at: daysAgo(4),
    last_outreach_channel: "sms",
    outreach_attempts: 3,
  },
  // 8. Kenji — Draft (just started)
  {
    packet_id: "demo-pkt-008-kenji", applicant_id: "app-008",
    status: "Draft", state_code: "CA", county: "Orange", county_fips: "06059",
    is_expedited: false,
    submitted_at: null, handed_off_at: null, closed_at: null,
    created_at: hoursAgo(3), updated_at: hoursAgo(3), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[7]!.full_name_ciphertext, preferred_language: "en" },
  },
  // 9. Elena — Needs Applicant Clarification (high risk, blocked)
  {
    packet_id: "demo-pkt-009-elena", applicant_id: "app-009",
    status: "Needs Applicant Clarification", state_code: "CA", county: "San Francisco", county_fips: "06075",
    is_expedited: true,
    submitted_at: daysAgo(8), handed_off_at: null, closed_at: null,
    created_at: daysAgo(9), updated_at: daysAgo(2), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[8]!.full_name_ciphertext, preferred_language: "es" },
  },
  // 10. Marcus — Closed (recertified) — full clean lifecycle
  {
    packet_id: "demo-pkt-010-marcus", applicant_id: "app-010",
    status: "Closed", state_code: "CA", county: "Alameda", county_fips: "06001",
    is_expedited: false,
    submitted_at: monthsAgo(14), handed_off_at: monthsAgo(13), closed_at: daysAgo(15),
    created_at: monthsAgo(14), updated_at: daysAgo(15), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[9]!.full_name_ciphertext, preferred_language: "en" },
    cert_period_months: 12,
    interview_completed_at: monthsAgo(12),
    last_outreach_at: daysAgo(20),
    last_outreach_channel: "email",
    outreach_attempts: 2,
  },
  // 11. Priya — In Navigator Review
  {
    packet_id: "demo-pkt-011-priya", applicant_id: "app-011",
    status: "In Navigator Review", state_code: "CA", county: "Santa Clara", county_fips: "06085",
    is_expedited: false,
    submitted_at: daysAgo(3), handed_off_at: null, closed_at: null,
    created_at: daysAgo(4), updated_at: hoursAgo(12), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[10]!.full_name_ciphertext, preferred_language: "en" },
  },
  // 12. Tomas — Handed Off 6mo ago, county requested wage verification 6d ago
  {
    packet_id: "demo-pkt-012-tomas", applicant_id: "app-012",
    status: "Handed Off", state_code: "CA", county: "Fresno", county_fips: "06019",
    is_expedited: false,
    submitted_at: monthsAgo(6), handed_off_at: monthsAgo(6), closed_at: null,
    created_at: monthsAgo(6), updated_at: monthsAgo(6), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[11]!.full_name_ciphertext, preferred_language: "es" },
    cert_period_months: 12,
    interview_completed_at: monthsAgo(6),
    verification_requested_at: daysAgo(6),
    last_outreach_at: daysAgo(2),
    last_outreach_channel: "sms",
    outreach_attempts: 1,
  },
  // 13. Aisha — interview was 5d ago, applicant didn't confirm attendance.
  // INTERVIEW AT RISK — most common silent denial reason on SNAP.
  {
    packet_id: "demo-pkt-013-aisha", applicant_id: "app-013",
    status: "Handed Off", state_code: "CA", county: "San Bernardino", county_fips: "06071",
    is_expedited: false,
    submitted_at: daysAgo(16), handed_off_at: daysAgo(14), closed_at: null,
    created_at: daysAgo(18), updated_at: daysAgo(14), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[12]!.full_name_ciphertext, preferred_language: "en" },
    cert_period_months: 12,
    interview_scheduled_at: daysAgo(5),
    interview_completed_at: null,
    outreach_attempts: 0,
  },
  // 14. James — Handed Off 5mo ago, county requested verification 10d ago — escalating.
  {
    packet_id: "demo-pkt-014-james", applicant_id: "app-014",
    status: "Handed Off", state_code: "CA", county: "Contra Costa", county_fips: "06013",
    is_expedited: false,
    submitted_at: monthsAgo(5), handed_off_at: monthsAgo(5), closed_at: null,
    created_at: monthsAgo(5), updated_at: monthsAgo(5), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[13]!.full_name_ciphertext, preferred_language: "ko" },
    cert_period_months: 24, // elderly/disabled cert period
    interview_completed_at: monthsAgo(5),
    verification_requested_at: daysAgo(10),
    last_outreach_at: daysAgo(3),
    last_outreach_channel: "call",
    outreach_attempts: 2,
  },
  // 15. Lucia — Handed Off 11mo+ ago, recert due in <30d — EXPIRING soon.
  {
    packet_id: "demo-pkt-015-lucia", applicant_id: "app-015",
    status: "Handed Off", state_code: "CA", county: "Kern", county_fips: "06029",
    is_expedited: false,
    submitted_at: daysAgo(345), handed_off_at: daysAgo(345), closed_at: null,
    created_at: daysAgo(345), updated_at: daysAgo(345), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[14]!.full_name_ciphertext, preferred_language: "es" },
    cert_period_months: 12,
    interview_completed_at: daysAgo(340),
    last_outreach_at: daysAgo(5),
    last_outreach_channel: "sms",
    outreach_attempts: 2,
  },
  // 16. Daniel — second recertified household (visual density on the indigo bucket).
  {
    packet_id: "demo-pkt-016-daniel", applicant_id: "app-016",
    status: "Closed", state_code: "CA", county: "San Joaquin", county_fips: "06077",
    is_expedited: false,
    submitted_at: monthsAgo(13), handed_off_at: monthsAgo(13), closed_at: daysAgo(2),
    created_at: monthsAgo(13), updated_at: daysAgo(2), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[15]!.full_name_ciphertext, preferred_language: "en" },
    cert_period_months: 12,
    interview_completed_at: monthsAgo(12),
    last_outreach_at: daysAgo(10),
    last_outreach_channel: "in_person",
    outreach_attempts: 3,
  },

  // ─── Scale cohort (2026-05-25): 24 more enrolled packets so /enrollments
  //     reflects CBO caseload (~30 active households) rather than a 9-row pilot.
  //     Distribution targets: 3 overdue · 3 at-risk · 4 expiring · 5 verification
  //     outstanding · 5 interview pending · 7 active · 4 recertified.

  // 17. Yusuf — active mid-cycle, ABAWD scope
  {
    packet_id: "demo-pkt-017-yusuf", applicant_id: "app-017",
    status: "Handed Off", state_code: "CA", county: "Los Angeles", county_fips: "06037",
    is_expedited: false,
    submitted_at: monthsAgo(7), handed_off_at: monthsAgo(7), closed_at: null,
    created_at: monthsAgo(7), updated_at: monthsAgo(7), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[16]!.full_name_ciphertext, preferred_language: "en" },
    cert_period_months: 12, interview_completed_at: monthsAgo(7),
  },
  // 18. Mei — recert expiring in ~20d
  {
    packet_id: "demo-pkt-018-mei", applicant_id: "app-018",
    status: "Handed Off", state_code: "CA", county: "San Francisco", county_fips: "06075",
    is_expedited: false,
    submitted_at: daysAgo(350), handed_off_at: daysAgo(350), closed_at: null,
    created_at: daysAgo(350), updated_at: daysAgo(350), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[17]!.full_name_ciphertext, preferred_language: "zh" },
    cert_period_months: 12, interview_completed_at: daysAgo(346),
    last_outreach_at: daysAgo(2), last_outreach_channel: "email", outreach_attempts: 1,
  },
  // 19. Diego — active, recent enrollment
  {
    packet_id: "demo-pkt-019-diego", applicant_id: "app-019",
    status: "Handed Off", state_code: "CA", county: "Ventura", county_fips: "06111",
    is_expedited: false,
    submitted_at: monthsAgo(3), handed_off_at: monthsAgo(3), closed_at: null,
    created_at: monthsAgo(3), updated_at: monthsAgo(3), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[18]!.full_name_ciphertext, preferred_language: "es" },
    cert_period_months: 12, interview_completed_at: monthsAgo(3),
  },
  // 20. Aaliyah — verification outstanding (county wants paystubs)
  {
    packet_id: "demo-pkt-020-aaliyah", applicant_id: "app-020",
    status: "Handed Off", state_code: "CA", county: "Los Angeles", county_fips: "06037",
    is_expedited: false,
    submitted_at: monthsAgo(4), handed_off_at: monthsAgo(4), closed_at: null,
    created_at: monthsAgo(4), updated_at: monthsAgo(4), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[19]!.full_name_ciphertext, preferred_language: "en" },
    cert_period_months: 12, interview_completed_at: monthsAgo(4),
    verification_requested_at: daysAgo(8),
    last_outreach_at: daysAgo(1), last_outreach_channel: "sms", outreach_attempts: 2,
  },
  // 21. Reza — active, high RMN redemption
  {
    packet_id: "demo-pkt-021-reza", applicant_id: "app-021",
    status: "Handed Off", state_code: "CA", county: "Orange", county_fips: "06059",
    is_expedited: false,
    submitted_at: monthsAgo(5), handed_off_at: monthsAgo(5), closed_at: null,
    created_at: monthsAgo(5), updated_at: monthsAgo(5), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[20]!.full_name_ciphertext, preferred_language: "en" },
    cert_period_months: 12, interview_completed_at: monthsAgo(5),
  },
  // 22. Camila — interview pending (scheduled in ~6 days)
  {
    packet_id: "demo-pkt-022-camila", applicant_id: "app-022",
    status: "Handed Off", state_code: "CA", county: "Riverside", county_fips: "06065",
    is_expedited: false,
    submitted_at: daysAgo(11), handed_off_at: daysAgo(9), closed_at: null,
    created_at: daysAgo(13), updated_at: daysAgo(9), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[21]!.full_name_ciphertext, preferred_language: "es" },
    cert_period_months: 12, interview_scheduled_at: hoursFromNow(144),
    last_outreach_at: daysAgo(3), last_outreach_channel: "sms", outreach_attempts: 1,
  },
  // 23. Hyeon — active, 68yo (D-SNP eligible cohort), mid-cycle
  {
    packet_id: "demo-pkt-023-hyeon", applicant_id: "app-023",
    status: "Handed Off", state_code: "CA", county: "Santa Clara", county_fips: "06085",
    is_expedited: false,
    submitted_at: monthsAgo(8), handed_off_at: monthsAgo(8), closed_at: null,
    created_at: monthsAgo(8), updated_at: monthsAgo(8), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[22]!.full_name_ciphertext, preferred_language: "ko" },
    cert_period_months: 24, interview_completed_at: monthsAgo(8),
  },
  // 24. Quynh — recert OVERDUE (second overdue household, alongside Sofia)
  {
    packet_id: "demo-pkt-024-quynh", applicant_id: "app-024",
    status: "Handed Off", state_code: "CA", county: "Alameda", county_fips: "06001",
    is_expedited: false,
    submitted_at: monthsAgo(14), handed_off_at: monthsAgo(14), closed_at: null,
    created_at: monthsAgo(14), updated_at: monthsAgo(14), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[23]!.full_name_ciphertext, preferred_language: "vi" },
    cert_period_months: 12, interview_completed_at: monthsAgo(14),
    last_outreach_at: daysAgo(7), last_outreach_channel: "call", outreach_attempts: 4,
  },
  // 25. Brianna — interview at risk (scheduled 4d ago, no completion)
  {
    packet_id: "demo-pkt-025-brianna", applicant_id: "app-025",
    status: "Handed Off", state_code: "CA", county: "San Diego", county_fips: "06073",
    is_expedited: false,
    submitted_at: daysAgo(13), handed_off_at: daysAgo(11), closed_at: null,
    created_at: daysAgo(15), updated_at: daysAgo(11), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[24]!.full_name_ciphertext, preferred_language: "en" },
    cert_period_months: 12, interview_scheduled_at: daysAgo(4),
    last_outreach_at: daysAgo(1), last_outreach_channel: "sms", outreach_attempts: 1,
  },
  // 26. Linh — active, ABAWD scope, exceeded hours
  {
    packet_id: "demo-pkt-026-linh", applicant_id: "app-026",
    status: "Handed Off", state_code: "CA", county: "Sacramento", county_fips: "06067",
    is_expedited: false,
    submitted_at: monthsAgo(4), handed_off_at: monthsAgo(4), closed_at: null,
    created_at: monthsAgo(4), updated_at: monthsAgo(4), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[25]!.full_name_ciphertext, preferred_language: "vi" },
    cert_period_months: 12, interview_completed_at: monthsAgo(4),
  },
  // 27. Eduardo — active, 66yo, D-SNP transfer fired this month
  {
    packet_id: "demo-pkt-027-eduardo", applicant_id: "app-027",
    status: "Handed Off", state_code: "CA", county: "Fresno", county_fips: "06019",
    is_expedited: false,
    submitted_at: monthsAgo(6), handed_off_at: monthsAgo(6), closed_at: null,
    created_at: monthsAgo(6), updated_at: monthsAgo(6), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[26]!.full_name_ciphertext, preferred_language: "es" },
    cert_period_months: 24, interview_completed_at: monthsAgo(6),
  },
  // 28. Naomi — active, ad-only
  {
    packet_id: "demo-pkt-028-naomi", applicant_id: "app-028",
    status: "Handed Off", state_code: "CA", county: "Stanislaus", county_fips: "06099",
    is_expedited: false,
    submitted_at: monthsAgo(5), handed_off_at: monthsAgo(5), closed_at: null,
    created_at: monthsAgo(5), updated_at: monthsAgo(5), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[27]!.full_name_ciphertext, preferred_language: "en" },
    cert_period_months: 12, interview_completed_at: monthsAgo(5),
  },
  // 29. Joon — recert expiring ~22d out
  {
    packet_id: "demo-pkt-029-joon", applicant_id: "app-029",
    status: "Handed Off", state_code: "CA", county: "Los Angeles", county_fips: "06037",
    is_expedited: false,
    submitted_at: daysAgo(343), handed_off_at: daysAgo(343), closed_at: null,
    created_at: daysAgo(343), updated_at: daysAgo(343), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[28]!.full_name_ciphertext, preferred_language: "ko" },
    cert_period_months: 12, interview_completed_at: daysAgo(340),
    last_outreach_at: daysAgo(4), last_outreach_channel: "email", outreach_attempts: 1,
  },
  // 30. Esther — active, modest engagement
  {
    packet_id: "demo-pkt-030-esther", applicant_id: "app-030",
    status: "Handed Off", state_code: "CA", county: "San Mateo", county_fips: "06081",
    is_expedited: false,
    submitted_at: monthsAgo(2), handed_off_at: monthsAgo(2), closed_at: null,
    created_at: monthsAgo(2), updated_at: monthsAgo(2), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[29]!.full_name_ciphertext, preferred_language: "zh" },
    cert_period_months: 12, interview_completed_at: monthsAgo(2),
  },
  // 31. Adriana — interview pending (3 days out)
  {
    packet_id: "demo-pkt-031-adriana", applicant_id: "app-031",
    status: "Handed Off", state_code: "CA", county: "Imperial", county_fips: "06025",
    is_expedited: false,
    submitted_at: daysAgo(7), handed_off_at: daysAgo(5), closed_at: null,
    created_at: daysAgo(9), updated_at: daysAgo(5), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[30]!.full_name_ciphertext, preferred_language: "es" },
    cert_period_months: 12, interview_scheduled_at: hoursFromNow(72),
  },
  // 32. Tyrese — verification outstanding, ABAWD scope (compliance double-jeopardy)
  {
    packet_id: "demo-pkt-032-tyrese", applicant_id: "app-032",
    status: "Handed Off", state_code: "CA", county: "Alameda", county_fips: "06001",
    is_expedited: false,
    submitted_at: monthsAgo(5), handed_off_at: monthsAgo(5), closed_at: null,
    created_at: monthsAgo(5), updated_at: monthsAgo(5), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[31]!.full_name_ciphertext, preferred_language: "en" },
    cert_period_months: 12, interview_completed_at: monthsAgo(5),
    verification_requested_at: daysAgo(11),
    last_outreach_at: daysAgo(2), last_outreach_channel: "call", outreach_attempts: 2,
  },
  // 33. Mohammed — active, 72yo, D-SNP eligible (not yet fired)
  {
    packet_id: "demo-pkt-033-mohammed", applicant_id: "app-033",
    status: "Handed Off", state_code: "CA", county: "San Diego", county_fips: "06073",
    is_expedited: false,
    submitted_at: monthsAgo(9), handed_off_at: monthsAgo(9), closed_at: null,
    created_at: monthsAgo(9), updated_at: monthsAgo(9), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[32]!.full_name_ciphertext, preferred_language: "en" },
    cert_period_months: 24, interview_completed_at: monthsAgo(9),
  },
  // 34. Karina — interview pending (5 days out)
  {
    packet_id: "demo-pkt-034-karina", applicant_id: "app-034",
    status: "Handed Off", state_code: "CA", county: "San Bernardino", county_fips: "06071",
    is_expedited: false,
    submitted_at: daysAgo(8), handed_off_at: daysAgo(6), closed_at: null,
    created_at: daysAgo(10), updated_at: daysAgo(6), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[33]!.full_name_ciphertext, preferred_language: "tl" },
    cert_period_months: 12, interview_scheduled_at: hoursFromNow(120),
  },
  // 35. Olivia — recert expiring (within 30d)
  {
    packet_id: "demo-pkt-035-olivia", applicant_id: "app-035",
    status: "Handed Off", state_code: "CA", county: "Contra Costa", county_fips: "06013",
    is_expedited: false,
    submitted_at: daysAgo(347), handed_off_at: daysAgo(347), closed_at: null,
    created_at: daysAgo(347), updated_at: daysAgo(347), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[34]!.full_name_ciphertext, preferred_language: "es" },
    cert_period_months: 12, interview_completed_at: daysAgo(343),
    last_outreach_at: daysAgo(6), last_outreach_channel: "in_person", outreach_attempts: 2,
  },
  // 36. Jorge — verification outstanding (county wants shelter docs)
  {
    packet_id: "demo-pkt-036-jorge", applicant_id: "app-036",
    status: "Handed Off", state_code: "CA", county: "Kern", county_fips: "06029",
    is_expedited: false,
    submitted_at: monthsAgo(4), handed_off_at: monthsAgo(4), closed_at: null,
    created_at: monthsAgo(4), updated_at: monthsAgo(4), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[35]!.full_name_ciphertext, preferred_language: "es" },
    cert_period_months: 12, interview_completed_at: monthsAgo(4),
    verification_requested_at: daysAgo(4),
  },
  // 37. Aiyana — interview at risk (third such household)
  {
    packet_id: "demo-pkt-037-aiyana", applicant_id: "app-037",
    status: "Handed Off", state_code: "CA", county: "Mendocino", county_fips: "06045",
    is_expedited: false,
    submitted_at: daysAgo(14), handed_off_at: daysAgo(12), closed_at: null,
    created_at: daysAgo(16), updated_at: daysAgo(12), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[36]!.full_name_ciphertext, preferred_language: "en" },
    cert_period_months: 12, interview_scheduled_at: daysAgo(3),
    outreach_attempts: 0,
  },
  // 38. Soo-Yeon — recertified (clean lifecycle)
  {
    packet_id: "demo-pkt-038-soo-yeon", applicant_id: "app-038",
    status: "Closed", state_code: "CA", county: "Santa Clara", county_fips: "06085",
    is_expedited: false,
    submitted_at: monthsAgo(13), handed_off_at: monthsAgo(13), closed_at: daysAgo(8),
    created_at: monthsAgo(13), updated_at: daysAgo(8), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[37]!.full_name_ciphertext, preferred_language: "ko" },
    cert_period_months: 12, interview_completed_at: monthsAgo(12),
    last_outreach_at: daysAgo(12), last_outreach_channel: "email", outreach_attempts: 2,
  },
  // 39. Mateo — recertified (another clean lifecycle)
  {
    packet_id: "demo-pkt-039-mateo", applicant_id: "app-039",
    status: "Closed", state_code: "CA", county: "Los Angeles", county_fips: "06037",
    is_expedited: false,
    submitted_at: monthsAgo(14), handed_off_at: monthsAgo(13), closed_at: daysAgo(20),
    created_at: monthsAgo(14), updated_at: daysAgo(20), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[38]!.full_name_ciphertext, preferred_language: "es" },
    cert_period_months: 12, interview_completed_at: monthsAgo(12),
    last_outreach_at: daysAgo(22), last_outreach_channel: "call", outreach_attempts: 1,
  },
  // 40. Hannah — interview pending (2 days out — soon)
  {
    packet_id: "demo-pkt-040-hannah", applicant_id: "app-040",
    status: "Handed Off", state_code: "CA", county: "San Francisco", county_fips: "06075",
    is_expedited: false,
    submitted_at: daysAgo(9), handed_off_at: daysAgo(7), closed_at: null,
    created_at: daysAgo(11), updated_at: daysAgo(7), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[39]!.full_name_ciphertext, preferred_language: "en" },
    cert_period_months: 12, interview_scheduled_at: hoursFromNow(48),
    last_outreach_at: daysAgo(1), last_outreach_channel: "sms", outreach_attempts: 1,
  },
  // 41. Wei — recert in ~48d (stage_60). Light outreach — first notice just sent.
  {
    packet_id: "demo-pkt-041-wei", applicant_id: "app-041",
    status: "Handed Off", state_code: "CA", county: "Santa Clara", county_fips: "06085",
    is_expedited: false,
    submitted_at: daysAgo(317), handed_off_at: daysAgo(317), closed_at: null,
    created_at: daysAgo(317), updated_at: daysAgo(317), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[40]!.full_name_ciphertext, preferred_language: "zh" },
    cert_period_months: 12, interview_completed_at: daysAgo(313),
    last_outreach_at: daysAgo(8), last_outreach_channel: "sms", outreach_attempts: 1,
  },
  // 42. Beatrice — recert in ~10d (stage_14). Mid-cadence — confirm by phone.
  // Anchored to oneMonthMs (30d) cert math: 350 days handed off → 10 days left.
  {
    packet_id: "demo-pkt-042-beatrice", applicant_id: "app-042",
    status: "Handed Off", state_code: "CA", county: "Los Angeles", county_fips: "06037",
    is_expedited: false,
    submitted_at: daysAgo(350), handed_off_at: daysAgo(350), closed_at: null,
    created_at: daysAgo(350), updated_at: daysAgo(350), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[41]!.full_name_ciphertext, preferred_language: "es" },
    cert_period_months: 12, interview_completed_at: daysAgo(346),
    last_outreach_at: daysAgo(2), last_outreach_channel: "call", outreach_attempts: 3,
  },
  // 43. Felix — recert in ~3d (stage_7). CRITICAL — 6 outreach attempts and still
  // not in. The demo signal: this is where navigators escalate to in-person or
  // CBO warm transfer. Anchored to 30d/month cert math (357 days handed off → 3 left).
  {
    packet_id: "demo-pkt-043-felix", applicant_id: "app-043",
    status: "Handed Off", state_code: "CA", county: "Fresno", county_fips: "06019",
    is_expedited: false,
    submitted_at: daysAgo(357), handed_off_at: daysAgo(357), closed_at: null,
    created_at: daysAgo(357), updated_at: daysAgo(357), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[42]!.full_name_ciphertext, preferred_language: "en" },
    cert_period_months: 12, interview_completed_at: daysAgo(353),
    last_outreach_at: hoursAgo(4), last_outreach_channel: "call", outreach_attempts: 6,
  },
];

// ─────────────────────────────────────────────────────────────────────
// Error-risk rows — drive the queue KPI banner + per-packet risk dots
// Risk score → tier: 0-34 low, 35-59 medium, 60-100 high
// Each packet may have multiple rows to support Δ events in timeline.
// ─────────────────────────────────────────────────────────────────────

export type DemoRiskRow = {
  packet_id: string;
  score: number;
  tier: "low" | "medium" | "high";
  engine_version: string;
  created_at: string;
  factors: null;
};

export const DEMO_RISK_ROWS: DemoRiskRow[] = [
  // Maria (demo-001): low risk, 3 evals showing improvement
  { packet_id: "demo-pkt-001-maria", score: 22, tier: "low",    engine_version: "v0.2.0", created_at: hoursAgo(2),  factors: null },
  { packet_id: "demo-pkt-001-maria", score: 41, tier: "medium", engine_version: "v0.2.0", created_at: daysAgo(2),   factors: null },
  { packet_id: "demo-pkt-001-maria", score: 64, tier: "high",   engine_version: "v0.2.0", created_at: daysAgo(5),   factors: null },
  // Carlos (demo-002): medium, recent
  { packet_id: "demo-pkt-002-carlos", score: 41, tier: "medium", engine_version: "v0.2.0", created_at: hoursAgo(5),  factors: null },
  { packet_id: "demo-pkt-002-carlos", score: 58, tier: "medium", engine_version: "v0.2.0", created_at: daysAgo(2),   factors: null },
  // Jasmine (demo-003): medium-high
  { packet_id: "demo-pkt-003-jasmine", score: 58, tier: "medium", engine_version: "v0.2.0", created_at: daysAgo(1),  factors: null },
  // David (demo-004): medium (just scored)
  { packet_id: "demo-pkt-004-david",  score: 35, tier: "medium", engine_version: "v0.2.0", created_at: hoursAgo(8),  factors: null },
  // Anh (demo-005): low (enrolled)
  { packet_id: "demo-pkt-005-anh",    score: 18, tier: "low",    engine_version: "v0.2.0", created_at: daysAgo(28),  factors: null },
  // Robert (demo-006): low
  { packet_id: "demo-pkt-006-robert", score: 24, tier: "low",    engine_version: "v0.2.0", created_at: monthsAgo(10),factors: null },
  // Sofia (demo-007): medium
  { packet_id: "demo-pkt-007-sofia",  score: 31, tier: "medium", engine_version: "v0.2.0", created_at: monthsAgo(13),factors: null },
  // Elena (demo-009): HIGH — flagship critical packet
  { packet_id: "demo-pkt-009-elena",  score: 72, tier: "high",   engine_version: "v0.2.0", created_at: daysAgo(2),   factors: null },
  { packet_id: "demo-pkt-009-elena",  score: 78, tier: "high",   engine_version: "v0.2.0", created_at: daysAgo(8),   factors: null },
  // Marcus (demo-010): low (recertified)
  { packet_id: "demo-pkt-010-marcus", score: 20, tier: "low",    engine_version: "v0.2.0", created_at: daysAgo(15),  factors: null },
  // Priya (demo-011): medium
  { packet_id: "demo-pkt-011-priya",  score: 44, tier: "medium", engine_version: "v0.2.0", created_at: hoursAgo(12), factors: null },
];

// ─────────────────────────────────────────────────────────────────────
// Status history — drives the funnel reachedStage() + activity ticker
// ─────────────────────────────────────────────────────────────────────

export type DemoHistoryRow = {
  history_id: string;
  packet_id: string;
  from_status: string | null;
  to_status: string;
  occurred_at: string;
  reason: string | null;
  changed_by_staff_id: string | null;
};

export const DEMO_HISTORY: DemoHistoryRow[] = [
  // Maria — full lifecycle to Ready
  { history_id: "h-001", packet_id: "demo-pkt-001-maria",  from_status: null, to_status: "Draft",                 occurred_at: daysAgo(7),  reason: null, changed_by_staff_id: null },
  { history_id: "h-002", packet_id: "demo-pkt-001-maria",  from_status: "Draft", to_status: "Submitted for Review", occurred_at: daysAgo(4), reason: "Applicant completed eligibility flow", changed_by_staff_id: null },
  { history_id: "h-003", packet_id: "demo-pkt-001-maria",  from_status: "Submitted for Review", to_status: "In Navigator Review", occurred_at: daysAgo(3), reason: "Picked up for review", changed_by_staff_id: null },
  { history_id: "h-004", packet_id: "demo-pkt-001-maria",  from_status: "In Navigator Review", to_status: "Ready for Handoff", occurred_at: hoursAgo(2), reason: "All checks passed — Argyle verified income", changed_by_staff_id: null },
  // Carlos
  { history_id: "h-005", packet_id: "demo-pkt-002-carlos", from_status: null, to_status: "Draft",                 occurred_at: daysAgo(3),  reason: null, changed_by_staff_id: null },
  { history_id: "h-006", packet_id: "demo-pkt-002-carlos", from_status: "Draft", to_status: "Submitted for Review", occurred_at: daysAgo(2), reason: null, changed_by_staff_id: null },
  { history_id: "h-007", packet_id: "demo-pkt-002-carlos", from_status: "Submitted for Review", to_status: "In Navigator Review", occurred_at: hoursAgo(5), reason: "Started review", changed_by_staff_id: null },
  // Jasmine
  { history_id: "h-008", packet_id: "demo-pkt-003-jasmine", from_status: null, to_status: "Draft", occurred_at: daysAgo(6), reason: null, changed_by_staff_id: null },
  { history_id: "h-009", packet_id: "demo-pkt-003-jasmine", from_status: "Draft", to_status: "Submitted for Review", occurred_at: daysAgo(5), reason: null, changed_by_staff_id: null },
  { history_id: "h-010", packet_id: "demo-pkt-003-jasmine", from_status: "Submitted for Review", to_status: "Needs Documents", occurred_at: daysAgo(1), reason: "Requested pay stub from last 30 days", changed_by_staff_id: null },
  // David
  { history_id: "h-011", packet_id: "demo-pkt-004-david",  from_status: null, to_status: "Draft", occurred_at: daysAgo(2), reason: null, changed_by_staff_id: null },
  { history_id: "h-012", packet_id: "demo-pkt-004-david",  from_status: "Draft", to_status: "Submitted for Review", occurred_at: hoursAgo(8), reason: null, changed_by_staff_id: null },
  // Anh — full lifecycle to Handed Off
  { history_id: "h-013", packet_id: "demo-pkt-005-anh", from_status: null, to_status: "Draft", occurred_at: monthsAgo(1), reason: null, changed_by_staff_id: null },
  { history_id: "h-014", packet_id: "demo-pkt-005-anh", from_status: "Draft", to_status: "Submitted for Review", occurred_at: daysAgo(30), reason: null, changed_by_staff_id: null },
  { history_id: "h-015", packet_id: "demo-pkt-005-anh", from_status: "Submitted for Review", to_status: "Ready for Handoff", occurred_at: daysAgo(29), reason: null, changed_by_staff_id: null },
  { history_id: "h-016", packet_id: "demo-pkt-005-anh", from_status: "Ready for Handoff", to_status: "Handed Off", occurred_at: daysAgo(28), reason: "Submitted to CDSS portal", changed_by_staff_id: null },
  // Robert, Sofia, Marcus — quick recap to enrolled
  { history_id: "h-017", packet_id: "demo-pkt-006-robert", from_status: null, to_status: "Handed Off", occurred_at: monthsAgo(10), reason: null, changed_by_staff_id: null },
  { history_id: "h-018", packet_id: "demo-pkt-007-sofia",  from_status: null, to_status: "Handed Off", occurred_at: monthsAgo(13), reason: null, changed_by_staff_id: null },
  { history_id: "h-019", packet_id: "demo-pkt-010-marcus", from_status: null, to_status: "Handed Off", occurred_at: monthsAgo(13), reason: null, changed_by_staff_id: null },
  { history_id: "h-020", packet_id: "demo-pkt-010-marcus", from_status: "Handed Off", to_status: "Closed", occurred_at: daysAgo(15), reason: "Recertified successfully", changed_by_staff_id: null },
  { history_id: "h-021", packet_id: "demo-pkt-012-tomas",  from_status: null, to_status: "Handed Off", occurred_at: monthsAgo(6), reason: null, changed_by_staff_id: null },
  // Elena — multiple status events showing struggle
  { history_id: "h-022", packet_id: "demo-pkt-009-elena", from_status: null, to_status: "Draft", occurred_at: daysAgo(9), reason: null, changed_by_staff_id: null },
  { history_id: "h-023", packet_id: "demo-pkt-009-elena", from_status: "Draft", to_status: "Submitted for Review", occurred_at: daysAgo(8), reason: "Expedited request", changed_by_staff_id: null },
  { history_id: "h-024", packet_id: "demo-pkt-009-elena", from_status: "Submitted for Review", to_status: "Needs Applicant Clarification", occurred_at: daysAgo(2), reason: "Income discrepancy vs prior application", changed_by_staff_id: null },
  // Priya
  { history_id: "h-025", packet_id: "demo-pkt-011-priya", from_status: null, to_status: "Draft", occurred_at: daysAgo(4), reason: null, changed_by_staff_id: null },
  { history_id: "h-026", packet_id: "demo-pkt-011-priya", from_status: "Draft", to_status: "Submitted for Review", occurred_at: daysAgo(3), reason: null, changed_by_staff_id: null },
  { history_id: "h-027", packet_id: "demo-pkt-011-priya", from_status: "Submitted for Review", to_status: "In Navigator Review", occurred_at: hoursAgo(12), reason: null, changed_by_staff_id: null },
];

// ─────────────────────────────────────────────────────────────────────
// Uploaded documents — drives Doc AI panel + map dots
// ─────────────────────────────────────────────────────────────────────

export type DemoDocRow = {
  document_id: string;
  packet_id: string;
  document_kind: string;
  classification_confidence: number;
  processing_status: string;
  uploaded_at: string;
  original_filename: string | null;
  deleted_at: null;
};

export const DEMO_DOCS: DemoDocRow[] = [
  { document_id: "doc-001", packet_id: "demo-pkt-001-maria",  document_kind: "pay_stub", classification_confidence: 0.96, processing_status: "extracted", uploaded_at: daysAgo(4), original_filename: "paystub_apr30.pdf", deleted_at: null },
  { document_id: "doc-002", packet_id: "demo-pkt-001-maria",  document_kind: "lease",    classification_confidence: 0.93, processing_status: "extracted", uploaded_at: daysAgo(4), original_filename: "lease_2026.pdf", deleted_at: null },
  { document_id: "doc-003", packet_id: "demo-pkt-001-maria",  document_kind: "utility_bill", classification_confidence: 0.89, processing_status: "extracted", uploaded_at: daysAgo(3), original_filename: "pge_apr.pdf", deleted_at: null },
  { document_id: "doc-004", packet_id: "demo-pkt-002-carlos", document_kind: "pay_stub", classification_confidence: 0.87, processing_status: "extracted", uploaded_at: daysAgo(2), original_filename: "paystub.pdf", deleted_at: null },
  { document_id: "doc-005", packet_id: "demo-pkt-002-carlos", document_kind: "id",       classification_confidence: 0.94, processing_status: "extracted", uploaded_at: daysAgo(2), original_filename: "id.jpg", deleted_at: null },
  { document_id: "doc-006", packet_id: "demo-pkt-003-jasmine", document_kind: "id",      classification_confidence: 0.91, processing_status: "extracted", uploaded_at: daysAgo(5), original_filename: "drivers_license.jpg", deleted_at: null },
  { document_id: "doc-007", packet_id: "demo-pkt-005-anh",   document_kind: "pay_stub",  classification_confidence: 0.95, processing_status: "extracted", uploaded_at: monthsAgo(1), original_filename: "stub.pdf", deleted_at: null },
  { document_id: "doc-008", packet_id: "demo-pkt-005-anh",   document_kind: "lease",     classification_confidence: 0.92, processing_status: "extracted", uploaded_at: monthsAgo(1), original_filename: "lease.pdf", deleted_at: null },
  { document_id: "doc-009", packet_id: "demo-pkt-009-elena", document_kind: "pay_stub",  classification_confidence: 0.71, processing_status: "extracted", uploaded_at: daysAgo(8), original_filename: "scan.pdf", deleted_at: null },
  { document_id: "doc-010", packet_id: "demo-pkt-011-priya", document_kind: "pay_stub",  classification_confidence: 0.88, processing_status: "extracted", uploaded_at: daysAgo(3), original_filename: "paystub.pdf", deleted_at: null },
];

// ─────────────────────────────────────────────────────────────────────
// QC outcomes — drives QC tab + Dashboard home QCOutcomesPanel
// ─────────────────────────────────────────────────────────────────────

export type DemoQCRow = {
  packet_id: string;
  qc_sampled: boolean;
  error_found: boolean | null;
  error_type: string | null;
  error_amount: number | null;
};

export const DEMO_QC_ROWS: DemoQCRow[] = [
  { packet_id: "demo-pkt-005-anh",    qc_sampled: true, error_found: false, error_type: null, error_amount: null },
  { packet_id: "demo-pkt-006-robert", qc_sampled: true, error_found: false, error_type: null, error_amount: null },
  { packet_id: "demo-pkt-010-marcus", qc_sampled: true, error_found: false, error_type: null, error_amount: null },
  { packet_id: "demo-pkt-012-tomas",  qc_sampled: true, error_found: false, error_type: null, error_amount: null },
  { packet_id: "demo-pkt-007-sofia",  qc_sampled: true, error_found: true,  error_type: "shelter_overcounted", error_amount: 38 },
];

// ─────────────────────────────────────────────────────────────────────
// Outreach tasks — drives Outreach tab
// ─────────────────────────────────────────────────────────────────────

export type DemoOutreachTask = {
  outreach_task_id: string;
  packet_id: string;
  reason: string;
  income_usd: number | null;
  sla_hours: number | null;
  due_at: string;
  status: string;
  created_at: string;
};

export const DEMO_OUTREACH_TASKS: DemoOutreachTask[] = [
  {
    outreach_task_id: "outreach-001",
    packet_id: "demo-pkt-003-jasmine",
    reason: "manual",
    income_usd: null,
    sla_hours: 48,
    due_at: hoursFromNow(36),
    status: "pending",
    created_at: daysAgo(1),
  },
  {
    outreach_task_id: "outreach-002",
    packet_id: "demo-pkt-009-elena",
    reason: "manual",
    income_usd: null,
    sla_hours: 24,
    due_at: hoursFromNow(1),
    status: "pending",
    created_at: hoursAgo(23),
  },
  {
    outreach_task_id: "outreach-003",
    packet_id: "demo-pkt-006-robert",
    reason: "cliff_event",
    income_usd: 2410,
    sla_hours: 24,
    due_at: hoursAgo(2),
    status: "pending",
    created_at: hoursAgo(26),
  },
];

// ─────────────────────────────────────────────────────────────────────
// Stage 3 monetization yield — per-household monthly attribution.
// Wired into the YC pitch (post-issuance daily engagement → 3 revenue
// lines). Numbers are calibrated against the YC California-only ARR
// sizing: a blend of ~$3–5 per *monetized* household per month, NOT
// per all-3M-CA-household (which would imply a $500M TAM and break the
// pitch's $5–15M ARR math).
//
//   - adSavingsThisMonth: closed-loop RMN savings the household captured
//   - hoursLoggedThisMonth: ABAWD work-hours logged this month (of 80)
//   - workforceReferralValue: per-placement payout earned this month
//   - dsnpEligible: cohort flag (age ≥64.5 + Medicare enrollment window)
//   - dsnpWarmTransferValue: $250 if a warm transfer fired this month
//
// Salience: not every household is monetized. ~half the demo cohort
// shows zero on each stream — that's the honest pattern and what makes
// the composite math reconcile to YC sizing.
// ─────────────────────────────────────────────────────────────────────

export type Stage3Yield = {
  applicant_id: string;
  adSavingsThisMonth: number;       // dollars, retailer-level attribution
  hoursLoggedThisMonth: number;     // 0–80, only meaningful for ABAWD-scope
  workforceReferralValue: number;   // dollars paid for placements this month
  dsnpEligible: boolean;            // cohort flag — controls iOS DSNPCard render
  dsnpWarmTransferValue: number;    // dollars (typically 0 or 250 — $250/lead)
};

export const DEMO_STAGE3_YIELD: Stage3Yield[] = [
  // Maria — high ad redemption, ABAWD scope, working ~60% of target hrs
  { applicant_id: "app-001", adSavingsThisMonth: 12.40, hoursLoggedThisMonth: 48, workforceReferralValue: 7,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Carlos — light ad usage, ABAWD scope, low hours (compliance risk)
  { applicant_id: "app-002", adSavingsThisMonth: 4.20,  hoursLoggedThisMonth: 22, workforceReferralValue: 14,   dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Jasmine — moderate ad usage, no ABAWD, no monetization beyond ads
  { applicant_id: "app-003", adSavingsThisMonth: 8.70,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // David — ABAWD scope, full hours, workforce placement fired
  { applicant_id: "app-004", adSavingsThisMonth: 6.10,  hoursLoggedThisMonth: 78, workforceReferralValue: 35,   dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Anh — moderate ad, no ABAWD
  { applicant_id: "app-005", adSavingsThisMonth: 3.20,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Robert — 67yo, D-SNP eligible cohort, warm transfer fired this month
  { applicant_id: "app-006", adSavingsThisMonth: 2.80,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: true,  dsnpWarmTransferValue: 250 },
  // Sofia — ABAWD scope, exemplary hours
  { applicant_id: "app-007", adSavingsThisMonth: 5.90,  hoursLoggedThisMonth: 82, workforceReferralValue: 22,   dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Kenji — 70yo, D-SNP eligible, no warm transfer yet (in cohort, not yet fired)
  { applicant_id: "app-008", adSavingsThisMonth: 1.10,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: true,  dsnpWarmTransferValue: 0 },
  // Elena — no monetization this month
  { applicant_id: "app-009", adSavingsThisMonth: 0,     hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Marcus — ABAWD scope, moderate hours, mid-placement
  { applicant_id: "app-010", adSavingsThisMonth: 7.40,  hoursLoggedThisMonth: 56, workforceReferralValue: 18,   dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Priya — ad-only, no other streams
  { applicant_id: "app-011", adSavingsThisMonth: 9.30,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Tomas — 65yo, D-SNP eligible, warm transfer fired
  { applicant_id: "app-012", adSavingsThisMonth: 3.60,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: true,  dsnpWarmTransferValue: 250 },
  // Aisha (app-013) — interview at risk, benefits not yet issued: no monetization yet.
  { applicant_id: "app-013", adSavingsThisMonth: 0,     hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // James (app-014) — 68yo, ko-language, D-SNP eligible cohort; no transfer yet.
  { applicant_id: "app-014", adSavingsThisMonth: 1.40,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: true,  dsnpWarmTransferValue: 0 },
  // Lucia (app-015) — moderate ad, ABAWD scope, partial hours.
  { applicant_id: "app-015", adSavingsThisMonth: 6.80,  hoursLoggedThisMonth: 52, workforceReferralValue: 11,   dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Daniel (app-016) — recertified, steady ad redemption.
  { applicant_id: "app-016", adSavingsThisMonth: 4.50,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // ─── Scale cohort (2026-05-25, applicants 017–040)
  // Yusuf — ABAWD scope, mid hours
  { applicant_id: "app-017", adSavingsThisMonth: 4.20,  hoursLoggedThisMonth: 48, workforceReferralValue: 12,   dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Mei — ad-only, modest
  { applicant_id: "app-018", adSavingsThisMonth: 3.80,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Diego — light ad activity
  { applicant_id: "app-019", adSavingsThisMonth: 2.10,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Aaliyah — ABAWD scope, low hours (at-risk)
  { applicant_id: "app-020", adSavingsThisMonth: 3.30,  hoursLoggedThisMonth: 24, workforceReferralValue: 6,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Reza — high RMN redemption (one of the top earners)
  { applicant_id: "app-021", adSavingsThisMonth: 14.60, hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Camila — no monetization yet (just enrolled)
  { applicant_id: "app-022", adSavingsThisMonth: 0,     hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Hyeon — 68yo D-SNP cohort, not yet transferred
  { applicant_id: "app-023", adSavingsThisMonth: 2.20,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: true,  dsnpWarmTransferValue: 0 },
  // Quynh — overdue household, light ad
  { applicant_id: "app-024", adSavingsThisMonth: 1.50,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Brianna — interview at risk, modest ad
  { applicant_id: "app-025", adSavingsThisMonth: 2.80,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Linh — ABAWD compliant + exceeded hours, placement payout
  { applicant_id: "app-026", adSavingsThisMonth: 6.40,  hoursLoggedThisMonth: 84, workforceReferralValue: 25,   dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Eduardo — 66yo, D-SNP warm transfer fired this month
  { applicant_id: "app-027", adSavingsThisMonth: 3.10,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: true,  dsnpWarmTransferValue: 250 },
  // Naomi — ad-only, steady
  { applicant_id: "app-028", adSavingsThisMonth: 7.20,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Joon — expiring household, modest ad
  { applicant_id: "app-029", adSavingsThisMonth: 4.90,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Esther — ad-only, low engagement
  { applicant_id: "app-030", adSavingsThisMonth: 1.80,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Adriana — interview pending, no monetization yet
  { applicant_id: "app-031", adSavingsThisMonth: 0,     hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Tyrese — verification outstanding + ABAWD scope, hours behind pace (compliance double-jeopardy)
  { applicant_id: "app-032", adSavingsThisMonth: 5.60,  hoursLoggedThisMonth: 28, workforceReferralValue: 8,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Mohammed — 72yo D-SNP cohort, not yet transferred
  { applicant_id: "app-033", adSavingsThisMonth: 2.40,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: true,  dsnpWarmTransferValue: 0 },
  // Karina — interview pending, light activity
  { applicant_id: "app-034", adSavingsThisMonth: 1.20,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Olivia — expiring, modest
  { applicant_id: "app-035", adSavingsThisMonth: 5.10,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Jorge — ABAWD scope, hours below threshold (at-risk)
  { applicant_id: "app-036", adSavingsThisMonth: 3.40,  hoursLoggedThisMonth: 32, workforceReferralValue: 9,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Aiyana — interview at risk, no monetization
  { applicant_id: "app-037", adSavingsThisMonth: 0,     hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Soo-Yeon — recertified, ad-only
  { applicant_id: "app-038", adSavingsThisMonth: 6.30,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Mateo — recertified, ad-only
  { applicant_id: "app-039", adSavingsThisMonth: 5.80,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Hannah — interview pending, light ad
  { applicant_id: "app-040", adSavingsThisMonth: 1.90,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Wei (app-041) — stage_60 example, modest ad redemption.
  { applicant_id: "app-041", adSavingsThisMonth: 4.20,  hoursLoggedThisMonth: 0,  workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Beatrice (app-042) — stage_14 example, ABAWD scope, on pace.
  { applicant_id: "app-042", adSavingsThisMonth: 7.10,  hoursLoggedThisMonth: 68, workforceReferralValue: 14,   dsnpEligible: false, dsnpWarmTransferValue: 0 },
  // Felix (app-043) — stage_7 critical example, ABAWD behind pace (recert at risk
  // would compound with hours non-compliance — flagship "things going wrong" demo).
  { applicant_id: "app-043", adSavingsThisMonth: 5.40,  hoursLoggedThisMonth: 38, workforceReferralValue: 0,    dsnpEligible: false, dsnpWarmTransferValue: 0 },
];

export function getStage3Yield(applicantId: string | null | undefined): Stage3Yield | null {
  if (!applicantId) return null;
  return DEMO_STAGE3_YIELD.find((y) => y.applicant_id === applicantId) ?? null;
}

export type Stage3Totals = {
  adSavings: number;
  workforceReferrals: number;
  dsnpTransfers: number;                       // $ summed from one-time lead payouts this month
  dsnpTransferCount: number;                   // count of warm transfers fired this month
  dsnpEligibleCount: number;                   // households in the cohort (not yet transferred)
  monetizedHouseholdCount: number;             // households with non-zero recurring stream
  recurringYield: number;                      // ads + workforce only (monthly composite)
  totalYieldIncludingOneTime: number;          // recurring + D-SNP this month
  recurringYieldPerMonetizedHousehold: number; // hero metric
};

export function getStage3Totals(applicantIds: Array<string | null | undefined>): Stage3Totals {
  const ids = new Set(applicantIds.filter((id): id is string => !!id));
  const rows = DEMO_STAGE3_YIELD.filter((y) => ids.has(y.applicant_id));
  const adSavings = rows.reduce((sum, r) => sum + r.adSavingsThisMonth, 0);
  const workforceReferrals = rows.reduce((sum, r) => sum + r.workforceReferralValue, 0);
  const dsnpTransfers = rows.reduce((sum, r) => sum + r.dsnpWarmTransferValue, 0);
  const dsnpTransferCount = rows.filter((r) => r.dsnpWarmTransferValue > 0).length;
  const dsnpEligibleCount = rows.filter((r) => r.dsnpEligible).length;
  // Monetized = has any recurring stream (ads or workforce). D-SNP fired this
  // month doesn't qualify a household as "recurring monetized" — that lead is
  // one-time-per-lifetime per premise P5.
  const monetizedHouseholdCount = rows.filter(
    (r) => r.adSavingsThisMonth > 0 || r.workforceReferralValue > 0,
  ).length;
  const recurringYield = adSavings + workforceReferrals;
  const totalYieldIncludingOneTime = recurringYield + dsnpTransfers;
  const recurringYieldPerMonetizedHousehold = monetizedHouseholdCount > 0
    ? recurringYield / monetizedHouseholdCount
    : 0;
  return {
    adSavings,
    workforceReferrals,
    dsnpTransfers,
    dsnpTransferCount,
    dsnpEligibleCount,
    monetizedHouseholdCount,
    recurringYield,
    totalYieldIncludingOneTime,
    recurringYieldPerMonetizedHousehold,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Outreach packet metadata (used to look up packet info from task)
// ─────────────────────────────────────────────────────────────────────

export function getDemoPacketsForOutreach(): Array<{
  packet_id: string;
  status: string;
  county: string | null;
  state_code: string;
  applicants: { full_name_ciphertext: string | null } | null;
}> {
  return DEMO_PACKETS.map((p) => ({
    packet_id: p.packet_id,
    status: p.status,
    county: p.county,
    state_code: p.state_code,
    applicants: p.applicants ? { full_name_ciphertext: p.applicants.full_name_ciphertext } : null,
  }));
}

// ─────────────────────────────────────────────────────────────────────
// Per-packet detail bundles — for the demo packet detail page paths.
// Only the "Maria" (ready) + "Carlos" (mid-review) packets are fully
// hydrated; the other demo packets fall back to the queue rows when
// clicked (real query → 404 → caller redirects to /packets).
// ─────────────────────────────────────────────────────────────────────

export type DemoPacketDetailBundle = {
  packet: DemoPacket & { applicant_id: string };
  answers: Array<{ question_key: string; applicant_answer: string | null }>;
  docs: Array<{ document_id: string; document_kind: string; uploaded_at: string; original_filename: string | null; processing_status: string }>;
  history: Array<DemoHistoryRow>;
  fields: Array<{ field_id: string; extraction_id: string; field_key: string; field_label: string; original_ocr_value: string | null; applicant_answer: string | null; navigator_confirmed_value: string | null; confidence: number; needs_review: boolean; reviewed_at: string | null; review_note: string | null }>;
  docItems: Array<{ item_id: string; packet_id: string; label: string; document_kind: string; is_required: boolean; resolved_at: string | null; waived_at: string | null }>;
  extractions: Array<{ extraction_id: string; document_id: string; extracted_at: string; extractor_model: string | null; overall_confidence: number | null; uploaded_documents: { document_kind: string; original_filename: string | null } | null }>;
  paychecks: { monthly_amount_usd: number; pay_date: string; employer_name: string | null } | null;
  riskHistory: DemoRiskRow[];
  argyle: { connection_id: string; linked_at: string; argyle_user_id: string; linked_accounts: unknown[] } | null;
  shelterAllocation: null;
  notes: Array<{ note_id: string; created_at: string; is_internal: boolean; body_ciphertext: string }>;
  unresolvedDocs: number;
  unreviewedFields: number;
  hasConsent: boolean;
  consentedAt: string | null;
  wrStatus: { compliance_status: string | null; determined_at: string; is_subject: boolean; exemption_type: string | null } | null;
};

export function getDemoPacketDetail(packetId: string): DemoPacketDetailBundle | null {
  if (packetId === "demo-pkt-001-maria") return buildMariaDetail();
  if (packetId === "demo-pkt-002-carlos") return buildCarlosDetail();
  // Generic fallback for the other 10 demo packets — assembled from the
  // shared fixtures so a clicked packet never 404s during a demo. The page
  // will render with thinner sections (no answers / extracted fields) but
  // hero + lifecycle + risk + activity timeline all light up correctly.
  const packet = DEMO_PACKETS.find((p) => p.packet_id === packetId);
  if (!packet) return null;
  return buildGenericDetail(packet);
}

function buildGenericDetail(packet: DemoPacket): DemoPacketDetailBundle {
  const riskHistory = DEMO_RISK_ROWS.filter((r) => r.packet_id === packet.packet_id);
  const docs = DEMO_DOCS.filter((d) => d.packet_id === packet.packet_id);
  const history = DEMO_HISTORY.filter((h) => h.packet_id === packet.packet_id);
  // A handful of plausible-but-light answers so the eligibility-questions
  // section isn't an awkward "no answers yet" empty state.
  const answers = [
    { question_key: "household_size", applicant_answer: "2" },
    { question_key: "monthly_gross_income", applicant_answer: "1980" },
    { question_key: "employment_status", applicant_answer: "employed" },
    { question_key: "housing_situation", applicant_answer: "renting" },
    { question_key: "monthly_rent_or_mortgage", applicant_answer: "1450" },
    { question_key: "has_heating_costs", applicant_answer: "yes" },
    { question_key: "has_electric_or_gas", applicant_answer: "yes" },
    { question_key: "has_phone", applicant_answer: "yes" },
  ];
  // For Handed Off / Closed packets, treat them as fully-resolved so the
  // Review Status card paints "Ready" and the lifecycle strip matches the
  // hero status pill.
  const isFinal = packet.status === "Handed Off" || packet.status === "Closed";
  const isNeedsDocs = packet.status === "Needs Documents" || packet.status === "Needs Applicant Clarification";
  return {
    packet,
    answers,
    docs: docs.map((d) => ({
      document_id: d.document_id,
      document_kind: d.document_kind,
      uploaded_at: d.uploaded_at,
      original_filename: d.original_filename,
      processing_status: d.processing_status,
    })),
    history,
    fields: [],
    docItems: [],
    extractions: docs.map((d, i) => ({
      extraction_id: `gen-ex-${packet.packet_id}-${i}`,
      document_id: d.document_id,
      extracted_at: d.uploaded_at,
      extractor_model: "claude-opus-4-7",
      overall_confidence: d.classification_confidence,
      uploaded_documents: { document_kind: d.document_kind, original_filename: d.original_filename },
    })),
    paychecks: null,
    riskHistory,
    argyle: null,
    shelterAllocation: null,
    notes: [],
    unresolvedDocs: isNeedsDocs ? 2 : 0,
    unreviewedFields: 0,
    hasConsent: isFinal,
    consentedAt: isFinal ? packet.handed_off_at : null,
    wrStatus: isFinal
      ? { compliance_status: "compliant", determined_at: packet.handed_off_at ?? packet.updated_at, is_subject: true, exemption_type: null }
      : null,
  };
}

function buildMariaDetail(): DemoPacketDetailBundle {
  const packet = DEMO_PACKETS[0]!;
  return {
    packet,
    answers: [
      { question_key: "household_size", applicant_answer: "3" },
      { question_key: "monthly_gross_income", applicant_answer: "2840" },
      { question_key: "employment_status", applicant_answer: "employed" },
      { question_key: "housing_situation", applicant_answer: "renting" },
      { question_key: "monthly_rent_or_mortgage", applicant_answer: "1850" },
      { question_key: "has_heating_costs", applicant_answer: "yes" },
      { question_key: "has_electric_or_gas", applicant_answer: "yes" },
      { question_key: "has_phone", applicant_answer: "yes" },
      { question_key: "receives_heap", applicant_answer: "no" },
      { question_key: "lease_in_applicant_name", applicant_answer: "true" },
      { question_key: "rent_payment_method", applicant_answer: "bank_transfer" },
      { question_key: "address", applicant_answer: "1240 Telegraph Ave, Oakland CA 94612" },
      { question_key: "child_ages", applicant_answer: "6,9" },
      { question_key: "has_elderly_disabled_member", applicant_answer: "no" },
      { question_key: "has_disabled_member", applicant_answer: "no" },
      { question_key: "receives_ssi", applicant_answer: "no" },
      { question_key: "vehicle_value", applicant_answer: "4500" },
      { question_key: "savings_amount", applicant_answer: "320" },
    ],
    docs: DEMO_DOCS.filter((d) => d.packet_id === "demo-pkt-001-maria"),
    history: DEMO_HISTORY.filter((h) => h.packet_id === "demo-pkt-001-maria"),
    fields: [
      { field_id: "f-001", extraction_id: "ex-001", field_key: "gross_pay", field_label: "Gross pay", original_ocr_value: "1420.00", applicant_answer: "2840", navigator_confirmed_value: null, confidence: 0.96, needs_review: false, reviewed_at: hoursAgo(3), review_note: null },
      { field_id: "f-002", extraction_id: "ex-001", field_key: "pay_period", field_label: "Pay period", original_ocr_value: "biweekly", applicant_answer: null, navigator_confirmed_value: null, confidence: 0.98, needs_review: false, reviewed_at: hoursAgo(3), review_note: null },
      { field_id: "f-003", extraction_id: "ex-002", field_key: "monthly_rent_or_mortgage", field_label: "Monthly rent", original_ocr_value: "1850", applicant_answer: "1850", navigator_confirmed_value: "1850", confidence: 0.93, needs_review: false, reviewed_at: hoursAgo(3), review_note: null },
      { field_id: "f-004", extraction_id: "ex-002", field_key: "civica_rent_verification_status", field_label: "Rent matched", original_ocr_value: "matched", applicant_answer: null, navigator_confirmed_value: null, confidence: 1.0, needs_review: false, reviewed_at: null, review_note: null },
      { field_id: "f-005", extraction_id: "ex-002", field_key: "civica_name_verification_status", field_label: "Name matched", original_ocr_value: "matched", applicant_answer: null, navigator_confirmed_value: null, confidence: 1.0, needs_review: false, reviewed_at: null, review_note: null },
      { field_id: "f-006", extraction_id: "ex-002", field_key: "civica_defensibility_tier", field_label: "Lease defensibility", original_ocr_value: "strong", applicant_answer: null, navigator_confirmed_value: null, confidence: 1.0, needs_review: false, reviewed_at: null, review_note: null },
    ],
    docItems: [
      { item_id: "di-001", packet_id: "demo-pkt-001-maria", label: "Pay stub (last 30 days)", document_kind: "pay_stub", is_required: true, resolved_at: daysAgo(4), waived_at: null },
      { item_id: "di-002", packet_id: "demo-pkt-001-maria", label: "Lease agreement", document_kind: "lease", is_required: true, resolved_at: daysAgo(4), waived_at: null },
      { item_id: "di-003", packet_id: "demo-pkt-001-maria", label: "Utility bill", document_kind: "utility_bill", is_required: true, resolved_at: daysAgo(3), waived_at: null },
      { item_id: "di-004", packet_id: "demo-pkt-001-maria", label: "Photo ID", document_kind: "id", is_required: false, resolved_at: null, waived_at: daysAgo(2) },
    ],
    extractions: [
      { extraction_id: "ex-001", document_id: "doc-001", extracted_at: daysAgo(4), extractor_model: "claude-opus-4-7", overall_confidence: 0.96, uploaded_documents: { document_kind: "pay_stub", original_filename: "paystub_apr30.pdf" } },
      { extraction_id: "ex-002", document_id: "doc-002", extracted_at: daysAgo(4), extractor_model: "claude-opus-4-7", overall_confidence: 0.93, uploaded_documents: { document_kind: "lease", original_filename: "lease_2026.pdf" } },
      { extraction_id: "ex-003", document_id: "doc-003", extracted_at: daysAgo(3), extractor_model: "claude-opus-4-7", overall_confidence: 0.89, uploaded_documents: { document_kind: "utility_bill", original_filename: "pge_apr.pdf" } },
    ],
    paychecks: { monthly_amount_usd: 2870, pay_date: daysAgo(5), employer_name: "Sutter Health" },
    riskHistory: DEMO_RISK_ROWS.filter((r) => r.packet_id === "demo-pkt-001-maria"),
    argyle: { connection_id: "argyle-001", linked_at: daysAgo(3), argyle_user_id: "au-001", linked_accounts: [{ id: "a1" }] },
    shelterAllocation: null,
    notes: [
      { note_id: "n-001", created_at: daysAgo(3), is_internal: true, body_ciphertext: "Applicant connected Argyle on intake call — payroll syncing." },
      { note_id: "n-002", created_at: hoursAgo(2), is_internal: false, body_ciphertext: "All verifications complete. Advancing to Ready for Handoff." },
    ],
    unresolvedDocs: 0,
    unreviewedFields: 0,
    hasConsent: true,
    consentedAt: daysAgo(4),
    wrStatus: {
      compliance_status: "compliant",
      determined_at: daysAgo(2),
      is_subject: true,
      exemption_type: null,
    },
  };
}

function buildCarlosDetail(): DemoPacketDetailBundle {
  const packet = DEMO_PACKETS[1]!;
  return {
    packet,
    answers: [
      { question_key: "household_size", applicant_answer: "2" },
      { question_key: "monthly_gross_income", applicant_answer: "1980" },
      { question_key: "employment_status", applicant_answer: "self_employed" },
      { question_key: "housing_situation", applicant_answer: "renting" },
      { question_key: "monthly_rent_or_mortgage", applicant_answer: "1320" },
      { question_key: "has_heating_costs", applicant_answer: "yes" },
      { question_key: "has_electric_or_gas", applicant_answer: null },
      { question_key: "has_phone", applicant_answer: null },
      { question_key: "address", applicant_answer: "789 Fulton St, Fresno CA 93706" },
      { question_key: "child_ages", applicant_answer: "" },
      { question_key: "has_elderly_disabled_member", applicant_answer: "no" },
      { question_key: "has_disabled_member", applicant_answer: "no" },
      { question_key: "receives_ssi", applicant_answer: "no" },
    ],
    docs: DEMO_DOCS.filter((d) => d.packet_id === "demo-pkt-002-carlos"),
    history: DEMO_HISTORY.filter((h) => h.packet_id === "demo-pkt-002-carlos"),
    fields: [
      { field_id: "f-101", extraction_id: "ex-101", field_key: "gross_pay", field_label: "Gross pay", original_ocr_value: "990.00", applicant_answer: "1980", navigator_confirmed_value: null, confidence: 0.74, needs_review: true, reviewed_at: null, review_note: null },
      { field_id: "f-102", extraction_id: "ex-101", field_key: "pay_period", field_label: "Pay period", original_ocr_value: "biweekly", applicant_answer: null, navigator_confirmed_value: null, confidence: 0.62, needs_review: true, reviewed_at: null, review_note: null },
    ],
    docItems: [
      { item_id: "di-101", packet_id: "demo-pkt-002-carlos", label: "Pay stub (last 30 days)", document_kind: "pay_stub", is_required: true, resolved_at: daysAgo(2), waived_at: null },
      { item_id: "di-102", packet_id: "demo-pkt-002-carlos", label: "Photo ID", document_kind: "id", is_required: true, resolved_at: daysAgo(2), waived_at: null },
      { item_id: "di-103", packet_id: "demo-pkt-002-carlos", label: "Lease agreement", document_kind: "lease", is_required: true, resolved_at: null, waived_at: null },
    ],
    extractions: [
      { extraction_id: "ex-101", document_id: "doc-004", extracted_at: daysAgo(2), extractor_model: "claude-opus-4-7", overall_confidence: 0.74, uploaded_documents: { document_kind: "pay_stub", original_filename: "paystub.pdf" } },
      { extraction_id: "ex-102", document_id: "doc-005", extracted_at: daysAgo(2), extractor_model: "claude-opus-4-7", overall_confidence: 0.94, uploaded_documents: { document_kind: "id", original_filename: "id.jpg" } },
    ],
    paychecks: null,
    riskHistory: DEMO_RISK_ROWS.filter((r) => r.packet_id === "demo-pkt-002-carlos"),
    argyle: null,
    shelterAllocation: null,
    notes: [
      { note_id: "n-101", created_at: hoursAgo(4), is_internal: true, body_ciphertext: "Pay stub OCR confidence low — need to confirm income with applicant or get Argyle connection." },
    ],
    unresolvedDocs: 1,
    unreviewedFields: 2,
    hasConsent: false,
    consentedAt: null,
    wrStatus: null,
  };
}
