import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase.js');
vi.mock('../auth/staffLookup.js', () => ({
  resolveStaffId: vi.fn(),
}));

import { buildApp } from '../app.js';
import { _resetSecretCache } from '../auth/verify.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { resolveStaffId } from '../auth/staffLookup.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAdmin = supabaseAdmin as any;

// ── Helpers ───────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-secret-that-is-at-least-32-bytes!!';

async function staffToken(sub = 'staff-sub-1', role = 'navigator'): Promise<string> {
  return new SignJWT({ sub, email: 'nav@civica.org', app_metadata: { role } })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .setSubject(sub)
    .sign(new TextEncoder().encode(TEST_SECRET));
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Builds a Supabase-shaped chainable query mock.
 * Each resolved call pops the next item from `results`.
 * null → { data: null, error: { code: 'PGRST116' } } (simulate not-found).
 * undefined → { data: [], error: null } (simulate empty array).
 */
function makeSupabase(results: (Record<string, unknown> | null | Record<string, unknown>[] | undefined)[]) {
  let idx = 0;

  const resolve = () => {
    const val = results[idx++];
    if (val === null) return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
    if (val === undefined) return Promise.resolve({ data: [], error: null });
    if (Array.isArray(val)) return Promise.resolve({ data: val, error: null });
    return Promise.resolve({ data: val, error: null });
  };

  const chain: Record<string, unknown> = {};
  const noop = () => chain;
  Object.assign(chain, {
    from: noop,
    schema: () => chain,
    select: noop,
    insert: noop,
    update: noop,
    upsert: noop,
    delete: noop,
    eq: noop,
    neq: noop,
    is: noop,
    gt: noop,
    gte: noop,
    lt: noop,
    lte: noop,
    in: noop,
    order: noop,
    limit: noop,
    range: noop,
    single: resolve,
    // Awaiting the chain directly (without .single()) also pops from the queue.
    then: (fn: (v: unknown) => unknown, onRej?: (e: unknown) => unknown) =>
      resolve().then(fn, onRej),
  });

  return chain as unknown as typeof supabaseAdmin;
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_JWT_SECRET', TEST_SECRET);
  _resetSecretCache();

  // Default: rpc (set_config) always succeeds
  mockAdmin.rpc = vi.fn().mockResolvedValue({ data: null, error: null });

  // Default: staff lookup returns a valid staff_id (resets after each test)
  vi.mocked(resolveStaffId).mockResolvedValue('staff-row-1');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  _resetSecretCache();
});

// ── GET /navigator/sessions ───────────────────────────────────────────────

