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
}

// Hono env generics — imported by each route group.
export type ApplicantEnv = { Variables: { applicant: ApplicantContext } };
export type StaffEnv = { Variables: { staff: StaffContext } };
