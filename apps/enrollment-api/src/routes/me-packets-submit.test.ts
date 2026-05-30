import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// The submit path auto-scores into packet_error_risk best-effort (me-packets.ts
// scoreAndPersist @ submit) — that row is the Pillar-1 CPR builder's per-packet
// input. These tests lock the eng-review CRITICAL path: submission MUST succeed
// even if that scoring throws, so the KPI plumbing can never break submit.

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../lib/applicant.js', () => ({
  getOrCreateApplicant: vi.fn().mockResolvedValue({ applicant_id: 'user-001' }),
}));

import { makeAnonClient, makeServiceClient } from '../lib/supabase.js';
import { getOrCreateApplicant } from '../lib/applicant.js';
import mePacketsRouter from './me-packets.js';
import {
  TEST_ENV,
  APPLICANT,
  makeDbClient,
  makeQueryBuilder,
  buildTestApp,
  JSON_HEADERS,
} from '../test/helpers.js';

afterEach(() => vi.resetAllMocks());
beforeEach(() => {
  vi.mocked(getOrCreateApplicant).mockResolvedValue({ applicant_id: 'user-001' } as never);
});

const PACKET_ID = 'b0000000-0000-0000-0000-000000000001';

// The submit handler reads the packet for ownership via the anon client. We
// provision ONLY that first anon from() — scoreAndPersist's subsequent reads
// (packet_answers / argyle / extraction_fields) then resolve to undefined and
// throw, which exercises the best-effort `.catch()` path on purpose.
function mockOwnership(packetResult: { data: unknown; error: unknown }) {
  const qbPacket = makeQueryBuilder(packetResult);
  vi.mocked(makeAnonClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValueOnce(qbPacket) }),
  } as never);
}

const UPDATED_PACKET = {
  packet_id: PACKET_ID,
  status: 'Submitted for Review',
  state_code: 'CA',
  created_at: '2026-05-30T00:00:00Z',
  updated_at: '2026-05-30T00:00:00Z',
  submitted_at: '2026-05-30T00:00:00Z',
  notes_for_applicant: null,
};

describe('POST /me/packets/:packetId/submit', () => {
  it('submits a Draft packet and returns 200 even when best-effort scoring throws', async () => {
    mockOwnership({ data: { packet_id: PACKET_ID, status: 'Draft' }, error: null });
    // Service client resolves the update().select().single() chain to the updated row.
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: UPDATED_PACKET, error: null }),
    );

    const app = buildTestApp(mePacketsRouter, '/me/packets', APPLICANT);
    const res = await app.request(
      `/me/packets/${PACKET_ID}/submit`,
      { method: 'POST', headers: JSON_HEADERS },
      TEST_ENV,
    );

    // CRITICAL (eng-review): submission MUST succeed regardless of CPR/scoring outcome.
    expect(res.status).toBe(200);
    // mapPacket() renames packet_id -> id in the response body.
    const body = (await res.json()) as { id: string; status: string };
    expect(body.id).toBe(PACKET_ID);
    expect(body.status).toBe('Submitted for Review');
  });

  it('rejects submitting a non-Draft packet with 409 (no double-submit)', async () => {
    mockOwnership({ data: { packet_id: PACKET_ID, status: 'Submitted for Review' }, error: null });
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));

    const app = buildTestApp(mePacketsRouter, '/me/packets', APPLICANT);
    const res = await app.request(
      `/me/packets/${PACKET_ID}/submit`,
      { method: 'POST', headers: JSON_HEADERS },
      TEST_ENV,
    );
    expect(res.status).toBe(409);
  });

  it('returns 404 when the packet is not found or not owned by the applicant', async () => {
    mockOwnership({ data: null, error: { code: 'PGRST116' } });
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));

    const app = buildTestApp(mePacketsRouter, '/me/packets', APPLICANT);
    const res = await app.request(
      `/me/packets/${PACKET_ID}/submit`,
      { method: 'POST', headers: JSON_HEADERS },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });
});
