// Canonical source: packages/snap-enums/src/packetStatus.ts
// Inlined here because apps/api uses moduleResolution:NodeNext which cannot
// resolve workspace packages that export raw .ts source files. Remove this
// file and replace with a workspace import once snap-enums has a build step
// that emits .d.ts declarations (or once apps/api switches to bundler resolution).

export const PACKET_STATUSES = [
  "Draft",
  "Submitted for Review",
  "Needs Documents",
  "Needs Applicant Clarification",
  "In Navigator Review",
  "Ready for Handoff",
  "Handed Off",
  "Closed",
] as const;

export type PacketStatus = (typeof PACKET_STATUSES)[number];

export const PACKET_STATUS_TRANSITIONS: Record<PacketStatus, readonly PacketStatus[]> = {
  "Draft": ["Submitted for Review"],
  "Submitted for Review": ["In Navigator Review", "Needs Documents", "Needs Applicant Clarification"],
  "Needs Documents": ["In Navigator Review", "Needs Applicant Clarification"],
  "Needs Applicant Clarification": ["In Navigator Review", "Needs Documents"],
  "In Navigator Review": ["Ready for Handoff", "Needs Documents", "Needs Applicant Clarification"],
  "Ready for Handoff": ["Handed Off"],
  "Handed Off": ["Closed"],
  "Closed": [],
};
