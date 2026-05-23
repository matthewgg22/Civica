import { describe, it, expect, vi, afterEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from '../../lib/supabase.js';
import webhooksRouter from './webhooks.js';
import {
  TEST_ENV,
  makeDbClient,
  makeQueryBuilder,
} from '../../test/helpers.js';
import type { Env } from '../../types.js';

afterEach(() => vi.resetAllMocks());

const CARD_ID = 'c0000000-0000-0000-0000-000000000001';
const SECRET = 'test-secret-12345';

// Webhook is auth-free aside from HMAC, so we don't need buildTestApp's
// actor-injection middleware — mount directly.
function makeApp(env: Env = TEST_ENV) {
  const app = new Hono<{ Bindings: Env }>();
  app.route('/', webhooksRouter);
  return { app, env };
}

async function signHmac(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function ENV_WITH_SECRET(): Env {
  return { ...TEST_ENV, EBT_SCRAPER_WEBHOOK_SECRET: SECRET };
}

describe('POST /webhooks/ebt-scraper — HMAC verification', () => {
  it('accepts when no secret is configured (dev/test parity with Argyle)', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const { app, env } = makeApp();
    const body = JSON.stringify({
      type: 'balance_updated',
      card_id: CARD_ID,
      balance_cents: 1000,
      balance_at: new Date().toISOString(),
    });
    const res = await app.request('/', { method: 'POST', body }, env);
    expect(res.status).toBe(200);
  });

  it('returns 401 when signature header is missing', async () => {
    const { app } = makeApp();
    const env = ENV_WITH_SECRET();
    const body = JSON.stringify({ type: 'session_expired', card_id: CARD_ID });
    const res = await app.request('/', { method: 'POST', body }, env);
    expect(res.status).toBe(401);
  });

  it('returns 401 when signature is malformed', async () => {
    const { app } = makeApp();
    const env = ENV_WITH_SECRET();
    const body = JSON.stringify({ type: 'session_expired', card_id: CARD_ID });
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'X-Civica-Signature': 'sha256=not-hex!!' },
      body,
    }, env);
    expect(res.status).toBe(401);
  });

  it('returns 401 when signature does not match', async () => {
    const { app } = makeApp();
    const env = ENV_WITH_SECRET();
    const body = JSON.stringify({ type: 'session_expired', card_id: CARD_ID });
    const badSig = await signHmac('wrong-secret', body);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'X-Civica-Signature': `sha256=${badSig}` },
      body,
    }, env);
    expect(res.status).toBe(401);
  });

  it('accepts when signature matches', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const { app } = makeApp();
    const env = ENV_WITH_SECRET();
    const body = JSON.stringify({ type: 'session_expired', card_id: CARD_ID });
    const sig = await signHmac(SECRET, body);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'X-Civica-Signature': `sha256=${sig}` },
      body,
    }, env);
    expect(res.status).toBe(200);
  });
});

