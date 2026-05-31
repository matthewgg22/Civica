import { describe, it, expect, vi, afterEach } from 'vitest';

// County-authoritative outcome webhook (TODO-44 / Lane B). Locks the auth
// boundary (mandatory HMAC), the fidelity invariant (source=county_authoritative),
// idempotency (onConflict packet_id,source), and FK-safe skip of unknown packets.

vi.mock('../lib/supabase.js', () => ({ makeServiceClient: vi.fn(), makeAnonClient: vi.fn() }));

import { makeServiceClient } from '../lib/supabase.js';
import countyWebhook from './county-outcome-webhook.js';
import { TEST_ENV, APPLICANT, makeQueryBuilder, buildTestApp, JSON_HEADERS } from '../test/helpers.js';

afterEach(() => vi.resetAllMocks());

const SECRET = 'test-county-secret';
const ENV = { ...TEST_ENV, COUNTY_OUTCOME_WEBHOOK_SECRET: SECRET };
const PACKET = 'b0000000-0000-0000-0000-000000000001';
const UNKNOWN = 'c0000000-0000-0000-0000-000000000099';

// Sign exactly as the route verifies (HMAC-SHA256 over the raw body, sha256= hex).
async function sign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return 'sha256=' + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The route reads snap_packets (known-check) then upserts packet_outcomes.
function mockDb(knownPacketIds: string[]) {
  const upsertSpy = vi.fn();
  const knownQb = makeQueryBuilder({ data: knownPacketIds.map((packet_id) => ({ packet_id })), error: null });
  const upsertQb = makeQueryBuilder({ data: [], error: null });
  upsertQb.upsert = vi.fn((rows: unknown, opts: unknown) => {
    upsertSpy(rows, opts);
    return upsertQb;
  });
  vi.mocked(makeServiceClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValueOnce(knownQb).mockReturnValue(upsertQb),
    }),
  } as never);
  return { upsertSpy };
}

function post(body: string, sig: string | undefined, env: typeof TEST_ENV = ENV) {
  const app = buildTestApp(countyWebhook, '/webhooks/county-outcome', APPLICANT);
  const headers: Record<string, string> = { ...JSON_HEADERS };
  if (sig) headers['X-Civica-Signature'] = sig;
  return app.request('/webhooks/county-outcome', { method: 'POST', headers, body }, env);
}

describe('POST /webhooks/county-outcome', () => {
  it('503 when the secret is unconfigured (never accepts unsigned authoritative data)', async () => {
    const body = JSON.stringify({ outcomes: [{ packet_id: PACKET, outcome: 'approved' }] });
    const res = await post(body, await sign(SECRET, body), TEST_ENV); // TEST_ENV has no secret
    expect(res.status).toBe(503);
  });

  it('401 on a missing or invalid signature', async () => {
    const body = JSON.stringify({ outcomes: [{ packet_id: PACKET, outcome: 'approved' }] });
    expect((await post(body, undefined)).status).toBe(401);
    expect((await post(body, 'sha256=deadbeef')).status).toBe(401);
  });

  it('upserts a valid signed batch as source=county_authoritative with the QC dollars (fidelity)', async () => {
    const { upsertSpy } = mockDb([PACKET]);
    const body = JSON.stringify({
      outcomes: [{ packet_id: PACKET, outcome: 'denied', per_pct: 5.2, error_dollars: 120 }],
    });
    const res = await post(body, await sign(SECRET, body));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { upserted: number; skipped: string[] };
    expect(json.upserted).toBe(1);
    expect(json.skipped).toEqual([]);

    const [rows, opts] = upsertSpy.mock.calls[0]!;
    expect((rows as Array<Record<string, unknown>>)[0]).toMatchObject({
      packet_id: PACKET,
      source: 'county_authoritative', // the firewall: authoritative, dollar-bearing
      outcome: 'denied',
      per_pct: 5.2,
      error_dollars: 120,
    });
    expect(opts).toMatchObject({ onConflict: 'packet_id,source' });
  });

  it('skips unknown packet_ids (FK-safe) and reports them', async () => {
    const { upsertSpy } = mockDb([PACKET]); // only PACKET exists
    const body = JSON.stringify({
      outcomes: [
        { packet_id: PACKET, outcome: 'approved' },
        { packet_id: UNKNOWN, outcome: 'denied' },
      ],
    });
    const res = await post(body, await sign(SECRET, body));
    const json = (await res.json()) as { upserted: number; skipped: string[] };
    expect(json.upserted).toBe(1);
    expect(json.skipped).toEqual([UNKNOWN]);
    const [rows] = upsertSpy.mock.calls[0]!;
    expect(rows as unknown[]).toHaveLength(1);
    expect((rows as Array<{ packet_id: string }>)[0]!.packet_id).toBe(PACKET);
  });

  it('400 on an invalid payload (bad outcome enum), signature notwithstanding', async () => {
    const body = JSON.stringify({ outcomes: [{ packet_id: PACKET, outcome: 'maybe' }] });
    const res = await post(body, await sign(SECRET, body));
    expect(res.status).toBe(400);
  });
});
