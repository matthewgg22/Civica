import { Hono } from 'hono';
import { requireApplicantJwt } from '../auth/applicant.js';
import type { ApplicantEnv } from '../auth/types.js';
import { applicantRateLimit } from '../lib/rateLimit.js';

export const applicantRoutes = new Hono<ApplicantEnv>();

applicantRoutes.use('*', requireApplicantJwt);
applicantRoutes.use('*', applicantRateLimit); // per-user, runs after auth sets c.var.applicant

// Endpoints land in Phase 13.
