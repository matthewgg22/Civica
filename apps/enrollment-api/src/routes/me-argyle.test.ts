import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../lib/applicant.js', () => ({
  getOrCreateApplicant: vi.fn(),
}));

import { makeServiceClient } from '../lib/supabase.js';
import { getOrCreateApplicant } from '../lib/applicant.js';
import meArgyleRouter from './me-argyle.js';
import {
  TEST_ENV,
  APPLICANT,
  NAVIGATOR,
  makeDbClient,
  makeQueryBuilder,
  buildTestApp,
  JSON_HEADERS,
} from '../test/helpers.js';

afterEach(() => vi.resetAllMocks());

const APPLICANT_ID = 'a0000000-0000-0000-0000-000000000001';
const PACKET_ID   = 'b0000000-0000-0000-0000-000000000001';
const ARGYLE_USER = 'argyle-user-abc123';
const CONNECTION_ID = 'c0000000-0000-0000-0000-000000000001';

const MOCK_APPLICANT = { applicant_id: APPLICANT_ID, state_code: 'CA', preferred_language: 'en' };

const MOCK_CONNECTION = {
  connection_id: CONNECTION_ID,
  argyle_user_id: ARGYLE_USER,
  linked_accounts: [],
  linked_at: '2026-05-19T00:00:00Z',
  revoked_at: null,
};

// ---------------------------------------------------------------------------
// GET /me/argyle/connect
// ---------------------------------------------------------------------------

describe('GET /me/argyle/connect', () => {
  it('returns linked=true when active connection exists', async () => {
    vi.mocked(getOrCreateApplicant).mockResolvedValue(MOCK_APPLICANT as never);
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: MOCK_CONNECTION, error: null }),
    );

    const app = buildTestApp(meArgyleRouter, '/me/argyle/connect', APPLICANT);
    const res = await app.request('/me/argyle/connect', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { linked: boolean; connection: unknown };
    expect(body.linked).toBe(true);
    expect(body.connection).not.toBeNull();
  });

  it('returns linked=false when no active connection', async () => {
    vi.mocked(getOrCreateApplicant).mockResolvedValue(MOCK_APPLICANT as never);
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: null, error: null }),
    );

    const app = buildTestApp(meArgyleRouter, '/me/argyle/connect', APPLICANT);
    const res = await app.request('/me/argyle/connect', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { linked: boolean };
    expect(body.linked).toBe(false);
  });

  it('returns 403 for navigator role', async () => {
    const app = buildTestApp(meArgyleRouter, '/me/argyle/connect', NAVIGATOR);
    const res = await app.request('/me/argyle/connect', {}, TEST_ENV);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /me/argyle/connect
// ---------------------------------------------------------------------------

describe('POST /me/argyle/connect', () => {
  it('returns 201 and new connection on happy path', async () => {
    vi.mocked(getOrCreateApplicant).mockResolvedValue(MOCK_APPLICANT as never);

    // makeServiceClient is called once; shared client handles revoke update + insert
    const fromMock = vi.fn()
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null })) // revoke existing
      .mockReturnValueOnce(makeQueryBuilder({                               // insert new
        data: { connection_id: CONNECTION_ID, argyle_user_id: ARGYLE_USER, linked_at: '2026-05-19T00:00:00Z' },
        error: null,
      }));

    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({ from: fromMock }),
    } as never);

    const app = buildTestApp(meArgyleRouter, '/me/argyle/connect', APPLICANT);
    const res = await app.request(
      '/me/argyle/connect',
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ argyle_user_id: ARGYLE_USER, packet_id: PACKET_ID }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { linked: boolean; connection: { argyle_user_id: string } };
    expect(body.linked).toBe(true);
    expect(body.connection.argyle_user_id).toBe(ARGYLE_USER);
  });

  it('returns 400 when argyle_user_id is missing', async () => {
    const app = buildTestApp(meArgyleRouter, '/me/argyle/connect', APPLICANT);
    const res = await app.request(
      '/me/argyle/connect',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 for navigator role', async () => {
    const app = buildTestApp(meArgyleRouter, '/me/argyle/connect', NAVIGATOR);
    const res = await app.request(
      '/me/argyle/connect',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ argyle_user_id: ARGYLE_USER }) },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// DELETE /me/argyle/connect
// ---------------------------------------------------------------------------

describe('DELETE /me/argyle/connect', () => {
  it('returns linked=false after revoking connection', async () => {
    vi.mocked(getOrCreateApplicant).mockResolvedValue(MOCK_APPLICANT as never);
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: { connection_id: CONNECTION_ID }, error: null }),
    );

    const app = buildTestApp(meArgyleRouter, '/me/argyle/connect', APPLICANT);
    const res = await app.request('/me/argyle/connect', { method: 'DELETE' }, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { linked: boolean };
    expect(body.linked).toBe(false);
  });

  it('returns 404 when no active connection to revoke', async () => {
    vi.mocked(getOrCreateApplicant).mockResolvedValue(MOCK_APPLICANT as never);
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: null, error: null }),
    );

    const app = buildTestApp(meArgyleRouter, '/me/argyle/connect', APPLICANT);
    const res = await app.request('/me/argyle/connect', { method: 'DELETE' }, TEST_ENV);
    expect(res.status).toBe(404);
  });

  it('returns 403 for navigator role', async () => {
    const app = buildTestApp(meArgyleRouter, '/me/argyle/connect', NAVIGATOR);
    const res = await app.request('/me/argyle/connect', { method: 'DELETE' }, TEST_ENV);
    expect(res.status).toBe(403);
  });
});