describe('POST /webhooks/ebt-scraper — payload validation', () => {
  it('returns 400 for invalid JSON', async () => {
    const { app } = makeApp();
    const res = await app.request('/', { method: 'POST', body: 'not-json' }, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown event type', async () => {
    const { app } = makeApp();
    const body = JSON.stringify({ type: 'something_else', card_id: CARD_ID });
    const res = await app.request('/', { method: 'POST', body }, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 when card_id is not a UUID', async () => {
    const { app } = makeApp();
    const body = JSON.stringify({
      type: 'balance_updated',
      card_id: 'not-a-uuid',
      balance_cents: 1,
      balance_at: new Date().toISOString(),
    });
    const res = await app.request('/', { method: 'POST', body }, TEST_ENV);
    expect(res.status).toBe(400);
  });
});

describe('POST /webhooks/ebt-scraper — event handling', () => {
  it('balance_updated → updates ebt_cards', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const { app } = makeApp();
    const body = JSON.stringify({
      type: 'balance_updated',
      card_id: CARD_ID,
      balance_cents: 23200,
      balance_at: '2026-05-22T12:00:00Z',
    });
    const res = await app.request('/', { method: 'POST', body }, TEST_ENV);
    expect(res.status).toBe(200);
    const result = await res.json() as { ok: boolean; action: string };
    expect(result.action).toBe('balance_updated');
  });

  it('transactions_added → bulk-inserts and reports count', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const { app } = makeApp();
    const body = JSON.stringify({
      type: 'transactions_added',
      card_id: CARD_ID,
      transactions: [
        {
          posted_at: '2026-05-22T10:00:00Z',
          amount_cents: -1234,
          merchant: 'SAFEWAY',
          category: 'groceries',
          raw_description: 'EBT PURCHASE',
        },
        {
          posted_at: '2026-05-22T11:00:00Z',
          amount_cents: -567,
          merchant: 'TARGET',
          category: 'groceries',
          raw_description: 'EBT PURCHASE',
          state_code_match: 'CA',
        },
      ],
    });
    const res = await app.request('/', { method: 'POST', body }, TEST_ENV);
    expect(res.status).toBe(200);
    const result = await res.json() as { ok: boolean; inserted: number };
    expect(result.inserted).toBe(2);
  });

  it('transactions_added → reports 0 when array is empty (no DB call)', async () => {
    const { app } = makeApp();
    const body = JSON.stringify({
      type: 'transactions_added',
      card_id: CARD_ID,
      transactions: [],
    });
    const res = await app.request('/', { method: 'POST', body }, TEST_ENV);
    expect(res.status).toBe(200);
    const result = await res.json() as { inserted: number };
    expect(result.inserted).toBe(0);
  });

  it('deposit_posted → updates existing deposit row and acks', async () => {
    // First call returns existing deposit row; second is the update.
    let calls = 0;
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          calls++;
          if (calls === 1) return makeQueryBuilder({ data: { id: 'dep-1' }, error: null });
          return makeQueryBuilder({ data: null, error: null });
        }),
      }),
      rpc: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { app } = makeApp();
    const body = JSON.stringify({
      type: 'deposit_posted',
      card_id: CARD_ID,
      scheduled_for: '2026-06-01',
      amount_cents: 23200,
      posted_at: '2026-06-01T06:30:00Z',
    });
    const res = await app.request('/', { method: 'POST', body }, TEST_ENV);
    expect(res.status).toBe(200);
    const result = await res.json() as { action: string };
    expect(result.action).toBe('deposit_posted');
  });

  it('deposit_posted → inserts when no existing scheduled row', async () => {
    let calls = 0;
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          calls++;
          if (calls === 1) return makeQueryBuilder({ data: null, error: null });
          return makeQueryBuilder({ data: null, error: null });
        }),
      }),
      rpc: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { app } = makeApp();
    const body = JSON.stringify({
      type: 'deposit_posted',
      card_id: CARD_ID,
      scheduled_for: '2026-06-01',
      amount_cents: 23200,
      posted_at: '2026-06-01T06:30:00Z',
    });
    const res = await app.request('/', { method: 'POST', body }, TEST_ENV);
    expect(res.status).toBe(200);
  });

  it('low_balance_crossed → acks (mock APNs send)', async () => {
    const { app } = makeApp();
    const body = JSON.stringify({
      type: 'low_balance_crossed',
      card_id: CARD_ID,
      balance_cents: 1000,
      threshold_cents: 2500,
    });
    const res = await app.request('/', { method: 'POST', body }, TEST_ENV);
    expect(res.status).toBe(200);
    const result = await res.json() as { action: string };
    expect(result.action).toBe('low_balance_pushed');
  });

  it('session_expired → acks (mock re-link APNs)', async () => {
    const { app } = makeApp();
    const body = JSON.stringify({ type: 'session_expired', card_id: CARD_ID });
    const res = await app.request('/', { method: 'POST', body }, TEST_ENV);
    expect(res.status).toBe(200);
    const result = await res.json() as { action: string };
    expect(result.action).toBe('session_expired_pushed');
  });

  it('scrape_error → logs and acks with code echoed back', async () => {
    const { app } = makeApp();
    const body = JSON.stringify({
      type: 'scrape_error',
      card_id: CARD_ID,
      code: 'captcha',
      message: 'Portal challenged',
    });
    const res = await app.request('/', { method: 'POST', body }, TEST_ENV);
    expect(res.status).toBe(200);
    const result = await res.json() as { action: string; code: string };
    expect(result.action).toBe('scrape_error_logged');
    expect(result.code).toBe('captcha');
  });

  it('balance_updated → returns 500 when DB write fails', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({
      data: null,
      error: { message: 'boom' },
    }));
    const { app } = makeApp();
    const body = JSON.stringify({
      type: 'balance_updated',
      card_id: CARD_ID,
      balance_cents: 1,
      balance_at: new Date().toISOString(),
    });
    const res = await app.request('/', { method: 'POST', body }, TEST_ENV);
    expect(res.status).toBe(500);
  });
});
