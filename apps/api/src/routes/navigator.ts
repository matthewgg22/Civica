import { Hono } from 'hono';
import { requireStaffJwt } from '../auth/staff.js';
import type { StaffEnv } from '../auth/types.js';
import { withAudit } from '../audit/withAudit.js';
import { getDb } from '../db/client.js';
import type { NavigatorStatus } from '../db/schema.js';
import { canTransition } from '../domain/status.js';
import { navigatorRateLimit } from '../lib/rateLimit.js';

export const navigatorRoutes = new Hono<StaffEnv>();

navigatorRoutes.use('*', requireStaffJwt);
navigatorRoutes.use('*', navigatorRateLimit); // per-IP, runs after auth

// ── GET /navigator/sessions ───────────────────────────────────────────────

navigatorRoutes.get('/sessions', async (c) => {
  const { navigator_status, state, assigned_to } = c.req.query();

  const sessions = await getDb()
    .selectFrom('snap_sessions as s')
    .leftJoin('snap_session_assignments as a', (join) =>
      join.onRef('a.session_id', '=', 's.session_id').on('a.unassigned_at', 'is', null),
    )
    .select([
      's.session_id',
      's.status',
      's.navigator_status',
      's.state',
      's.language',
      's.created_at',
      's.updated_at',
      'a.navigator_id',
    ])
    .$if(!!navigator_status, (qb) =>
      qb.where('s.navigator_status', '=', navigator_status as NavigatorStatus),
    )
    .$if(!!state, (qb) => qb.where('s.state', '=', state!.toUpperCase()))
    .$if(!!assigned_to, (qb) => qb.where('a.navigator_id', '=', assigned_to!))
    .orderBy('s.created_at', 'desc')
    .limit(100)
    .execute();

  return c.json({ sessions });
});

// ── GET /navigator/sessions/:id ───────────────────────────────────────────

navigatorRoutes.get('/sessions/:id', async (c) => {
  const id = c.req.param('id');
  const db = getDb();

  const session = await db
    .selectFrom('snap_sessions')
    .select(['session_id', 'status', 'navigator_status', 'state', 'language', 'created_at', 'updated_at'])
    .where('session_id', '=', id)
    .executeTakeFirst();

  if (!session) return c.json({ error: 'session_not_found' }, 404);

  const [assignment, notes, missingItems] = await Promise.all([
    db
      .selectFrom('snap_session_assignments')
      .select(['assignment_id', 'navigator_id', 'assigned_at', 'assigned_by'])
      .where('session_id', '=', id)
      .where('unassigned_at', 'is', null)
      .executeTakeFirst(),
    db
      .selectFrom('snap_navigator_notes')
      .select(['note_id', 'author_id', 'body', 'created_at'])
      .where('session_id', '=', id)
      .orderBy('created_at', 'asc')
      .execute(),
    db
      .selectFrom('snap_missing_item_requests')
      .select([
        'request_id',
        'item_type',
        'item_description',
        'requested_by',
        'requested_at',
        'resolved_at',
        'resolved_by',
        'resolution_note',
      ])
      .where('session_id', '=', id)
      .orderBy('requested_at', 'asc')
      .execute(),
  ]);

  return c.json({
    session,
    assignment: assignment ?? null,
    notes,
    missing_items: missingItems,
  });
});

// ── PATCH /navigator/sessions/:id/status ─────────────────────────────────

