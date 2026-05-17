import { z } from "zod";

// Canonical 8-state SNAP enrollment packet lifecycle.
// Matches the `packet_status` enum in supabase/migrations/
// 20260516_snap_enrollment_01_types_and_extensions.sql.
//
// If you change values here, also update:
//   - the Postgres enum in the migration (add a new migration; never ALTER enum in place)
//   - PacketStatus.swift in Civica/Features/SNAP/

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

export const PacketStatusSchema = z.enum(PACKET_STATUSES);
export type PacketStatus = z.infer<typeof PacketStatusSchema>;

/** Valid forward transitions for each status. */
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
