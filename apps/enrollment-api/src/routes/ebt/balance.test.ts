import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../../lib/ebt-dispatch.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/ebt-dispatch.js')>();
  return {
    ...actual,
    dispatchScrapeRefresh: vi.fn().mockResolvedValue({ dispatched: false }),
  };
});

import { makeServiceClient } from '../../lib/supabase.js';
import { dispatchScrapeRefresh } from '../../lib/ebt-dispatch.js';
import balanceRouter from './balance.js';
import {
  TEST_ENV,
  APPLICANT,
  NAVIGATOR,
  makeDbClient,
  buildTestApp,
} from '../../test/helpers.js';

beforeEach(() => {
  // vi.resetAllMocks() clears mock implementations between tests; re-prime
  // dispatchScrapeRefresh so routes that call it don't get `undefined` back.
  vi.mocked(dispatchScrapeRefresh).mockResolvedValue({ dispatched: false });
});

afterEach(() => vi.resetAllMocks());

const CARD_ID = 'c0000000-0000-0000-0000-000000000001';
const FUTURE_ISO = new Date(Date.now() + 86400_000).toISOString();
const FRESH_BALANCE_ISO = new Date(Date.now() - 60_000).toISOString();   // 1 min ago
const STALE_BALANCE_ISO = new Date(Date.now() - 45 * 60_000).toISOString(); // 45 min ago

describe('GET /ebt/balance', () => {
  it('returns 403 for navigator role', async () => {
    const app = buildTestApp(balanceRouter, '/', NAVIGATOR);
    const res = await app.request('/', {}, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it('returns 404 NO_CARD_LINKED when no card exists', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const app = buildTestApp(balanceRouter, '/', APPLICANT);
    const res = await app.request('/', {}, TEST_ENV);
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('NO_CARD_LINKED');
  });

  it('returns 500 when Supabase select fails', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({
      data: null,
      error: { message: 'boom' },
    }));
    const app = buildTestApp(balanceRouter, '/', APPLICANT);
    const res = await app.request('/', {}, TEST_ENV);
    expect(res.status).toBe(500);
  });

  it('returns balance with stale=false when balance_at is recent', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({
      data: {
        id: CARD_ID,
        balance_cents: 23200,
        balance_at: FRESH_BALANCE_ISO,
        session_cookie_expires_at: FUTURE_ISO,
      },
      error: null,
    }));

    const app = buildTestApp(balanceRouter, '/', APPLICANT);
    const res = await app.request('/', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { balance_cents: number; stale: boolean };
    expect(body.balance_cents).toBe(23200);
    expect(body.stale).toBe(false);
    expect(dispatchScrapeRefresh).not.toHaveBeenCalled();
  });

  it('returns stale=true AND dispatches a refresh when balance_at is older than 30min', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({
      data: {
        id: CARD_ID,
        balance_cents: 23200,
        balance_at: STALE_BALANCE_ISO,
        session_cookie_expires_at: FUTURE_ISO,
      },
      error: null,
    }));

    const app = buildTestApp(balanceRouter, '/', APPLICANT);
    const res = await app.request('/', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { balance_cents: number; stale: boolean };
    expect(body.stale).toBe(true);
    expect(dispatchScrapeRefresh).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cardId: CARD_ID, userId: APPLICANT.id, reason: 'on_open_stale' }),
    );
  });

  it('treats balance_at=null as stale (never been scraped)', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({
      data: {
        id: CARD_ID,
        balance_cents: null,
        balance_at: null,
        session_cookie_expires_at: FUTURE_ISO,
      },
      error: null,
    }));

    const app = buildTestApp(balanceRouter, '/', APPLICANT);
    const res = await app.request('/', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { balance_cents: number | null; stale: boolean };
    expect(body.stale).toBe(true);
    expect(body.balance_cents).toBeNull();
    expect(dispatchScrapeRefresh).toHaveBeenCalled();
  });
});
