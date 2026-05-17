import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../middleware/actorContext.js', () => ({
  withActorContext: vi.fn(),
}));
vi.mock('../lib/applicant.js', () => ({
  getOrCreateApplicant: vi.fn(),
}));

import { makeAnonClient } from '../lib/supabase.js';
import { withActorContext } from '../middleware/actorContext.js';
import { getOrCreateApplicant } from '../lib/applicant.js';
import meInboxRouter from './me-inbox.js';
import fullApp from '../index.js';
import { TEST_ENV, NAVIGATOR, APPLICANT, makeDbClient, makeQueryBuilder, buildTestApp } from '../test/helpers.js';

const MOCK_APPLICANT = { applicant_id: 'app-001', state_code: 'CA' as const, preferred_language: 'en' };

afterEach(() => vi.resetAllMocks());

// ── 401 via full app ──────────────────────────────────────────────────────

describe('auth guard', () => {
  it('rejects requests with no Bearer token', async () => {
    const res = await fullApp.request('/v1/enrollment/me/inbox', {}, TEST_ENV);
    expect(res.status).toBe(401);
  });
});

// ── Staff role gate ───────────────────────────────────────────────────────

describe('staff role gate', () => {
  it('GET returns 403 for navigator (staff must use dashboard API)', async () => {
    const res = await buildTestApp(meInboxRouter, '/me/inbox', NAVIGATOR).request(
      '/me/inbox', {}, TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('POST resolve returns 403 for navigator', async () => {
    const res = await buildTestApp(meInboxRouter, '/me/inbox', NAVIGATOR).request(
      '/me/inbox/req-001/resolve',
      { method: 'POST' },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });
});

// ── GET /me/inbox (applicant view) ────────────────────────────────────────

describe('GET /me/inbox', () => {
  it('returns empty array when applicant has no packets', async () => {
    vi.mocked(getOrCreateApplicant).mockResolvedValue(MOCK_APPLICANT);
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: [], error: null }));

    const res = await buildTestApp(meInboxRouter, '/me/inbox', APPLICANT).request(
      '/me/inbox', {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('maps missing-item requests to the inbox shape', async () => {
    vi.mocked(getOrCreateApplicant).mockResolvedValue(MOCK_APPLICANT);

    // The handler makes two sequential queries on the SAME anonClient:
    // 1. snap_packets → [{ packet_id: 'p1' }]
    // 2. missing_item_requests → [{ request_id, ... }]
    const qbPackets = makeQueryBuilder({ data: [{ packet_id: 'p1' }], error: null });
    const qbRequests = makeQueryBuilder({
      data: [
        {
          request_id: 'req-1',
          packet_id: 'p1',
          status: 'pending',
          sent_at: '2026-05-17T00:00:00Z',
          resolved_at: null,
          required_document_items: { label: 'Proof of income' },
        },
      ],
      error: null,
    });

    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValueOnce(qbPackets).mockReturnValueOnce(qbRequests),
      }),
    } as unknown as ReturnType<typeof makeAnonClient>);

    const res = await buildTestApp(meInboxRouter, '/me/inbox', APPLICANT).request(
      '/me/inbox', {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ id: string; prompt: string; resolved: boolean }>;
    expect(body).toHaveLength(1);
    const item = body[0]!;
    expect(item.id).toBe('req-1');
    expect(item.prompt).toBe('Proof of income');
    expect(item.resolved).toBe(false);
  });
});

// ── POST /me/inbox/:requestId/resolve ─────────────────────────────────────

describe('POST /me/inbox/:requestId/resolve', () => {
  it('returns 404 when request does not exist', async () => {
    vi.mocked(getOrCreateApplicant).mockResolvedValue(MOCK_APPLICANT);
    // Request lookup returns null → route throws 404
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(meInboxRouter, '/me/inbox', APPLICANT).request(
      '/me/inbox/req-missing/resolve',
      { method: 'POST' },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when request belongs to a different applicant', async () => {
    vi.mocked(getOrCreateApplicant).mockResolvedValue(MOCK_APPLICANT);

    // First query (missing_item_requests lookup) returns the request row
    const qbRequest = makeQueryBuilder({
      data: { request_id: 'req-1', packet_id: 'p-other', status: 'pending' },
      error: null,
    });
    // Second query (snap_packets ownership check) returns null → different applicant
    const qbPacket = makeQueryBuilder({ data: null, error: null });

    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValueOnce(qbRequest).mockReturnValueOnce(qbPacket),
      }),
    } as unknown as ReturnType<typeof makeAnonClient>);

    const res = await buildTestApp(meInboxRouter, '/me/inbox', APPLICANT).request(
      '/me/inbox/req-1/resolve',
      { method: 'POST' },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('returns 204 on happy path resolve', async () => {
    vi.mocked(getOrCreateApplicant).mockResolvedValue(MOCK_APPLICANT);

    const qbRequest = makeQueryBuilder({
      data: { request_id: 'req-1', packet_id: 'p1', status: 'pending' },
      error: null,
    });
    const qbPacket = makeQueryBuilder({ data: { packet_id: 'p1' }, error: null });

    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValueOnce(qbRequest).mockReturnValueOnce(qbPacket),
      }),
    } as unknown as ReturnType<typeof makeAnonClient>);

    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(meInboxRouter, '/me/inbox', APPLICANT).request(
      '/me/inbox/req-1/resolve',
      { method: 'POST' },
      TEST_ENV,
    );
    expect(res.status).toBe(204);
  });
});
