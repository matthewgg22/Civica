import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineClient, _resetEngineClientCache, getEngineClient } from './engineClient.js';

const TEST_BASE = 'http://engine.internal';
const TEST_SECRET = 'test-hmac-secret-32-bytes-minimum!';

// ── Mock fetch helper ──────────────────────────────────────────────────────

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

function mockFetch(status = 200, body: unknown = { ok: true }) {
  const captured: CapturedRequest[] = [];

  const fn: typeof globalThis.fetch = async (url, init = {}) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers as ConstructorParameters<typeof Headers>[0]).forEach((v, k) => {
      headers[k] = v;
    });
    captured.push({
      url: url as string,
      method: (init?.method ?? 'GET') as string,
      headers,
      body: (init?.body as string | undefined) ?? null,
    });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  return { fn, captured };
}

function makeClient(fetchFn: typeof globalThis.fetch) {
  return new EngineClient({ baseUrl: TEST_BASE, hmacSecret: TEST_SECRET, fetch: fetchFn });
}

function expectedSig(timestamp: string, method: string, path: string, body: string): string {
  return createHmac('sha256', TEST_SECRET)
    .update(`${timestamp}.${method}.${path}.${body}`)
    .digest('hex');
}

// ── Header propagation ────────────────────────────────────────────────────

describe('GET request headers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sets X-Internal-Actor', async () => {
    const { fn, captured } = mockFetch();
    await makeClient(fn).get('/snap/sessions', 'user-sub-1');
    expect(captured[0]?.headers['x-internal-actor']).toBe('user-sub-1');
  });

  it('sets X-Internal-Request-Id to a UUID when not provided', async () => {
    const { fn, captured } = mockFetch();
    await makeClient(fn).get('/snap/sessions', 'user-sub-1');
    expect(captured[0]?.headers['x-internal-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('forwards a caller-supplied request ID', async () => {
    const { fn, captured } = mockFetch();
    await makeClient(fn).get('/snap/sessions', 'user-sub-1', 'my-req-id');
    expect(captured[0]?.headers['x-internal-request-id']).toBe('my-req-id');
  });

  it('sets X-Internal-Timestamp as unix seconds', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { fn, captured } = mockFetch();
    await makeClient(fn).get('/path', 'actor');
    expect(captured[0]?.headers['x-internal-timestamp']).toBe('1767225600');
  });

  it('sets a correct HMAC-SHA256 X-Internal-Signature for GET', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { fn, captured } = mockFetch();
    await makeClient(fn).get('/snap/sessions', 'actor');
    const ts = '1767225600';
    const expected = expectedSig(ts, 'GET', '/snap/sessions', '');
    expect(captured[0]?.headers['x-internal-signature']).toBe(expected);
  });
});

// ── POST body + signature ─────────────────────────────────────────────────

describe('POST request', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('serialises body as JSON', async () => {
    const { fn, captured } = mockFetch();
    await makeClient(fn).post('/snap/sessions', { state: 'CA', language: 'en' }, 'actor');
    expect(captured[0]?.body).toBe('{"state":"CA","language":"en"}');
  });

  it('includes body in HMAC signature', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { fn, captured } = mockFetch();
    const body = { state: 'CA', language: 'en' };
    await makeClient(fn).post('/snap/sessions', body, 'actor');
    const ts = '1767225600';
    const expected = expectedSig(ts, 'POST', '/snap/sessions', JSON.stringify(body));
    expect(captured[0]?.headers['x-internal-signature']).toBe(expected);
  });

  it('different bodies produce different signatures', async () => {
    const client = makeClient(mockFetch().fn);
    const sig1 = client.sign('1000', 'POST', '/path', '{"a":1}');
    const sig2 = client.sign('1000', 'POST', '/path', '{"a":2}');
    expect(sig1).not.toBe(sig2);
  });
});

// ── URL construction ──────────────────────────────────────────────────────

describe('URL construction', () => {
  it('concatenates baseUrl and path', async () => {
    const { fn, captured } = mockFetch();
    await makeClient(fn).get('/snap/sessions/abc', 'actor');
    expect(captured[0]?.url).toBe('http://engine.internal/snap/sessions/abc');
  });

  it('strips trailing slash from baseUrl', async () => {
    const { fn, captured } = mockFetch();
    const client = new EngineClient({
      baseUrl: 'http://engine.internal/',
      hmacSecret: TEST_SECRET,
      fetch: fn,
    });
    await client.get('/snap/sessions', 'actor');
    expect(captured[0]?.url).toBe('http://engine.internal/snap/sessions');
  });
});

// ── Response mapping ──────────────────────────────────────────────────────

describe('EngineResponse shape', () => {
  it('ok is true for 2xx', async () => {
    const { fn } = mockFetch(200, { session_id: 'abc' });
    const res = await makeClient(fn).get('/path', 'actor');
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ session_id: 'abc' });
  });

  it('ok is false for 4xx', async () => {
    const { fn } = mockFetch(404, { detail: 'not found' });
    const res = await makeClient(fn).get('/path', 'actor');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });
});

// ── Singleton factory ─────────────────────────────────────────────────────

describe('getEngineClient()', () => {
  beforeEach(() => {
    _resetEngineClientCache();
    vi.stubEnv('ENGINE_BASE_URL', TEST_BASE);
    vi.stubEnv('INTERNAL_HMAC_SECRET', TEST_SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    _resetEngineClientCache();
  });

  it('returns an EngineClient when env vars are set', () => {
    expect(getEngineClient()).toBeInstanceOf(EngineClient);
  });

  it('returns the same instance on repeated calls', () => {
    expect(getEngineClient()).toBe(getEngineClient());
  });

  it('throws when ENGINE_BASE_URL is missing', () => {
    vi.stubEnv('ENGINE_BASE_URL', '');
    _resetEngineClientCache();
    expect(() => getEngineClient()).toThrow('ENGINE_BASE_URL is required');
  });

  it('throws when INTERNAL_HMAC_SECRET is missing', () => {
    vi.stubEnv('INTERNAL_HMAC_SECRET', '');
    _resetEngineClientCache();
    expect(() => getEngineClient()).toThrow('INTERNAL_HMAC_SECRET is required');
  });
});
