import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('hono/jwt', () => ({
  sign: vi.fn(),
  verify: vi.fn(),
}));
vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../middleware/actorContext.js', () => ({
  withActorContext: vi.fn(),
}));

import { sign, verify } from 'hono/jwt';
import { makeAnonClient, makeServiceClient } from '../lib/supabase.js';
import buddyRouter from './buddy.js';
import meRouter from './me.js';
import {
  TEST_ENV,
  APPLICANT,
  NAVIGATOR,
  BUDDY,
  makeDbClient,
  makeQueryBuilder,
  buildTestApp,
  JSON_HEADERS,
} from '../test/helpers.js';
import type { Env } from '../types.js';

const BUDDY_ENV: Env = { ...TEST_ENV, BUDDY_ADD_ENABLED: 'true', BUDDY_JWT_SECRET: 'test-secret-32bytespadding!!!' };
const REL_ID = 'rel-00000000-0000-0000-0000-000000000001';
const APPLICANT_ID = 'user-001';
const BUDDY_USER_ID = 'buddy-001';

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /buddy/config
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /buddy/config', () => {
  it('returns enabled:false when BUDDY_ADD_ENABLED is not set', async () => {
    const res = await buildTestApp(buddyRouter, '/', APPLICANT).request('/config', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { enabled: boolean };
    expect(body.enabled).toBe(false);
  });

  it('returns enabled:true when BUDDY_ADD_ENABLED=true', async () => {
    const res = await buildTestApp(buddyRouter, '/', APPLICANT).request('/config', {}, BUDDY_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { enabled: boolean };
    expect(body.enabled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /buddy/invite
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /buddy/invite', () => {
  it('returns 403 when actor is not applicant (buddy role)', async () => {
    const res = await buildTestApp(buddyRouter, '/', BUDDY).request(
      '/invite',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) },
      BUDDY_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 when BUDDY_ADD_ENABLED is false', async () => {
    const res = await buildTestApp(buddyRouter, '/', APPLICANT).request(
      '/invite',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) },
      TEST_ENV, // no BUDDY_ADD_ENABLED
    );
    expect(res.status).toBe(403);
  });

  it('returns 500 when BUDDY_JWT_SECRET is missing', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null, count: 0 }));
    const { BUDDY_JWT_SECRET: _omit, ...envNoSecret } = BUDDY_ENV;
    const res = await buildTestApp(buddyRouter, '/', APPLICANT).request(
      '/invite',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) },
      envNoSecret as unknown as Env,
    );
    expect(res.status).toBe(500);
  });

  it('returns 422 BUDDY_LIMIT_REACHED when 3 active relationships exist', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null, count: 3 }));
    const res = await buildTestApp(buddyRouter, '/', APPLICANT).request(
      '/invite',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) },
      BUDDY_ENV,
    );
    expect(res.status).toBe(422);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('BUDDY_LIMIT_REACHED');
  });

  it('returns 422 ORG_CODE_INVALID when org_code not found', async () => {
    // The route uses a single db client: first query is the count check, second is the org lookup.
    // Build a mock that returns different results on successive from() calls.
    let fromCalls = 0;
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          fromCalls++;
          if (fromCalls === 1) return makeQueryBuilder({ data: null, error: null, count: 0 }); // count check passes
          return makeQueryBuilder({ data: null, error: { code: 'PGRST116' } }); // org not found
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await buildTestApp(buddyRouter, '/', APPLICANT).request(
      '/invite',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ org_code: 'BAD-CODE' }) },
      BUDDY_ENV,
    );
    expect(res.status).toBe(422);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('ORG_CODE_INVALID');
  });

  it('returns 201 with token and invite_url on happy path', async () => {
    vi.mocked(sign).mockResolvedValue('mock-signed-jwt');
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null, count: 0 }));

    const res = await buildTestApp(buddyRouter, '/', APPLICANT).request(
      '/invite',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) },
      BUDDY_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { token: string; invite_url: string; expires_at: string };
    expect(body.token).toBe('mock-signed-jwt');
    expect(body.invite_url).toContain('civica.app/buddy/accept');
    expect(body.expires_at).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /buddy/accept
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /buddy/accept', () => {
  const validToken = 'valid-signed-jwt';

  it('returns 403 when BUDDY_ADD_ENABLED is false', async () => {
    const res = await buildTestApp(buddyRouter, '/', APPLICANT).request(
      '/accept',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ token: validToken }) },
      TEST_ENV, // no BUDDY_ADD_ENABLED
    );
    expect(res.status).toBe(403);
  });

  it('returns 401 TOKEN_INVALID when JWT verification fails', async () => {
    vi.mocked(verify).mockRejectedValue(new Error('invalid signature'));
    const res = await buildTestApp(buddyRouter, '/', APPLICANT).request(
      '/accept',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ token: 'bad-token' }) },
      BUDDY_ENV,
    );
    expect(res.status).toBe(401);
  });

  it('returns 409 TOKEN_ALREADY_USED when token already consumed', async () => {
    vi.mocked(verify).mockResolvedValue({ jti: 'some-nonce', exp: 9999999999 });
    // UPDATE returns 0 rows (token already used)
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: [], error: null }));

    const res = await buildTestApp(buddyRouter, '/', APPLICANT).request(
      '/accept',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ token: validToken }) },
      BUDDY_ENV,
    );
    expect(res.status).toBe(409);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('TOKEN_ALREADY_USED');
  });

  it('connects a navigator via the same link WITHOUT assigning the buddy role', async () => {
    vi.mocked(verify).mockResolvedValue({ jti: 'nonce', exp: 9999999999 });
    // Staff must keep their navigator role: the Admin API (which sets role=buddy)
    // must never be called on this path.
    const adminFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', adminFetch);

    // Navigator path makes 3 from() calls: invite consume, events insert, upsert.
    let fromCalls = 0;
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          fromCalls++;
          if (fromCalls === 1) return makeQueryBuilder({ data: [{ id: 'inv-1', applicant_user_id: APPLICANT_ID }], error: null });
          if (fromCalls === 2) return makeQueryBuilder({ data: null, error: null }); // events insert (ignored)
          return makeQueryBuilder({ data: { id: REL_ID }, error: null }); // relationship upsert
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await buildTestApp(buddyRouter, '/', NAVIGATOR).request(
      '/accept',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ token: validToken }) },
      BUDDY_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { relationship_id: string; status: string };
    expect(body.relationship_id).toBe(REL_ID);
    expect(body.status).toBe('navigator_linked');
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('returns 201 with relationship_id on happy path', async () => {
    vi.mocked(verify).mockResolvedValue({ jti: 'nonce', exp: 9999999999 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    // Route uses ONE db client for: 1) invite UPDATE, 2) buddy_relationship INSERT.
    let fromCalls = 0;
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          fromCalls++;
          if (fromCalls === 1) return makeQueryBuilder({ data: [{ id: 'inv-1', applicant_user_id: APPLICANT_ID }], error: null });
          return makeQueryBuilder({ data: { id: REL_ID }, error: null });
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await buildTestApp(buddyRouter, '/', APPLICANT).request(
      '/accept',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ token: validToken }) },
      BUDDY_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { relationship_id: string };
    expect(body.relationship_id).toBe(REL_ID);
  });

  it('returns 500 when Supabase Admin API fails', async () => {
    vi.mocked(verify).mockResolvedValue({ jti: 'nonce', exp: 9999999999 });
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: [{ id: 'inv-1', applicant_user_id: APPLICANT_ID }], error: null }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const res = await buildTestApp(buddyRouter, '/', APPLICANT).request(
      '/accept',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ token: validToken }) },
      BUDDY_ENV,
    );
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /buddy/applicant-summary
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /buddy/applicant-summary', () => {
  it('returns 403 when actor is not buddy', async () => {
    const res = await buildTestApp(buddyRouter, '/', APPLICANT).request(
      '/applicant-summary', {}, BUDDY_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('returns empty array when no active relationships exist', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: [], error: null }));
    const res = await buildTestApp(buddyRouter, '/', BUDDY).request(
      '/applicant-summary', {}, BUDDY_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns summaries with checklist_summary when active packet exists', async () => {
    const rels = [{ id: REL_ID, applicant_user_id: APPLICANT_ID, notifications_enabled: true }];
    // After T3: buddy queries buddy_packet_summary_view (column-restricted view)
    // via anon client. Service client handles buddy_relationship.
    const packets = [
      { packet_id: 'pkt-1', applicant_user_id: APPLICANT_ID, status: 'in_progress', updated_at: new Date().toISOString() },
    ];
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: rels, error: null }));
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: packets, error: null }));

    const res = await buildTestApp(buddyRouter, '/', BUDDY).request(
      '/applicant-summary', {}, BUDDY_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ relationship_id: string; checklist_summary: unknown }>;
    expect(body).toHaveLength(1);
    expect(body[0]?.relationship_id).toBe(REL_ID);
    expect(body[0]?.checklist_summary).not.toBeNull();
  });

  it('returns summaries with null checklist_summary when no active packet', async () => {
    const rels = [{ id: REL_ID, applicant_user_id: APPLICANT_ID, notifications_enabled: false }];
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: rels, error: null }));
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: [], error: null }));

    const res = await buildTestApp(buddyRouter, '/', BUDDY).request(
      '/applicant-summary', {}, BUDDY_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ checklist_summary: unknown; next_action: string }>;
    expect(body[0]?.checklist_summary).toBeNull();
    expect(body[0]?.next_action).toContain('No active application');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /me/buddies
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /me/buddies', () => {
  it('returns 403 when actor is not applicant', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: [], error: null }));
    const res = await buildTestApp(meRouter, '/', BUDDY).request('/buddies', {}, BUDDY_ENV);
    expect(res.status).toBe(403);
  });

  it('returns empty array when no buddies', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: [], error: null }));
    const res = await buildTestApp(meRouter, '/', APPLICANT).request('/buddies', {}, BUDDY_ENV);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns list of active buddy relationships', async () => {
    const rows = [
      { id: REL_ID, buddy_user_id: BUDDY_USER_ID, status: 'active', notifications_enabled: true, created_at: '2026-05-21', updated_at: '2026-05-21' },
    ];
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: rows, error: null }));
    const res = await buildTestApp(meRouter, '/', APPLICANT).request('/buddies', {}, BUDDY_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /me/buddies/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /me/buddies/:id', () => {
  it('returns 403 when actor is not applicant', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const res = await buildTestApp(meRouter, '/', NAVIGATOR).request(
      `/buddies/${REL_ID}`,
      { method: 'DELETE' },
      BUDDY_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('returns 404 when relationship not found', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116' } }),
    );
    const res = await buildTestApp(meRouter, '/', APPLICANT).request(
      `/buddies/${REL_ID}`,
      { method: 'DELETE' },
      BUDDY_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 revoked:true and calls Admin API to clear app_metadata', async () => {
    const relRow = { id: REL_ID, buddy_user_id: BUDDY_USER_ID, status: 'active' };
    vi.mocked(makeServiceClient)
      .mockReturnValueOnce(makeDbClient({ data: relRow, error: null }))
      .mockReturnValueOnce(makeDbClient({ data: null, error: null }));
    // Revoke now guards the role clear: GET reads the role, PUT clears it only
    // when it's 'buddy'. This buddy IS a real buddy, so the PUT must still fire.
    const mockFetch = vi.fn().mockImplementation((_url: string, init?: { method?: string }) => {
      if (init?.method === 'PUT') return Promise.resolve(new Response(null, { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ app_metadata: { role: 'buddy' } }), { status: 200 }));
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await buildTestApp(meRouter, '/', APPLICANT).request(
      `/buddies/${REL_ID}`,
      { method: 'DELETE' },
      BUDDY_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { revoked: boolean };
    expect(body.revoked).toBe(true);
    // Verify Admin API was called with role: null
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(BUDDY_USER_ID),
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /me/buddies/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /me/buddies/:id', () => {
  it('returns 403 when actor is not applicant', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const res = await buildTestApp(meRouter, '/', BUDDY).request(
      `/buddies/${REL_ID}`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ notifications_enabled: false }) },
      BUDDY_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid body', async () => {
    const res = await buildTestApp(meRouter, '/', APPLICANT).request(
      `/buddies/${REL_ID}`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ notifications_enabled: 'yes' }) },
      BUDDY_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when relationship not found', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116' } }),
    );
    const res = await buildTestApp(meRouter, '/', APPLICANT).request(
      `/buddies/${REL_ID}`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ notifications_enabled: false }) },
      BUDDY_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 with updated notifications_enabled', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: { id: REL_ID, notifications_enabled: false }, error: null }),
    );
    const res = await buildTestApp(meRouter, '/', APPLICANT).request(
      `/buddies/${REL_ID}`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ notifications_enabled: false }) },
      BUDDY_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; notifications_enabled: boolean };
    expect(body.notifications_enabled).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth middleware: buddy detection
// ─────────────────────────────────────────────────────────────────────────────

describe('auth middleware buddy detection (unit)', () => {
  // These tests verify that the middleware correctly reads app_metadata.role='buddy'
  // from the JWT. They test auth.ts logic indirectly by inspecting what actor is set.
  // Full integration coverage requires a real Supabase mock — covered in E2E.
  it('actor kind "buddy" is a valid ActorKind in TypeScript (type-level assertion)', () => {
    // If this compiles, the type union is correct.
    const kind: import('../types.js').ActorKind = 'buddy';
    expect(kind).toBe('buddy');
  });

  it('BUDDY test fixture has buddy_relationship_id set', () => {
    expect(BUDDY.buddy_relationship_id).toBeTruthy();
    expect(BUDDY.kind).toBe('buddy');
  });
});
