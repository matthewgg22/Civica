import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../lib/applicant.js', () => ({
  // resolveApplicant() calls getOrCreateApplicant; return the test applicant_id literal
  getOrCreateApplicant: vi.fn().mockResolvedValue({ applicant_id: 'user-001' }),
}));

import { makeAnonClient, makeServiceClient } from '../lib/supabase.js';
import { getOrCreateApplicant } from '../lib/applicant.js';
import mePacketsRouter from './me-packets.js';
import {
  TEST_ENV,
  APPLICANT,
  NAVIGATOR,
  makeDbClient,
  makeQueryBuilder,
  buildTestApp,
  JSON_HEADERS,
} from '../test/helpers.js';

afterEach(() => vi.resetAllMocks());
// Restore applicant mock after each reset (vi.resetAllMocks clears mockResolvedValue)
beforeEach(() => {
  vi.mocked(getOrCreateApplicant).mockResolvedValue({ applicant_id: 'user-001' } as never);
});

const PACKET_ID = 'b0000000-0000-0000-0000-000000000001';
const MOCK_PACKET = { packet_id: PACKET_ID, applicant_id: 'user-001' };

function mockAnonDb(
  packetResult: { data: unknown; error: unknown },
  answersResult: { data: unknown; error: unknown },
  argyleResult: { data: unknown; error: unknown },
) {
  const qbPacket = makeQueryBuilder(packetResult);
  const qbAnswers = makeQueryBuilder(answersResult);
  const qbArgyle = makeQueryBuilder(argyleResult);
  vi.mocked(makeAnonClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi.fn()
        .mockReturnValueOnce(qbPacket)   // snap_packets ownership
        .mockReturnValueOnce(qbAnswers)  // packet_answers
        .mockReturnValueOnce(qbArgyle),  // argyle_connections
    }),
  } as never);
}

describe('POST /me/packets/:packetId/error-risk', () => {
  it('returns score=5 tier=low when Argyle connected (API-verified income)', async () => {
    mockAnonDb(
      { data: MOCK_PACKET, error: null },
      { data: [{ question_key: 'employment_status', applicant_answer: 'self_employed' }], error: null },
      { data: { linked_accounts: [{ account_id: 'acc-1' }] }, error: null },
    );
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));

    const app = buildTestApp(mePacketsRouter, '/me/packets', APPLICANT);
    const res = await app.request(
      `/me/packets/${PACKET_ID}/error-risk`,
      { method: 'POST', headers: JSON_HEADERS },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { tier: string; score: number; factors: string[] };
    // Argyle connected → gig-income=strong; single flow, strong → score 5
    expect(body.tier).toBe('low');
    expect(body.score).toBe(5);
    expect(body.factors).toEqual([]);
  });

  it('returns score=80 tier=high with earned_income_unverified when no Argyle', async () => {
    mockAnonDb(
      { data: MOCK_PACKET, error: null },
      { data: [{ question_key: 'employment_status', applicant_answer: 'self_employed' }], error: null },
      { data: { linked_accounts: [] }, error: null },
    );
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));

    const app = buildTestApp(mePacketsRouter, '/me/packets', APPLICANT);
    const res = await app.request(
      `/me/packets/${PACKET_ID}/error-risk`,
      { method: 'POST', headers: JSON_HEADERS },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { tier: string; score: number; factors: string[] };
    // No Argyle → gig-income=weak; single flow, weak → score 80
    expect(body.tier).toBe('high');
    expect(body.score).toBe(80);
    expect(body.factors).toContain('earned_income_unverified');
  });

  it('returns tier=incomplete score=null when no answers collected yet', async () => {
    mockAnonDb(
      { data: MOCK_PACKET, error: null },
      { data: [], error: null },
      { data: null, error: null },
    );
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));

    const app = buildTestApp(mePacketsRouter, '/me/packets', APPLICANT);
    const res = await app.request(
      `/me/packets/${PACKET_ID}/error-risk`,
      { method: 'POST', headers: JSON_HEADERS },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { tier: string; score: null; factors: string[] };
    expect(body.tier).toBe('incomplete');
    expect(body.score).toBeNull();
    expect(body.factors).toEqual([]);
  });

  it('returns 404 when packet not found or belongs to another applicant', async () => {
    const qbNotFound = makeQueryBuilder({ data: null, error: { code: 'PGRST116' } });
    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(qbNotFound) }),
    } as never);

    const app = buildTestApp(mePacketsRouter, '/me/packets', APPLICANT);
    const res = await app.request(
      `/me/packets/${PACKET_ID}/error-risk`,
      { method: 'POST', headers: JSON_HEADERS },
      TEST_ENV,
    );

    expect(res.status).toBe(404);
  });

  it('returns 403 when actor is a navigator (applicant-only endpoint)', async () => {
    const app = buildTestApp(mePacketsRouter, '/me/packets', NAVIGATOR);
    const res = await app.request(
      `/me/packets/${PACKET_ID}/error-risk`,
      { method: 'POST', headers: JSON_HEADERS },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('includes engine_version in response', async () => {
    mockAnonDb(
      { data: MOCK_PACKET, error: null },
      { data: [], error: null },
      { data: null, error: null },
    );
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));

    const app = buildTestApp(mePacketsRouter, '/me/packets', APPLICANT);
    const res = await app.request(
      `/me/packets/${PACKET_ID}/error-risk`,
      { method: 'POST', headers: JSON_HEADERS },
      TEST_ENV,
    );

    const body = await res.json() as { engine_version: string };
    expect(body.engine_version).toMatch(/^0\./);
  });
});