describe('GET /navigator/sessions', () => {
  it('returns sessions list', async () => {
    const mockSb = makeSupabase([[{ packet_id: 'pkt-1', status: 'In Navigator Review', state_code: 'CA', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), packet_assignments: [] }]]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions', { headers: auth(token) });
    expect(res.status).toBe(200);
    const body = await res.json() as { sessions: unknown[] };
    expect(body.sessions).toHaveLength(1);
  });

  it('accepts status filter without error', async () => {
    const mockSb = makeSupabase([[]]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions?status=In+Navigator+Review', { headers: auth(token) });
    expect(res.status).toBe(200);
  });
});

// ── GET /navigator/sessions/:id ───────────────────────────────────────────

describe('GET /navigator/sessions/:id', () => {
  it('returns 404 when session not found', async () => {
    const mockSb = makeSupabase([null]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/missing', { headers: auth(token) });
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('session_not_found');
  });

  it('returns session detail with related data', async () => {
    const packet = { packet_id: 'pkt-1', status: 'In Navigator Review', state_code: 'CA', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    // First single() = packet; then three parallel queries each return arrays via `then`
    const mockSb = makeSupabase([packet, [{ assignment_id: 'asgn-1', staff_id: 'nav-1', is_current: true }], [], []]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1', { headers: auth(token) });
    expect(res.status).toBe(200);
    const body = await res.json() as { session: { session_id: string }; assignment: { assignment_id: string } | null };
    expect(body.session.session_id).toBe('pkt-1');
  });
});

// ── PATCH /navigator/sessions/:id/status ─────────────────────────────────

describe('PATCH /navigator/sessions/:id/status', () => {
  it('returns 400 when `to` field is missing', async () => {
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/status', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string; field: string };
    expect(body.error).toBe('missing_field');
    expect(body.field).toBe('to');
  });

  it('returns 404 when session not found', async () => {
    const mockSb = makeSupabase([null]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/missing/status', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'In Navigator Review' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 422 with not_assigned when moving to In Navigator Review without assignment', async () => {
    const packet = { packet_id: 'pkt-1', status: 'Submitted for Review' };
    const mockSb = makeSupabase([packet, [], []]); // packet, no assignment, no unresolved items
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/status', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'In Navigator Review' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('not_assigned');
  });

  it('returns 422 with missing_required_docs when unresolved items block Ready for Handoff', async () => {
    const packet = { packet_id: 'pkt-1', status: 'In Navigator Review' };
    const mockSb = makeSupabase([packet, [{ assignment_id: 'asgn-1' }], [{ request_id: 'req-1' }]]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/status', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'Ready for Handoff' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('missing_required_docs');
  });

  it('returns 422 with terminal_state when packet is Handed Off', async () => {
    const packet = { packet_id: 'pkt-1', status: 'Handed Off' };
    const mockSb = makeSupabase([packet, [], []]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/status', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'In Navigator Review' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('terminal_state');
  });

  it('transitions and returns updated status when guard passes', async () => {
    const packet = { packet_id: 'pkt-1', status: 'Submitted for Review' };
    // packet, assignment (has), no unresolved, update result
    const mockSb = makeSupabase([packet, [{ assignment_id: 'asgn-1' }], [], { packet_id: 'pkt-1', status: 'In Navigator Review' }]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/status', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'In Navigator Review' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('In Navigator Review');
  });
});

// ── POST /navigator/sessions/:id/assign ──────────────────────────────────

describe('POST /navigator/sessions/:id/assign', () => {
  it('returns 400 when navigator_id is missing', async () => {
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/assign', {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { field: string };
    expect(body.field).toBe('navigator_id');
  });

  it('returns 404 when session not found', async () => {
    const mockSb = makeSupabase([null]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/missing/assign', {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ navigator_id: 'nav-1' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 201 with assignment on success', async () => {
    const at = new Date().toISOString();
    const mockSb = makeSupabase([
      { packet_id: 'pkt-1' },                                                   // packet lookup
      { data: null, error: null } as unknown as Record<string, unknown>,          // unassign (no-op)
      { assignment_id: 'asgn-new', staff_id: 'nav-1', assigned_at: at },          // new assignment
    ]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/assign', {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ navigator_id: 'nav-1' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { assignment: { assignment_id: string } };
    expect(body.assignment.assignment_id).toBe('asgn-new');
  });
});

// ── POST /navigator/sessions/:id/notes ───────────────────────────────────

describe('POST /navigator/sessions/:id/notes', () => {
  it('returns 400 when body is empty', async () => {
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/notes', {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: '   ' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 201 with note on success', async () => {
    const at = new Date().toISOString();
    const mockSb = makeSupabase([
      { packet_id: 'pkt-1' },
      { note_id: 'note-1', author_staff_id: 'staff-sub-1', body_ciphertext: 'Great progress', created_at: at },
    ]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/notes', {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Great progress' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { note: { note_id: string } };
    expect(body.note.note_id).toBe('note-1');
  });
});

// ── POST /navigator/sessions/:id/missing-items ────────────────────────────

describe('POST /navigator/sessions/:id/missing-items', () => {
  it('returns 400 when item_type is missing', async () => {
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/missing-items', {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { field: string };
    expect(body.field).toBe('item_type');
  });

  it('returns 201 on success', async () => {
    const at = new Date().toISOString();
    const mockSb = makeSupabase([
      { packet_id: 'pkt-1' },
      { request_id: 'req-1', message_ciphertext: 'paystub: Most recent', status: 'pending', sent_at: at },
    ]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/missing-items', {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_type: 'paystub', item_description: 'Most recent' }),
    });
    expect(res.status).toBe(201);
  });
});

// ── PATCH /navigator/sessions/:id/missing-items/:itemId ──────────────────

describe('PATCH /navigator/sessions/:id/missing-items/:itemId', () => {
  it('returns 404 when item not found', async () => {
    const mockSb = makeSupabase([null]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/missing-items/bad-id', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('missing_item_not_found');
  });

  it('returns 409 when item already resolved', async () => {
    const mockSb = makeSupabase([
      { request_id: 'req-1', packet_id: 'pkt-1', status: 'resolved' },
    ]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/missing-items/req-1', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution_note: 'done' }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('already_resolved');
  });

  it('returns 200 with resolved item on success', async () => {
    const at = new Date().toISOString();
    const mockSb = makeSupabase([
      { request_id: 'req-1', packet_id: 'pkt-1', status: 'pending' },
      { request_id: 'req-1', status: 'resolved', resolved_at: at, resolved_by_staff_id: 'staff-sub-1' },
    ]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/missing-items/req-1', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution_note: 'uploaded by applicant' }),
    });
    expect(res.status).toBe(200);
  });
});

// ── GET /navigator/sessions/:id/audit-log ────────────────────────────────

describe('GET /navigator/sessions/:id/audit-log', () => {
  it('returns 404 when session not found', async () => {
    const mockSb = makeSupabase([null]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/missing/audit-log', {
      headers: auth(token),
    });
    expect(res.status).toBe(404);
  });

  it('returns entries with pagination metadata', async () => {
    const mockSb = makeSupabase([
      { packet_id: 'pkt-1' },
      [{ audit_id: 'a-1', table_name: 'snap_packets', operation: 'UPDATE' }],
    ]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/audit-log?limit=10&offset=0', {
      headers: auth(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { entries: unknown[]; limit: number; offset: number };
    expect(body.entries).toHaveLength(1);
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
  });

  it('caps limit at 200', async () => {
    const mockSb = makeSupabase([{ packet_id: 'pkt-1' }, []]);
    mockAdmin.schema = vi.fn().mockReturnValue(mockSb);

    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/pkt-1/audit-log?limit=9999', {
      headers: auth(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { limit: number };
    expect(body.limit).toBe(200);
  });
});
