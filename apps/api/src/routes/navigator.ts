import { Hono } from 'hono';
import { requireStaffJwt } from '../auth/staff.js';
import type { StaffEnv } from '../auth/types.js';
import { navigatorRateLimit } from '../lib/rateLimit.js';

export const navigatorRoutes = new Hono<StaffEnv>();

navigatorRoutes.use('*', requireStaffJwt);
navigatorRoutes.use('*', navigatorRateLimit); // per-IP, runs after auth

// Endpoints land in Phase 14.