navigatorRoutes.patch('/sessions/:id/status', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ to?: NavigatorStatus; reason?: string }>();

  if (!body.to) return c.json({ error: 'missing_field', field: 'to' }, 400);

  const db = getDb();

  const session = await db
    .selectFrom('snap_sessions')
    .select(['session_id', 'navigator_status'])
    .where('session_id', '=', id)
    .executeTakeFirst();

  if (!session) return c.json({ error: 'session_not_found' }, 404);

  const [activeAssignment, unresolvedItem] = await Promise.all([
    db
      .selectFrom('snap_session_assignments')
      .select('assignment_id')
      .where('session_id', '=', id)
      .where('unassigned_at', 'is', null)
      .executeTakeFirst(),
    db
      .selectFrom('snap_missing_item_requests')
      .select('request_id')
      .where('session_id', '=', id)
      .where('resolved_at', 'is', null)
      .executeTakeFirst(),
  ]);

  const guard = canTransition(session.navigator_status, body.to, {
    hasAssignment: !!activeAssignment,
    hasConsent: true, // TODO: enforce when applicant consent table is added
    hasUnresolvedMissingItems: !!unresolvedItem,
  });

  if (!guard.ok) {
    return c.json({ error: guard.error, message: guard.message }, 422);
  }

  const actor = { kind: 'authenticated_user' as const, id: c.var.staff.sub };
  const to = body.to;

  await withAudit(
    db,
    actor,
    'STATUS_TRANSITIONED',
    id,
    async (trx) => {
      await trx
        .updateTable('snap_sessions')
        .set({ navigator_status: to })
        .where('session_id', '=', id)
        .execute();
      await trx
        .insertInto('snap_session_status_history')
        .values({
          session_id: id,
          from_status: session.navigator_status,
          to_status: to,
          changed_by: c.var.staff.sub,
          reason: body.reason ?? null,
        })
        .execute();
    },
    {
      reason: body.reason ?? `status → ${to}`,
      requestId: c.req.header('x-request-id') ?? undefined,
      columnOrResource: 'snap_sessions.navigator_status',
    },
  );

  return c.json({ session_id: id, navigator_status: to });
});

// ── POST /navigator/sessions/:id/assign ──────────────────────────────────

navigatorRoutes.post('/sessions/:id/assign', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ navigator_id?: string }>();

  if (!body.navigator_id) return c.json({ error: 'missing_field', field: 'navigator_id' }, 400);

  const db = getDb();

  const session = await db
    .selectFrom('snap_sessions')
    .select('session_id')
    .where('session_id', '=', id)
    .executeTakeFirst();

  if (!session) return c.json({ error: 'session_not_found' }, 404);

  // Retire any existing active assignment before inserting the new one.
  await db
    .updateTable('snap_session_assignments')
    .set({ unassigned_at: new Date() })
    .where('session_id', '=', id)
    .where('unassigned_at', 'is', null)
    .execute();

  const actor = { kind: 'authenticated_user' as const, id: c.var.staff.sub };
  const navigatorId = body.navigator_id;

  const assignment = await withAudit(
    db,
    actor,
    'SESSION_ASSIGNED',
    id,
    (trx) =>
      trx
        .insertInto('snap_session_assignments')
        .values({
          session_id: id,
          navigator_id: navigatorId,
          assigned_by: c.var.staff.sub,
        })
        .returning(['assignment_id', 'navigator_id', 'assigned_at'])
        .executeTakeFirstOrThrow(),
    {
      reason: `assigned to ${navigatorId}`,
      requestId: c.req.header('x-request-id') ?? undefined,
      columnOrResource: 'snap_session_assignments',
    },
  );

  return c.json({ assignment }, 201);
});

// ── POST /navigator/sessions/:id/notes ───────────────────────────────────

navigatorRoutes.post('/sessions/:id/notes', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ body?: string }>();

  const noteText = body.body?.trim();
  if (!noteText) return c.json({ error: 'missing_field', field: 'body' }, 400);

  const db = getDb();

  const session = await db
    .selectFrom('snap_sessions')
    .select('session_id')
    .where('session_id', '=', id)
    .executeTakeFirst();

  if (!session) return c.json({ error: 'session_not_found' }, 404);

  const actor = { kind: 'authenticated_user' as const, id: c.var.staff.sub };

  const note = await withAudit(
    db,
    actor,
    'NOTE_ADDED',
    id,
    (trx) =>
      trx
        .insertInto('snap_navigator_notes')
        .values({ session_id: id, author_id: c.var.staff.sub, body: noteText })
        .returning(['note_id', 'author_id', 'body', 'created_at'])
        .executeTakeFirstOrThrow(),
    {
      requestId: c.req.header('x-request-id') ?? undefined,
      columnOrResource: 'snap_navigator_notes',
    },
  );

  return c.json({ note }, 201);
});

