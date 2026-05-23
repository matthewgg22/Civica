import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../../lib/ebt-dispatch.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/ebt-dispatch.js')>();
  return {
    ...actual,
    dispatchScrapeRefresh: vi.fn().mockResolvedValue({ dispatched: true }),
  };
});

import { makeServiceClient } from '../../lib/supabase.js';
import {
  dispatchScrapeRefresh,
  _resetRateLimitForTests,
} from '../../lib/ebt-dispatch.js';
import refreshRouter from './refresh.js';
import {
  TEST_ENV,
  APPLICANT,
  NAVIGATOR,
  makeDbClient,
  buildTestApp,
} from '../../test/helpers.js';

const CARD_ID = 'c0000000-0000-0000-0000-000000000001';

beforeEach(() => {
  _resetRateLimitForTests();
  // vi.resetAllMocks() in afterEach clears mock implementations, so re-prime
  // the default behaviour each test needs.
  vi.mocked(dispatchScrapeRefresh).mockResolvedValue({ dispatched: true });
});

afterEach(() => vi.resetAllMocks());

describe('POST /ebt/refresh', () => {
  it('returns 403 for navigator role', async () => {
    const app = buildTestApp(refreshRouter, '/', NAVIGATOR);
    const res = await app.request('/', { method: 'POST' }, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it('returns 404 NO_CARD_LINKED when no card exists', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const app = buildTestApp(refreshRouter, '/', APPLICANT);
    const res = await app.request('/', { method: 'POST' }, TEST_ENV);
    expect(res.status).toBe(404);
  });

  it('returns 500 when Supabase card lookup fails', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({
      data: null,
      error: { message: 'boom' },
    }));
    const app = buildTestApp(refreshRouter, '/', APPLICANT);
    const res = await app.request('/', { method: 'POST' }, TEST_ENV);
    expect(res.status).toBe(500);
  });

  it('returns 202 and dispatches scrape on happy path', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: { id: CARD_ID }, error: null }),
    );
    const app = buildTestApp(refreshRouter, '/', APPLICANT);
    const res = await app.request('/', { method: 'POST' }, TEST_ENV);
    expect(res.status).toBe(202);
    const body = await res.json() as { dispatched: boolean };
    expect(body.dispatched).toBe(true);
    expect(dispatchScrapeRefresh).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cardId: CARD_ID, userId: APPLICANT.id, reason: 'manual_refresh' }),
    );
  });

  it('returns 429 RATE_LIMITED on the second call within the window', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: { id: CARD_ID }, error: null }),
    );
    const app = buildTestApp(refreshRouter, '/', APPLICANT);

    const first = await app.request('/', { method: 'POST' }, TEST_ENV);
    expect(first.status).toBe(202);

    const second = await app.request('/', { method: 'POST' }, TEST_ENV);
    expect(second.status).toBe(429);
    expect(second.headers.get('Retry-After')).toBeTruthy();
    const body = await second.json() as { error: string; retry_after_seconds: number };
    expect(body.error).toBe('RATE_LIMITED');
    expect(body.retry_after_seconds).toBeGreaterThan(0);
  });

  it('lets a different user through while the original is rate-limited', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: { id: CARD_ID }, error: null }),
    );
    const app1 = buildTestApp(refreshRouter, '/', APPLICANT);
    const otherUser = { kind: 'applicant' as const, id: 'user-002' };
    const app2 = buildTestApp(refreshRouter, '/', otherUser);

    expect((await app1.request('/', { method: 'POST' }, TEST_ENV)).status).toBe(202);
    expect((await app1.request('/', { method: 'POST' }, TEST_ENV)).status).toBe(429);
    expect((await app2.request('/', { method: 'POST' }, TEST_ENV)).status).toBe(202);
  });
});
