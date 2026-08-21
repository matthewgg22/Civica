import { Hono } from 'hono';
import { requireStaffJwt } from '../auth/staff.js';
import type { StaffEnv } from '../auth/types.js';
import { canTransition } from '../domain/status.js';
import { navigatorRateLimit } from '../lib/rateLimit.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { PacketStatus } from '@civica/snap-enums';

export const navigatorRoutes = new Hono<StaffEnv>();

navigatorRoutes.use('*', requireStaffJwt);
navigatorRoutes.use('*', navigatorRateLimit);

const se = () => supabaseAdmin.schema('snap_enrollment');

type SetConfigArgs = { setting_name: string; new_value: string; is_local: boolean };
const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (fn: string, args: SetConfigArgs) => Promise<unknown>;

async function setActorCtx(staffId: string, requestId: string, reason?: string) {
  await rpc('set_config', { setting_name: 'snap_enrollment.actor_kind', new_value: 'navigator', is_local: true });
  await rpc('set_config', { setting_name: 'snap_enrollment.actor_id', new_value: staffId, is_local: true });
  await rpc('set_config', { setting_name: 'snap_enrollment.request_id', new_value: requestId, is_local: true });
  if (reason) {
    await rpc('set_config', { setting_name: 'snap_enrollment.transition_reason', new_value: reason, is_local: true });
  }
}

// ── GET /navigator/sessions ───────────────────────────────────────────────

navigatorRoutes.get('/sessions', async (c) => {
  const { status: statusFilter, state, assigned_to } = c.req.query();

  let query = se()
    .from('snap_packets')
    .select('packet_id, status, state_code, created_at, updated_at, packet_assignments(staff_id, is_current)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (statusFilter) query = query.eq('status', statusFilter);
  if (state) query = query.eq('state_code', state.toUpperCase());

  const { data, error } = await query;
  if (error) {
    console.error('navigator/sessions list failed', error);
    return c.json({ code: 'internal_error', message: 'Internal server error' }, 500);
  }

  // The shape the select's packet_assignments(...) join actually returns —
  // typed here so the two casts below stop being `any` (#721 first lint).
  type AssignmentRow = { is_current: boolean; staff_id: string | null };
  const sessions = (data ?? [])
    .filter((p) => !assigned_to || (p.packet_assignments as AssignmentRow[]).some((a) => a.is_current && a.staff_id === assigned_to))
    .map((p) => ({
      session_id: p.packet_id,
      status: p.status,
      navigator_status: p.status,
      state: p.state_code,
      created_at: p.created_at,
      updated_at: p.updated_at,
      navigator_id: (p.packet_assignments as AssignmentRow[]).find((a) => a.is_current)?.staff_id ?? null,
    }));

  return c.json({ sessions });
});

// ── GET /navigator/sessions/:id ───────────────────────────────────────────

navigatorRoutes.get('/sessions/:id', async (c) => {
  const id = c.req.param('id');

  const { data: packet, error: pErr } = await se()
    .from('snap_packets')
    .select('packet_id, status, state_code, created_at, updated_at')
    .eq('packet_id', id)
    .is('deleted_at', null)
    .single();

  if (pErr?.code === 'PGRST116') return c.json({ code: 'session_not_found', message: 'Session not found' }, 404);
  if (pErr) return c.json({ code: 'internal_error', message: 'Internal server error' }, 500);

  const [{ data: assignments }, { data: rawNotes }, { data: rawItems }] = await Promise.all([
    se()
      .from('packet_assignments')
      .select('assignment_id, staff_id, assigned_at, assigned_by_staff_id, is_current')
      .eq('packet_id', id)
      .eq('is_current', true),
    se()
      .from('navigator_notes')
      .select('note_id, author_staff_id, body_ciphertext, created_at')
      .eq('packet_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    se()
      .from('missing_item_requests')
      .select('request_id, message_ciphertext, status, sent_at, resolved_at, resolved_by_staff_id')
      .eq('packet_id', id)
      .order('sent_at', { ascending: true }),
  ]);

  const notes = (rawNotes ?? []).map((n) => ({
    note_id: n.note_id,
    author_id: n.author_staff_id,
    body: n.body_ciphertext,
    created_at: n.created_at,
  }));

  const missing_items = (rawItems ?? []).map((r) => ({
    request_id: r.request_id,
    item_description: r.message_ciphertext,
    status: r.status,
    requested_at: r.sent_at,
    resolved_at: r.resolved_at ?? null,
    resolved_by: r.resolved_by_staff_id ?? null,
  }));

  return c.json({
    session: {
      session_id: packet!.packet_id,
      navigator_status: packet!.status,
      status: packet!.status,
      state: packet!.state_code,
      created_at: packet!.created_at,
      updated_at: packet!.updated_at,
    },
    assignment: (assignments ?? [])[0] ?? null,
    notes,
    missing_items,
  });
});

// ── PATCH /navigator/sessions/:id/status ─────────────────────────────────

navigatorRoutes.patch('/sessions/:id/status', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ to?: PacketStatus; reason?: string }>();

  if (!body.to) return c.json({ code: 'missing_field', message: 'Missing required field: to', field: 'to' }, 400);

  const { data: packet, error: pErr } = await se()
    .from('snap_packets')
    .select('packet_id, status')
    .eq('packet_id', id)
    .is('deleted_at', null)
    .single();

  if (pErr?.code === 'PGRST116') return c.json({ code: 'session_not_found', message: 'Session not found' }, 404);
  if (pErr) return c.json({ code: 'internal_error', message: 'Internal server error' }, 500);

  const [{ data: activeAssignment }, { data: unresolvedItem }] = await Promise.all([
    se().from('packet_assignments').select('assignment_id').eq('packet_id', id).eq('is_current', true).limit(1),
    se().from('missing_item_requests').select('request_id').eq('packet_id', id).eq('status', 'pending').limit(1),
  ]);

  const guard = canTransition(packet!.status as PacketStatus, body.to, {
    hasAssignment: (activeAssignment ?? []).length > 0,
    hasConsent: true, // TODO: enforce when consent table is wired
    hasUnresolvedMissingItems: (unresolvedItem ?? []).length > 0,
  });

  if (!guard.ok) {
    return c.json({ code: guard.error, message: guard.message }, 422);
  }

  const staffId = c.var.staff.staffId;
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  await setActorCtx(staffId, requestId, body.reason ?? `status → ${body.to}`);

  // Guard trigger (20260521) validates the transition, writes packet_status_history, and
  // stamps submitted_at / handed_off_at. If the DB rejects the transition it throws P0001.
  const { error: updateErr } = await se()
    .from('snap_packets')
    .update({ status: body.to })
    .eq('packet_id', id);

  if (updateErr?.code === 'P0001') return c.json({ code: 'invalid_transition', message: updateErr.message }, 422);
  if (updateErr) {
    console.error('status transition failed', updateErr);
    return c.json({ code: 'internal_error', message: 'Internal server error' }, 500);
  }

  return c.json({ session_id: id, navigator_status: body.to, status: body.to });
});

