import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  NAVIGATOR,
  makeDbClient,
  buildTestApp,
  JSON_HEADERS,
} from '../../test/helpers.js';

beforeEach(() => {
  vi.mocked(dispatchScrapeRefresh).mockResolvedValue({ dispatched: false, reason: 'no_dispatch_url' });
});

afterEach(() => vi.resetAllMocks());

const CARD_ID = 'c0000000-0000-0000-0000-000000000001';
const HASH = 'a'.repeat(64);
const FUTURE_ISO = new Date(Date.now() + 86400_000).toISOString();
const CIPHERTEXT = 'pgs1:ZmFrZS1jaXBoZXJ0ZXh0';

/**
 * makeDbClient defaults rpc -> { data: null, error: null }, which would make
 * encryptSessionCookie throw. Wire a sensible ciphertext response so the
 * non-encryption happy-path tests keep exercising the upsert flow.
 */
function mockClient(upsertResult: { data: unknown; error: unknown }) {
  const client = makeDbClient(upsertResult);
  client.rpc.mockResolvedValue({ data: CIPHERTEXT, error: null });
  return client;
}

const VALID_BODY = {
  card_id_hash: HASH,
  processor: 'ebt_ca',
  session_cookie: 'opaque-session-cookie-bytes',
  expires_at: FUTURE_ISO,
};

describe('POST /ebt/link', () => {
  it('returns 403 for navigator role', async () => {
    const app = buildTestApp(linkRouter, '/', NAVIGATOR);
    const res = await app.request('/', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(VALID_BODY),
    }, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it('returns 400 when card_id_hash is missing', async () => {
    const app = buildTestApp(linkRouter, '/', APPLICANT);
    const { card_id_hash: _omit, ...bad } = VALID_BODY;
    const res = await app.request('/', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(bad),
    }, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 when expires_at is not an ISO datetime', async () => {
    const app = buildTestApp(linkRouter, '/', APPLICANT);
    const res = await app.request('/', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ ...VALID_BODY, expires_at: 'tomorrow' }),
    }, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown processor', async () => {
    const app = buildTestApp(linkRouter, '/', APPLICANT);
    const res = await app.request('/', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ ...VALID_BODY, processor: 'unknown' }),
    }, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 500 when Supabase upsert fails', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(mockClient({
      data: null,
      error: { code: '23505', message: 'unique violation' },
    }));
    const app = buildTestApp(linkRouter, '/', APPLICANT);
    const res = await app.request('/', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(VALID_BODY),
    }, TEST_ENV);
    expect(res.status).toBe(500);
  });

  it('returns 201 with id, processor, session expiry on happy path', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(mockClient({
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
    }));

    const app = buildTestApp(linkRouter, '/', APPLICANT);
    const res = await app.request('/', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(VALID_BODY),
    }, TEST_ENV);
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; processor: string };
    expect(body.id).toBe(CARD_ID);
    expect(body.processor).toBe('ebt_ca');

    // Side-effect: first-link scrape dispatch was attempted.
    expect(dispatchScrapeRefresh).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cardId: CARD_ID, userId: APPLICANT.id, reason: 'first_link' }),
    );
  });

  it('accepts optional remember_cookie', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(mockClient({
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
    }));

    const app = buildTestApp(linkRouter, '/', APPLICANT);
    const res = await app.request('/', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ ...VALID_BODY, remember_cookie: 'remember-bytes' }),
    }, TEST_ENV);
    expect(res.status).toBe(201);
  });
});
