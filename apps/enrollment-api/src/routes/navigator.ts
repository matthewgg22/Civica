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

export default app;
