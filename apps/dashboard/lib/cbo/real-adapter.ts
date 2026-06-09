// Phase-2 real adapter — maps live enrollment-api / Supabase data into the SAME
// view-model the synthetic /cbo-preview cards consume (CaseAssignment / BuddyLink
// / PortalAutofill). The authenticated /cbo route renders the same prop-only
// cards (CaseAssignmentCard / BuddyLinkCard / PortalAutofillCard) off this output.
//
// Honest about the current backend: the dual-approval + consent STATE model
// (plan T9) isn't built yet, and the answer→BenefitsCal field mapping lives in
// the submitter extension, not the dashboard. So this adapter:
//   - maps assignment + buddy from real data, and
//   - derives the portal approval gate from PROXIES that exist today
//     (BenefitsCal consent + submission state), documented per field.
// When T9 lands, swap the proxy logic for the real approval rows.
//
// PII note: the caseworker buddy read (GET /packets/:id/buddies) is
// column-restricted — no helper name/uid — so the real buddy card shows a
// generic "Linked helper", not a name. That's intentional, not a gap.

import type { CaseAssignment, BuddyLink, PortalAutofill } from "./demo-pipeline";

// ── Input shapes (the subset of the real API responses we read) ────────────

export interface RealPacketAssignment {
  is_current?: boolean | null;
  assigned_at?: string | null;
  staff_users?: { display_name?: string | null } | null;
}

export interface RealPacket {
  status?: string | null;
  packet_assignments?: RealPacketAssignment[] | null;
  required_document_items?: unknown[] | null;
}

export interface RealBuddyRow {
  relationship_id: string;
  status: string; // active | pending | completed | revoked
  org_linked: boolean;
  last_active: string; // ISO
}

export interface RealBenefitsCalStatus {
  status?: string | null; // pending_review | queued | running | succeeded | submitted | failed | cancelled
  consent_type?: "in_person" | "telephonic" | "async_portal" | null;
}

export interface CboCaseViewModel {
  assignment: CaseAssignment;
  buddy: BuddyLink;
  portal: PortalAutofill;
}

// ── Assignment ─────────────────────────────────────────────────────────────
// Caseworker = the staff member on the current packet_assignment; status is
// derived from the packet's lifecycle status (gateway PacketStatus enum).

const REVIEWING_STATUSES = new Set([
  "In Navigator Review",
  "Needs Documents",
  "Needs Applicant Clarification",
  "Submitted for Review",
]);
const APPROVED_STATUSES = new Set(["Ready for Handoff", "Handed Off", "Closed"]);

export function toAssignment(packet: RealPacket): CaseAssignment {
  const current = (packet.packet_assignments ?? []).find((a) => a?.is_current);
  if (!current) {
    return { caseworker: "Unassigned", status: "unassigned", assignedAt: null };
  }
  const packetStatus = packet.status ?? "";
  const status: CaseAssignment["status"] = APPROVED_STATUSES.has(packetStatus)
    ? "approved"
    : REVIEWING_STATUSES.has(packetStatus)
      ? "reviewing"
      : "assigned"; // Draft / unknown → assigned-but-not-yet-in-review
  return {
    caseworker: current.staff_users?.display_name ?? "Assigned caseworker",
    status,
    assignedAt: current.assigned_at ?? null,
  };
}

// ── Buddy ───────────────────────────────────────────────────────────────────
// Pick the most relevant relationship (active > pending > the rest). The PII-safe
// endpoint exposes no helper name, so helperName is a generic label; relationship
// is a heuristic from org linkage (org_linked → came via a CBO/navigator org).

const BUDDY_STATUS: Record<string, BuddyLink["status"]> = {
  active: "active",
  pending: "pending",
  completed: "completed",
  revoked: "completed", // terminal → reads as completed
};

export function toBuddy(buddies: RealBuddyRow[]): BuddyLink {
  if (!buddies || buddies.length === 0) {
    return { helperName: "", relationship: "family", status: "none", lastActive: "" };
  }
  const rank = (s: string) => (s === "active" ? 0 : s === "pending" ? 1 : 2);
  const pick = [...buddies].sort((a, b) => rank(a.status) - rank(b.status))[0];
  const status = BUDDY_STATUS[pick.status] ?? "none";
  if (status === "none") {
    return { helperName: "", relationship: "family", status: "none", lastActive: "" };
  }
  return {
    helperName: "Linked helper", // column-restricted — no PII name available
    relationship: pick.org_linked ? "navigator" : "friend",
    status,
    lastActive: pick.last_active ? pick.last_active.slice(0, 10) : "",
  };
}

// ── Portal autofill gate ─────────────────────────────────────────────────────
// PROXY LOGIC until T9 (dual-approval state) lands:
//   - consent: BenefitsCal consent_type (the real recorded consent).
//   - applicantApproved: consent recorded is the closest existing proxy for
//     applicant sign-off (no applicant-approval row exists yet).
//   - cboApproved: a BenefitsCal submission that the navigator has prepared or
//     pushed (any non-failed/cancelled state) proxies CBO approval.
// The answer→field mapping is performed by the submitter extension on the live
// portal, NOT here, so fieldMap is empty on the real card; docCount surfaces the
// number of required document items so the gate still shows attachment context.

const CBO_APPROVED_SUBMISSION_STATUSES = new Set([
  "pending_review",
  "queued",
  "running",
  "succeeded",
  "submitted",
]);

export function toPortal(
  packet: RealPacket,
  benefitsCal: RealBenefitsCalStatus | null,
): PortalAutofill {
  const consent = benefitsCal?.consent_type ?? null;
  const cboApproved = Boolean(
    benefitsCal?.status && CBO_APPROVED_SUBMISSION_STATUSES.has(benefitsCal.status),
  );
  const applicantApproved = consent !== null; // proxy until T9
  const docCount = Array.isArray(packet.required_document_items)
    ? packet.required_document_items.length
    : 0;
  return { applicantApproved, cboApproved, consent, fieldMap: [], docCount };
}

// ── Top-level ────────────────────────────────────────────────────────────────

export function adaptCboCase(
  packet: RealPacket,
  buddies: RealBuddyRow[],
  benefitsCal: RealBenefitsCalStatus | null,
): CboCaseViewModel {
  return {
    assignment: toAssignment(packet),
    buddy: toBuddy(buddies),
    portal: toPortal(packet, benefitsCal),
  };
}
