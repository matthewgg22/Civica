import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import meRouter from './me.js';
import { makeServiceClient } from '../lib/supabase.js';
import { TEST_ENV, APPLICANT, NAVIGATOR, makeDbClient, buildTestApp, JSON_HEADERS } from '../test/helpers.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

// fetch mock for clearBuddyRoleIfBuddy: GET reads the role, PUT clears it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function roleFetchMock(role: string): any {
  return vi.fn().mockImplementation((_url: string, init?: { method?: string }) => {
    if (init?.method === 'PUT') return Promise.resolve(new Response(null, { status: 200 }));
    return Promise.resolve(
      new Response(JSON.stringify({ app_metadata: { role } }), { status: 200 }),
    );
  });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const putCallOf = (m: any) =>
  m.mock.calls.find((c: unknown[]) => (c[1] as { method?: string } | undefined)?.method === 'PUT');

describe('GET /me/buddies', () => {
  it('returns 403 for a non-applicant', async () => {
    const res = await buildTestApp(meRouter, '/me', NAVIGATOR).request('/me/buddies', {}, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it('applicant: lists pending requests with ?status=pending', async () => {
    const rows = [{ id: 'br-1', buddy_user_id: 'nav-001', status: 'pending', org_id: null, notifications_enabled: true, created_at: 'x', updated_at: 'y' }];
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: rows, error: null }));
    const res = await buildTestApp(meRouter, '/me', APPLICANT).request('/me/buddies?status=pending', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ status: string }>;
    expect(body[0]!.status).toBe('pending');
  });
});

describe('POST /me/buddies/:id/approve', () => {
  it('applicant: approves a pending request → active', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: { id: 'br-1', status: 'active' }, error: null }));
    const res = await buildTestApp(meRouter, '/me', APPLICANT).request('/me/buddies/br-1/approve', { method: 'POST', headers: JSON_HEADERS }, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('active');
  });

  it('404 when no pending request matches', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: { code: 'PGRST116', message: 'no rows' } }));
    const res = await buildTestApp(meRouter, '/me', APPLICANT).request('/me/buddies/missing/approve', { method: 'POST', headers: JSON_HEADERS }, TEST_ENV);
    expect(res.status).toBe(404);
  });

  it('403 for a non-applicant', async () => {
    const res = await buildTestApp(meRouter, '/me', NAVIGATOR).request('/me/buddies/br-1/approve', { method: 'POST', headers: JSON_HEADERS }, TEST_ENV);
    expect(res.status).toBe(403);
  });
});

describe('POST /me/buddies/:id/decline', () => {
  it('declines a caseworker request WITHOUT clearing their staff role', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: { id: 'br-1', buddy_user_id: 'nav-001', status: 'revoked' }, error: null }));
    const fetchMock = roleFetchMock('navigator');
    globalThis.fetch = fetchMock as never;

    const res = await buildTestApp(meRouter, '/me', APPLICANT).request('/me/buddies/br-1/decline', { method: 'POST', headers: JSON_HEADERS }, TEST_ENV);
    expect(res.status).toBe(200);
    expect((await res.json() as { declined: boolean }).declined).toBe(true);
    // The caseworker's role is read (GET) but NEVER nulled (no PUT).
    expect(putCallOf(fetchMock)).toBeUndefined();
  });

  it('clears the role for a real buddy (role=buddy)', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: { id: 'br-2', buddy_user_id: 'buddy-001', status: 'revoked' }, error: null }));
    const fetchMock = roleFetchMock('buddy');
    globalThis.fetch = fetchMock as never;

    const res = await buildTestApp(meRouter, '/me', APPLICANT).request('/me/buddies/br-2/decline', { method: 'POST', headers: JSON_HEADERS }, TEST_ENV);
    expect(res.status).toBe(200);
    expect(putCallOf(fetchMock)).toBeDefined();
  });

  it('404 when no pending request matches', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: { code: 'PGRST116', message: 'no rows' } }));
    const res = await buildTestApp(meRouter, '/me', APPLICANT).request('/me/buddies/missing/decline', { method: 'POST', headers: JSON_HEADERS }, TEST_ENV);
    expect(res.status).toBe(404);
  });
});
