/**
 * Navigator Outreach Routes — T-DR3-7 (marketplace cliff event)
 *
 * POST /navigator/outreach — creates a navigator queue task when a student's
 * confirmed paycheck pushes counted income above the SNAP cliff. Called by
 * the iOS PostPlacementView cliff-event flow immediately after Argyle confirms
 * the paycheck. Requires navigator role or above.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { makeAnonClient } from '../lib/supabase.js';
import { withActorContext } from '../middleware/actorContext.js';
import type { Env } from '../types.js';
import type { Json } from '@civica/db-types';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const OutreachReasonSchema = z.enum(['cliff_event', 'manual']);

const OutreachStatusSchema = z.enum(['pending', 'contacted', 'resolved', 'cancelled']);

const patchOutreachBodySchema = z.object({
  status: OutreachStatusSchema,
  resolution_notes: z.string().max(2000).optional(),
});

const outreachBodySchema = z.object({
  packet_id: z.string().uuid(),
  reason: OutreachReasonSchema,
  /** Counted monthly income at time of cliff detection (USD). */
  income_usd: z.number().min(0).optional(),
  /** Hours until navigator must make first contact. Default 24. */
  sla_hours: z.number().int().min(1).max(168).default(24),
});

// ---------------------------------------------------------------------------
// Role guard
// ---------------------------------------------------------------------------

function requireNavigator(actorKind: string): void {
  if (actorKind === 'applicant') {
    throw new HTTPException(403, { message: 'Navigator role required' });
  }
}

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// POST /navigator/outreach
// ---------------------------------------------------------------------------

app.post('/outreach', zValidator('json', outreachBodySchema), async (c) => {
  const actor = c.get('actor');
  requireNavigator(actor.kind);

  const body = c.req.valid('json');
  const jwt = c.get('jwt');

  // Verify packet exists and fetch org_id + applicant_id.
  const anonDb = makeAnonClient(c.env, jwt);
  const { data: packet, error: packetErr } = await anonDb
    .schema('snap_enrollment')
    .from('snap_packets')
    .select('packet_id, org_id, applicant_id, state_code')
    .eq('packet_id', body.packet_id)
    .is('deleted_at', null)
    .single();

  if (packetErr?.code === 'PGRST116') {
    throw new HTTPException(404, { message: 'Packet not found' });
  }
  if (packetErr) throw new HTTPException(500, { message: packetErr.message });

  const db = await withActorContext(c);

  const dueAt = new Date(Date.now() + body.sla_hours * 60 * 60 * 1000).toISOString();

  const { data: task, error: insertErr } = await db
    .schema('snap_enrollment')
    .from('navigator_outreach_queue')
    .insert({
      packet_id: body.packet_id,
      org_id: packet.org_id ?? '',
      applicant_id: packet.applicant_id,
      reason: body.reason,
      income_usd: body.income_usd ?? null,
      sla_hours: body.sla_hours,
      due_at: dueAt,
      status: 'pending',
      created_by: actor.id,
    })
    .select()
    .single();

  if (insertErr) throw new HTTPException(500, { message: insertErr.message });

  // Emit event to work_requirement_events if a WR status row exists.
  const { data: wrStatus } = await anonDb
    .schema('snap_enrollment')
    .from('work_requirement_statuses')
    .select('wr_status_id, org_id')
    .eq('packet_id', body.packet_id)
    .single();

  if (wrStatus) {
    await db
      .schema('snap_enrollment')
      .from('work_requirement_events')
      .insert({
        wr_status_id: (wrStatus as unknown as { wr_status_id: string }).wr_status_id,
        org_id: (wrStatus as unknown as { org_id: string }).org_id,
        actor_id: actor.id,
        event_type: 'navigator_note',
        payload: {
          reason: body.reason,
          income_usd: body.income_usd,
          outreach_task_id: (task as unknown as { outreach_task_id: string }).outreach_task_id,
          due_at: dueAt,
        } as unknown as Json,
      });
  }

  return c.json(task, 201);
});

// ---------------------------------------------------------------------------
// POST /navigator/packets/:packetId/qc-outcome — log a QC sampling result
// ---------------------------------------------------------------------------
//
// Called when a navigator receives a QC response for a sampled case.
// Only QC-sampled cases should have error_found set; unsampled cases must
// have error_found = null (unsampled ≠ clean — prevents label contamination
// in the Phase 2 retraining pipeline).

const qcOutcomeBodySchema = z.object({
  qc_sampled: z.boolean(),
  error_found: z.boolean().nullable(),
  error_type: z.string().max(100).nullable().optional(),
  error_amount: z.number().min(0).nullable().optional(),
}).refine(
  (d) => d.qc_sampled || d.error_found === null,
  { message: "error_found must be null when qc_sampled is false" }
);

app.post('/packets/:packetId/qc-outcome', zValidator('json', qcOutcomeBodySchema), async (c) => {
  const actor = c.get('actor');
  requireNavigator(actor.kind);

  const packetId = c.req.param('packetId');
  const body = c.req.valid('json');
  const jwt = c.get('jwt');

  // Verify packet exists and fetch org_id for RLS column
  const anonDb = makeAnonClient(c.env, jwt);
  const { data: packet, error: packetErr } = await anonDb
    .schema('snap_enrollment')
    .from('snap_packets')
    .select('packet_id, org_id')
    .eq('packet_id', packetId)
    .is('deleted_at', null)
    .single();

  if (packetErr?.code === 'PGRST116') {
    throw new HTTPException(404, { message: 'Packet not found' });
  }
  if (packetErr) throw new HTTPException(500, { message: packetErr.message });

  const db = await withActorContext(c);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outcome, error: insertErr } = await db
    .schema('snap_enrollment')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('qc_outcomes' as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      packet_id: packetId,
      org_id: packet.org_id ?? '',
      qc_sampled: body.qc_sampled,
      error_found: body.error_found ?? null,
      error_type: body.error_type ?? null,
      error_amount: body.error_amount ?? null,
      logged_by: actor.id,
    } as any)
    .select()
    .single();

  if (insertErr) throw new HTTPException(500, { message: insertErr.message });

  return c.json(outcome, 201);
});

// ---------------------------------------------------------------------------
// PATCH /navigator/outreach/:taskId — update task status
// ---------------------------------------------------------------------------

app.patch('/outreach/:taskId', zValidator('json', patchOutreachBodySchema), async (c) => {
  const actor = c.get('actor');
  requireNavigator(actor.kind);

  const taskId = c.req.param('taskId');
  const body = c.req.valid('json');
  const db = await withActorContext(c);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = { status: body.status };
  if (body.resolution_notes !== undefined) {
    updatePayload['resolution_notes'] = body.resolution_notes;
  }
  // Set timestamp fields based on the new status
  const now = new Date().toISOString();
  if (body.status === 'contacted') updatePayload['contacted_at'] = now;
  if (body.status === 'resolved') {
    updatePayload['resolved_at'] = now;
  }

  const { data: task, error } = await db
    .schema('snap_enrollment')
    .from('navigator_outreach_queue')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updatePayload as any)
    .eq('outreach_task_id', taskId)
    .select()
    .single();

  if (error?.code === 'PGRST116') {
    throw new HTTPException(404, { message: 'Outreach task not found' });
  }
  if (error) throw new HTTPException(500, { message: error.message });

  return c.json(task);
});

export default app;
