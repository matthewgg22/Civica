/**
 * ebt-dispatch — pgsodium decrypt-before-dispatch (T3) tests.
 *
 * The plaintext cookie MUST be obtained via the decrypt_session_cookie RPC,
 * not by JSON.parse-ing the ciphertext column directly. These tests pin:
 *   1. dispatchScrapeRefresh fetches the card row, calls decrypt RPC with
 *      the ciphertext from session_cookie_encrypted, JSON.parses the
 *      RPC's plaintext output, and POSTs cookies to the scraper.
 *   2. When decrypt RPC fails, we return { dispatched: false } with a
 *      decrypt-specific reason instead of silently dispatching garbage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from './supabase.js';
import { dispatchScrapeRefresh } from './ebt-dispatch.js';
import { TEST_ENV } from '../test/helpers.js';
import type { Env } from '../types.js';

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

const CARD_ID = 'c0000000-0000-0000-0000-000000000001';
const USER_ID = 'user-001';
const CIPHERTEXT = 'pgs1:Y2lwaGVydGV4dA==';
const PLAINTEXT = JSON.stringify([
  { name: 'JSESSIONID', value: 'abc123', domain: '.ebt.ca.gov', path: '/', expires: -1 },
]);

const ENV_WITH_DISPATCH: Env = {
  ...TEST_ENV,
  EBT_SCRAPER_DISPATCH_URL: 'https://scraper.example.com/scrape',
  EBT_SCRAPER_WEBHOOK_SECRET: 'shared-secret',
};

/**
 * Build a fake supabase client whose .from('ebt_cards').select(...).eq(...).
 * single() returns the canned row, and whose .rpc() returns the canned
 * decrypt response.
 */
function makeDispatchClient(opts: {
  row: { data: unknown; error: unknown };
  rpcResult: { data: string | null; error: unknown };
  capturedRpc?: { calls: Array<{ name: string; args: unknown }> };
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qb: Record<string, any> = {};
  for (const m of ['select', 'eq', 'is', 'order', 'limit', 'single', 'maybeSingle']) {
    qb[m] = vi.fn().mockReturnValue(qb);
  }
  qb.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(opts.row).then(res, rej);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = vi.fn().mockImplementation((name: string, args: any) => {
    opts.capturedRpc?.calls.push({ name, args });
    return Promise.resolve(opts.rpcResult);
  });

  return {
    schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(qb) }),
    rpc,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('dispatchScrapeRefresh — decrypt before dispatch', () => {
  it('calls decrypt_session_cookie RPC with the ciphertext from the card row', async () => {
    const capturedRpc = { calls: [] as Array<{ name: string; args: unknown }> };
    const client = makeDispatchClient({
      row: {
        data: {
          id: CARD_ID,
          processor: 'ebt_ca',
          session_cookie_encrypted: CIPHERTEXT,
          session_cookie_expires_at: new Date(Date.now() + 86400_000).toISOString(),
        },
        error: null,
      },
      rpcResult: { data: PLAINTEXT, error: null },
      capturedRpc,
    });
    vi.mocked(makeServiceClient).mockReturnValue(client);
    const fetchStub = vi.fn().mockResolvedValue(new Response('', { status: 202 }));
    vi.stubGlobal('fetch', fetchStub);

    const result = await dispatchScrapeRefresh(ENV_WITH_DISPATCH, {
      cardId: CARD_ID, userId: USER_ID, reason: 'on_open_stale',
    });

    expect(result).toEqual({ dispatched: true });
    expect(capturedRpc.calls).toEqual([
      { name: 'decrypt_session_cookie', args: { ciphertext: CIPHERTEXT } },
    ]);

    // Verify the POST body carried the decrypted cookieHandoff.
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [, init] = fetchStub.mock.calls[0]!;
    const sent = JSON.parse(init.body as string);
    expect(sent.cardId).toBe(CARD_ID);
    expect(sent.login.cookieHandoff).toEqual(JSON.parse(PLAINTEXT));
  });

  it('returns dispatched=false with cookie_decrypt_failed when decrypt RPC errors', async () => {
    const client = makeDispatchClient({
      row: {
        data: {
          id: CARD_ID,
          processor: 'ebt_ca',
          session_cookie_encrypted: CIPHERTEXT,
          session_cookie_expires_at: new Date(Date.now() + 86400_000).toISOString(),
        },
        error: null,
      },
      rpcResult: { data: null, error: { message: 'mac failed' } },
    });
    vi.mocked(makeServiceClient).mockReturnValue(client);
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);

    const result = await dispatchScrapeRefresh(ENV_WITH_DISPATCH, {
      cardId: CARD_ID, userId: USER_ID, reason: 'on_open_stale',
    });

    expect(result.dispatched).toBe(false);
    expect(result.reason).toContain('cookie_decrypt_failed');
    // We MUST NOT POST to the scraper without a valid cookie.
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('returns cookie_parse_failed when decrypt succeeds but plaintext is not a JSON array', async () => {
    const client = makeDispatchClient({
      row: {
        data: {
          id: CARD_ID,
          processor: 'ebt_ca',
          session_cookie_encrypted: CIPHERTEXT,
          session_cookie_expires_at: new Date(Date.now() + 86400_000).toISOString(),
        },
        error: null,
      },
      rpcResult: { data: 'not-json', error: null },
    });
    vi.mocked(makeServiceClient).mockReturnValue(client);
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);

    const result = await dispatchScrapeRefresh(ENV_WITH_DISPATCH, {
      cardId: CARD_ID, userId: USER_ID, reason: 'on_open_stale',
    });

    expect(result.dispatched).toBe(false);
    expect(result.reason).toBe('cookie_parse_failed');
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

describe('dispatchScrapeRefresh — short-circuit guards still hold', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  it('skips when EBT_SCRAPER_DISPATCH_URL is unset (dev/test)', async () => {
    const result = await dispatchScrapeRefresh(TEST_ENV, {
      cardId: CARD_ID, userId: USER_ID, reason: 'first_link',
    });
    expect(result).toEqual({ dispatched: false, reason: 'no_dispatch_url' });
  });
  it('skips when EBT_SCRAPER_WEBHOOK_SECRET is unset', async () => {
    const env: Env = { ...TEST_ENV, EBT_SCRAPER_DISPATCH_URL: 'https://x.test' };
    const result = await dispatchScrapeRefresh(env, {
      cardId: CARD_ID, userId: USER_ID, reason: 'first_link',
    });
    expect(result).toEqual({ dispatched: false, reason: 'no_secret' });
  });
});
