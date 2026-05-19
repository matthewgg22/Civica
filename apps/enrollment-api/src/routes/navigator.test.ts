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
