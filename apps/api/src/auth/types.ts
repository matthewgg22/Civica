import type { StaffRoleId } from '../db/schema.js';

export interface ApplicantContext {
  sub: string;
  email?: string;
  isAnonymous: boolean;
}

export interface StaffContext {
  sub: string;
  email: string;
  role: StaffRoleId;
  // snap_enrollment.staff_users.staff_id — required for FK references and audit actor_id.
  // Distinct from `sub` (which is the auth.users UUID).
  staffId: string;
}

// Hono env generics — imported by each route group.
export type ApplicantEnv = { Variables: { applicant: ApplicantContext } };
export type StaffEnv = { Variables: { staff: StaffContext } };
