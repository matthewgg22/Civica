import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// POST /me/packets/:id/outcome — applicant self-reports the county decision.
// These tests lock the T4 contract: ownership (404, not 403 — no existence leak),
// validation (400 on a bad enum), the applicant-only gate (403 for staff), and
// the FIDELITY invariant — the route always writes source=self_report, so a
// self-report can never be smuggled in as authoritative (PER-moving) data.

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../lib/applicant.js', () => ({
  getOrCreateApplicant: vi.fn().mockResolvedValue({ applicant_id: 'user-001' }),
}));

import { makeAnonClient } from '../lib/supabase.js';
import { getOrCreateApplicant } from '../lib/applicant.js';
import mePacketsRouter from './me-packets.js';
import {
  TEST_ENV,
  APPLICANT,
  NAVIGATOR,
  makeQueryBuilder,
  buildTestApp,
  JSON_HEADERS,
} from '../test/helpers.js';

afterEach(() => vi.resetAllMocks());
beforeEach(() => {
  vi.mocked(getOrCreateApplicant).mockResolvedValue({ applicant_id: 'user-001' } as never);
});

const PACKET_ID = 'b0000000-0000-0000-0000-000000000001';

// The route uses the anon client twice: ownership read (snap_packets) then the
// packet_outcomes upsert. Provision both query builders in order.
function mockOutcomeFlow(
  ownership: { data: unknown; error: unknown },
  upsertResult: { data: unknown; error: unknown },
) {
  const qbOwnership = makeQueryBuilder(ownership);
  const qbUpsert = makeQueryBuilder(upsertResult);
  vi.mocked(makeAnonClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValueOnce(qbOwnership).mockReturnValueOnce(qbUpsert),
    }),
  } as never);
  return { qbUpsert };
}

const post = (body: unknown, actor = APPLICANT) => {
  const app = buildTestApp(mePacketsRouter, '/me/packets', actor);
  return app.request(
    `/me/packets/${PACKET_ID}/outcome`,
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) },
    TEST_ENV,
  );
};

describe('POST /me/packets/:packetId/outcome', () => {
  it('upserts a self-report and returns it; source is always self_report', async () => {
    const { qbUpsert } = mockOutcomeFlow(
      { data: { packet_id: PACKET_ID }, error: null },
      {
        data: { packet_id: PACKET_ID, source: 'self_report', outcome: 'denied', reported_at: '2026-05-30T00:00:00Z' },
        error: null,
      },
    );

    const res = await post({ outcome: 'denied' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { outcome: string; source: string };
    expect(body.outcome).toBe('denied');
    expect(body.source).toBe('self_report');

    // FIDELITY: the route hard-codes source=self_report and upserts on the
    // (packet_id, source) idempotency key — never authoritative, never double-count.
    expect(qbUpsert.upsert).toHaveBeenCalledTimes(1);
    const [payload, opts] = qbUpsert.upsert.mock.calls[0];
    expect(payload).toMatchObject({ packet_id: PACKET_ID, source: 'self_report', outcome: 'denied' });
    expect(opts).toMatchObject({ onConflict: 'packet_id,source' });
  });

  it('accepts approved and pending_decision', async () => {
    for (const outcome of ['approved', 'pending_decision'] as const) {
      mockOutcomeFlow(
        { data: { packet_id: PACKET_ID }, error: null },
        { data: { packet_id: PACKET_ID, source: 'self_report', outcome, reported_at: '2026-05-30T00:00:00Z' }, error: null },
      );
      const res = await post({ outcome });
      expect(res.status).toBe(200);
      expect(((await res.json()) as { outcome: string }).outcome).toBe(outcome);
      vi.mocked(makeAnonClient).mockReset();
    }
  });

  it('returns 404 when the packet is not found or not owned (no existence leak)', async () => {
    mockOutcomeFlow({ data: null, error: { code: 'PGRST116' } }, { data: null, error: null });
    const res = await post({ outcome: 'approved' });
    expect(res.status).toBe(404);
  });

  it('returns 400 on an invalid outcome enum', async () => {
    mockOutcomeFlow({ data: { packet_id: PACKET_ID }, error: null }, { data: null, error: null });
    const res = await post({ outcome: 'maybe_later' });
    expect(res.status).toBe(400);
  });

  it('returns 403 when the actor is a navigator (applicant-only endpoint)', async () => {
    const res = await post({ outcome: 'approved' }, NAVIGATOR);
    expect(res.status).toBe(403);
  });
});
