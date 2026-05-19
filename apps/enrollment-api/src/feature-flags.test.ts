import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('./lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from './lib/supabase.js';
import featureFlagsRouter from './routes/feature-flags.js';
import { Hono } from 'hono';
import type { Env, Variables } from './types.js';

const TEST_ENV: Env = {
  SUPABASE_URL: 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key',
  SUPABASE_ANON_KEY: 'placeholder-anon-key',
  SNAP_FERNET_KEY: 'placeholder-fernet-key-32bytes!!',
  SENTRY_DSN: '',
};

afterEach(() => vi.resetAllMocks());

// Minimal Supabase mock — `from('feature_flags').select(...).in(...)` is the
// query chain. Returns the supplied result when awaited.
function makeFlagsClient(result: { data: unknown; error: unknown }) {
  const qb: Record<string, unknown> = {};
  for (const m of ['select', 'in', 'eq']) {
    qb[m] = vi.fn().mockReturnValue(qb);
  }
  (qb as { then: unknown }).then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return {
    from: vi.fn().mockReturnValue(qb),
  };
}

function buildApp(): Hono<{ Bindings: Env; Variables: Variables }> {
  const a = new Hono<{ Bindings: Env; Variables: Variables }>();
  a.use('*', async (c, next) => {
    c.set('log', {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    });
    c.set('requestId', 'test');
    await next();
  });
  a.route('/v1/enrollment/feature-flags', featureFlagsRouter);
  return a;
}

describe('GET /v1/enrollment/feature-flags', () => {
  it('returns DB-backed value when flag row exists', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(
      makeFlagsClient({
        data: [{ key: 'lpie_auto_exempt_enabled', enabled: false }],
        error: null,
      }) as never,
    );
    const res = await buildApp().request('/v1/enrollment/feature-flags', { method: 'GET' }, TEST_ENV);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ lpie_auto_exempt_enabled: false });
  });

  it('falls back to defaults when row is missing', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(
      makeFlagsClient({ data: [], error: null }) as never,
    );
    const res = await buildApp().request('/v1/enrollment/feature-flags', { method: 'GET' }, TEST_ENV);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ lpie_auto_exempt_enabled: true });
  });

  it('falls back to defaults on DB read error', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(
      makeFlagsClient({ data: null, error: { message: 'boom' } }) as never,
    );
    const res = await buildApp().request('/v1/enrollment/feature-flags', { method: 'GET' }, TEST_ENV);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ lpie_auto_exempt_enabled: true });
  });
});
