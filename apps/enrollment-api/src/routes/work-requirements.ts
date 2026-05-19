/**
 * Work Requirements Routes — OBBBA §10102 (T12)
 *
 * All routes require navigator role or above (enforced by authMiddleware on the
 * parent api router in src/index.ts; individual routes gate on actor.kind).
 *
 * Household member demographics are not stored per-member in the current DB schema
 * (packet_answers holds household-level aggregate flags). Callers supply the
 * per-member array in the POST /evaluate body, derived from the intake interview
 * or the navigator's review. The route fetches state_code and org_id from the DB
 * to anchor the row; demographic data comes from the request body.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { makeAnonClient, makeServiceClient } from '../lib/supabase.js';
import { withActorContext } from '../middleware/actorContext.js';
import type { Env } from '../types.js';
import type { Json } from '@civica/db-types';
import {
  evaluateWorkRequirement,
  CA_WAIVER_COUNTY_FIPS,
  MA_WAIVER_COUNTY_FIPS,
} from '@civica/snap-rules';
import type { WorkRequirementInput } from '@civica/snap-rules';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const HouseholdMemberSchema = z.object({
  id: z.string().min(1),
  age: z.number().int().min(0).max(120),
  isPregnant: z.boolean().optional(),
  hasDisability: z.boolean().optional(),
  receivesSSI: z.boolean().optional(),
  receivesSSDA: z.boolean().optional(),
  dependentChildAges: z.array(z.number().int().min(0)).optional(),
});

const evaluateBodySchema = z.object({
  householdMembers: z.array(HouseholdMemberSchema).min(1),
  // hasWaiverCounty is optional: if omitted the route derives it from county_fips
  // against the snap-rules waiver set (currently empty; conservative default = false)
  hasWaiverCounty: z.boolean().optional(),
});

const ExemptionTypeSchema = z.enum([
  'disability',
  'pregnancy',
  'caretaker_under_6',
  'qualifying_program',
  'waiver_county',
  'ssdi_ssi',
  'none',
]);

const patchBodySchema = z.object({
  exemption_type: ExemptionTypeSchema.optional(),
  hours_reported_per_week: z.number().min(0).max(168).optional(),
  compliance_status: z.enum(['unknown', 'compliant', 'at_risk', 'non_compliant']).optional(),
  notes: z.string().max(4000).optional(),
});

const eventBodySchema = z.object({
  event_type: z.enum([
    'subject_determination',
    'exemption_granted',
    'exemption_revoked',
    'compliance_verified',
    'hours_updated',
    'time_limit_incremented',
    'time_limit_reset',
    'navigator_note',
  ]),
  payload: z.record(z.unknown()),
});

// ---------------------------------------------------------------------------
// Role guard helper: navigator or above
// ---------------------------------------------------------------------------

function requireNavigator(actorKind: string): void {
  if (actorKind === 'applicant') {
    throw new HTTPException(403, { message: 'Navigator role required' });
  }
}

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// POST /work-requirements/:packetId/evaluate
// ---------------------------------------------------------------------------

app.post('/:packetId/evaluate', zValidator('json', evaluateBodySchema), async (c) => {
  const actor = c.get('actor');
  requireNavigator(actor.kind);

  const { packetId } = c.req.param();
  const body = c.req.valid('json');
  const jwt = c.get('jwt');

  // Fetch packet to get state_code, org_id, applicant_id, and optionally county_fips
  const anonDb = makeAnonClient(c.env, jwt);
  const { data: packet, error: packetErr } = await anonDb
    .schema('snap_enrollment')
    .from('snap_packets')
    .select('packet_id, state_code, org_id, applicant_id, county_fips')
    .eq('packet_id', packetId)
    .is('deleted_at', null)
    .single();

  if (packetErr?.code === 'PGRST116') throw new HTTPException(404, { message: 'Packet not found' });
  if (packetErr) throw new HTTPException(500, { message: packetErr.message });

  // Derive hasWaiverCounty from the snap-rules waiver set if not provided by caller.
  // Currently both sets are empty (conservative post-OBBBA default).
  let hasWaiverCounty = body.hasWaiverCounty ?? false;
  if (body.hasWaiverCounty === undefined && packet.county_fips) {
    const waiverSet = packet.state_code === 'CA' ? CA_WAIVER_COUNTY_FIPS : MA_WAIVER_COUNTY_FIPS;
    hasWaiverCounty = waiverSet.has(packet.county_fips);
  }

  // Run the rules engine
  const determination = evaluateWorkRequirement({
    state: packet.state_code as 'CA' | 'MA',
    householdMembers: body.householdMembers as WorkRequirementInput['householdMembers'],
    hasWaiverCounty,
  });

  // Upsert work_requirement_statuses (one row per packet; re-evaluate overwrites)
  const db = await withActorContext(c);
  const { data: statusRow, error: upsertErr } = await db
    .schema('snap_enrollment')
    .from('work_requirement_statuses')
    .upsert(
      {
        packet_id: packetId,
        org_id: packet.org_id ?? '',
        applicant_id: packet.applicant_id,
        is_subject: determination.isSubject,
        subject_member_ids: determination.subjectMemberIds,
        determination_basis: 'rules_engine',
        determined_at: new Date().toISOString(),
        exemption_type: determination.exemptionType,
        compliance_status: 'unknown',
        months_used_in_window: 0,
      },
      { onConflict: 'packet_id', ignoreDuplicates: false },
    )
    .select()
    .single();

  if (upsertErr) throw new HTTPException(500, { message: upsertErr.message });

  // Insert event log entry
  const { error: eventErr } = await db
    .schema('snap_enrollment')
    .from('work_requirement_events')
    .insert({
      wr_status_id: (statusRow as unknown as { wr_status_id: string }).wr_status_id,
      org_id: packet.org_id ?? '',
      actor_id: actor.id,
      event_type: 'subject_determination',
      payload: {
        is_subject: determination.isSubject,
        subject_member_ids: determination.subjectMemberIds,
        exemption_type: determination.exemptionType,
        exemption_reason: determination.exemptionReason,
        determination_basis: 'rules_engine',
        household_member_count: body.householdMembers.length,
      } as unknown as Json,
    });

  if (eventErr) throw new HTTPException(500, { message: eventErr.message });

  return c.json({ ...determination, status_row: statusRow }, 201);
});

// ---------------------------------------------------------------------------
// GET /work-requirements/:packetId
// ---------------------------------------------------------------------------

app.get('/:packetId', async (c) => {
  const actor = c.get('actor');
  requireNavigator(actor.kind);

  const { packetId } = c.req.param();
  const jwt = c.get('jwt');
  const db = makeAnonClient(c.env, jwt);

  const { data, error } = await db
    .schema('snap_enrollment')
    .from('work_requirement_statuses')
    .select('*')
    .eq('packet_id', packetId)
    .single();

  if (error?.code === 'PGRST116') {
    throw new HTTPException(404, { message: 'Work requirement status not yet evaluated for this packet' });
  }
  if (error) throw new HTTPException(500, { message: error.message });

  return c.json(data);
});

// ---------------------------------------------------------------------------
// PATCH /work-requirements/:wrStatusId
// ---------------------------------------------------------------------------

app.patch('/:wrStatusId', zValidator('json', patchBodySchema), async (c) => {
  const actor = c.get('actor');
  requireNavigator(actor.kind);

  const { wrStatusId } = c.req.param();
  const body = c.req.valid('json');

  if (Object.keys(body).length === 0) {
    throw new HTTPException(400, { message: 'Request body must include at least one field to update' });
  }

  // Fetch current row to get org_id for event insert
  const jwt = c.get('jwt');
  const anonDb = makeAnonClient(c.env, jwt);
  const { data: current, error: fetchErr } = await anonDb
    .schema('snap_enrollment')
    .from('work_requirement_statuses')
    .select('wr_status_id, org_id, exemption_type, hours_reported_per_week, compliance_status, compliance_notes')
    .eq('wr_status_id', wrStatusId)
    .single();

  if (fetchErr?.code === 'PGRST116') throw new HTTPException(404, { message: 'Work requirement status not found' });
  if (fetchErr) throw new HTTPException(500, { message: fetchErr.message });

  const db = await withActorContext(c);

  // Determine if the exemption changed (affects determination_basis)
  const exemptionChanged =
    body.exemption_type !== undefined &&
    body.exemption_type !== (current as unknown as { exemption_type: string | null }).exemption_type;

  const updatePayload: Record<string, unknown> = {
    last_reviewed_by: actor.id,
    last_reviewed_at: new Date().toISOString(),
  };
  if (body.exemption_type !== undefined) updatePayload.exemption_type = body.exemption_type;
  if (body.hours_reported_per_week !== undefined) updatePayload.hours_reported_per_week = body.hours_reported_per_week;
  if (body.compliance_status !== undefined) updatePayload.compliance_status = body.compliance_status;
  if (body.notes !== undefined) updatePayload.compliance_notes = body.notes;
  if (exemptionChanged) updatePayload.determination_basis = 'navigator_override';

  const { data: updated, error: updateErr } = await db
    .schema('snap_enrollment')
    .from('work_requirement_statuses')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updatePayload as any)
    .eq('wr_status_id', wrStatusId)
    .select()
    .single();

  if (updateErr?.code === 'PGRST116') throw new HTTPException(404, { message: 'Work requirement status not found' });
  if (updateErr) throw new HTTPException(500, { message: updateErr.message });

  // Insert event log for each changed field
  const changedFields: Record<string, unknown> = {};
  if (body.exemption_type !== undefined) changedFields.exemption_type = body.exemption_type;
  if (body.hours_reported_per_week !== undefined) changedFields.hours_reported_per_week = body.hours_reported_per_week;
  if (body.compliance_status !== undefined) changedFields.compliance_status = body.compliance_status;
  if (body.notes !== undefined) changedFields.compliance_notes = body.notes;

  const eventType = exemptionChanged ? 'exemption_granted' : 'compliance_verified';

  const { error: eventErr } = await db
    .schema('snap_enrollment')
    .from('work_requirement_events')
    .insert({
      wr_status_id: wrStatusId,
      org_id: (current as unknown as { org_id: string }).org_id,
      actor_id: actor.id,
      event_type: eventType,
      payload: { changed_fields: changedFields, navigator_override: true } as unknown as Json,
    });

  if (eventErr) throw new HTTPException(500, { message: eventErr.message });

  return c.json(updated);
});

// ---------------------------------------------------------------------------
// POST /work-requirements/:wrStatusId/events
// ---------------------------------------------------------------------------

app.post('/:wrStatusId/events', zValidator('json', eventBodySchema), async (c) => {
  const actor = c.get('actor');
  requireNavigator(actor.kind);

  const { wrStatusId } = c.req.param();
  const body = c.req.valid('json');

  // Fetch org_id from the status row
  const jwt = c.get('jwt');
  const anonDb = makeAnonClient(c.env, jwt);
  const { data: statusRow, error: fetchErr } = await anonDb
    .schema('snap_enrollment')
    .from('work_requirement_statuses')
    .select('wr_status_id, org_id')
    .eq('wr_status_id', wrStatusId)
    .single();

  if (fetchErr?.code === 'PGRST116') throw new HTTPException(404, { message: 'Work requirement status not found' });
  if (fetchErr) throw new HTTPException(500, { message: fetchErr.message });

  const db = await withActorContext(c);
  const { data: event, error: insertErr } = await db
    .schema('snap_enrollment')
    .from('work_requirement_events')
    .insert({
      wr_status_id: wrStatusId,
      org_id: (statusRow as unknown as { org_id: string }).org_id,
      actor_id: actor.id,
      event_type: body.event_type,
      payload: body.payload as unknown as Json,
    })
    .select()
    .single();

  if (insertErr) throw new HTTPException(500, { message: insertErr.message });

  return c.json(event, 201);
});

export default app;
