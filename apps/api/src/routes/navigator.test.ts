import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/client.js');
vi.mock('../audit/withAudit.js');

import { buildApp } from '../app.js';
import { _resetSecretCache } from '../auth/verify.js';
import { withAudit } from '../audit/withAudit.js';
import { getDb } from '../db/client.js';

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

function json(body: unknown) {
  return { 'Content-Type': 'application/json', ...({} as Record<string, string>) };
}

/**
 * Minimal chainable query builder mock. Each call to executeTakeFirst /
 * execute returns the next item from the provided queues in call order.
 * withAudit is mocked separately to call fn(db) directly, so the mutation
 * queries inside it also draw from these queues.
 */
function makeDb(opts: {
  takeFirsts?: (Record<string, unknown> | null | undefined)[];
  executes?: unknown[][];
} = {}) {
  let tfIdx = 0;
  let execIdx = 0;
  const takeFirsts = opts.takeFirsts ?? [];
  const executes = opts.executes ?? [];

  const chain: Record<string, unknown> = {};
  const noop = () => chain;

  Object.assign(chain, {
    selectFrom: noop,
    leftJoin: noop,
    select: noop,
    $if: (_: boolean, fn: (c: unknown) => unknown) => (_ ? fn(chain) : chain),
    where: noop,
    onRef: noop,
    on: noop,
    orderBy: noop,
    limit: noop,
    offset: noop,
    updateTable: noop,
    insertInto: noop,
    values: noop,
    set: noop,
    returning: noop,
    execute: () => Promise.resolve(executes[execIdx++] ?? []),
    executeTakeFirst: () => Promise.resolve(takeFirsts[tfIdx++] ?? null),
    executeTakeFirstOrThrow: () => {
      const val = takeFirsts[tfIdx++];
      if (val == null) throw Object.assign(new Error('no result'), { code: 'NO_RESULT' });
      return Promise.resolve(val);
    },
    transaction: () => ({
      execute: (fn: (t: unknown) => Promise<unknown>) => fn(chain),
    }),
  });

  return chain as unknown as ReturnType<typeof getDb>;
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_JWT_SECRET', TEST_SECRET);
  _resetSecretCache();

  // withAudit: call fn with db (the mock chain) directly, skip the real transaction/audit
  vi.mocked(withAudit).mockImplementation(async (db, _actor, _action, _sid, fn) => {
    return fn(db as never);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  _resetSecretCache();
});

// ── GET /navigator/sessions ───────────────────────────────────────────────

describe('GET /navigator/sessions', () => {
  it('returns sessions list', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({ executes: [[{ session_id: 'sess-1', navigator_status: 'in_review' }]] }),
    );
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions', { headers: auth(token) });
    expect(res.status).toBe(200);
    const body = await res.json() as { sessions: unknown[] };
    expect(body.sessions).toHaveLength(1);
  });

  it('accepts navigator_status filter without error', async () => {
    vi.mocked(getDb).mockReturnValue(makeDb({ executes: [[]] }));
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions?navigator_status=awaiting_navigator', {
      headers: auth(token),
    });
    expect(res.status).toBe(200);
  });
});

// ── GET /navigator/sessions/:id ───────────────────────────────────────────

describe('GET /navigator/sessions/:id', () => {
  it('returns 404 when session not found', async () => {
    vi.mocked(getDb).mockReturnValue(makeDb({ takeFirsts: [null] }));
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/missing', { headers: auth(token) });
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('session_not_found');
  });

  it('returns session detail with related data', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        takeFirsts: [
          { session_id: 'sess-1', navigator_status: 'in_review' }, // session
          { assignment_id: 'asgn-1', navigator_id: 'nav-1' },      // assignment
        ],
        executes: [
          [{ note_id: 'note-1', body: 'hello' }], // notes
          [],                                       // missing items
        ],
      }),
    );
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1', { headers: auth(token) });
    expect(res.status).toBe(200);
    const body = await res.json() as { session: { session_id: string }; assignment: { assignment_id: string } };
    expect(body.session.session_id).toBe('sess-1');
    expect(body.assignment?.assignment_id).toBe('asgn-1');
  });
});

// ── PATCH /navigator/sessions/:id/status ─────────────────────────────────

