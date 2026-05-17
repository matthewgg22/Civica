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
import fieldsRouter from './fields.js';
import fullApp from '../index.js';
import { TEST_ENV, NAVIGATOR, APPLICANT, makeDbClient, buildTestApp, JSON_HEADERS } from '../test/helpers.js';

const PACKET_ID = 'p0000000-0000-0000-0000-000000000001';
const FIELD_ID = 'f0000000-0000-0000-0000-000000000001';

afterEach(() => vi.resetAllMocks());

// ── 401 via full app ──────────────────────────────────────────────────────

describe('auth guard', () => {
  it('rejects requests with no Bearer token', async () => {
    const res = await fullApp.request(`/v1/enrollment/packets/${PACKET_ID}/fields`, {}, TEST_ENV);
    expect(res.status).toBe(401);
  });
});

// ── GET /packets/:packetId/fields ─────────────────────────────────────────

describe('GET /packets/:packetId/fields', () => {
  it('returns extraction fields on happy path', async () => {
    const fields = [
      { field_id: FIELD_ID, field_key: 'employer_name', needs_review: true, reviewed_at: null },
    ];
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: fields, error: null }));

    const res = await buildTestApp(fieldsRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/fields`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it('applicant can list fields (no role gate)', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: [], error: null }));

    const res = await buildTestApp(fieldsRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/fields`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
  });
});

// ── PATCH /fields/:fieldId/review ─────────────────────────────────────────

describe('PATCH /fields/:fieldId/review', () => {
  it('returns 400 when navigator_confirmed_value is missing', async () => {
    const res = await buildTestApp(fieldsRouter, '/', NAVIGATOR).request(
      `/fields/${FIELD_ID}/review`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({}) },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('confirms field value and returns 200 on happy path', async () => {
    const reviewed = {
      field_id: FIELD_ID,
      field_key: 'employer_name',
      navigator_confirmed_value: 'Acme Corp',
      reviewed_at: '2026-05-17T00:00:00Z',
    };
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: reviewed, error: null }));

    const res = await buildTestApp(fieldsRouter, '/', NAVIGATOR).request(
      `/fields/${FIELD_ID}/review`,
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ navigator_confirmed_value: 'Acme Corp' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { navigator_confirmed_value: string };
    expect(body.navigator_confirmed_value).toBe('Acme Corp');
  });

  it('returns 404 when field does not exist (PGRST116)', async () => {
    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'not found' } }),
    );

    const res = await buildTestApp(fieldsRouter, '/', NAVIGATOR).request(
      `/fields/missing/review`,
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ navigator_confirmed_value: 'x' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 422 when trigger blocks the review (P0001)', async () => {
    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: null, error: { code: 'P0001', message: 'Trigger blocked review' } }),
    );

    const res = await buildTestApp(fieldsRouter, '/', NAVIGATOR).request(
      `/fields/${FIELD_ID}/review`,
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ navigator_confirmed_value: 'x' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });
});
