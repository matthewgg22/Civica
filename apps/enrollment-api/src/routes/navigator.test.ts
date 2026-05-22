import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../middleware/actorContext.js', () => ({
  withActorContext: vi.fn(),
}));

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { makeAnonClient } from '../lib/supabase.js';
import { withActorContext } from '../middleware/actorContext.js';
import { authMiddleware } from '../middleware/auth.js';
import navigatorRouter from './navigator.js';
import {
  TEST_ENV,
  NAVIGATOR,
  APPLICANT,
  makeDbClient,
  makeQueryBuilder,
  buildTestApp,
  JSON_HEADERS,
} from '../test/helpers.js';
import type { Env } from '../types.js';

function buildAuthApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.use('*', authMiddleware);
  app.route('/navigator', navigatorRouter);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}

afterEach(() => vi.resetAllMocks());

const PACKET_ID = 'a0000000-0000-0000-0000-000000000001';

const MOCK_PACKET = {
  packet_id: PACKET_ID,
  org_id: 'org-001',
  applicant_id: 'a0000000-0000-0000-0000-000000000001',
  state_code: 'CA',
};

const MOCK_TASK = {
  outreach_task_id: 't0000000-0000-0000-0000-000000000001',
  packet_id: PACKET_ID,
  org_id: 'org-001',
  applicant_id: MOCK_PACKET.applicant_id,
  reason: 'cliff_event',
  income_usd: 1580,
  sla_hours: 24,
  status: 'pending',
  created_at: '2026-05-18T00:00:00.000Z',
};

const OUTREACH_BODY = {
  packet_id: PACKET_ID,
  reason: 'cliff_event',
  income_usd: 1580,
  sla_hours: 24,
};

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('auth guard', () => {
  it('rejects requests with no Bearer token', async () => {
    const app = buildAuthApp();
    const res = await app.request(
      '/navigator/outreach',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(OUTREACH_BODY) },
      TEST_ENV,
    );
    expect(res.status).toBe(401);
  });
});

// ── POST /navigator/outreach ──────────────────────────────────────────────────

describe('POST /navigator/outreach', () => {
  it('returns 201 and task row on happy path', async () => {
    const qbPacket = makeQueryBuilder({ data: MOCK_PACKET, error: null });
    const qbNoWr = makeQueryBuilder({ data: null, error: { code: 'PGRST116' } });
    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn()
          .mockReturnValueOnce(qbPacket)   // packet lookup
          .mockReturnValueOnce(qbNoWr),    // WR status lookup (not found → skip event)
      }),
    } as never);

    const dbClient = makeDbClient({ data: MOCK_TASK, error: null });
    vi.mocked(withActorContext).mockResolvedValue(dbClient);

    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      '/navigator/outreach',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(OUTREACH_BODY) },
      TEST_ENV,
    );

    expect(res.status).toBe(201);
    const body = await res.json() as { reason: string; status: string };
    expect(body.reason).toBe('cliff_event');
    expect(body.status).toBe('pending');
  });

  it('returns 403 when actor is applicant', async () => {
    const app = buildTestApp(navigatorRouter, '/navigator', APPLICANT);
    const res = await app.request(
      '/navigator/outreach',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(OUTREACH_BODY) },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when packet_id is not a UUID', async () => {
    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      '/navigator/outreach',
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ ...OUTREACH_BODY, packet_id: 'not-a-uuid' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when packet does not exist', async () => {
    const qbNotFound = makeQueryBuilder({ data: null, error: { code: 'PGRST116' } });
    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(qbNotFound) }),
    } as never);

    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      '/navigator/outreach',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(OUTREACH_BODY) },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });
});

// ── POST /navigator/packets/:packetId/qc-outcome ─────────────────────────────
// RLS enforcement (cross-org isolation) must be verified in staging against a
// real Supabase instance with navigator JWT from a different org_id.

