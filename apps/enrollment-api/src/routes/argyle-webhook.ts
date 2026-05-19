/**
 * Argyle Webhook Receiver — T-DR3-8 (marketplace cliff event paycheck confirmation)
 *
 * POST /webhooks/argyle — receives paycheck.added events from Argyle.
 * Verifies HMAC-SHA256 signature, looks up the applicant via argyle_connections,
 * persists the paycheck, recomputes benefit impact, and fires a navigator
 * outreach task if the new income crosses the cliff (projected_benefit = 0).
 *
 * Route is outside authMiddleware — Argyle calls it directly.
 * Auth is the HMAC signature only.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { makeServiceClient } from '../lib/supabase.js';
import type { Env } from '../types.js';

// ---------------------------------------------------------------------------
// Zod schemas for Argyle paycheck.added payload
// ---------------------------------------------------------------------------

const ArgylePaycheckSchema = z.object({
  id: z.string(),
  employer: z.string().optional().default(''),
  /** Gross monthly amount in USD cents — we convert to dollars. */
  gross_pay_amount: z.number(),
  currency: z.string().default('USD'),
  pay_date: z.string(),            // ISO date string
  pay_period_end: z.string().optional(),
});

const ArgyleWebhookSchema = z.object({
  event: z.string(),
  data: z.object({
    user: z.string(),             // argyle_user_id
    paycheck: ArgylePaycheckSchema,
  }),
});

// ---------------------------------------------------------------------------
// HMAC-SHA256 signature verification
// ---------------------------------------------------------------------------

async function verifyArgyleSignature(
  secret: string,
  body: string,
  signatureHeader: string | undefined,
): Promise<boolean> {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expected = signatureHeader.slice(7);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hex === expected;
}

// ---------------------------------------------------------------------------
// Cliff detection (mirrors snap-qc-engine logic for benefit-impact-projection)
// ---------------------------------------------------------------------------

const EID_RATE = 0.20;
const BENEFIT_REDUCTION_RATE = 0.30;

function projectBenefit(currentBenefit: number, monthlyAmountUsd: number): number {
  const netCounted = monthlyAmountUsd * (1 - EID_RATE);
  const reduction = Math.round(netCounted * BENEFIT_REDUCTION_RATE);
  return Math.max(0, Math.round(currentBenefit - reduction));
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Env }>();

app.post('/', async (c) => {
  const rawBody = await c.req.text();

  const sigHeader = c.req.header('Argyle-Signature');
  const secret = c.env.ARGYLE_WEBHOOK_SECRET;

  if (secret) {
    const valid = await verifyArgyleSignature(secret, rawBody, sigHeader);
    if (!valid) throw new HTTPException(401, { message: 'Invalid Argyle signature' });
  }

  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(rawBody);
  } catch {
    throw new HTTPException(400, { message: 'Invalid Argyle payload' });
  }

  // Ignore non-paycheck events before full schema validation.
  const eventType = (rawParsed as Record<string, unknown>)?.event;
  if (typeof eventType !== 'string') {
    throw new HTTPException(400, { message: 'Invalid Argyle payload' });
  }
  if (eventType !== 'paycheck.added') {
    return c.json({ ok: true, action: 'ignored', event: eventType });
  }

  let payload: z.infer<typeof ArgyleWebhookSchema>;
  try {
    payload = ArgyleWebhookSchema.parse(rawParsed);
  } catch {
    throw new HTTPException(400, { message: 'Invalid Argyle payload' });
  }

  const db = makeServiceClient(c.env);
  const { user: argyleUserId, paycheck } = payload.data;

  // Resolve applicant from argyle_connections
  const { data: conn, error: connErr } = await db
    .schema('snap_enrollment')
    .from('argyle_connections' as never)
    .select('applicant_id, packet_id')
    .eq('argyle_user_id', argyleUserId)
    .is('revoked_at', null)
    .single() as unknown as { data: { applicant_id: string; packet_id: string } | null; error: unknown };

  if (connErr || !conn) {
    // Unknown Argyle user — not necessarily an error (test events, etc.)
    return c.json({ ok: true, action: 'ignored', reason: 'no_connection' });
  }

  const monthlyUsd = Math.round(paycheck.gross_pay_amount / 100); // cents → dollars

  // Fetch packet to get current benefit amount
  const { data: packet } = await db
    .schema('snap_enrollment')
    .from('snap_packets')
    .select('org_id, state_code, current_benefit_usd')
    .eq('packet_id', conn.packet_id)
    .is('deleted_at', null)
    .single() as unknown as { data: { org_id: string; state_code: string; current_benefit_usd: number | null } | null };

  const currentBenefitUsd = packet?.current_benefit_usd ?? 0;
  const projectedBenefitUsd = projectBenefit(currentBenefitUsd, monthlyUsd);
  const isCliffEvent = projectedBenefitUsd === 0 && currentBenefitUsd > 0;

  // Persist confirmed paycheck
  const { data: paycheckRow } = await db
    .schema('snap_enrollment')
    .from('marketplace_paychecks' as never)
    .insert({
      applicant_id: conn.applicant_id,
      packet_id: conn.packet_id,
      org_id: packet?.org_id ?? '',
      argyle_paycheck_id: paycheck.id,
      employer_name: paycheck.employer,
      monthly_amount_usd: monthlyUsd,
      projected_benefit_usd: projectedBenefitUsd,
      pay_date: paycheck.pay_date,
      is_cliff_event: isCliffEvent,
    } as never)
    .select('marketplace_paycheck_id')
    .single() as unknown as { data: { marketplace_paycheck_id: string } | null };

  // Fire navigator outreach task on cliff event
  if (isCliffEvent) {
    await db
      .schema('snap_enrollment')
      .from('navigator_outreach_queue' as never)
      .insert({
        packet_id: conn.packet_id,
        org_id: packet?.org_id ?? '',
        applicant_id: conn.applicant_id,
        reason: 'cliff_event',
        income_usd: monthlyUsd,
        sla_hours: 24,
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        created_by: 'system:argyle-webhook',
      } as never);
  }

  return c.json({
    ok: true,
    action: isCliffEvent ? 'cliff_event_queued' : 'paycheck_recorded',
    marketplace_paycheck_id: paycheckRow?.marketplace_paycheck_id ?? null,
    projected_benefit_usd: projectedBenefitUsd,
  });
});

export default app;
