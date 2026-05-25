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
  // 5. Anh — Handed Off recently (pilot cohort entry — within 2026-05 window)
  {
    packet_id: "demo-pkt-005-anh", applicant_id: "app-005",
    status: "Handed Off", state_code: "CA", county: "Santa Clara", county_fips: "06085",
    is_expedited: false,
    submitted_at: daysAgo(12), handed_off_at: daysAgo(10), closed_at: null,
    created_at: daysAgo(14), updated_at: daysAgo(10), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[4]!.full_name_ciphertext, preferred_language: "vi" },
  },
  // 6. Robert — Handed Off ~10mo ago (expiring soon!)
  {
    packet_id: "demo-pkt-006-robert", applicant_id: "app-006",
    status: "Handed Off", state_code: "CA", county: "San Diego", county_fips: "06073",
    is_expedited: false,
    submitted_at: monthsAgo(10), handed_off_at: monthsAgo(10), closed_at: null,
    created_at: monthsAgo(10), updated_at: monthsAgo(10), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[5]!.full_name_ciphertext, preferred_language: "en" },
  },
  // 7. Sofia — Handed Off 13mo ago (OVERDUE recert)
  {
    packet_id: "demo-pkt-007-sofia", applicant_id: "app-007",
    status: "Handed Off", state_code: "CA", county: "Riverside", county_fips: "06065",
    is_expedited: false,
    submitted_at: monthsAgo(13), handed_off_at: monthsAgo(13), closed_at: null,
    created_at: monthsAgo(13), updated_at: monthsAgo(13), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[6]!.full_name_ciphertext, preferred_language: "es" },
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
  // 10. Marcus — Closed (recertified)
  {
    packet_id: "demo-pkt-010-marcus", applicant_id: "app-010",
    status: "Closed", state_code: "CA", county: "Alameda", county_fips: "06001",
    is_expedited: false,
    submitted_at: monthsAgo(14), handed_off_at: monthsAgo(13), closed_at: daysAgo(15),
    created_at: monthsAgo(14), updated_at: daysAgo(15), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[9]!.full_name_ciphertext, preferred_language: "en" },
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
  // 12. Tomas — Handed Off 6mo ago
  {
    packet_id: "demo-pkt-012-tomas", applicant_id: "app-012",
    status: "Handed Off", state_code: "CA", county: "Fresno", county_fips: "06019",
    is_expedited: false,
    submitted_at: monthsAgo(6), handed_off_at: monthsAgo(6), closed_at: null,
    created_at: monthsAgo(6), updated_at: monthsAgo(6), deleted_at: null,
    applicants: { full_name_ciphertext: DEMO_APPLICANTS[11]!.full_name_ciphertext, preferred_language: "es" },
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
  return null;
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