describe('POST /navigator/packets/:packetId/qc-outcome', () => {
  const OUTCOME_BODY = {
    qc_sampled: true,
    error_found: true,
    error_type: 'earned_income_unreported',
    error_amount: 320,
  };

  const MOCK_OUTCOME = {
    id: 'c0000000-0000-0000-0000-000000000001',
    packet_id: PACKET_ID,
    org_id: 'org-001',
    qc_sampled: true,
    error_found: true,
    error_type: 'earned_income_unreported',
    error_amount: 320,
    logged_at: '2026-05-19T00:00:00.000Z',
    logged_by: 'nav-001',
  };

  it('returns 201 with outcome row on happy path', async () => {
    const qbPacket = makeQueryBuilder({ data: { packet_id: PACKET_ID, org_id: 'org-001' }, error: null });
    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(qbPacket) }),
    } as never);

    const dbClient = makeDbClient({ data: MOCK_OUTCOME, error: null });
    vi.mocked(withActorContext).mockResolvedValue(dbClient);

    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      `/navigator/packets/${PACKET_ID}/qc-outcome`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(OUTCOME_BODY) },
      TEST_ENV,
    );

    expect(res.status).toBe(201);
    const body = await res.json() as typeof MOCK_OUTCOME;
    expect(body.qc_sampled).toBe(true);
    expect(body.error_found).toBe(true);
    expect(body.error_type).toBe('earned_income_unreported');
  });

  it('returns 201 for unsampled outcome with error_found null', async () => {
    const qbPacket = makeQueryBuilder({ data: { packet_id: PACKET_ID, org_id: 'org-001' }, error: null });
    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(qbPacket) }),
    } as never);

    const dbClient = makeDbClient({ data: { ...MOCK_OUTCOME, qc_sampled: false, error_found: null }, error: null });
    vi.mocked(withActorContext).mockResolvedValue(dbClient);

    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      `/navigator/packets/${PACKET_ID}/qc-outcome`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ qc_sampled: false, error_found: null }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(201);
  });

  it('returns 400 when qc_sampled=false but error_found is set (label contamination guard)', async () => {
    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      `/navigator/packets/${PACKET_ID}/qc-outcome`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ qc_sampled: false, error_found: false }),
      },
      TEST_ENV,
    );

    // Zod refine validation rejects this body
    expect(res.status).toBe(400);
  });

  it('returns 403 when actor is applicant', async () => {
    const app = buildTestApp(navigatorRouter, '/navigator', APPLICANT);
    const res = await app.request(
      `/navigator/packets/${PACKET_ID}/qc-outcome`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(OUTCOME_BODY) },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('returns 404 when packet does not exist', async () => {
    const qbNotFound = makeQueryBuilder({ data: null, error: { code: 'PGRST116' } });
    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(qbNotFound) }),
    } as never);

    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      `/navigator/packets/${PACKET_ID}/qc-outcome`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(OUTCOME_BODY) },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });
});

// ── PATCH /navigator/outreach/:taskId ─────────────────────────────────────────

const TASK_ID = 't0000000-0000-0000-0000-000000000001';

describe('PATCH /navigator/outreach/:taskId', () => {
  it('returns 200 and updated task when marking as contacted', async () => {
    const updatedTask = { ...MOCK_TASK, status: 'contacted', contacted_at: '2026-05-19T10:00:00Z' };
    const dbClient = makeDbClient({ data: updatedTask, error: null });
    vi.mocked(withActorContext).mockResolvedValue(dbClient);

    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      `/navigator/outreach/${TASK_ID}`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ status: 'contacted' }) },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('contacted');
  });

  it('returns 200 with resolution_notes when marking as resolved', async () => {
    const updatedTask = {
      ...MOCK_TASK,
      status: 'resolved',
      resolved_at: '2026-05-19T11:00:00Z',
      resolution_notes: 'Navigator called applicant — situation resolved.',
    };
    const dbClient = makeDbClient({ data: updatedTask, error: null });
    vi.mocked(withActorContext).mockResolvedValue(dbClient);

    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      `/navigator/outreach/${TASK_ID}`,
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ status: 'resolved', resolution_notes: 'Navigator called applicant — situation resolved.' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; resolution_notes: string };
    expect(body.status).toBe('resolved');
    expect(body.resolution_notes).toBe('Navigator called applicant — situation resolved.');
  });

  it('returns 404 when task not found', async () => {
    const dbClient = makeDbClient({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
    vi.mocked(withActorContext).mockResolvedValue(dbClient);

    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      `/navigator/outreach/${TASK_ID}`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ status: 'cancelled' }) },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when status is invalid', async () => {
    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      `/navigator/outreach/${TASK_ID}`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ status: 'invalid_status' }) },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when actor is applicant', async () => {
    const app = buildTestApp(navigatorRouter, '/navigator', APPLICANT);
    const res = await app.request(
      `/navigator/outreach/${TASK_ID}`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ status: 'contacted' }) },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });
});

// ── POST /navigator/packets/:packetId/error-risk ──────────────────────────────

