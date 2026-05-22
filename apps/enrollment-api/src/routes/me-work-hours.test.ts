import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
}));

import { makeAnonClient } from '../lib/supabase.js';
import workHoursRouter from './me-work-hours.js';
import { TEST_ENV, APPLICANT, NAVIGATOR, makeQueryBuilder, buildTestApp, JSON_HEADERS } from '../test/helpers.js';

afterEach(() => vi.resetAllMocks());

const PACKET_ID = 'b0000000-0000-0000-0000-000000000001';
const WR_STATUS_ID = 'c0000000-0000-0000-0000-000000000001';
const LOG_ID = 'd0000000-0000-0000-0000-000000000001';

const SUBJECT_STATUS = {
  wr_status_id: WR_STATUS_ID,
  is_subject: true,
  compliance_status: 'pending',
};

const MOCK_LOG_ENTRY = {
  log_id: LOG_ID,
  wr_status_id: WR_STATUS_ID,
  packet_id: PACKET_ID,
  applicant_id: APPLICANT.id,
  work_date: '2026-05-15',
  hours: 8,
  activity_type: 'work',
  employer_name: 'Acme Corp',
  document_id: null,
  notes: null,
  logged_at: '2026-05-15T18:00:00Z',
};

function mockPostSuccess() {
  const qbStatus = makeQueryBuilder({ data: SUBJECT_STATUS, error: null });
  const qbInsert = makeQueryBuilder({ data: MOCK_LOG_ENTRY, error: null });
  const qbSummary = makeQueryBuilder({ data: [{ hours: 8, document_id: null }], error: null });

  vi.mocked(makeAnonClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi.fn()
        .mockReturnValueOnce(qbStatus)   // work_requirement_statuses
        .mockReturnValueOnce(qbInsert)   // insert into hour_logs
        .mockReturnValueOnce(qbSummary), // getMonthlySummary
    }),
  } as never);
}

function mockGetSuccess(entries: unknown[] = [MOCK_LOG_ENTRY]) {
  const qbPacket = makeQueryBuilder({ data: { packet_id: PACKET_ID }, error: null });
  const qbEntries = makeQueryBuilder({ data: entries, error: null });
  const qbSummary = makeQueryBuilder({ data: entries.map(() => ({ hours: 8, document_id: null })), error: null });

  vi.mocked(makeAnonClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi.fn()
        .mockReturnValueOnce(qbPacket)   // snap_packets ownership check
        .mockReturnValueOnce(qbEntries)  // fetch entries
        .mockReturnValueOnce(qbSummary), // getMonthlySummary
    }),
  } as never);
}

// ---------------------------------------------------------------------------
// POST /:packetId/hours
// ---------------------------------------------------------------------------

describe('POST /me/work-requirements/:packetId/hours', () => {
  const app = buildTestApp(workHoursRouter, '/me/work-requirements', APPLICANT);
  const url = `/me/work-requirements/${PACKET_ID}/hours`;

  it('returns 201 with entry and monthly_summary on success', async () => {
    mockPostSuccess();

    const res = await app.request(url, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        work_date: '2026-05-15',
        hours: 8,
        activity_type: 'work',
        employer_name: 'Acme Corp',
      }),
    }, TEST_ENV);

    expect(res.status).toBe(201);
    const body = await res.json() as { entry: typeof MOCK_LOG_ENTRY; monthly_summary: { total_hours: number } };
    expect(body.entry.log_id).toBe(LOG_ID);
    expect(body.entry.hours).toBe(8);
    expect(body.monthly_summary.total_hours).toBe(8);
    expect(body.monthly_summary.target_hours).toBe(80);
  });

  it('returns 400 for invalid work_date format', async () => {
    const res = await app.request(url, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ work_date: '05/15/2026', hours: 8, activity_type: 'work' }),
    }, TEST_ENV);

    expect(res.status).toBe(400);
  });

  it('returns 400 for hours > 24', async () => {
    const res = await app.request(url, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ work_date: '2026-05-15', hours: 25, activity_type: 'work' }),
    }, TEST_ENV);

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid activity_type', async () => {
    const res = await app.request(url, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ work_date: '2026-05-15', hours: 8, activity_type: 'napping' }),
    }, TEST_ENV);

    expect(res.status).toBe(400);
  });

  it('returns 404 when no work_requirement_statuses row exists', async () => {
    const qbStatus = makeQueryBuilder({ data: null, error: { code: 'PGRST116', message: 'No rows' } });
    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValueOnce(qbStatus) }),
    } as never);

    const res = await app.request(url, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ work_date: '2026-05-15', hours: 8, activity_type: 'work' }),
    }, TEST_ENV);

    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toMatch(/navigator must evaluate/);
  });

  it('returns 400 when applicant is not subject to work requirements', async () => {
    const qbStatus = makeQueryBuilder({ data: { ...SUBJECT_STATUS, is_subject: false }, error: null });
    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValueOnce(qbStatus) }),
    } as never);

    const res = await app.request(url, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ work_date: '2026-05-15', hours: 8, activity_type: 'work' }),
    }, TEST_ENV);

    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toMatch(/not subject to work requirements/);
  });

  it('returns 403 for navigator role', async () => {
    const navApp = buildTestApp(workHoursRouter, '/me/work-requirements', NAVIGATOR);
    const res = await navApp.request(url, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ work_date: '2026-05-15', hours: 8, activity_type: 'work' }),
    }, TEST_ENV);

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /:packetId/hours
// ---------------------------------------------------------------------------