// ── POST /navigator/sessions/:id/assign ──────────────────────────────────

navigatorRoutes.post('/sessions/:id/assign', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ navigator_id?: string }>();

  if (!body.navigator_id) return c.json({ code: 'missing_field', message: 'Missing required field: navigator_id', field: 'navigator_id' }, 400);

  const { error: pErr } = await se()
    .from('snap_packets')
    .select('packet_id')
    .eq('packet_id', id)
    .is('deleted_at', null)
    .single();

  if (pErr?.code === 'PGRST116') return c.json({ code: 'session_not_found', message: 'Session not found' }, 404);
  if (pErr) return c.json({ code: 'internal_error', message: 'Internal server error' }, 500);

  const staffId = c.var.staff.staffId;
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  await setActorCtx(staffId, requestId);

  // Retire any active assignment before inserting the new one.
  await se()
    .from('packet_assignments')
    .update({ is_current: false, unassigned_at: new Date().toISOString() })
    .eq('packet_id', id)
    .eq('is_current', true);

  const { data: assignment, error: aErr } = await se()
    .from('packet_assignments')
    .insert({
      packet_id: id,
      staff_id: body.navigator_id,
      assigned_by_staff_id: staffId,
    })
    .select('assignment_id, staff_id, assigned_at')
    .single();

  if (aErr) {
    console.error('assign failed', aErr);
    return c.json({ code: 'internal_error', message: 'Internal server error' }, 500);
  }

  return c.json({
    assignment: {
      assignment_id: assignment!.assignment_id,
      navigator_id: assignment!.staff_id,
      assigned_at: assignment!.assigned_at,
    },
  }, 201);
});

// ── POST /navigator/sessions/:id/notes ───────────────────────────────────

navigatorRoutes.post('/sessions/:id/notes', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ body?: string }>();

  const noteText = body.body?.trim();
  if (!noteText) return c.json({ code: 'missing_field', message: 'Missing required field: body', field: 'body' }, 400);

  const { error: pErr } = await se()
    .from('snap_packets')
    .select('packet_id')
    .eq('packet_id', id)
    .is('deleted_at', null)
    .single();

  if (pErr?.code === 'PGRST116') return c.json({ code: 'session_not_found', message: 'Session not found' }, 404);
  if (pErr) return c.json({ code: 'internal_error', message: 'Internal server error' }, 500);

  const staffId = c.var.staff.staffId;
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  await setActorCtx(staffId, requestId);

  const { data: note, error: nErr } = await se()
    .from('navigator_notes')
    .insert({
      packet_id: id,
      author_staff_id: staffId,
      body_ciphertext: noteText, // TODO: Fernet-encrypt before storing
    })
    .select('note_id, author_staff_id, body_ciphertext, created_at')
    .single();

  if (nErr) {
    console.error('note insert failed', nErr);
    return c.json({ code: 'internal_error', message: 'Internal server error' }, 500);
  }

  return c.json({
    note: {
      note_id: note!.note_id,
      author_id: note!.author_staff_id,
      body: note!.body_ciphertext,
      created_at: note!.created_at,
    },
  }, 201);
});

