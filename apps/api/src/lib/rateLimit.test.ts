import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStore, rateLimit } from './rateLimit.js';

// ── InMemoryStore ─────────────────────────────────────────────────────────

describe('InMemoryStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('increments count within the window', async () => {
    const store = new InMemoryStore();
    const { count: c1 } = await store.increment('key', 60_000);
    const { count: c2 } = await store.increment('key', 60_000);
    expect(c1).toBe(1);
    expect(c2).toBe(2);
  });

  it('resets after the window expires', async () => {
    const store = new InMemoryStore();
    await store.increment('key', 1_000);
    vi.advanceTimersByTime(1_001);
    const { count } = await store.increment('key', 1_000);
    expect(count).toBe(1);
  });

  it('tracks separate keys independently', async () => {
    const store = new InMemoryStore();
    await store.increment('a', 60_000);
    await store.increment('a', 60_000);
    const { count } = await store.increment('b', 60_000);
    expect(count).toBe(1);
  });

  it('cleanup() removes expired windows', async () => {
    const store = new InMemoryStore();
    await store.increment('expiring', 100);
    vi.advanceTimersByTime(200);
    store.cleanup();
    // After cleanup, next increment should start a fresh window
    const { count } = await store.increment('expiring', 100);
    expect(count).toBe(1);
  });

  it('resetAt is within the expected window', async () => {
    const store = new InMemoryStore();
    const before = Date.now();
    const { resetAt } = await store.increment('key', 5_000);
    const after = Date.now();
    expect(resetAt.getTime()).toBeGreaterThanOrEqual(before + 5_000);
    expect(resetAt.getTime()).toBeLessThanOrEqual(after + 5_000 + 10);
  });
});

// ── rateLimit middleware ───────────────────────────────────────────────────

function makeApp(max: number, store = new InMemoryStore()) {
  const app = new Hono();
  app.use(
    '*',
    rateLimit({ windowMs: 60_000, max, keyFn: (c) => c.req.header('x-user-id') ?? 'anon', store }),
  );
  app.get('/test', (c) => c.json({ ok: true }));
  return app;
}

describe('rateLimit middleware', () => {
  it('passes requests under the limit with 200', async () => {
    const app = makeApp(5);
    const res = await app.request('/test', { headers: { 'x-user-id': 'u1' } });
    expect(res.status).toBe(200);
  });

  it('returns 429 when limit is exceeded', async () => {
    const store = new InMemoryStore();
    const app = makeApp(2, store);
    await app.request('/test', { headers: { 'x-user-id': 'u2' } });
    await app.request('/test', { headers: { 'x-user-id': 'u2' } });
    const res = await app.request('/test', { headers: { 'x-user-id': 'u2' } });
    expect(res.status).toBe(429);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('rate_limited');
  });

  it('429 response includes Retry-After header', async () => {
    const store = new InMemoryStore();
    const app = makeApp(1, store);
    await app.request('/test', { headers: { 'x-user-id': 'u3' } });
    const res = await app.request('/test', { headers: { 'x-user-id': 'u3' } });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('successful response includes X-RateLimit headers', async () => {
    const store = new InMemoryStore();
    const app = makeApp(10, store);
    const res = await app.request('/test', { headers: { 'x-user-id': 'u4' } });
    expect(res.headers.get('x-ratelimit-limit')).toBe('10');
    expect(res.headers.get('x-ratelimit-remaining')).toBe('9');
    expect(res.headers.get('x-ratelimit-reset')).toBeTruthy();
  });

  it('different keys have independent buckets', async () => {
    const store = new InMemoryStore();
    const app = makeApp(1, store);
    // Exhaust userA's bucket
    await app.request('/test', { headers: { 'x-user-id': 'userA' } });
    const resA = await app.request('/test', { headers: { 'x-user-id': 'userA' } });
    // userB is unaffected
    const resB = await app.request('/test', { headers: { 'x-user-id': 'userB' } });
    expect(resA.status).toBe(429);
    expect(resB.status).toBe(200);
  });
});
