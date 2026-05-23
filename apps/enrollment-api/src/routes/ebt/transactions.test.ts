import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from '../../lib/supabase.js';
import txnsRouter from './transactions.js';
import {
  TEST_ENV,
  APPLICANT,
  NAVIGATOR,
  makeQueryBuilder,
  buildTestApp,
} from '../../test/helpers.js';

afterEach(() => vi.resetAllMocks());

const CARD_ID = 'c0000000-0000-0000-0000-000000000001';

// Both card-lookup + transactions queries share a single from() — build a mock
// that returns each in order.
function mockTwoQueries(cardResult: unknown, txnsResult: unknown) {
  let calls = 0;
  vi.mocked(makeServiceClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        calls++;
        if (calls === 1) return makeQueryBuilder({ data: cardResult, error: null });
        return makeQueryBuilder({ data: txnsResult, error: null });
      }),
    }),
    rpc: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

const sampleTxn = (id: string, posted_at: string, amount_cents: number) => ({
  id,
  posted_at,
  amount_cents,
  merchant: 'WALMART RENO NV',
  category: 'groceries',
  raw_description: 'EBT PURCHASE WALMART',
  state_code_match: 'NV',
});

describe('GET /ebt/transactions', () => {
  it('returns 403 for navigator role', async () => {
    const app = buildTestApp(txnsRouter, '/', NAVIGATOR);
    const res = await app.request('/', {}, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it('returns empty page when no card is linked', async () => {
    // Single card lookup returns null
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(makeQueryBuilder({ data: null, error: null })),
      }),
      rpc: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = buildTestApp(txnsRouter, '/', APPLICANT);
    const res = await app.request('/', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { items: unknown[]; next_cursor: unknown };
    expect(body.items).toEqual([]);
    expect(body.next_cursor).toBeNull();
  });

  it('returns first page of transactions with no next_cursor when fewer than limit', async () => {
    mockTwoQueries({ id: CARD_ID }, [
      sampleTxn('t1', '2026-05-20T10:00:00Z', -1234),
      sampleTxn('t2', '2026-05-19T09:00:00Z', -567),
    ]);

    const app = buildTestApp(txnsRouter, '/', APPLICANT);
    const res = await app.request('/?limit=5', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { items: unknown[]; next_cursor: string | null };
    expect(body.items).toHaveLength(2);
    expect(body.next_cursor).toBeNull();
  });

  it('returns next_cursor when more rows exist than limit', async () => {
    // limit=2, return 3 rows → cursor pointer = 3rd row
    mockTwoQueries({ id: CARD_ID }, [
      sampleTxn('t1', '2026-05-20T10:00:00Z', -1000),
      sampleTxn('t2', '2026-05-19T09:00:00Z', -2000),
      sampleTxn('t3', '2026-05-18T08:00:00Z', -3000),
    ]);

    const app = buildTestApp(txnsRouter, '/', APPLICANT);
    const res = await app.request('/?limit=2', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { items: unknown[]; next_cursor: string | null };
    expect(body.items).toHaveLength(2);
    expect(body.next_cursor).toBeTruthy();
    // Cursor must decode back to a payload with posted_at + id
    const decoded = JSON.parse(atob(body.next_cursor!));
    expect(decoded.id).toBe('t3');
    expect(decoded.posted_at).toBe('2026-05-18T08:00:00Z');
  });

  it('returns 400 for an invalid cursor', async () => {
    // Card lookup succeeds, then the route bails before issuing transactions query
    // when the cursor is undecodable.
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(makeQueryBuilder({ data: { id: CARD_ID }, error: null })),
      }),
      rpc: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = buildTestApp(txnsRouter, '/', APPLICANT);
    const res = await app.request('/?cursor=!!!not-base64!!!', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed limit', async () => {
    const app = buildTestApp(txnsRouter, '/', APPLICANT);
    const res = await app.request('/?limit=abc', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 404 when card_id is supplied but not owned', async () => {
    mockTwoQueries(null, []);
    const app = buildTestApp(txnsRouter, '/', APPLICANT);
    const res = await app.request(`/?card_id=${CARD_ID}`, {}, TEST_ENV);
    expect(res.status).toBe(404);
  });

  it('honors explicit card_id when owned', async () => {
    mockTwoQueries({ id: CARD_ID }, [sampleTxn('t1', '2026-05-20T10:00:00Z', -100)]);
    const app = buildTestApp(txnsRouter, '/', APPLICANT);
    const res = await app.request(`/?card_id=${CARD_ID}`, {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  it('returns 500 when transactions query fails', async () => {
    let calls = 0;
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          calls++;
          if (calls === 1) return makeQueryBuilder({ data: { id: CARD_ID }, error: null });
          return makeQueryBuilder({ data: null, error: { message: 'boom' } });
        }),
      }),
      rpc: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = buildTestApp(txnsRouter, '/', APPLICANT);
    const res = await app.request('/', {}, TEST_ENV);
    expect(res.status).toBe(500);
  });
});
