import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../middleware/actorContext.js', () => ({
  withActorContext: vi.fn(),
}));

import { makeAnonClient } from '../lib/supabase.js';
import { withActorContext } from '../middleware/actorContext.js';
import workRequirementsRouter from './work-requirements.js';
import { app as fullApp } from '../index.js';
import {
  TEST_ENV,
  NAVIGATOR,
  APPLICANT,
  makeDbClient,
  makeQueryBuilder,
  buildTestApp,
  JSON_HEADERS,
} from '../test/helpers.js';

afterEach(() => vi.resetAllMocks());

const PACKET_ID = 'p0000000-0000-0000-0000-000000000001';
const WR_STATUS_ID = 'w0000000-0000-0000-0000-000000000001';

const MOCK_PACKET = {
  packet_id: PACKET_ID,
  state_code: 'CA',
  org_id: 'org-001',
  applicant_id: 'a0000000-0000-0000-0000-000000000001',
  county_fips: '06037',
};

const MOCK_STATUS_ROW = {
  wr_status_id: WR_STATUS_ID,
  packet_id: PACKET_ID,
  org_id: 'org-001',
  applicant_id: 'a0000000-0000-0000-0000-000000000001',
  is_subject: true,
  subject_member_ids: ['m1'],
  determination_basis: 'rules_engine',
  exemption_type: null,
  compliance_status: 'unknown',
  months_used_in_window: 0,
  created_at: '2026-05-18T00:00:00.000Z',
  updated_at: '2026-05-18T00:00:00.000Z',
};

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('auth guard', () => {
  it('rejects requests with no Bearer token', async () => {
    const res = await fullApp.request(
      `/v1/enrollment/work-requirements/${PACKET_ID}/evaluate`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ householdMembers: [] }) },
      TEST_ENV,
    );
    expect(res.status).toBe(401);
  });
});

// ── POST /work-requirements/:packetId/evaluate ────────────────────────────────

describe('POST /work-requirements/:packetId/evaluate', () => {
  it('returns 403 for applicant role', async () => {
    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', APPLICANT).request(
      `/work-requirements/${PACKET_ID}/evaluate`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ householdMembers: [{ id: 'm1', age: 30 }] }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('returns 201 with determination + citations + status_row on happy path (subject)', async () => {
    // anonDb: packet lookup
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: MOCK_PACKET, error: null }));
    // withActorContext db: upsert + event insert (both return success)
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'work_requirement_statuses') {
        return makeQueryBuilder({ data: MOCK_STATUS_ROW, error: null });
      }
      // work_requirement_events insert
      return makeQueryBuilder({ data: { event_id: 'evt-001' }, error: null });
    });
    vi.mocked(withActorContext).mockResolvedValue({
      schema: vi.fn().mockReturnValue({ from: fromMock }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as Awaited<ReturnType<typeof withActorContext>>);

    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', NAVIGATOR).request(
      `/work-requirements/${PACKET_ID}/evaluate`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ householdMembers: [{ id: 'm1', age: 30 }] }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as {
      isSubject: boolean;
      subjectMemberIds: string[];
      timeLimitApplicable: boolean;
      citations: Array<{ section: string }>;
      status_row: { wr_status_id: string };
    };
    expect(body.isSubject).toBe(true);
    expect(body.subjectMemberIds).toEqual(['m1']);
    expect(body.timeLimitApplicable).toBe(true);
    // 4 citations: base SNAP + OBBBA §10102 + tribal (7 CFR 273.24(b)(6)) + qualifying program (7 CFR 273.7(d)(1))
    expect(body.citations).toHaveLength(4);
    expect(body.citations[0]?.section).toBe('7 CFR 273.24');
    expect(body.status_row.wr_status_id).toBe(WR_STATUS_ID);
  });

  it('returns 201 with isSubject: false for household with no subject members', async () => {
    // Pregnant adult → exempt
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: MOCK_PACKET, error: null }));
    const exemptStatusRow = { ...MOCK_STATUS_ROW, is_subject: false, subject_member_ids: [], exemption_type: 'pregnancy' };
    const fromMock = vi.fn().mockImplementation(() =>
      makeQueryBuilder({ data: exemptStatusRow, error: null }),
    );
    vi.mocked(withActorContext).mockResolvedValue({
      schema: vi.fn().mockReturnValue({ from: fromMock }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as Awaited<ReturnType<typeof withActorContext>>);

    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', NAVIGATOR).request(
      `/work-requirements/${PACKET_ID}/evaluate`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ householdMembers: [{ id: 'm1', age: 30, isPregnant: true }] }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { isSubject: boolean; exemptionType: string | null };
    expect(body.isSubject).toBe(false);
    expect(body.exemptionType).toBe('pregnancy');
  });

  it('returns 404 when packet not found', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'Row not found' } }),
    );

    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', NAVIGATOR).request(
      `/work-requirements/${PACKET_ID}/evaluate`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ householdMembers: [{ id: 'm1', age: 30 }] }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when householdMembers is missing', async () => {
    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', NAVIGATOR).request(
      `/work-requirements/${PACKET_ID}/evaluate`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({}),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });
});

