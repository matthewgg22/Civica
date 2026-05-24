/**
 * link.ts — pgsodium encryption (T3 / migration 20260576) tests.
 *
 * The plaintext cookie value MUST NEVER reach the upsert payload — only the
 * pgsodium-wrapped ciphertext does. These tests pin that contract by
 * asserting:
 *
 *   1. encrypt_session_cookie RPC is invoked with the raw cookie body
 *   2. The ciphertext returned by the RPC is what gets written to
 *      session_cookie_encrypted (not the plaintext)
 *   3. remember_cookie is encrypted via a second RPC call when provided
 *   4. encrypt RPC failure -> 500 (we never silently store plaintext)
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('../../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../../lib/ebt-dispatch.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/ebt-dispatch.js')>();
  return {
    ...actual,
    dispatchScrapeRefresh: vi.fn().mockResolvedValue({ dispatched: false, reason: 'no_dispatch_url' }),
  };
});

import { makeServiceClient } from '../../lib/supabase.js';
import { dispatchScrapeRefresh } from '../../lib/ebt-dispatch.js';
import linkRouter from './link.js';
import {
  TEST_ENV,
  APPLICANT,
  buildTestApp,
  JSON_HEADERS,
} from '../../test/helpers.js';

afterEach(() => vi.resetAllMocks());

beforeEach(() => {
  vi.mocked(dispatchScrapeRefresh).mockResolvedValue({
    dispatched: false,
    reason: 'no_dispatch_url',
  });
});

const CARD_ID = 'c0000000-0000-0000-0000-000000000001';
const HASH = 'a'.repeat(64);
const FUTURE_ISO = new Date(Date.now() + 86400_000).toISOString();
const PLAINTEXT_COOKIE = '[{"name":"JSESSIONID","value":"raw-plaintext-do-not-store"}]';
const PLAINTEXT_REMEMBER = 'remember-me-plaintext-too';
const CIPHERTEXT_SESSION = 'pgs1:c2Vzc2lvbi1jaXBoZXItYjY0';
const CIPHERTEXT_REMEMBER = 'pgs1:cmVtZW1iZXItY2lwaGVy';

/**
 * Builds a fake supabase client where:
 *   - `.schema(...).from(...)` returns a chainable thenable whose terminal
 *     `.single()` await produces `upsertResult`, AND whose upsert payload is
 *     captured in `captured.upsertedRow` for later assertion.
 *   - `.rpc('encrypt_session_cookie', ...)` returns the wired ciphertext.
 */
