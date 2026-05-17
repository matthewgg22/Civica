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
import handoffRouter from './handoff.js';
import fullApp from '../index.js';
import { TEST_ENV, NAVIGATOR, APPLICANT, makeDbClient, makeQueryBuilder, buildTestApp } from '../test/helpers.js';

const PACKET_ID = 'p0000000-0000-0000-0000-000000000001';

afterEach(() => vi.resetAllMocks());

// ── 401 via full app ──────────────────────────────────────────────────────

describe('auth guard', () => {
  it('rejects requests with no Bearer token', async () => {
    const res = await fullApp.request(`/v1/enrollment/packets/${PACKET_ID}/handoff`, {}, TEST_ENV);
    expect(res.status).toBe(401);
  });
});

// ── Applicant role gate ───────────────────────────────────────────────────

describe('applicant role gate', () => {
  it('GET list returns 403 for applicant', async () => {
    const res = await buildTestApp(handoffRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/handoff`, {}, TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('GET preview returns 403 for applicant', async () => {
    const res = await buildTestApp(handoffRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/handoff/preview`, {}, TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('POST create returns 403 for applicant', async () => {
    const res = await buildTestApp(handoffRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/handoff`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('GET download returns 403 for applicant', async () => {
    const res = await buildTestApp(handoffRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/handoff/exp-001/download`, {}, TEST_ENV,
    );
    expect(res.status).toBe(403);
  });
});

// ── GET /packets/:packetId/handoff (list) ─────────────────────────────────

describe('GET /packets/:packetId/handoff', () => {
  it('returns export history on happy path', async () => {
    const exports = [{ export_id: 'e1', format: 'json_api', exported_at: '2026-05-01T00:00:00Z' }];
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: exports, error: null }));

    const res = await buildTestApp(handoffRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/handoff`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });
});

// ── POST /packets/:packetId/handoff ───────────────────────────────────────

describe('POST /packets/:packetId/handoff', () => {
  it('returns 400 for invalid format enum', async () => {
    const res = await buildTestApp(handoffRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/handoff`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'not_a_format' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when packet does not exist', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'not found' } }),
    );

    const res = await buildTestApp(handoffRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/handoff`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'json_api' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 422 when packet status is not ready', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: { packet_id: PACKET_ID, status: 'Draft', applicant_id: 'a1' }, error: null }),
    );

    const res = await buildTestApp(handoffRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/handoff`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'json_api' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });
});

// ── GET /packets/:packetId/handoff/:exportId/download ────────────────────

describe('GET .../handoff/:exportId/download', () => {
  it('returns 404 when export row does not exist', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'not found' } }),
    );

    const res = await buildTestApp(handoffRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/handoff/exp-missing/download`, {}, TEST_ENV,
    );
    expect(res.status).toBe(404);
  });
});

// ── Happy path POST with "Ready for Handoff" status ──────────────────────

describe('POST handoff happy path (status=Ready for Handoff, no blockers, consent present)', () => {
  it('returns 201 with export_id and checksum', async () => {
    // makeAnonClient is called ONCE; the single db handles all queries.
    // Dispatch by table name so packet loads get status, consent gets a row, everything else empty.
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'snap_packets') {
        return makeQueryBuilder({
          data: {
            packet_id: PACKET_ID, status: 'Ready for Handoff', applicant_id: 'app-001',
            applicants: null, state_code: 'CA', county: null, created_at: null,
            submitted_at: null, handed_off_at: null,
          },
          error: null,
        });
      }
      if (table === 'user_consents') {
        return makeQueryBuilder({ data: [{ consent_id: 'c1', consent_kind: 'privacy_notice', consented_at: null, policy_version: '1.0', consent_method: null }], error: null });
      }
      // required_document_items, extraction_fields, packet_answers, etc. → no blockers / empty
      return makeQueryBuilder({ data: [], error: null, count: 0 });
    });

    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({ from: fromMock }),
    } as unknown as ReturnType<typeof makeAnonClient>);

    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: { export_id: 'exp-new', exported_at: '2026-05-17T00:00:00Z' }, error: null }),
    );

    const res = await buildTestApp(handoffRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/handoff`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'json_api' }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(201);
    const body = await res.json() as { export_id: string; checksum_sha256: string };
    expect(body.export_id).toBe('exp-new');
    expect(typeof body.checksum_sha256).toBe('string');
  });
});
