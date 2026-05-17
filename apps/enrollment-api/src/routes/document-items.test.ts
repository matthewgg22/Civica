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
import documentItemsRouter from './document-items.js';
import { app as fullApp } from '../index.js';
import { TEST_ENV, NAVIGATOR, APPLICANT, makeDbClient, buildTestApp, JSON_HEADERS } from '../test/helpers.js';

const PACKET_ID = 'p0000000-0000-0000-0000-000000000001';
const ITEM_ID = 'i0000000-0000-0000-0000-000000000001';

afterEach(() => vi.resetAllMocks());

// ── 401 via full app ──────────────────────────────────────────────────────

describe('auth guard', () => {
  it('rejects requests with no Bearer token', async () => {
    const res = await fullApp.request(`/v1/enrollment/packets/${PACKET_ID}/document-items`, {}, TEST_ENV);
    expect(res.status).toBe(401);
  });
});

// ── GET /packets/:packetId/document-items ─────────────────────────────────

describe('GET /packets/:packetId/document-items', () => {
  it('returns checklist on happy path', async () => {
    const items = [{ item_id: ITEM_ID, label: 'Photo ID', is_required: true, resolved_at: null }];
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: items, error: null }));

    const res = await buildTestApp(documentItemsRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/document-items`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it('applicant can list document-items (no role gate)', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: [], error: null }));

    const res = await buildTestApp(documentItemsRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/document-items`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
  });
});

// ── PATCH /document-items/:itemId/resolve ─────────────────────────────────

describe('PATCH /document-items/:itemId/resolve', () => {
  it('resolves item and returns 200 on happy path', async () => {
    const resolved = { item_id: ITEM_ID, resolved_at: '2026-05-17T00:00:00Z', waived_at: null };
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: resolved, error: null }));

    const res = await buildTestApp(documentItemsRouter, '/', NAVIGATOR).request(
      `/document-items/${ITEM_ID}/resolve`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({}) },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { item_id: string };
    expect(body.item_id).toBe(ITEM_ID);
  });

  it('returns 404 when item does not exist', async () => {
    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'not found' } }),
    );

    const res = await buildTestApp(documentItemsRouter, '/', NAVIGATOR).request(
      `/document-items/missing/resolve`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({}) },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when resolved_document_id is not a valid UUID', async () => {
    const res = await buildTestApp(documentItemsRouter, '/', NAVIGATOR).request(
      `/document-items/${ITEM_ID}/resolve`,
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ resolved_document_id: 'not-a-uuid' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });
});

// ── PATCH /document-items/:itemId/waive ───────────────────────────────────

describe('PATCH /document-items/:itemId/waive', () => {
  it('returns 400 when waive_reason is empty', async () => {
    const res = await buildTestApp(documentItemsRouter, '/', NAVIGATOR).request(
      `/document-items/${ITEM_ID}/waive`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ waive_reason: '' }) },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when waive_reason is missing', async () => {
    const res = await buildTestApp(documentItemsRouter, '/', NAVIGATOR).request(
      `/document-items/${ITEM_ID}/waive`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({}) },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('waives item and returns 200 on happy path', async () => {
    const waived = { item_id: ITEM_ID, waived_at: '2026-05-17T00:00:00Z', waive_reason: 'exempt by policy' };
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: waived, error: null }));

    const res = await buildTestApp(documentItemsRouter, '/', NAVIGATOR).request(
      `/document-items/${ITEM_ID}/waive`,
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ waive_reason: 'exempt by policy' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { waive_reason: string };
    expect(body.waive_reason).toBe('exempt by policy');
  });
});