function makeCapturingClient(opts: {
  upsertResult: { data: unknown; error: unknown };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpcImpl?: (name: string, args: any) => Promise<{ data: string | null; error: unknown }>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const captured: { upsertedRow?: Record<string, any>; rpcCalls: Array<{ name: string; args: any }> } = {
    rpcCalls: [],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qb: Record<string, any> = {};
  for (const m of ['select', 'eq', 'is', 'order', 'limit', 'insert', 'update',
                   'delete', 'in', 'filter', 'neq', 'not', 'single', 'maybeSingle']) {
    qb[m] = vi.fn().mockReturnValue(qb);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  qb.upsert = vi.fn().mockImplementation((row: Record<string, any>) => {
    captured.upsertedRow = row;
    return qb;
  });
  qb.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(opts.upsertResult).then(res, rej);
  qb.catch = (rej: (e: unknown) => unknown) => Promise.resolve(opts.upsertResult).catch(rej);

  const defaultRpc = opts.rpcImpl
    ?? (async (_name: string, _args: unknown) => ({ data: CIPHERTEXT_SESSION, error: null }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = vi.fn().mockImplementation((name: string, args: any) => {
    captured.rpcCalls.push({ name, args });
    return defaultRpc(name, args);
  });

  const client = {
    schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(qb) }),
    rpc,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return { client, captured };
}

const VALID_BODY = {
  card_id_hash: HASH,
  processor: 'ebt_ca' as const,
  session_cookie: PLAINTEXT_COOKIE,
  expires_at: FUTURE_ISO,
};

describe('POST /ebt/link — pgsodium encryption (T3)', () => {
  it('calls encrypt_session_cookie RPC with the raw plaintext cookie', async () => {
    const { client, captured } = makeCapturingClient({
      upsertResult: {
        data: {
          id: CARD_ID,
          user_id: APPLICANT.id,
          processor: 'ebt_ca',
          session_cookie_expires_at: FUTURE_ISO,
          last_synced_at: null,
          balance_cents: null,
          balance_at: null,
        },
        error: null,
      },
    });
    vi.mocked(makeServiceClient).mockReturnValue(client);

    const app = buildTestApp(linkRouter, '/', APPLICANT);
    const res = await app.request('/', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(VALID_BODY),
    }, TEST_ENV);
    expect(res.status).toBe(201);

    expect(captured.rpcCalls.length).toBeGreaterThanOrEqual(1);
    const encryptCall = captured.rpcCalls.find((c) => c.name === 'encrypt_session_cookie');
    expect(encryptCall).toBeDefined();
    expect(encryptCall!.args).toEqual({ plaintext: PLAINTEXT_COOKIE });
  });

  it('stores the RPC ciphertext, not the plaintext, in session_cookie_encrypted', async () => {
    const { client, captured } = makeCapturingClient({
      upsertResult: {
        data: {
          id: CARD_ID,
          user_id: APPLICANT.id,
          processor: 'ebt_ca',
          session_cookie_expires_at: FUTURE_ISO,
          last_synced_at: null,
          balance_cents: null,
          balance_at: null,
        },
        error: null,
      },
    });
    vi.mocked(makeServiceClient).mockReturnValue(client);

    const app = buildTestApp(linkRouter, '/', APPLICANT);
    const res = await app.request('/', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(VALID_BODY),
    }, TEST_ENV);
    expect(res.status).toBe(201);

    expect(captured.upsertedRow).toBeDefined();
    expect(captured.upsertedRow!.session_cookie_encrypted).toBe(CIPHERTEXT_SESSION);
    // Hard contract: plaintext MUST NOT appear in the upserted row.
    expect(captured.upsertedRow!.session_cookie_encrypted).not.toBe(PLAINTEXT_COOKIE);
    expect(JSON.stringify(captured.upsertedRow)).not.toContain('raw-plaintext-do-not-store');
  });

  it('encrypts remember_cookie via a second RPC call when provided', async () => {
    let callIdx = 0;
    const { client, captured } = makeCapturingClient({
      upsertResult: {
        data: {
          id: CARD_ID,
          user_id: APPLICANT.id,
          processor: 'ebt_ca',
          session_cookie_expires_at: FUTURE_ISO,
          last_synced_at: null,
          balance_cents: null,
          balance_at: null,
        },
        error: null,
      },
      rpcImpl: async () => {
        callIdx += 1;
        return {
          data: callIdx === 1 ? CIPHERTEXT_SESSION : CIPHERTEXT_REMEMBER,
          error: null,
        };
      },
    });
    vi.mocked(makeServiceClient).mockReturnValue(client);

    const app = buildTestApp(linkRouter, '/', APPLICANT);
    const res = await app.request('/', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ ...VALID_BODY, remember_cookie: PLAINTEXT_REMEMBER }),
    }, TEST_ENV);
    expect(res.status).toBe(201);

    expect(captured.rpcCalls.length).toBe(2);
    expect(captured.rpcCalls[0]).toEqual({
      name: 'encrypt_session_cookie',
      args: { plaintext: PLAINTEXT_COOKIE },
    });
    expect(captured.rpcCalls[1]).toEqual({
      name: 'encrypt_session_cookie',
      args: { plaintext: PLAINTEXT_REMEMBER },
    });
    expect(captured.upsertedRow!.session_cookie_encrypted).toBe(CIPHERTEXT_SESSION);
    expect(captured.upsertedRow!.remember_cookie_encrypted).toBe(CIPHERTEXT_REMEMBER);
  });

  it('returns 500 when encrypt_session_cookie RPC fails (never stores plaintext)', async () => {
    const { client, captured } = makeCapturingClient({
      upsertResult: {
        data: { id: CARD_ID, user_id: APPLICANT.id, processor: 'ebt_ca',
                session_cookie_expires_at: FUTURE_ISO, last_synced_at: null,
                balance_cents: null, balance_at: null },
        error: null,
      },
      rpcImpl: async () => ({ data: null, error: { message: 'key not registered' } }),
    });
    vi.mocked(makeServiceClient).mockReturnValue(client);

    const app = buildTestApp(linkRouter, '/', APPLICANT);
    const res = await app.request('/', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(VALID_BODY),
    }, TEST_ENV);
    expect(res.status).toBe(500);
    // Hono's HTTPException renders as a text body by default — we just need
    // to confirm the *upsert never happened* (the structural invariant).
    expect(captured.upsertedRow).toBeUndefined();
  });
});