// ── POST /navigator/sessions/:id/missing-items ────────────────────────────

navigatorRoutes.post('/sessions/:id/missing-items', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ item_type?: string; item_description?: string }>();

  const itemType = body.item_type?.trim();
  if (!itemType) return c.json({ error: 'missing_field', field: 'item_type' }, 400);

  const db = getDb();

  const session = await db
    .selectFrom('snap_sessions')
    .select('session_id')
    .where('session_id', '=', id)
    .executeTakeFirst();

  if (!session) return c.json({ error: 'session_not_found' }, 404);

  const actor = { kind: 'authenticated_user' as const, id: c.var.staff.sub };

  const item = await withAudit(
    db,
    actor,
    'MISSING_ITEM_REQUESTED',
    id,
    (trx) =>
      trx
        .insertInto('snap_missing_item_requests')
        .values({
          session_id: id,
          requested_by: c.var.staff.sub,
          item_type: itemType,
          item_description: body.item_description?.trim() ?? null,
        })
        .returning(['request_id', 'item_type', 'item_description', 'requested_at'])
        .executeTakeFirstOrThrow(),
    {
      requestId: c.req.header('x-request-id') ?? undefined,
      columnOrResource: 'snap_missing_item_requests',
    },
  );

  return c.json({ item }, 201);
});

// ── PATCH /navigator/sessions/:id/missing-items/:itemId ──────────────────

navigatorRoutes.patch('/sessions/:id/missing-items/:itemId', async (c) => {
  const id = c.req.param('id');
  const itemId = c.req.param('itemId');
  const body = await c.req.json<{ resolution_note?: string }>();

  const db = getDb();

  const existing = await db
    .selectFrom('snap_missing_item_requests')
    .select(['request_id', 'session_id', 'resolved_at'])
    .where('request_id', '=', itemId)
    .where('session_id', '=', id)
    .executeTakeFirst();

  if (!existing) return c.json({ error: 'missing_item_not_found' }, 404);
  if (existing.resolved_at !== null) return c.json({ error: 'already_resolved' }, 409);

  const actor = { kind: 'authenticated_user' as const, id: c.var.staff.sub };

  const item = await withAudit(
    db,
    actor,
    'MISSING_ITEM_RESOLVED',
    id,
    (trx) =>
      trx
        .updateTable('snap_missing_item_requests')
        .set({
          resolved_at: new Date(),
          resolved_by: c.var.staff.sub,
          resolution_note: body.resolution_note?.trim() ?? null,
        })
        .where('request_id', '=', itemId)
        .returning(['request_id', 'item_type', 'resolved_at', 'resolved_by', 'resolution_note'])
        .executeTakeFirstOrThrow(),
    {
      requestId: c.req.header('x-request-id') ?? undefined,
      columnOrResource: `snap_missing_item_requests/${itemId}`,
    },
  );

  return c.json({ item });
});

// ── GET /navigator/sessions/:id/audit-log ────────────────────────────────

navigatorRoutes.get('/sessions/:id/audit-log', async (c) => {
  const id = c.req.param('id');
  const limit = Math.min(Number(c.req.query('limit') ?? '50'), 200);
  const offset = Number(c.req.query('offset') ?? '0');

  const db = getDb();

  const session = await db
    .selectFrom('snap_sessions')
    .select('session_id')
    .where('session_id', '=', id)
    .executeTakeFirst();

  if (!session) return c.json({ error: 'session_not_found' }, 404);

  const entries = await db
    .selectFrom('snap_audit_log')
    .select([
      'audit_id',
      'action',
      'actor_kind',
      'actor_id',
      'reason',
      'request_id',
      'column_or_resource',
      'occurred_at',
    ])
    .where('session_id', '=', id)
    .orderBy('occurred_at', 'asc')
    .limit(limit)
    .offset(offset)
    .execute();

  return c.json({ session_id: id, entries, limit, offset });
});
