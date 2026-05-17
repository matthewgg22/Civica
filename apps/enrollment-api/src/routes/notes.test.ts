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
import notesRouter from './notes.js';
import fullApp from '../index.js';
import { TEST_ENV, NAVIGATOR, APPLICANT, makeDbClient, buildTestApp, JSON_HEADERS } from '../test/helpers.js';

const PACKET_ID = 'p0000000-0000-0000-0000-000000000001';
const NOTE_ID = 'n0000000-0000-0000-0000-000000000001';

afterEach(() => vi.resetAllMocks());

// ── 401 via full app ──────────────────────────────────────────────────────

describe('auth guard', () => {
  it('rejects requests with no Bearer token', async () => {
    const res = await fullApp.request(`/v1/enrollment/packets/${PACKET_ID}/notes`, {}, TEST_ENV);
    expect(res.status).toBe(401);
  });
});

// ── GET /packets/:packetId/notes ──────────────────────────────────────────

describe('GET /packets/:packetId/notes', () => {
  it('returns notes list on happy path', async () => {
    const notes = [{ note_id: NOTE_ID, is_internal: false, created_at: '2026-05-01T00:00:00Z' }];
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: notes, error: null }));

    const res = await buildTestApp(notesRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/notes`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  it('applicant can list notes (RLS filters internal ones)', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: [], error: null }));

    const res = await buildTestApp(notesRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/notes`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
  });
});

// ── POST /packets/:packetId/notes ─────────────────────────────────────────

describe('POST /packets/:packetId/notes', () => {
  it('returns 403 for applicant', async () => {
    const res = await buildTestApp(notesRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/notes`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ body_ciphertext: 'abc', is_internal: true }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when body_ciphertext is empty', async () => {
    const res = await buildTestApp(notesRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/notes`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ body_ciphertext: '' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('creates note and returns 201 on happy path', async () => {
    const created = { note_id: NOTE_ID, is_internal: true, body_ciphertext: 'ciphertext' };
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: created, error: null }));

    const res = await buildTestApp(notesRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/notes`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ body_ciphertext: 'ciphertext', is_internal: true }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { note_id: string };
    expect(body.note_id).toBe(NOTE_ID);
  });
});

// ── DELETE /notes/:noteId ─────────────────────────────────────────────────

describe('DELETE /notes/:noteId', () => {
  it('returns 403 for applicant', async () => {
    const res = await buildTestApp(notesRouter, '/', APPLICANT).request(
      `/notes/${NOTE_ID}`,
      { method: 'DELETE' },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('returns 204 on successful soft-delete', async () => {
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(notesRouter, '/', NAVIGATOR).request(
      `/notes/${NOTE_ID}`,
      { method: 'DELETE' },
      TEST_ENV,
    );
    expect(res.status).toBe(204);
  });
});
