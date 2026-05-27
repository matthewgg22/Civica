import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../lib/applicant.js', () => ({
  getOrCreateApplicant: vi.fn(),
}));
vi.mock('../lib/rate-limit.js', () => ({
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

import { makeAnonClient, makeServiceClient } from '../lib/supabase.js';
import { getOrCreateApplicant } from '../lib/applicant.js';
import meRouter from './me.js';
import {
  TEST_ENV, NAVIGATOR, APPLICANT, makeQueryBuilder, buildTestApp, JSON_HEADERS,
  type MockResult,
} from '../test/helpers.js';

afterEach(() => vi.resetAllMocks());

const SOURCE_PACKET_ID = 'pkt-source-001';
const NEW_PACKET_ID = 'pkt-new-001';

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

const closedSource = {
  packet_id: SOURCE_PACKET_ID,
  state_code: 'CA',
  county: 'Alameda',
  county_fips: '06001',
  status: 'Closed',
  closed_at: daysAgoISO(30),
};

const createdPacket = {
  packet_id: NEW_PACKET_ID,
  status: 'Draft',
  state_code: 'CA',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Mocks the chain of Supabase calls the route makes:
 *   anon:    1× snap_packets (source read)
 *   service: 1× snap_packets (existing draft check)
 *            1× snap_packets (insert new packet)
 *            1× packet_answers (read source answers)
 *            1× packet_answers (insert new answers)
 */
function mockClients(opts: {
  source: MockResult;
  existing?: MockResult;
  created?: MockResult;
  sourceAnswers?: MockResult;
  insertAnswers?: MockResult;
}) {
  vi.mocked(makeAnonClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValueOnce(makeQueryBuilder(opts.source)),
    }),
  } as never);

  const serviceFroms = vi.fn();
  if (opts.existing) serviceFroms.mockReturnValueOnce(makeQueryBuilder(opts.existing));
  if (opts.created) serviceFroms.mockReturnValueOnce(makeQueryBuilder(opts.created));
  if (opts.sourceAnswers) serviceFroms.mockReturnValueOnce(makeQueryBuilder(opts.sourceAnswers));
  if (opts.insertAnswers) serviceFroms.mockReturnValueOnce(makeQueryBuilder(opts.insertAnswers));

  vi.mocked(makeServiceClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({ from: serviceFroms }),
  } as never);

  vi.mocked(getOrCreateApplicant).mockResolvedValue({
    applicant_id: 'applicant-001',
    state_code: 'CA',
    preferred_language: 'en',
  } as never);
}

async function postReEnroll(packetId: string, actor = APPLICANT) {
  return buildTestApp(meRouter, '/', actor).request(
    `/re-enroll-from/${packetId}`,
    { method: 'POST', headers: JSON_HEADERS },
    TEST_ENV,
  );
}

describe('POST /me/re-enroll-from/:packetId', () => {
  it('creates a new Draft packet hydrated with state/county and copies answers (happy path)', async () => {
    mockClients({
      source: { data: closedSource, error: null },
      existing: { data: null, error: null },
      created: { data: createdPacket, error: null },
      sourceAnswers: {
        data: [
          { question_key: 'household_size', question_label: 'How many?', applicant_answer: '3', answer_source: 'applicant' },
          { question_key: 'rent_monthly', question_label: 'Rent?', applicant_answer: '1500', answer_source: 'applicant' },
          { question_key: 'income_monthly', question_label: 'Income?', applicant_answer: '800', answer_source: 'argyle' },
        ],
        error: null,
      },
      insertAnswers: { data: null, error: null },
    });

    const res = await postReEnroll(SOURCE_PACKET_ID);
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect((body.packet as Record<string, unknown>).packet_id).toBe(NEW_PACKET_ID);
    expect((body.packet as Record<string, unknown>).status).toBe('Draft');
    expect((body.hydrated as Record<string, unknown>).answers).toBe(3);
    expect(body.idempotent).toBe(false);
  });

  it('creates a Draft with answers=0 when source had no answers', async () => {
    mockClients({
      source: { data: closedSource, error: null },
      existing: { data: null, error: null },
      created: { data: createdPacket, error: null },
      sourceAnswers: { data: [], error: null },
    });

    const res = await postReEnroll(SOURCE_PACKET_ID);
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect((body.hydrated as Record<string, unknown>).answers).toBe(0);
  });

  it('is idempotent: returns existing active packet without creating a new one', async () => {
    const existingDraft = {
      packet_id: 'pkt-existing',
      status: 'Draft',
      state_code: 'CA',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockClients({
      source: { data: closedSource, error: null },
      existing: { data: existingDraft, error: null },
    });

    const res = await postReEnroll(SOURCE_PACKET_ID);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect((body.packet as Record<string, unknown>).packet_id).toBe('pkt-existing');
    expect(body.idempotent).toBe(true);
    expect((body.hydrated as Record<string, unknown>).answers).toBe(0);
  });

  it('returns 404 when source packet does not exist', async () => {
    mockClients({ source: { data: null, error: null } });
    const res = await postReEnroll('pkt-missing');
    expect(res.status).toBe(404);
  });

  it('returns 400 when source packet is not Closed (e.g., still Draft)', async () => {
    const draft = { ...closedSource, status: 'Draft', closed_at: null };
    mockClients({ source: { data: draft, error: null } });
    const res = await postReEnroll(SOURCE_PACKET_ID);
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/must be Closed/);
  });

  it('returns 400 when source has Closed status but no closed_at timestamp', async () => {
    const bad = { ...closedSource, closed_at: null };
    mockClients({ source: { data: bad, error: null } });
    const res = await postReEnroll(SOURCE_PACKET_ID);
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/closed_at/);
  });

  it('returns 400 when source packet closed more than 90 days ago', async () => {
    const stale = { ...closedSource, closed_at: daysAgoISO(120) };
    mockClients({ source: { data: stale, error: null } });
    const res = await postReEnroll(SOURCE_PACKET_ID);
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/too old/);
  });

  it('returns 403 for navigator/staff actors', async () => {
    const res = await postReEnroll(SOURCE_PACKET_ID, NAVIGATOR);
    expect(res.status).toBe(403);
  });

  it('returns 500 when source read fails with non-PGRST116 error', async () => {
    mockClients({
      source: { data: null, error: { code: '08000', message: 'connection failure' } },
    });
    const res = await postReEnroll(SOURCE_PACKET_ID);
    expect(res.status).toBe(500);
  });

  it('returns 500 when new-packet insert fails', async () => {
    mockClients({
      source: { data: closedSource, error: null },
      existing: { data: null, error: null },
      created: { data: null, error: { message: 'insert blew up' } },
    });
    const res = await postReEnroll(SOURCE_PACKET_ID);
    expect(res.status).toBe(500);
  });

  it('returns 500 when answer copy fails (leaks empty Draft for retry)', async () => {
    mockClients({
      source: { data: closedSource, error: null },
      existing: { data: null, error: null },
      created: { data: createdPacket, error: null },
      sourceAnswers: {
        data: [
          { question_key: 'household_size', question_label: 'How many?', applicant_answer: '3', answer_source: 'applicant' },
        ],
        error: null,
      },
      insertAnswers: { data: null, error: { message: 'fk violation' } },
    });
    const res = await postReEnroll(SOURCE_PACKET_ID);
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(/failed to copy answers/);
  });
});
