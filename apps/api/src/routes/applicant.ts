import { Hono } from 'hono';
import { requireApplicantJwt } from '../auth/applicant.js';
import type { ApplicantEnv } from '../auth/types.js';

export const applicantRoutes = new Hono<ApplicantEnv>();

applicantRoutes.use('*', requireApplicantJwt);

// Endpoints land in Phase 13.
