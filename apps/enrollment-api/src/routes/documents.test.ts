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
import documentsRouter from './documents.js';
import { app as fullApp } from '../index.js';
import { TEST_ENV, NAVIGATOR, APPLICANT, makeDbClient, buildTestApp, JSON_HEADERS } from '../test/helpers.js';

const PACKET_ID = 'c0000000-0000-0000-0000-000000000001';
const DOC_ID = 'd0000000-0000-0000-0000-000000000001';

afterEach(() => vi.resetAllMocks());

// ── 401 via full app ──────────────────────────────────────────────────────

describe('auth guard', () => {
  it('rejects requests with no Bearer token', async () => {
    const res = await fullApp.request(`/v1/enrollment/packets/${PACKET_ID}/documents`, {}, TEST_ENV);
    expect(res.status).toBe(401);
  });
});

// ── GET /packets/:packetId/documents ──────────────────────────────────────

describe('GET /packets/:packetId/documents', () => {
  it('returns document list on happy path', async () => {
    const docs = [{ document_id: DOC_ID, document_kind: 'paystub', uploaded_at: '2026-05-01T00:00:00Z' }];
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: docs, error: null }));

    const res = await buildTestApp(documentsRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/documents`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it('applicant can list documents (no role gate)', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: [], error: null }));

    const res = await buildTestApp(documentsRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/documents`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
  });
});

// ── POST /documents ───────────────────────────────────────────────────────

describe('POST /documents', () => {
  it('returns 400 for invalid document_kind', async () => {
    const res = await buildTestApp(documentsRouter, '/', APPLICANT).request(
      `/documents`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          packet_id: PACKET_ID,
          applicant_id: 'a0000000-0000-0000-0000-000000000001',
          storage_path: 'docs/test.jpg',
          document_kind: 'invalid_kind',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when storage_path is missing', async () => {
    const res = await buildTestApp(documentsRouter, '/', APPLICANT).request(
      `/documents`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          packet_id: PACKET_ID,
          applicant_id: 'a0000000-0000-0000-0000-000000000001',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('creates document and returns 201 on happy path', async () => {
    const created = { document_id: DOC_ID, document_kind: 'paystub' };
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: created, error: null }));

    const res = await buildTestApp(documentsRouter, '/', APPLICANT).request(
      `/documents`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          packet_id: PACKET_ID,
          applicant_id: 'a0000000-0000-0000-0000-000000000001',
          storage_path: 'docs/test.jpg',
          document_kind: 'paystub',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { document_id: string };
    expect(body.document_id).toBe(DOC_ID);
  });
});

// ── PATCH /documents/:documentId ─────────────────────────────────────────

describe('PATCH /documents/:documentId', () => {
  it('returns 400 for invalid processing_status', async () => {
    const res = await buildTestApp(documentsRouter, '/', NAVIGATOR).request(
      `/documents/${DOC_ID}`,
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ processing_status: 'not_a_status' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('updates classification and returns 200 on happy path', async () => {
    const updated = { document_id: DOC_ID, document_kind: 'photo_id' };
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: updated, error: null }));

    const res = await buildTestApp(documentsRouter, '/', NAVIGATOR).request(
      `/documents/${DOC_ID}`,
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ document_kind: 'photo_id', processing_status: 'complete' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { document_id: string };
    expect(body.document_id).toBe(DOC_ID);
  });

  it('returns 404 when document does not exist', async () => {
    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'not found' } }),
    );

    const res = await buildTestApp(documentsRouter, '/', NAVIGATOR).request(
      `/documents/missing`,
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ processing_status: 'complete' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });
});

// ── DELETE /documents/:documentId ─────────────────────────────────────────

describe('DELETE /documents/:documentId', () => {
  it('returns 204 on soft-delete happy path', async () => {
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(documentsRouter, '/', NAVIGATOR).request(
      `/documents/${DOC_ID}`,
      { method: 'DELETE' },
      TEST_ENV,
    );
    expect(res.status).toBe(204);
  });
});
