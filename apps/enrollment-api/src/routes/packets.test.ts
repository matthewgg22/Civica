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
import packetsRouter from './packets.js';
import fullApp from '../index.js';
import { TEST_ENV, NAVIGATOR, APPLICANT, makeDbClient, buildTestApp, JSON_HEADERS } from '../test/helpers.js';

afterEach(() => vi.resetAllMocks());

// ── 401 via full app ──────────────────────────────────────────────────────

describe('auth guard', () => {
  it('rejects requests with no Bearer token', async () => {
    const res = await fullApp.request('/v1/enrollment/packets', {}, TEST_ENV);
    expect(res.status).toBe(401);
  });
});

// ── GET /packets ──────────────────────────────────────────────────────────

describe('GET /packets', () => {
  it('returns packet list on happy path', async () => {
    const packets = [{ packet_id: 'p1', status: 'Draft', state_code: 'CA' }];
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: packets, error: null }));

    const res = await buildTestApp(packetsRouter, '/packets', NAVIGATOR).request('/packets', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it('propagates DB error as 500', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: null, error: { message: 'db down' } }));

    const res = await buildTestApp(packetsRouter, '/packets', NAVIGATOR).request('/packets', {}, TEST_ENV);
    expect(res.status).toBe(500);
  });
});

// ── GET /packets/:packetId ────────────────────────────────────────────────

describe('GET /packets/:packetId', () => {
  it('returns the packet on happy path', async () => {
    const packet = { packet_id: 'p1', status: 'Draft', state_code: 'CA' };
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: packet, error: null }));

    const res = await buildTestApp(packetsRouter, '/packets', NAVIGATOR).request('/packets/p1', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { packet_id: string };
    expect(body.packet_id).toBe('p1');
  });

  it('returns 404 when DB returns PGRST116', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'Row not found' } }),
    );

    const res = await buildTestApp(packetsRouter, '/packets', NAVIGATOR).request('/packets/missing', {}, TEST_ENV);
    expect(res.status).toBe(404);
  });
});

// ── POST /packets ─────────────────────────────────────────────────────────

describe('POST /packets', () => {
  it('returns 400 when applicant_id is missing', async () => {
    const res = await buildTestApp(packetsRouter, '/packets', NAVIGATOR).request('/packets', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ state_code: 'CA' }),
    }, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 when state_code is invalid', async () => {
    const res = await buildTestApp(packetsRouter, '/packets', NAVIGATOR).request('/packets', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ applicant_id: 'a0000000-0000-0000-0000-000000000001', state_code: 'XX' }),
    }, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('creates packet and returns 201 on happy path', async () => {
    const created = { packet_id: 'p-new', status: 'Draft', state_code: 'CA' };
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: created, error: null }));

    const res = await buildTestApp(packetsRouter, '/packets', NAVIGATOR).request('/packets', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ applicant_id: 'a0000000-0000-0000-0000-000000000001', state_code: 'CA' }),
    }, TEST_ENV);
    expect(res.status).toBe(201);
    const body = await res.json() as { packet_id: string };
    expect(body.packet_id).toBe('p-new');
  });
});

// ── PATCH /packets/:packetId ──────────────────────────────────────────────

describe('PATCH /packets/:packetId', () => {
  it('returns 400 for an unrecognised status value', async () => {
    const res = await buildTestApp(packetsRouter, '/packets', NAVIGATOR).request('/packets/p1', {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ status: 'Nonexistent Status' }),
    }, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('updates packet and returns 200 on happy path', async () => {
    const updated = { packet_id: 'p1', status: 'In Navigator Review' };
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: updated, error: null }));

    const res = await buildTestApp(packetsRouter, '/packets', NAVIGATOR).request('/packets/p1', {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ status: 'In Navigator Review' }),
    }, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('In Navigator Review');
  });

  it('returns 422 when DB trigger rejects transition (P0001)', async () => {
    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: null, error: { code: 'P0001', message: 'Invalid status transition' } }),
    );

    const res = await buildTestApp(packetsRouter, '/packets', NAVIGATOR).request('/packets/p1', {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ status: 'Handed Off' }),
    }, TEST_ENV);
    expect(res.status).toBe(422);
  });
});

// ── GET /packets/:packetId/history ────────────────────────────────────────

describe('GET /packets/:packetId/history', () => {
  it('returns history array on happy path', async () => {
    const history = [{ from_status: 'Draft', to_status: 'Submitted for Review' }];
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: history, error: null }));

    const res = await buildTestApp(packetsRouter, '/packets', NAVIGATOR).request('/packets/p1/history', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });
});

// ── Applicant role access ─────────────────────────────────────────────────

describe('applicant role access', () => {
  it('applicant can list packets (no role gate on GET)', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: [], error: null }));

    const res = await buildTestApp(packetsRouter, '/packets', APPLICANT).request('/packets', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });
});
