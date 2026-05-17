import { Hono } from 'hono';
import { vi } from 'vitest';
import type { Actor, Env } from '../types.js';

export const TEST_ENV: Env = {
  SUPABASE_URL: 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key',
  SUPABASE_ANON_KEY: 'placeholder-anon-key',
  SNAP_FERNET_KEY: 'placeholder-fernet-key-32bytes!!',
};

export const NAVIGATOR: Actor = { kind: 'navigator', id: 'nav-001', orgId: 'org-001' };
export const APPLICANT: Actor = { kind: 'applicant', id: 'user-001' };

export type MockResult = { data: unknown; error: unknown; count?: number };

// A THENABLE query builder — awaitable to get `result`.
// All chained query methods return `this` so arbitrary chains work.
// IMPORTANT: do NOT use as the db-client root — Promise.resolve() will unwrap thenables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeQueryBuilder(result: MockResult): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qb: Record<string, any> = {};
  for (const m of [
    'select', 'eq', 'is', 'order', 'limit', 'insert', 'upsert',
    'update', 'delete', 'in', 'filter', 'neq', 'not', 'single', 'head',
  ]) {
    qb[m] = vi.fn().mockReturnValue(qb);
  }
  // Make the query builder awaitable (resolves to `result`)
  qb.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  qb.catch = (rej: (e: unknown) => unknown) => Promise.resolve(result).catch(rej);
  qb.finally = (fn: () => void) => Promise.resolve(result).finally(fn);
  return qb;
}

// A NON-THENABLE Supabase-like db client.
// Not thenable = Promise.resolve(makeDbClient(...)) wraps it correctly,
// so `await withActorContext(c)` returns the client itself (not `result`).
// All table queries resolve to `result` via a shared query builder.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeDbClient(result: MockResult): any {
  const qb = makeQueryBuilder(result);
  return {
    schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(qb) }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null, data: { path: 'test/path' } }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://example.com/dl' }, error: null,
        }),
      }),
    },
  };
}

// Wraps a router in a test Hono app that bypasses auth by injecting actor + jwt directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTestApp(router: Hono<any>, mountPath: string, actor: Actor): Hono<any> {
  const app = new Hono<{ Bindings: Env }>();
  app.use('*', async (c, next) => {
    c.set('actor', actor);
    c.set('jwt', 'test-jwt-token');
    await next();
  });
  app.route(mountPath, router);
  return app;
}

export const JSON_HEADERS = { 'Content-Type': 'application/json' };
