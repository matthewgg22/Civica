import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../lib/applicant.js', () => ({
  getOrCreateApplicant: vi.fn(),
}));

import { makeAnonClient } from '../lib/supabase.js';
import { getOrCreateApplicant } from '../lib/applicant.js';
import mePacketsRouter from './me-packets.js';
import { TEST_ENV, NAVIGATOR, APPLICANT, makeQueryBuilder, buildTestApp } from '../test/helpers.js';

afterEach(() => vi.resetAllMocks());

const PACKET_ID = 'pkt-001';
const APPLICANT_ID = 'applicant-001';

/**
 * GET /me/packets/:id/retention-risk fans out 4 queries:
 *   1. snap_packets (ownership + status)
 *   2. packet_answers (children derivation)
 *   3. recertifications (cert_period_end → days_to_next_reporting)
 *   4. recertifications (prior outcomes for the applicant)
 *
 * mockClients takes those four results in order.
 */
function mockClients(opts: {
  packet: { data: unknown; error: unknown };
  answers?: { data: unknown; error: unknown };
  packetRecert?: { data: unknown; error: unknown };
  priorRecerts?: { data: unknown; error: unknown };
}) {
  const froms = vi.fn()
    .mockReturnValueOnce(makeQueryBuilder(opts.packet))
    .mockReturnValueOnce(makeQueryBuilder(opts.answers ?? { data: [], error: null }))
    .mockReturnValueOnce(makeQueryBuilder(opts.packetRecert ?? { data: null, error: null }))
    .mockReturnValueOnce(makeQueryBuilder(opts.priorRecerts ?? { data: [], error: null }));

  vi.mocked(makeAnonClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({ from: froms }),
  } as never);

  vi.mocked(getOrCreateApplicant).mockResolvedValue({
    applicant_id: APPLICANT_ID,
    state_code: 'CA',
    preferred_language: 'en',
  } as never);
}

async function getRetentionRisk(packetId: string = PACKET_ID, actor = APPLICANT) {
  return buildTestApp(mePacketsRouter, '/me/packets', actor).request(
    `/me/packets/${packetId}/retention-risk`,
    {},
    TEST_ENV,
  );
}

function futureDateISO(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

describe('GET /me/packets/:packetId/retention-risk', () => {
  it('returns scored result for an active packet with upcoming recert', async () => {
    mockClients({
      packet: { data: { packet_id: PACKET_ID, applicant_id: APPLICANT_ID, status: 'Draft' }, error: null },
      answers: {
        data: [
          { question_key: 'household_size', applicant_answer: '3' },
          { question_key: 'household_has_children', applicant_answer: 'true' },
        ],
        error: null,
      },
      packetRecert: { data: { cert_period_end: futureDateISO(20) }, error: null },
      priorRecerts: { data: [{ status: 'completed' }], error: null },
    });

    const res = await getRetentionRisk();
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.engine_version).toBeTruthy();
    expect(['high', 'medium', 'low', 'no-reporting-window']).toContain(body.tier);
    expect(typeof body.would_be_type_1_error_if_exits).toBe('boolean');
    expect(Array.isArray(body.top_signals)).toBe(true);
  });

  it('flags children dampener when household_has_children=true is present', async () => {
    mockClients({
      packet: { data: { packet_id: PACKET_ID, applicant_id: APPLICANT_ID, status: 'Draft' }, error: null },
      answers: {
        data: [{ question_key: 'household_has_children', applicant_answer: 'true' }],
        error: null,
      },
      packetRecert: { data: { cert_period_end: futureDateISO(5) }, error: null },
      priorRecerts: { data: [], error: null },
    });

    const res = await getRetentionRisk();
    const body = await res.json() as Record<string, unknown>;
    expect((body.top_signals as string[])).toContain('household_with_children_retains');
  });

  it('derives children flag from num_children answer when has_children key is absent', async () => {
    mockClients({
      packet: { data: { packet_id: PACKET_ID, applicant_id: APPLICANT_ID, status: 'Draft' }, error: null },
      answers: {
        data: [{ question_key: 'num_children', applicant_answer: '2' }],
        error: null,
      },
      packetRecert: { data: { cert_period_end: futureDateISO(5) }, error: null },
      priorRecerts: { data: [], error: null },
    });

    const res = await getRetentionRisk();
    const body = await res.json() as Record<string, unknown>;
    expect((body.top_signals as string[])).toContain('household_with_children_retains');
  });

  it('returns no-reporting-window tier when packet is Closed', async () => {
    mockClients({
      packet: { data: { packet_id: PACKET_ID, applicant_id: APPLICANT_ID, status: 'Closed' }, error: null },
      answers: { data: [], error: null },
      // No recert query happens for Closed packets, but mock anyway in case the code path changes.
      packetRecert: { data: null, error: null },
      priorRecerts: { data: [], error: null },
    });

    const res = await getRetentionRisk();
    const body = await res.json() as Record<string, unknown>;
    expect(body.tier).toBe('no-reporting-window');
    expect(body.score).toBeNull();
  });

  it('returns 404 when packet not found or not owned by applicant', async () => {
    mockClients({
      packet: { data: null, error: { code: 'PGRST116', message: 'no rows' } },
    });

    const res = await getRetentionRisk('pkt-missing');
    expect(res.status).toBe(404);
  });

  it('returns 500 on unexpected Supabase error', async () => {
    mockClients({
      packet: { data: null, error: { code: '08000', message: 'connection failure' } },
    });

    const res = await getRetentionRisk();
    expect(res.status).toBe(500);
  });

  it('maps approved/submitted recert status to "completed" outcome', async () => {
    mockClients({
      packet: { data: { packet_id: PACKET_ID, applicant_id: APPLICANT_ID, status: 'Draft' }, error: null },
      answers: { data: [], error: null },
      packetRecert: { data: { cert_period_end: futureDateISO(5) }, error: null },
      priorRecerts: {
        data: [{ status: 'approved' }, { status: 'submitted' }],
        error: null,
      },
    });
    const res = await getRetentionRisk();
    const body = await res.json() as Record<string, unknown>;
    // Most recent = "approved" → mapped to "completed" → no prior_churn or prior_missed signal.
    const signals = body.top_signals as string[];
    expect(signals).not.toContain('prior_churn_pattern');
    expect(signals).not.toContain('prior_missed_recert');
  });

  it('surfaces prior_missed_recert signal when most recent recert was missed', async () => {
    mockClients({
      packet: { data: { packet_id: PACKET_ID, applicant_id: APPLICANT_ID, status: 'Draft' }, error: null },
      answers: { data: [], error: null },
      packetRecert: { data: { cert_period_end: futureDateISO(5) }, error: null },
      priorRecerts: { data: [{ status: 'missed' }], error: null },
    });
    const res = await getRetentionRisk();
    const body = await res.json() as Record<string, unknown>;
    expect((body.top_signals as string[])).toContain('prior_missed_recert');
  });

  it('returns 403 for navigator/staff actors', async () => {
    mockClients({
      packet: { data: null, error: null },
    });
    const res = await getRetentionRisk(PACKET_ID, NAVIGATOR);
    expect(res.status).toBe(403);
  });
});
