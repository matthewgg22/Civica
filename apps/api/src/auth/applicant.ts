import type { MiddlewareHandler } from 'hono';
import type { ApplicantEnv } from './types.js';
import { verifySupabaseJwt } from './verify.js';

const STAFF_ROLES = new Set(['navigator', 'supervisor', 'admin']);

export const requireApplicantJwt: MiddlewareHandler<ApplicantEnv> = async (c, next) => {
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

  // Hard wall: staff JWTs are rejected on applicant endpoints.
  const appMeta = payload['app_metadata'] as Record<string, unknown> | undefined;
  if (appMeta && typeof appMeta['role'] === 'string' && STAFF_ROLES.has(appMeta['role'])) {
    return c.json({ error: 'staff_token_on_applicant_endpoint' }, 401);
  }

  c.set('applicant', {
    sub: payload.sub ?? '',
    isAnonymous: typeof payload['email'] !== 'string',
    ...(typeof payload['email'] === 'string' && { email: payload['email'] }),
  });

  await next();
};
