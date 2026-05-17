import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../middleware/actorContext.js', () => ({
  withActorContext: vi.fn(),
}));

import { makeAnonClient } from '../lib/supabase.js';
import { withActorContext } from '../middleware/actorContext.js';
import missingItemsRouter from './missing-items.js';
import fullApp from '../index.js';
import { TEST_ENV, NAVIGATOR, APPLICANT, makeDbClient, buildTestApp, JSON_HEADERS } from '../test/helpers.js';

const PACKET_ID = 'p0000000-0000-0000-0000-000000000001';

afterEach(() => vi.resetAllMocks());

// ── 401 via full app ──────────────────────────────────────────────────────

describe('auth guard', () => {
  it('rejects requests with no Bearer token', async () => {
    const res = await fullApp.request(`/v1/enrollment/packets/${PACKET_ID}/missing-items`, {}, TEST_ENV);
    expect(res.status).toBe(401);
  });
});

// ── Applicant role gate ───────────────────────────────────────────────────

describe('applicant role gate', () => {
  it('GET list returns 403 for applicant', async () => {
    const res = await buildTestApp(missingItemsRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/missing-items`, {}, TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('POST create returns 403 for applicant', async () => {
    const res = await buildTestApp(missingItemsRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/missing-items`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('POST cancel returns 403 for applicant', async () => {
    const res = await buildTestApp(missingItemsRouter, '/', APPLICANT).request(
      `/missing-items/req-001/cancel`,
      { method: 'POST' },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });
});

// ── GET /packets/:packetId/missing-items ──────────────────────────────────

describe('GET /packets/:packetId/missing-items', () => {
  it('returns request list on happy path', async () => {
    const requests = [{ request_id: 'r1', status: 'pending', sent_at: '2026-05-01T00:00:00Z' }];
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: requests, error: null }));

    const res = await buildTestApp(missingItemsRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/missing-items`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });
});

// ── POST /packets/:packetId/missing-items ─────────────────────────────────

describe('POST /packets/:packetId/missing-items', () => {
  it('returns 400 when required_item_id is not a valid UUID', async () => {
    const res = await buildTestApp(missingItemsRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/missing-items`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ required_item_id: 'not-a-uuid' }) },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('creates request and returns 201 on happy path', async () => {
    const inserted = { request_id: 'r-new', status: 'pending', sent_at: '2026-05-17T00:00:00Z' };
    const svcDb = makeDbClient({ data: inserted, error: null });
    // withActorContext also calls bump-packet query (returns no-op)
    vi.mocked(withActorContext).mockResolvedValue(svcDb);

    const res = await buildTestApp(missingItemsRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/missing-items`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ bump_packet_status: false }) },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { request_id: string; status: string };
    expect(body.request_id).toBe('r-new');
    expect(body.status).toBe('pending');
  });

  it('returns 400 when required_item_id references wrong packet', async () => {
    const validUuid = 'i0000000-0000-0000-0000-000000000001';
    // The handler verifies the item belongs to the packet; null means mismatch
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(missingItemsRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/missing-items`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ required_item_id: validUuid }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });
});

// ── POST /missing-items/:requestId/cancel ─────────────────────────────────

describe('POST /missing-items/:requestId/cancel', () => {
  it('returns 204 on happy path', async () => {
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(missingItemsRouter, '/', NAVIGATOR).request(
      `/missing-items/req-001/cancel`, { method: 'POST' }, TEST_ENV,
    );
    expect(res.status).toBe(204);
  });
});