describe('PATCH /navigator/sessions/:id/status', () => {
  it('returns 400 when `to` field is missing', async () => {
    vi.mocked(getDb).mockReturnValue(makeDb());
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/status', {
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
    vi.mocked(getDb).mockReturnValue(makeDb({ takeFirsts: [null] }));
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/missing/status', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'in_review' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 422 with not_assigned when moving to in_review without assignment', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        takeFirsts: [
          { session_id: 'sess-1', navigator_status: 'awaiting_navigator' }, // session
          null, // no active assignment
          null, // no unresolved missing items
        ],
      }),
    );
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/status', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'in_review' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('not_assigned');
  });

  it('returns 422 with missing_required_docs when unresolved items block ready_for_handoff', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        takeFirsts: [
          { session_id: 'sess-1', navigator_status: 'in_review' },
          { assignment_id: 'asgn-1' }, // has assignment
          { request_id: 'req-1' },     // has unresolved item
        ],
      }),
    );
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/status', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'ready_for_handoff' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('missing_required_docs');
  });

  it('returns 422 with terminal_state when session is handed_off', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        takeFirsts: [
          { session_id: 'sess-1', navigator_status: 'handed_off' },
          null,
          null,
        ],
      }),
    );
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/status', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'in_review' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('terminal_state');
  });

  it('transitions and returns updated status when guard passes', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        takeFirsts: [
          { session_id: 'sess-1', navigator_status: 'awaiting_navigator' },
          { assignment_id: 'asgn-1' }, // has assignment
          null,                         // no unresolved items
        ],
        executes: [[], []], // update + history insert inside withAudit fn
      }),
    );
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/status', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'in_review' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { navigator_status: string };
    expect(body.navigator_status).toBe('in_review');
  });
});

// ── POST /navigator/sessions/:id/assign ──────────────────────────────────

describe('POST /navigator/sessions/:id/assign', () => {
  it('returns 400 when navigator_id is missing', async () => {
    vi.mocked(getDb).mockReturnValue(makeDb());
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/assign', {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { field: string };
    expect(body.field).toBe('navigator_id');
  });

  it('returns 404 when session not found', async () => {
    vi.mocked(getDb).mockReturnValue(makeDb({ takeFirsts: [null] }));
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/missing/assign', {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ navigator_id: 'nav-1' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 201 with assignment on success', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        takeFirsts: [
          { session_id: 'sess-1' },
          { assignment_id: 'asgn-new', navigator_id: 'nav-1', assigned_at: new Date().toISOString() },
        ],
        executes: [[]], // unassign existing
      }),
    );
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/assign', {
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
    vi.mocked(getDb).mockReturnValue(makeDb());
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/notes', {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: '   ' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 201 with note on success', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        takeFirsts: [
          { session_id: 'sess-1' },
          { note_id: 'note-1', body: 'Great progress', author_id: 'staff-sub-1' },
        ],
      }),
    );
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/notes', {
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
    vi.mocked(getDb).mockReturnValue(makeDb());
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/missing-items', {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { field: string };
    expect(body.field).toBe('item_type');
  });

  it('returns 201 on success', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        takeFirsts: [
          { session_id: 'sess-1' },
          { request_id: 'req-1', item_type: 'paystub' },
        ],
      }),
    );
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/missing-items', {
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
    vi.mocked(getDb).mockReturnValue(makeDb({ takeFirsts: [null] }));
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/missing-items/bad-id', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('missing_item_not_found');
  });

  it('returns 409 when item already resolved', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        takeFirsts: [{ request_id: 'req-1', session_id: 'sess-1', resolved_at: new Date().toISOString() }],
      }),
    );
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/missing-items/req-1', {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution_note: 'done' }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('already_resolved');
  });

  it('returns 200 with resolved item on success', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        takeFirsts: [
          { request_id: 'req-1', session_id: 'sess-1', resolved_at: null },
          { request_id: 'req-1', item_type: 'paystub', resolved_at: new Date().toISOString() },
        ],
      }),
    );
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/missing-items/req-1', {
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
    vi.mocked(getDb).mockReturnValue(makeDb({ takeFirsts: [null] }));
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/missing/audit-log', {
      headers: auth(token),
    });
    expect(res.status).toBe(404);
  });

  it('returns entries with pagination metadata', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        takeFirsts: [{ session_id: 'sess-1' }],
        executes: [[{ audit_id: 'a-1', action: 'STATUS_TRANSITIONED' }]],
      }),
    );
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/audit-log?limit=10&offset=0', {
      headers: auth(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { entries: unknown[]; limit: number; offset: number };
    expect(body.entries).toHaveLength(1);
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
  });

  it('caps limit at 200', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        takeFirsts: [{ session_id: 'sess-1' }],
        executes: [[]],
      }),
    );
    const token = await staffToken();
    const res = await buildApp().request('/navigator/sessions/sess-1/audit-log?limit=9999', {
      headers: auth(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { limit: number };
    expect(body.limit).toBe(200);
  });
});