// ── POST /navigator/sessions/:id/missing-items ────────────────────────────
// item_type and item_description are concatenated into message_ciphertext.

navigatorRoutes.post('/sessions/:id/missing-items', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ item_type?: string; item_description?: string }>();

  const itemType = body.item_type?.trim();
  if (!itemType) return c.json({ code: 'missing_field', message: 'Missing required field: item_type', field: 'item_type' }, 400);

  const { error: pErr } = await se()
    .from('snap_packets')
    .select('packet_id')
    .eq('packet_id', id)
    .is('deleted_at', null)
    .single();

  if (pErr?.code === 'PGRST116') return c.json({ code: 'session_not_found', message: 'Session not found' }, 404);
  if (pErr) return c.json({ code: 'internal_error', message: 'Internal server error' }, 500);

  const staffId = c.var.staff.staffId;
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  await setActorCtx(staffId, requestId);

  const messageText = body.item_description?.trim()
    ? `${itemType}: ${body.item_description.trim()}`
    : itemType;

  const { data: item, error: iErr } = await se()
    .from('missing_item_requests')
    .insert({
      packet_id: id,
      requested_by_staff_id: staffId,
      message_ciphertext: messageText, // TODO: Fernet-encrypt before storing
    })
    .select('request_id, message_ciphertext, status, sent_at')
    .single();

  if (iErr) {
    console.error('missing-item insert failed', iErr);
    return c.json({ code: 'internal_error', message: 'Internal server error' }, 500);
  }

  return c.json({
    item: {
      request_id: item!.request_id,
      item_type: itemType,
      item_description: body.item_description?.trim() ?? null,
      requested_at: item!.sent_at,
      status: item!.status,
    },
  }, 201);
});

// ── PATCH /navigator/sessions/:id/missing-items/:itemId ──────────────────

navigatorRoutes.patch('/sessions/:id/missing-items/:itemId', async (c) => {
  const id = c.req.param('id');
  const itemId = c.req.param('itemId');
  const body = await c.req.json<{ resolution_note?: string }>();

  const { data: existing, error: eErr } = await se()
    .from('missing_item_requests')
    .select('request_id, packet_id, status')
    .eq('request_id', itemId)
    .eq('packet_id', id)
    .single();

  if (eErr?.code === 'PGRST116') return c.json({ code: 'missing_item_not_found', message: 'Missing item request not found' }, 404);
  if (eErr) return c.json({ code: 'internal_error', message: 'Internal server error' }, 500);
  if (existing!.status !== 'pending') return c.json({ code: 'already_resolved', message: 'Item already resolved' }, 409);

  const staffId = c.var.staff.staffId;
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  await setActorCtx(staffId, requestId);

  const { data: item, error: uErr } = await se()
    .from('missing_item_requests')
    .update({
      status: 'resolved' as const,
      resolved_at: new Date().toISOString(),
      resolved_by_staff_id: staffId,
    })
    .eq('request_id', itemId)
    .select('request_id, status, resolved_at, resolved_by_staff_id')
    .single();

  if (uErr) {
    console.error('missing-item resolve failed', uErr);
    return c.json({ code: 'internal_error', message: 'Internal server error' }, 500);
  }

  return c.json({
    item: {
      request_id: item!.request_id,
      status: item!.status,
      resolved_at: item!.resolved_at,
      resolved_by: item!.resolved_by_staff_id,
      resolution_note: body.resolution_note?.trim() ?? null,
    },
  });
});

// ── GET /navigator/sessions/:id/audit-log ────────────────────────────────

navigatorRoutes.get('/sessions/:id/audit-log', async (c) => {
  const id = c.req.param('id');
  const limit = Math.min(Number(c.req.query('limit') ?? '50'), 200);
  const offset = Number(c.req.query('offset') ?? '0');

  const { error: pErr } = await se()
    .from('snap_packets')
    .select('packet_id')
    .eq('packet_id', id)
    .is('deleted_at', null)
    .single();

  if (pErr?.code === 'PGRST116') return c.json({ code: 'session_not_found', message: 'Session not found' }, 404);
  if (pErr) return c.json({ code: 'internal_error', message: 'Internal server error' }, 500);

  const { data: entries, error: aErr } = await se()
    .from('audit_log_events')
    .select('audit_id, table_name, operation, actor_kind, actor_id, request_id, occurred_at, changed_columns, old_values, new_values')
    .eq('packet_id', id)
    .order('occurred_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (aErr) {
    console.error('audit-log query failed', aErr);
    return c.json({ code: 'internal_error', message: 'Internal server error' }, 500);
  }

  return c.json({ session_id: id, entries: entries ?? [], limit, offset });
});