function mockErrorRiskDb(
  packetResult: { data: unknown; error: unknown },
  answersResult: { data: unknown; error: unknown },
  argyleResult: { data: unknown; error: unknown },
  fieldsResult: { data: unknown; error: unknown } = { data: [], error: null },
) {
  const qbPacket = makeQueryBuilder(packetResult);
  const qbAnswers = makeQueryBuilder(answersResult);
  const qbArgyle = makeQueryBuilder(argyleResult);
  const qbFields = makeQueryBuilder(fieldsResult);
  vi.mocked(makeAnonClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi.fn()
        .mockReturnValueOnce(qbPacket)   // snap_packets ownership check
        .mockReturnValueOnce(qbAnswers)  // packet_answers
        .mockReturnValueOnce(qbArgyle)   // argyle_connections
        .mockReturnValueOnce(qbFields),  // extraction_fields (OCR data)
    }),
  } as never);
}

describe('POST /navigator/packets/:packetId/error-risk', () => {
  it('returns tier=high when income unverified and no Argyle', async () => {
    mockErrorRiskDb(
      { data: { packet_id: PACKET_ID, applicant_id: 'a0000000-0000-0000-0000-000000000001' }, error: null },
      { data: [{ question_key: 'employment_status', applicant_answer: 'employed_full_time' }], error: null },
      { data: { linked_accounts: [] }, error: null },
    );

    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      `/navigator/packets/${PACKET_ID}/error-risk`,
      { method: 'POST', headers: JSON_HEADERS },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { tier: string; score: number; factors: string[] };
    expect(body.tier).toBe('high');
    expect(body.score).toBe(80);
    expect(body.factors).toContain('earned_income_unverified');
  });

  it('returns tier=low when Argyle connected (API-verified income)', async () => {
    mockErrorRiskDb(
      { data: { packet_id: PACKET_ID, applicant_id: 'a0000000-0000-0000-0000-000000000001' }, error: null },
      { data: [{ question_key: 'employment_status', applicant_answer: 'self_employed' }], error: null },
      { data: { linked_accounts: [{ account_id: 'acc-1' }] }, error: null },
    );

    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      `/navigator/packets/${PACKET_ID}/error-risk`,
      { method: 'POST', headers: JSON_HEADERS },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { tier: string; score: number };
    expect(body.tier).toBe('low');
    expect(body.score).toBe(5);
  });

  it('returns tier=incomplete when no answers collected', async () => {
    mockErrorRiskDb(
      { data: { packet_id: PACKET_ID, applicant_id: 'a0000000-0000-0000-0000-000000000001' }, error: null },
      { data: [], error: null },
      { data: null, error: null },
    );

    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      `/navigator/packets/${PACKET_ID}/error-risk`,
      { method: 'POST', headers: JSON_HEADERS },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { tier: string; score: null };
    expect(body.tier).toBe('incomplete');
    expect(body.score).toBeNull();
  });

  it('returns 404 when packet not in navigator org', async () => {
    const qbNotFound = makeQueryBuilder({ data: null, error: { code: 'PGRST116' } });
    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(qbNotFound) }),
    } as never);

    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      `/navigator/packets/${PACKET_ID}/error-risk`,
      { method: 'POST', headers: JSON_HEADERS },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when actor is applicant', async () => {
    const app = buildTestApp(navigatorRouter, '/navigator', APPLICANT);
    const res = await app.request(
      `/navigator/packets/${PACKET_ID}/error-risk`,
      { method: 'POST', headers: JSON_HEADERS },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  // Regression test for the scoring-divergence fix: navigator endpoint must
  // surface the OBBBA HEAP+Full-SUA conflict ("weak"), not the prior proxy's
  // unconditional "moderate". Same packet must score identically on both
  // navigator and applicant endpoints.
  it('returns weak utility-sua signal on HEAP+Full-SUA conflict (parity with applicant endpoint)', async () => {
    mockErrorRiskDb(
      { data: { packet_id: PACKET_ID, applicant_id: 'a0000000-0000-0000-0000-000000000001' }, error: null },
      {
        data: [
          { question_key: 'has_heating_costs', applicant_answer: 'yes' },
          { question_key: 'has_electric_or_gas', applicant_answer: 'yes' },
          { question_key: 'has_phone', applicant_answer: 'yes' },
          { question_key: 'receives_heap', applicant_answer: 'yes' },
        ],
        error: null,
      },
      { data: { linked_accounts: [] }, error: null },
      { data: [], error: null },
    );

    const app = buildTestApp(navigatorRouter, '/navigator', NAVIGATOR);
    const res = await app.request(
      `/navigator/packets/${PACKET_ID}/error-risk`,
      { method: 'POST', headers: JSON_HEADERS },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { tier: string; factors: string[] };
    expect(body.factors).toContain('shelter_utility_unverified');
  });
});
