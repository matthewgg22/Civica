import { Hono } from 'hono';
import { requireStaffJwt } from '../auth/staff.js';
import type { StaffEnv } from '../auth/types.js';

export const navigatorRoutes = new Hono<StaffEnv>();

navigatorRoutes.use('*', requireStaffJwt);

// Endpoints land in Phase 14.
