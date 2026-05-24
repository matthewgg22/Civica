import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

const apnsMocks = vi.hoisted(() => ({
  sendDepositLanded: vi.fn().mockResolvedValue({ status: 'not-configured', attempts: 0, successes: 0 }),
  sendLowBalance: vi.fn().mockResolvedValue({ status: 'not-configured', attempts: 0, successes: 0 }),
  sendReLink: vi.fn().mockResolvedValue({ status: 'not-configured', attempts: 0, successes: 0 }),
}));
vi.mock('../../lib/apns-send.js', () => apnsMocks);

import { makeServiceClient } from '../../lib/supabase.js';
import webhooksRouter from './webhooks.js';
import {
  TEST_ENV,
  makeDbClient,
  makeQueryBuilder,
} from '../../test/helpers.js';
import type { Env } from '../../types.js';

afterEach(() => vi.resetAllMocks());

// vi.resetAllMocks() wipes the .mockResolvedValue defaults set in vi.hoisted,
// so re-arm the apns-send stubs before each test.
beforeEach(() => {
  apnsMocks.sendDepositLanded.mockResolvedValue({ status: 'not-configured', attempts: 0, successes: 0 });
  apnsMocks.sendLowBalance.mockResolvedValue({ status: 'not-configured', attempts: 0, successes: 0 });
  apnsMocks.sendReLink.mockResolvedValue({ status: 'not-configured', attempts: 0, successes: 0 });
});

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
    // 1: select ebt_deposits → existing row; 2: update ebt_deposits;
    // 3: lookupCardOwner (ebt_cards) → no row, push silently no-ops.
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
    // 1: select ebt_deposits → none; 2: insert ebt_deposits;
    // 3: lookupCardOwner (ebt_cards) → none, push no-ops.
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => makeQueryBuilder({ data: null, error: null })),
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

  it('low_balance_crossed → acks (push best-effort, APNS_* unset → not-configured)', async () => {
    // lookupCardOwner runs first; with no owner row the push silently
    // no-ops. TEST_ENV has no APNS_* anyway, so even with an owner the
    // send helper would return { status: 'not-configured' }.
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
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

  it('session_expired → acks (push best-effort, no owner row)', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const { app } = makeApp();
    const body = JSON.stringify({ type: 'session_expired', card_id: CARD_ID });
    const res = await app.request('/', { method: 'POST', body }, TEST_ENV);
    expect(res.status).toBe(200);
    const result = await res.json() as { action: string };
    expect(result.action).toBe('session_expired_pushed');
  });

  it('low_balance_crossed → looks up card owner and calls sendLowBalance(userId, threshold)', async () => {
    // ebt_cards lookup returns the owner row.
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: { user_id: 'user-abc' }, error: null }),
    );
    const { app } = makeApp();
    const body = JSON.stringify({
      type: 'low_balance_crossed',
      card_id: CARD_ID,
      balance_cents: 1000,
      threshold_cents: 2500,
    });
    const res = await app.request('/', { method: 'POST', body }, TEST_ENV);
    expect(res.status).toBe(200);

    expect(apnsMocks.sendLowBalance).toHaveBeenCalledTimes(1);
    const call = apnsMocks.sendLowBalance.mock.calls[0]![0] as {
      userId: string; thresholdCents: number;
    };
    expect(call.userId).toBe('user-abc');
    expect(call.thresholdCents).toBe(2500);
  });

  it('session_expired → looks up card owner and calls sendReLink(userId)', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: { user_id: 'user-xyz' }, error: null }),
    );
    const { app } = makeApp();
    const body = JSON.stringify({ type: 'session_expired', card_id: CARD_ID });
    const res = await app.request('/', { method: 'POST', body }, TEST_ENV);
    expect(res.status).toBe(200);

    expect(apnsMocks.sendReLink).toHaveBeenCalledTimes(1);
    const call = apnsMocks.sendReLink.mock.calls[0]![0] as { userId: string };
    expect(call.userId).toBe('user-xyz');
  });

  it('low_balance_crossed → skips push when card owner not found (no throw)', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: null, error: null }),
    );
    const { app } = makeApp();
    const body = JSON.stringify({
      type: 'low_balance_crossed',
      card_id: CARD_ID,
      balance_cents: 1000,
      threshold_cents: 2500,
    });
    const res = await app.request('/', { method: 'POST', body }, TEST_ENV);
    expect(res.status).toBe(200);
    expect(apnsMocks.sendLowBalance).not.toHaveBeenCalled();
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
