/**
 * Work Hours Routes — OBBBA §10102 / 7 CFR 273.24 (applicant-facing)
 *
 * Allows SNAP recipients subject to work requirements to log their
 * monthly hours and attach supporting documentation (pay stubs, employer
 * letters). These logs are the evidence base for recertification and
 * mid-period change reporting (7 CFR 273.12(c) 10-day rule).
 *
 * All routes accept applicant role only — navigators read logs via the
 * navigator dashboard (work_requirement_monthly_summary view).
 *
 * Routes:
 *   POST /me/work-requirements/:packetId/hours   — log a work session
 *   GET  /me/work-requirements/:packetId/hours   — fetch monthly summary + entries
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { makeAnonClient } from '../lib/supabase.js';
import { requireApplicant } from '../lib/auth.js';
import type { Env } from '../types.js';

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const activityTypeSchema = z.enum(['work', 'training', 'volunteering', 'job_search']);

const postBodySchema = z.object({
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'work_date must be YYYY-MM-DD'),
  hours: z.number().positive().max(24),
  activity_type: activityTypeSchema,
  employer_name: z.string().max(200).optional(),
  document_id: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(), // defaults to current month
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentMonthStr(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

function monthBounds(monthStr: string): { start: string; end: string } {
  const [year, month] = monthStr.split('-').map(Number) as [number, number];
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1); // first day of next month (exclusive)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// POST /me/work-requirements/:packetId/hours
// Log one work session. Returns the saved entry + monthly rollup.
// ---------------------------------------------------------------------------

app.post('/:packetId/hours', zValidator('json', postBodySchema), async (c) => {
  const actor = c.get('actor');
  requireApplicant(actor.kind);

  const { packetId } = c.req.param();
  const body = c.req.valid('json');
  const jwt = c.get('jwt');
  const db = makeAnonClient(c.env, jwt);

  // Verify packet belongs to this applicant and has a work_requirement_statuses row
  const { data: statusRow, error: statusErr } = await db
    .schema('snap_enrollment')
    .from('work_requirement_statuses')
    .select('wr_status_id, is_subject, compliance_status')
    .eq('packet_id', packetId)
    .eq('applicant_id', actor.id)
    .single();

  if (statusErr?.code === 'PGRST116') {
    throw new HTTPException(404, {
      message: 'Work requirement status not found. A navigator must evaluate your packet first.',
    });
  }
  if (statusErr) throw new HTTPException(500, { message: statusErr.message });

  if (!statusRow.is_subject) {
    throw new HTTPException(400, {
      message: 'You are not subject to work requirements for this packet.',
    });
  }

  // Insert the log entry (RLS enforces applicant_id = auth.uid())
  const { data: entry, error: insertErr } = await db
    .schema('snap_enrollment')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('work_requirement_hour_logs' as any)
    .insert({
      wr_status_id: statusRow.wr_status_id,
      packet_id: packetId,
      applicant_id: actor.id,
      work_date: body.work_date,
      hours: body.hours,
      activity_type: body.activity_type,
      employer_name: body.employer_name ?? null,
      document_id: body.document_id ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (insertErr) throw new HTTPException(500, { message: insertErr.message });

  // Compute monthly rollup for the month containing work_date
  const month = body.work_date.slice(0, 7);
  const summary = await getMonthlySummary(db, packetId, month);

  return c.json({ entry, monthly_summary: summary }, 201);
});

// ---------------------------------------------------------------------------
// GET /me/work-requirements/:packetId/hours?month=YYYY-MM
// Fetch all entries for a month + the monthly rollup.
// Defaults to current month if ?month is omitted.
// ---------------------------------------------------------------------------

app.get('/:packetId/hours', zValidator('query', monthQuerySchema), async (c) => {
  const actor = c.get('actor');
  requireApplicant(actor.kind);

  const { packetId } = c.req.param();
  const { month: monthParam } = c.req.valid('query');
  const month = monthParam ?? currentMonthStr();
  const { start, end } = monthBounds(month);
  const jwt = c.get('jwt');
  const db = makeAnonClient(c.env, jwt);

  // Verify packet ownership (RLS also enforces this, but explicit check gives clearer error)
  const { data: packet, error: packetErr } = await db
    .schema('snap_enrollment')
    .from('snap_packets')
    .select('packet_id')
    .eq('packet_id', packetId)
    .eq('applicant_id', actor.id)
    .single();

  if (packetErr?.code === 'PGRST116') {
    throw new HTTPException(404, { message: 'Packet not found' });
  }
  if (packetErr || !packet) throw new HTTPException(500, { message: packetErr?.message ?? 'Unknown error' });

  // Fetch entries for the month
  const { data: entries, error: entriesErr } = await db
    .schema('snap_enrollment')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('work_requirement_hour_logs' as any)
    .select('log_id, work_date, hours, activity_type, employer_name, document_id, notes, logged_at')
    .eq('packet_id', packetId)
    .gte('work_date', start)
    .lt('work_date', end)
    .order('work_date', { ascending: false });

  if (entriesErr) throw new HTTPException(500, { message: entriesErr.message });

  const summary = await getMonthlySummary(db, packetId, month);

  return c.json({ monthly_summary: summary, entries: entries ?? [] });
});

// ---------------------------------------------------------------------------
// DELETE /me/work-requirements/:packetId/hours/:logId
// Remove an entry the applicant logged (e.g. entered wrong date/hours).
// ---------------------------------------------------------------------------

app.delete('/:packetId/hours/:logId', async (c) => {
  const actor = c.get('actor');
  requireApplicant(actor.kind);

  const { logId } = c.req.param();
  const jwt = c.get('jwt');
  const db = makeAnonClient(c.env, jwt);

  // RLS enforces applicant_id = auth.uid(); delete will silently no-op if not owner
  const { error } = await db
    .schema('snap_enrollment')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('work_requirement_hour_logs' as any)
    .delete()
    .eq('log_id', logId);

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({ deleted: logId });
});

// ---------------------------------------------------------------------------
// Internal: compute monthly summary for a packet + month string
// ---------------------------------------------------------------------------

async function getMonthlySummary(
  db: ReturnType<typeof makeAnonClient>,
  packetId: string,
  month: string,
) {
  const { start, end } = monthBounds(month);

  const { data: rows, error } = await db
    .schema('snap_enrollment')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('work_requirement_hour_logs' as any)
    .select('hours, document_id')
    .eq('packet_id', packetId)
    .gte('work_date', start)
    .lt('work_date', end);

  if (error) throw new HTTPException(500, { message: error.message });

  type SummaryRow = { hours: number | string; document_id: string | null };
  const entries: SummaryRow[] = (rows as unknown as SummaryRow[]) ?? [];
  const totalHours = entries.reduce((sum, r) => sum + Number(r.hours), 0);
  const hasDocumentation = entries.some((r) => r.document_id != null);

  return {
    month,
    total_hours: Math.round(totalHours * 10) / 10,
    target_hours: 80,
    entries_count: entries.length,
    has_documentation: hasDocumentation,
    // Derived compliance signals — used by iOS to drive the status chip and alert
    is_on_track: totalHours >= minimumHoursForDayOfMonth(),
    is_complete: totalHours >= 80,
  };
}

/**
 * Minimum hours expected by today's date to be "on track" for 80 hrs/month.
 * Linear pace: (today's day / days in month) × 80.
 */
function minimumHoursForDayOfMonth(): number {
  const now = new Date();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.floor((day / daysInMonth) * 80);
}

export default app;
