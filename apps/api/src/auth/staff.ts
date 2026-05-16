import type { MiddlewareHandler } from 'hono';
import type { StaffContext, StaffEnv } from './types.js';
import { verifySupabaseJwt } from './verify.js';

const VALID_STAFF_ROLES = new Set<StaffContext['role']>(['navigator', 'supervisor', 'admin']);

export const requireStaffJwt: MiddlewareHandler<StaffEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  let payload;
  try {
    payload = await verifySupabaseJwt(header.slice(7));
  } catch {
    return c.json({ error: 'invalid_token' }, 401);
  }

  // Hard wall: applicant JWTs (no staff role claim) are rejected on staff endpoints.
  const appMeta = payload['app_metadata'] as Record<string, unknown> | undefined;
  const role = appMeta?.['role'];
  if (typeof role !== 'string' || !VALID_STAFF_ROLES.has(role as StaffContext['role'])) {
    return c.json({ error: 'applicant_token_on_staff_endpoint' }, 401);
  }

  const email = payload['email'];
  if (typeof email !== 'string') {
    return c.json({ error: 'invalid_token' }, 401);
  }

  c.set('staff', {
    sub: payload.sub ?? '',
    email,
    role: role as StaffContext['role'],
  });

  await next();
};
