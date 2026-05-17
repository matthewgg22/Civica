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
import answersRouter from './answers.js';
import fullApp from '../index.js';
import { TEST_ENV, NAVIGATOR, APPLICANT, makeDbClient, buildTestApp, JSON_HEADERS } from '../test/helpers.js';

const PACKET_ID = 'p0000000-0000-0000-0000-000000000001';

afterEach(() => vi.resetAllMocks());

// ── 401 via full app ──────────────────────────────────────────────────────

describe('auth guard', () => {
  it('rejects requests with no Bearer token', async () => {
    const res = await fullApp.request(`/v1/enrollment/packets/${PACKET_ID}/answers`, {}, TEST_ENV);
    expect(res.status).toBe(401);
  });
});

// ── GET /packets/:packetId/answers ────────────────────────────────────────

describe('GET /packets/:packetId/answers', () => {
  it('returns answer list on happy path', async () => {
    const answers = [{ answer_id: 'a1', question_key: 'household_size', applicant_answer: '3' }];
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: answers, error: null }));

    const res = await buildTestApp(answersRouter, '/', NAVIGATOR).request(
      `/packets/${PACKET_ID}/answers`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  it('applicant can list answers (no role gate)', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: [], error: null }));

    const res = await buildTestApp(answersRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/answers`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
  });
});

// ── PUT /packets/:packetId/answers/:questionKey ───────────────────────────

describe('PUT /packets/:packetId/answers/:questionKey', () => {
  it('returns 400 when question_key is missing from body', async () => {
    const res = await buildTestApp(answersRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/answers/household_size`,
      {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ question_label: 'Household size' }), // missing question_key
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when question_label is missing', async () => {
    const res = await buildTestApp(answersRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/answers/household_size`,
      {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ question_key: 'household_size' }), // missing question_label
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('upserts and returns 201 on happy path', async () => {
    const upserted = {
      answer_id: 'a-new',
      question_key: 'household_size',
      applicant_answer: '3',
    };
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: upserted, error: null }));

    const res = await buildTestApp(answersRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/answers/household_size`,
      {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          question_key: 'household_size',
          question_label: 'Household size',
          applicant_answer: '3',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { question_key: string };
    expect(body.question_key).toBe('household_size');
  });

  it('returns 422 when three-value immutability trigger fires (P0001)', async () => {
    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: null, error: { code: 'P0001', message: 'applicant_answer is immutable' } }),
    );

    const res = await buildTestApp(answersRouter, '/', APPLICANT).request(
      `/packets/${PACKET_ID}/answers/household_size`,
      {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          question_key: 'household_size',
          question_label: 'Household size',
          applicant_answer: 'overwrite attempt',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });
});

// ── PATCH /answers/:answerId/review ───────────────────────────────────────

describe('PATCH /answers/:answerId/review', () => {
  it('returns 400 when navigator_confirmed_value is missing', async () => {
    const res = await buildTestApp(answersRouter, '/', NAVIGATOR).request(
      `/answers/a1/review`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({}) },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('confirms value and returns 200 on happy path', async () => {
    const reviewed = { answer_id: 'a1', navigator_confirmed_value: '3' };
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: reviewed, error: null }));

    const res = await buildTestApp(answersRouter, '/', NAVIGATOR).request(
      `/answers/a1/review`,
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ navigator_confirmed_value: '3' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { navigator_confirmed_value: string };
    expect(body.navigator_confirmed_value).toBe('3');
  });

  it('returns 404 when answer does not exist (PGRST116)', async () => {
    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'Row not found' } }),
    );

    const res = await buildTestApp(answersRouter, '/', NAVIGATOR).request(
      `/answers/missing/review`,
      {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ navigator_confirmed_value: '3' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });
});