// ── GET /work-requirements/:packetId ─────────────────────────────────────────

describe('GET /work-requirements/:packetId', () => {
  it('returns 404 before evaluate (no row exists)', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'Row not found' } }),
    );

    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', NAVIGATOR).request(
      `/work-requirements/${PACKET_ID}`,
      {},
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 with status row after evaluate', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: MOCK_STATUS_ROW, error: null }));

    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', NAVIGATOR).request(
      `/work-requirements/${PACKET_ID}`,
      {},
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { wr_status_id: string; is_subject: boolean };
    expect(body.wr_status_id).toBe(WR_STATUS_ID);
    expect(body.is_subject).toBe(true);
  });

  it('returns 403 for applicant role', async () => {
    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', APPLICANT).request(
      `/work-requirements/${PACKET_ID}`,
      {},
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });
});

// ── PATCH /work-requirements/:wrStatusId ─────────────────────────────────────

describe('PATCH /work-requirements/:wrStatusId', () => {
  it('updates exemption_type and inserts an event log row', async () => {
    // anonDb: fetch current row
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({
        data: { wr_status_id: WR_STATUS_ID, org_id: 'org-001', exemption_type: null, compliance_status: 'unknown' },
        error: null,
      }),
    );
    const updatedRow = { ...MOCK_STATUS_ROW, exemption_type: 'disability', determination_basis: 'navigator_override' };
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'work_requirement_statuses') {
        return makeQueryBuilder({ data: updatedRow, error: null });
      }
      // events insert
      return makeQueryBuilder({ data: { event_id: 'evt-002' }, error: null });
    });
    vi.mocked(withActorContext).mockResolvedValue({
      schema: vi.fn().mockReturnValue({ from: fromMock }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as Awaited<ReturnType<typeof withActorContext>>);

    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', NAVIGATOR).request(
      `/work-requirements/${WR_STATUS_ID}`,
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ exemption_type: 'disability' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { exemption_type: string; determination_basis: string };
    expect(body.exemption_type).toBe('disability');
    expect(body.determination_basis).toBe('navigator_override');
  });

  it('returns 400 with empty body', async () => {
    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', NAVIGATOR).request(
      `/work-requirements/${WR_STATUS_ID}`,
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({}),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid compliance_status', async () => {
    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', NAVIGATOR).request(
      `/work-requirements/${WR_STATUS_ID}`,
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ compliance_status: 'invalid_value' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 for applicant role', async () => {
    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', APPLICANT).request(
      `/work-requirements/${WR_STATUS_ID}`,
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ compliance_status: 'compliant' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });
});

// ── POST /work-requirements/:wrStatusId/events ────────────────────────────────

describe('POST /work-requirements/:wrStatusId/events', () => {
  it('inserts a manual navigator_note event and returns 201', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: { wr_status_id: WR_STATUS_ID, org_id: 'org-001' }, error: null }),
    );
    const eventRow = {
      event_id: 'evt-003',
      wr_status_id: WR_STATUS_ID,
      event_type: 'navigator_note',
      payload: { note: 'called household, confirmed 22hrs/week' },
    };
    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: eventRow, error: null }),
    );

    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', NAVIGATOR).request(
      `/work-requirements/${WR_STATUS_ID}/events`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          event_type: 'navigator_note',
          payload: { note: 'called household, confirmed 22hrs/week' },
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { event_type: string; event_id: string };
    expect(body.event_type).toBe('navigator_note');
    expect(body.event_id).toBe('evt-003');
  });

  it('returns 400 for invalid event_type', async () => {
    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', NAVIGATOR).request(
      `/work-requirements/${WR_STATUS_ID}/events`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ event_type: 'bad_event', payload: {} }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when wr_status_id not found', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'Row not found' } }),
    );

    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', NAVIGATOR).request(
      `/work-requirements/nonexistent-id/events`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ event_type: 'navigator_note', payload: {} }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 for applicant role', async () => {
    const res = await buildTestApp(workRequirementsRouter, '/work-requirements', APPLICANT).request(
      `/work-requirements/${WR_STATUS_ID}/events`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ event_type: 'navigator_note', payload: {} }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });
});
