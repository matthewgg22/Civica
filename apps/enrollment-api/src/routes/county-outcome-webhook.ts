/**
 * County-authoritative outcome webhook — TODO-44 (Phase 2, Lane B).
 *
 * POST /webhooks/county-outcome — inbound authoritative SNAP application
 * outcomes from a county / CDSS feed. Upserts packet_outcomes with
 * source='county_authoritative' (+ error_dollars / per_pct), which is one of
 * the two authoritative feeds the kpi-snapshot cron sums into measured_per
 * (the other being internal QC review). These rows MOVE the measured error
 * rate, so:
 *   - Route is OUTSIDE authMiddleware; the HMAC signature is the only auth.
 *   - The shared secret is MANDATORY — unset → 503 (never accept unsigned
 *     authoritative data). Mirrors the EBT scraper webhook contract.
 *   - source is hard-coded county_authoritative; the fidelity firewall
 *     (migration 20260600) keeps self-reports a separate, dollar-free source.
 *
 * Payload is PROVISIONAL — the real county feed format is not yet confirmed
 * (the data-sharing agreement is the external blocker). It is a versioned,
 * validated batch so activation is a config step (set the secret) once the feed
 * lands; reconcile this schema with the county's actual format then.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { makeServiceClient } from '../lib/supabase.js';
import type { Env, Variables } from '../types.js';

// ---------------------------------------------------------------------------
// Provisional payload — a batch of per-packet authoritative outcomes.
// ---------------------------------------------------------------------------

const CountyOutcomeSchema = z.object({
  outcomes: z
    .array(
      z.object({
        packet_id: z.string().uuid(),
        outcome: z.enum(['approved', 'denied', 'pending_decision']),
        /** QC-found payment error in dollars (optional). */
        error_dollars: z.number().nonnegative().optional(),
        /** QC-found payment error rate, percentage points (0–100). >0 = an error. */
        per_pct: z.number().min(0).max(100).optional(),
      }),
    )
    .min(1)
    .max(500), // cap the batch so one request can't lock the table
});

// ---------------------------------------------------------------------------
// HMAC-SHA256 signature verification (mirrors argyle-webhook.ts).
// ---------------------------------------------------------------------------

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time hex compare — avoids leaking the signature via timing. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(
  secret: string,
  body: string,
  signatureHeader: string | undefined,
): Promise<boolean> {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expected = signatureHeader.slice(7);
  const actual = await hmacSha256Hex(secret, body);
  return constantTimeEqual(actual, expected);
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.post('/', async (c) => {
  // Mandatory secret: these rows move measured PER, so an unconfigured webhook
  // must refuse rather than accept unsigned data.
  const secret = c.env.COUNTY_OUTCOME_WEBHOOK_SECRET;
  if (!secret) {
    throw new HTTPException(503, { message: 'County outcome webhook not configured' });
  }

  const rawBody = await c.req.text();
  const valid = await verifySignature(secret, rawBody, c.req.header('X-Civica-Signature'));
  if (!valid) throw new HTTPException(401, { message: 'Invalid signature' });

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new HTTPException(400, { message: 'Invalid JSON' });
  }

  let payload: z.infer<typeof CountyOutcomeSchema>;
  try {
    payload = CountyOutcomeSchema.parse(parsed);
  } catch {
    throw new HTTPException(400, { message: 'Invalid county outcome payload' });
  }

  const db = makeServiceClient(c.env);
  const ids = [...new Set(payload.outcomes.map((o) => o.packet_id))];

  // Only upsert outcomes for packets that exist — an unknown packet_id would
  // otherwise abort the whole batch on the snap_packets FK. Unknowns are
  // reported back as skipped so the caller can reconcile.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const knownResp = await (db.schema('snap_enrollment').from('snap_packets') as any)
    .select('packet_id')
    .in('packet_id', ids);
  if (knownResp.error) {
    throw new HTTPException(500, { message: knownResp.error.message });
  }
  const known = new Set((knownResp.data ?? []).map((r: { packet_id: string }) => r.packet_id));

  const rows = payload.outcomes
    .filter((o) => known.has(o.packet_id))
    .map((o) => ({
      packet_id: o.packet_id,
      source: 'county_authoritative',
      outcome: o.outcome,
      error_dollars: o.error_dollars ?? null,
      per_pct: o.per_pct ?? null,
      reported_by: null,
    }));
  const skipped = ids.filter((id) => !known.has(id));

  if (rows.length > 0) {
    // Idempotent on (packet_id, source): a re-sent outcome updates, never double-counts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsertResp = await (db.schema('snap_enrollment').from('packet_outcomes' as any) as any)
      .upsert(rows, { onConflict: 'packet_id,source' })
      .select('packet_id');
    if (upsertResp.error) {
      throw new HTTPException(500, { message: upsertResp.error.message });
    }
  }

  return c.json({ ok: true, upserted: rows.length, skipped });
});

export default app;
