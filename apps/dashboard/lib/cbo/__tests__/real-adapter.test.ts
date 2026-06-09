import { describe, it, expect } from "vitest";
import {
  toAssignment,
  toBuddy,
  toPortal,
  adaptCboCase,
  type RealPacket,
  type RealBuddyRow,
} from "../real-adapter";

describe("real-adapter — toAssignment", () => {
  it("unassigned when there is no current assignment", () => {
    expect(toAssignment({ status: "Draft", packet_assignments: [] })).toEqual({
      caseworker: "Unassigned",
      status: "unassigned",
      assignedAt: null,
    });
  });

  it("maps the current assignment + caseworker display name", () => {
    const packet: RealPacket = {
      status: "In Navigator Review",
      packet_assignments: [
        { is_current: false, staff_users: { display_name: "Old Nav" } },
        { is_current: true, assigned_at: "2026-06-01T00:00:00Z", staff_users: { display_name: "R. Okafor" } },
      ],
    };
    expect(toAssignment(packet)).toEqual({
      caseworker: "R. Okafor",
      status: "reviewing",
      assignedAt: "2026-06-01T00:00:00Z",
    });
  });

  it("derives approved/reviewing/assigned from packet status", () => {
    const mk = (status: string): RealPacket => ({
      status,
      packet_assignments: [{ is_current: true, staff_users: { display_name: "N" } }],
    });
    expect(toAssignment(mk("Ready for Handoff")).status).toBe("approved");
    expect(toAssignment(mk("Handed Off")).status).toBe("approved");
    expect(toAssignment(mk("Needs Documents")).status).toBe("reviewing");
    expect(toAssignment(mk("Draft")).status).toBe("assigned");
  });

  it("falls back to a generic caseworker label when display_name is missing", () => {
    const packet: RealPacket = {
      status: "Draft",
      packet_assignments: [{ is_current: true, staff_users: null }],
    };
    expect(toAssignment(packet).caseworker).toBe("Assigned caseworker");
  });
});

describe("real-adapter — toBuddy", () => {
  it("none when there are no buddies", () => {
    expect(toBuddy([])).toEqual({ helperName: "", relationship: "family", status: "none", lastActive: "" });
  });

  it("prefers an active relationship and uses a PII-safe generic name", () => {
    const buddies: RealBuddyRow[] = [
      { relationship_id: "1", status: "pending", org_linked: false, last_active: "2026-06-02T10:00:00Z" },
      { relationship_id: "2", status: "active", org_linked: true, last_active: "2026-06-05T10:00:00Z" },
    ];
    expect(toBuddy(buddies)).toEqual({
      helperName: "Linked helper",
      relationship: "navigator", // org_linked → came via an org
      status: "active",
      lastActive: "2026-06-05",
    });
  });

  it("maps revoked → completed and non-org → friend", () => {
    const b = toBuddy([{ relationship_id: "1", status: "revoked", org_linked: false, last_active: "2026-06-01T00:00:00Z" }]);
    expect(b.status).toBe("completed");
    expect(b.relationship).toBe("friend");
  });
});

describe("real-adapter — toPortal (proxy gate until T9)", () => {
  it("locked when there is no BenefitsCal submission", () => {
    const p = toPortal({ required_document_items: [{}, {}] }, null);
    expect(p).toEqual({
      applicantApproved: false,
      cboApproved: false,
      consent: null,
      fieldMap: [],
      docCount: 2,
    });
  });

  it("consent proxies applicant approval; an active submission proxies CBO approval", () => {
    const p = toPortal({ required_document_items: [] }, { status: "queued", consent_type: "telephonic" });
    expect(p.applicantApproved).toBe(true); // consent recorded
    expect(p.cboApproved).toBe(true); // submission in an approved state
    expect(p.consent).toBe("telephonic");
  });

  it("a failed submission does not count as CBO approval", () => {
    const p = toPortal({}, { status: "failed", consent_type: "telephonic" });
    expect(p.cboApproved).toBe(false);
    expect(p.applicantApproved).toBe(true); // consent still recorded
  });

  it("field mapping is empty on the real card (the extension fills the live portal)", () => {
    expect(toPortal({}, { status: "succeeded", consent_type: "in_person" }).fieldMap).toEqual([]);
  });
});

describe("real-adapter — adaptCboCase", () => {
  it("assembles the full view-model", () => {
    const vm = adaptCboCase(
      { status: "Handed Off", packet_assignments: [{ is_current: true, staff_users: { display_name: "L. Park" } }], required_document_items: [{}] },
      [{ relationship_id: "1", status: "active", org_linked: false, last_active: "2026-06-05T00:00:00Z" }],
      { status: "succeeded", consent_type: "async_portal" },
    );
    expect(vm.assignment.status).toBe("approved");
    expect(vm.buddy.status).toBe("active");
    expect(vm.portal.applicantApproved && vm.portal.cboApproved).toBe(true);
    expect(vm.portal.docCount).toBe(1);
  });
});