describe('GET /me/work-requirements/:packetId/hours', () => {
  const app = buildTestApp(workHoursRouter, '/me/work-requirements', APPLICANT);
  const url = `/me/work-requirements/${PACKET_ID}/hours`;

  it('returns 200 with entries and monthly_summary', async () => {
    mockGetSuccess();

    const res = await app.request(url, {}, TEST_ENV);

    expect(res.status).toBe(200);
    const body = await res.json() as { entries: unknown[]; monthly_summary: { total_hours: number; entries_count: number } };
    expect(body.entries).toHaveLength(1);
    expect(body.monthly_summary.entries_count).toBe(1);
    expect(body.monthly_summary.target_hours).toBe(80);
  });

  it('returns empty entries for a month with no logs', async () => {
    mockGetSuccess([]);

    const res = await app.request(`${url}?month=2026-01`, {}, TEST_ENV);

    expect(res.status).toBe(200);
    const body = await res.json() as { entries: unknown[]; monthly_summary: { total_hours: number } };
    expect(body.entries).toHaveLength(0);
    expect(body.monthly_summary.total_hours).toBe(0);
  });

  it('returns 400 for invalid month format', async () => {
    const res = await app.request(`${url}?month=May-2026`, {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 404 when packet does not belong to applicant', async () => {
    const qbPacket = makeQueryBuilder({ data: null, error: { code: 'PGRST116', message: 'No rows' } });
    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValueOnce(qbPacket) }),
    } as never);

    const res = await app.request(url, {}, TEST_ENV);
    expect(res.status).toBe(404);
  });

  it('returns 403 for navigator role', async () => {
    const navApp = buildTestApp(workHoursRouter, '/me/work-requirements', NAVIGATOR);
    const res = await navApp.request(url, {}, TEST_ENV);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// DELETE /:packetId/hours/:logId
// ---------------------------------------------------------------------------

describe('DELETE /me/work-requirements/:packetId/hours/:logId', () => {
  const app = buildTestApp(workHoursRouter, '/me/work-requirements', APPLICANT);
  const url = `/me/work-requirements/${PACKET_ID}/hours/${LOG_ID}`;

  it('returns 200 with deleted log id on success', async () => {
    const qbDelete = makeQueryBuilder({ data: null, error: null });
    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValueOnce(qbDelete) }),
    } as never);

    const res = await app.request(url, { method: 'DELETE' }, TEST_ENV);

    expect(res.status).toBe(200);
    const body = await res.json() as { deleted: string };
    expect(body.deleted).toBe(LOG_ID);
  });

  it('returns 403 for navigator role', async () => {
    const navApp = buildTestApp(workHoursRouter, '/me/work-requirements', NAVIGATOR);
    const res = await navApp.request(url, { method: 'DELETE' }, TEST_ENV);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// monthly_summary derived fields
// ---------------------------------------------------------------------------

describe('monthly_summary computed fields', () => {
  it('has_documentation is true when any entry has a document_id', async () => {
    const entryWithDoc = { ...MOCK_LOG_ENTRY, document_id: 'doc-abc' };

    const qbPacket = makeQueryBuilder({ data: { packet_id: PACKET_ID }, error: null });
    const qbEntries = makeQueryBuilder({ data: [entryWithDoc], error: null });
    const qbSummary = makeQueryBuilder({ data: [{ hours: 8, document_id: 'doc-abc' }], error: null });

    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn()
          .mockReturnValueOnce(qbPacket)
          .mockReturnValueOnce(qbEntries)
          .mockReturnValueOnce(qbSummary),
      }),
    } as never);

    const app = buildTestApp(workHoursRouter, '/me/work-requirements', APPLICANT);
    const res = await app.request(`/me/work-requirements/${PACKET_ID}/hours`, {}, TEST_ENV);

    expect(res.status).toBe(200);
    const body = await res.json() as { monthly_summary: { has_documentation: boolean } };
    expect(body.monthly_summary.has_documentation).toBe(true);
  });

  it('is_complete is true when total_hours >= 80', async () => {
    const manyEntries = Array.from({ length: 10 }, (_, i) => ({
      hours: 8,
      document_id: null,
    }));

    const qbPacket = makeQueryBuilder({ data: { packet_id: PACKET_ID }, error: null });
    const qbEntries = makeQueryBuilder({ data: manyEntries, error: null });
    const qbSummary = makeQueryBuilder({ data: manyEntries, error: null });

    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn()
          .mockReturnValueOnce(qbPacket)
          .mockReturnValueOnce(qbEntries)
          .mockReturnValueOnce(qbSummary),
      }),
    } as never);

    const app = buildTestApp(workHoursRouter, '/me/work-requirements', APPLICANT);
    const res = await app.request(`/me/work-requirements/${PACKET_ID}/hours`, {}, TEST_ENV);

    expect(res.status).toBe(200);
    const body = await res.json() as { monthly_summary: { is_complete: boolean; total_hours: number } };
    expect(body.monthly_summary.total_hours).toBe(80);
    expect(body.monthly_summary.is_complete).toBe(true);
  });
});
