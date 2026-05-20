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
import recertRouter from './recert.js';
import { app as fullApp } from '../index.js';
import { TEST_ENV, NAVIGATOR, APPLICANT, makeDbClient, makeQueryBuilder, buildTestApp, JSON_HEADERS } from '../test/helpers.js';

const PACKET_ID = 'pkt00000-0000-0000-0000-000000000001';
const RECERT_ID = 'rec00000-0000-0000-0000-000000000001';
const SESSION_ID = 'ses00000-0000-0000-0000-000000000001';

afterEach(() => vi.resetAllMocks());

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe('auth guard', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await fullApp.request(`/v1/enrollment/recert/${PACKET_ID}`, {}, TEST_ENV);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /recert/:packetId — returns recertification
// ---------------------------------------------------------------------------

describe('GET /recert/:packetId', () => {
  it('returns recertification with reminder schedule', async () => {
    const row = {
      recert_id: RECERT_ID,
      packet_id: PACKET_ID,
      org_id: 'org-001',
      cert_period_end: '2027-05-18',
      cert_period_end_source: 'estimated',
      status: 'pending',
      outcome: null,
      created_at: '2026-05-18T00:00:00Z',
      updated_at: '2026-05-18T00:00:00Z',
    };
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: row, error: null }));

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${PACKET_ID}`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.recert_id).toBe(RECERT_ID);
    expect(Array.isArray(body.reminder_schedule)).toBe(true);
    expect((body.reminder_schedule as unknown[]).length).toBe(3);
  });

  it('returns 404 when no recertification exists', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'Not found' } }),
    );
    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${PACKET_ID}`, {}, TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 for applicant role', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const res = await buildTestApp(recertRouter, '/', APPLICANT).request(
      `/${PACKET_ID}`, {}, TEST_ENV,
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /recert/:packetId/init — creates recertification
// ---------------------------------------------------------------------------

describe('POST /recert/:packetId/init', () => {
  const packetRow = {
    packet_id: PACKET_ID,
    org_id: 'org-001',
    state_code: 'CA',
    created_at: '2026-05-18T00:00:00Z',
  };
  const recertRow = {
    recert_id: RECERT_ID,
    packet_id: PACKET_ID,
    org_id: 'org-001',
    cert_period_end: '2027-05-18',
    cert_period_end_source: 'estimated',
    status: 'pending',
    created_at: '2026-05-18T00:00:00Z',
    updated_at: '2026-05-18T00:00:00Z',
  };

  it('creates a recertification with estimated date', async () => {
    // First call returns packet, second call returns inserted recert
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: packetRow, error: null }));
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: recertRow, error: null }));

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${PACKET_ID}/init`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.recert_id).toBe(RECERT_ID);
  });

  it('creates a recertification with provided certPeriodEnd', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: packetRow, error: null }));
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: recertRow, error: null }));

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${PACKET_ID}/init`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ cert_period_end: '2027-05-18', cert_period_end_source: 'manual' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
  });

  it('returns 404 when packet not found', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'Not found' } }),
    );
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${PACKET_ID}/init`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 409 when recertification already exists', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: packetRow, error: null }));
    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: null, error: { code: '23505', message: 'unique violation' } }),
    );

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${PACKET_ID}/init`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) },
      TEST_ENV,
    );
    expect(res.status).toBe(409);
  });

  it('returns 403 for applicant role', async () => {
    const res = await buildTestApp(recertRouter, '/', APPLICANT).request(
      `/${PACKET_ID}/init`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PATCH /recert/:recertId — update status/outcome
// ---------------------------------------------------------------------------

describe('PATCH /recert/:recertId', () => {
  it('updates recertification status', async () => {
    const updated = {
      recert_id: RECERT_ID,
      status: 'interview_scheduled',
      updated_at: '2026-05-18T01:00:00Z',
    };
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: updated, error: null }));

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${RECERT_ID}`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ status: 'interview_scheduled' }) },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe('interview_scheduled');
  });

  it('returns 404 when recertification not found', async () => {
    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'Not found' } }),
    );
    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${RECERT_ID}`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ status: 'lapsed' }) },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 for applicant', async () => {
    const res = await buildTestApp(recertRouter, '/', APPLICANT).request(
      `/${RECERT_ID}`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ status: 'lapsed' }) },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /recert/:recertId/practice/start
// ---------------------------------------------------------------------------

describe('POST /recert/:recertId/practice/start', () => {
  it('starts a practice session and returns sessionId + firstQuestion', async () => {
    const recertRow = {
      recert_id: RECERT_ID,
      org_id: 'org-001',
      packet_id: PACKET_ID,
    };
    const packetRow = { state_code: 'CA' };
    const sessionRow = {
      session_id: SESSION_ID,
      recert_id: RECERT_ID,
      state_code: 'CA',
      turn_count: 0,
      flags: [],
      done: false,
    };

    // makeAnonClient is called once; the shared client handles recert + packet + answers
    // queries — all return recertRow since the shared query builder doesn't distinguish tables.
    // The personalizer receives [] (via Array.isArray guard) and falls back to generic questions.
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: recertRow, error: null }));
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: sessionRow, error: null }));

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${RECERT_ID}/practice/start`,
      { method: 'POST' },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(typeof body.session_id).toBe('string');
    expect(body.first_question).toBeDefined();
    const fq = body.first_question as Record<string, unknown>;
    expect(typeof fq.questionId).toBe('string');
    expect(typeof fq.questionText).toBe('string');
  });

  it('returns 404 when recertification not found', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'Not found' } }),
    );
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${RECERT_ID}/practice/start`,
      { method: 'POST' },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /recert/:recertId/practice/:sessionId/respond
// ---------------------------------------------------------------------------

describe('POST /recert/:recertId/practice/:sessionId/respond', () => {
  it('returns next turn for a benign response', async () => {
    // Start a real in-memory session first so orchestrator has state
    const { recertEngine } = await import('@civica/recert-engine');
    const { sessionId: realSessionId } = recertEngine.interview.start({
      recertId: RECERT_ID,
      packetSnapshot: { state_code: 'CA' },
      state: 'CA',
    });

    const sessionRow = {
      session_id: realSessionId,
      recert_id: RECERT_ID,
      turn_count: 0,
      flags: [],
      done: false,
    };

    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: sessionRow, error: null }));
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${RECERT_ID}/practice/${realSessionId}/respond`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ user_message: 'No changes.' }) },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.done).toBe(false);
    expect(body.turn).toBeDefined();
    expect(body.flags).toBeDefined();
  });

  it('returns 404 when session not found in DB', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'Not found' } }),
    );
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${RECERT_ID}/practice/${SESSION_ID}/respond`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ user_message: 'Hello' }) },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('accepts audio_bytes_duration and threads it through (voice input)', async () => {
    const { recertEngine } = await import('@civica/recert-engine');
    const { sessionId: realSessionId } = recertEngine.interview.start({
      recertId: RECERT_ID,
      packetSnapshot: { state_code: 'CA' },
      state: 'CA',
    });

    const sessionRow = {
      session_id: realSessionId,
      recert_id: RECERT_ID,
      turn_count: 0,
      flags: [],
      done: false,
    };

    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: sessionRow, error: null }));
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${RECERT_ID}/practice/${realSessionId}/respond`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ user_message: 'I work part-time at a cafe.', audio_bytes_duration: 48000 }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
  });

  it('accepts respond without audio_bytes_duration (text input — backward compat)', async () => {
    const { recertEngine } = await import('@civica/recert-engine');
    const { sessionId: realSessionId } = recertEngine.interview.start({
      recertId: RECERT_ID,
      packetSnapshot: { state_code: 'CA' },
      state: 'CA',
    });

    const sessionRow = {
      session_id: realSessionId,
      recert_id: RECERT_ID,
      turn_count: 0,
      flags: [],
      done: false,
    };

    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: sessionRow, error: null }));
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${RECERT_ID}/practice/${realSessionId}/respond`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ user_message: 'No changes.' }) },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
  });

  it('returns 400 for missing user_message', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${RECERT_ID}/practice/${SESSION_ID}/respond`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /recert/:recertId/practice/:sessionId
// ---------------------------------------------------------------------------

describe('GET /recert/:recertId/practice/:sessionId', () => {
  it('returns session state', async () => {
    const sessionRow = {
      session_id: SESSION_ID,
      recert_id: RECERT_ID,
      state_code: 'CA',
      turn_count: 3,
      flags: [{ type: 'address', description: 'moved' }],
      done: false,
      started_at: '2026-05-18T00:00:00Z',
      completed_at: null,
    };
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: sessionRow, error: null }));

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${RECERT_ID}/practice/${SESSION_ID}`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.session_id).toBe(SESSION_ID);
    expect(body.turn_count).toBe(3);
    expect(body.done).toBe(false);
  });

  it('returns 404 when session not found', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'Not found' } }),
    );
    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${RECERT_ID}/practice/${SESSION_ID}`, {}, TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('applicants can read their own session (RLS-enforced ownership)', async () => {
    // Practice sessions are applicant-facing — they practice their own recert
    // interview. RLS via anonDb enforces session ownership, so the route
    // does NOT gate on actor.kind. An applicant fetching their own session
    // gets 200 (with session data); fetching someone else's gets 404 from RLS.
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({
        data: {
          session_id: SESSION_ID,
          recert_id: RECERT_ID,
          state_code: 'CA',
          turn_count: 1,
          flags: {},
          done: false,
          started_at: '2026-05-19T00:00:00Z',
          completed_at: null,
        },
        error: null,
      }),
    );
    const res = await buildTestApp(recertRouter, '/', APPLICANT).request(
      `/${RECERT_ID}/practice/${SESSION_ID}`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// POST /recert/:recertId/practice/:sessionId/score
// ---------------------------------------------------------------------------

describe('POST /recert/:recertId/practice/:sessionId/score', () => {
  it('returns existing score when one is already persisted (idempotency)', async () => {
    const sessionRow = {
      session_id: SESSION_ID,
      recert_id: RECERT_ID,
      state_code: 'CA',
      flags: [],
      done: true,
    };
    const scoreRow = {
      session_id: SESSION_ID,
      overall_score: 82,
      strengths: ['Clear about address'],
      improvements: ['Detail income'],
      summary_en: 'Good run.',
      summary_es: 'Buena práctica.',
      engine_version: 'claude-haiku-4-5/score-v1',
      generated_at: '2026-05-19T00:00:00Z',
    };

    // Both lookups (session + score) use the same anon client + query builder;
    // returning scoreRow on the second await is OK because the builder echoes.
    // Trick: chain by overriding sequence — first call returns session, then score.
    const seqClient = makeDbClient({ data: scoreRow, error: null });
    // override `from` to return different shapes for sessions vs scores
    let call = 0;
    seqClient.schema = vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation((tbl: string) => {
        call += 1;
        const result = tbl === 'recert_practice_sessions'
          ? { data: sessionRow, error: null }
          : { data: scoreRow, error: null };
        return makeQueryBuilder(result);
      }),
    });
    vi.mocked(makeAnonClient).mockReturnValue(seqClient);
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(recertRouter, '/', APPLICANT).request(
      `/${RECERT_ID}/practice/${SESSION_ID}/score`,
      { method: 'POST' },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.overall_score).toBe(82);
    expect(call).toBeGreaterThanOrEqual(2);
  });

  it('returns 400 when session is not yet done', async () => {
    const sessionRow = {
      session_id: SESSION_ID,
      recert_id: RECERT_ID,
      state_code: 'CA',
      flags: [],
      done: false,
    };
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: sessionRow, error: null }));
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(recertRouter, '/', APPLICANT).request(
      `/${RECERT_ID}/practice/${SESSION_ID}/score`,
      { method: 'POST' },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when session is not found', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'Not found' } }),
    );
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(recertRouter, '/', APPLICANT).request(
      `/${RECERT_ID}/practice/${SESSION_ID}/score`,
      { method: 'POST' },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when session done but no persisted turns exist (predates persistence)', async () => {
    // After PR #219 hardening, scoring reads from recert_practice_turns instead
    // of in-memory orchestrator state. Sessions completed BEFORE migration
    // 20260562 applied will have no turn rows → 404 (not 410).
    const sessionRow = {
      session_id: SESSION_ID,
      recert_id: RECERT_ID,
      state_code: 'CA',
      flags: [],
      done: true,
    };
    const seqClient = makeDbClient({ data: null, error: null });
    seqClient.schema = vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation((tbl: string) => {
        if (tbl === 'recert_practice_sessions') {
          return makeQueryBuilder({ data: sessionRow, error: null });
        }
        if (tbl === 'recert_practice_scores') {
          return makeQueryBuilder({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
        }
        if (tbl === 'recert_practice_turns') {
          return makeQueryBuilder({ data: [], error: null });
        }
        return makeQueryBuilder({ data: null, error: null });
      }),
    });
    vi.mocked(makeAnonClient).mockReturnValue(seqClient);
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(recertRouter, '/', APPLICANT).request(
      `/${RECERT_ID}/practice/${SESSION_ID}/score`,
      { method: 'POST' },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('reads transcript from persisted turns (survives Worker restart)', async () => {
    // Simulate the post-restart scenario: the in-memory orchestrator session
    // is gone, but the persisted turns table has the transcript. Scoring
    // should still succeed (this is the whole point of the hardening).
    const sessionRow = {
      session_id: SESSION_ID,
      recert_id: RECERT_ID,
      state_code: 'CA',
      flags: [],
      done: true,
    };
    const persistedTurns = [
      { turn_index: 0, caseworker_question: 'Has your address changed?', applicant_response: 'No, same place.', coaching: null },
      { turn_index: 1, caseworker_question: 'Has your income changed?', applicant_response: 'No changes.', coaching: null },
    ];
    const insertedScore = {
      session_id: SESSION_ID,
      overall_score: 75,
      strengths: ['a', 'b'],
      improvements: ['c', 'd'],
      summary_en: 'ok',
      summary_es: 'bien',
      engine_version: 'claude-haiku-4-5/score-v1',
      generated_at: '2026-05-19T00:00:00Z',
    };

    const seqClient = makeDbClient({ data: null, error: null });
    seqClient.schema = vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation((tbl: string) => {
        if (tbl === 'recert_practice_sessions') {
          return makeQueryBuilder({ data: sessionRow, error: null });
        }
        if (tbl === 'recert_practice_scores') {
          return makeQueryBuilder({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
        }
        if (tbl === 'recert_practice_turns') {
          return makeQueryBuilder({ data: persistedTurns, error: null });
        }
        return makeQueryBuilder({ data: null, error: null });
      }),
    });
    vi.mocked(makeAnonClient).mockReturnValue(seqClient);
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: insertedScore, error: null }));

    const { recertEngine } = await import('@civica/recert-engine');
    const scoreSpy = vi.spyOn(recertEngine.scorer, 'scoreSession').mockResolvedValue({
      overall_score: 75,
      strengths: ['a', 'b'],
      improvements: ['c', 'd'],
      summary_en: 'ok',
      summary_es: 'bien',
      engine_version: 'claude-haiku-4-5/score-v1',
    });

    const res = await buildTestApp(recertRouter, '/', APPLICANT).request(
      `/${RECERT_ID}/practice/${SESSION_ID}/score`,
      { method: 'POST' },
      { ...TEST_ENV, RECERT_AI_ENABLED: 'true', ANTHROPIC_API_KEY: 'test-key' },
    );
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.overall_score).toBe(75);

    expect(scoreSpy).toHaveBeenCalledTimes(1);
    const scoreInput = scoreSpy.mock.calls[0]?.[0] as { turns: Array<{ questionText: string; response?: string }> };
    expect(scoreInput.turns).toHaveLength(2);
    expect(scoreInput.turns[0]?.questionText).toBe('Has your address changed?');
    expect(scoreInput.turns[0]?.response).toBe('No, same place.');

    scoreSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Transcript persistence (recert_practice_turns)
// ---------------------------------------------------------------------------

describe('practice turn persistence', () => {
  it('start route inserts turn 0 with applicant_response=null', async () => {
    const recertRow = { recert_id: RECERT_ID, org_id: 'org-001', packet_id: PACKET_ID };
    const sessionRow = {
      session_id: SESSION_ID, recert_id: RECERT_ID, state_code: 'CA',
      turn_count: 0, flags: [], done: false,
    };

    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: recertRow, error: null }));

    const insertCalls: Array<{ table: string; payload: unknown }> = [];
    const serviceClient = makeDbClient({ data: sessionRow, error: null });
    serviceClient.schema = vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation((tbl: string) => {
        const qb = makeQueryBuilder(
          tbl === 'recert_practice_sessions'
            ? { data: sessionRow, error: null }
            : { data: null, error: null },
        );
        const realInsert = qb.insert;
        qb.insert = vi.fn().mockImplementation((payload: unknown) => {
          insertCalls.push({ table: tbl, payload });
          return realInsert(payload);
        });
        return qb;
      }),
    });
    vi.mocked(withActorContext).mockResolvedValue(serviceClient);

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${RECERT_ID}/practice/start`,
      { method: 'POST' },
      TEST_ENV,
    );
    expect(res.status).toBe(201);

    const turnInsert = insertCalls.find((c) => c.table === 'recert_practice_turns');
    expect(turnInsert).toBeDefined();
    const payload = turnInsert?.payload as Record<string, unknown>;
    expect(payload.turn_index).toBe(0);
    expect(payload.applicant_response).toBeNull();
    expect(payload.coaching).toBeNull();
    expect(typeof payload.caseworker_question).toBe('string');
  });

  it('respond route updates current turn and inserts next turn when not done', async () => {
    const { recertEngine } = await import('@civica/recert-engine');
    const { sessionId: realSessionId } = recertEngine.interview.start({
      recertId: RECERT_ID,
      packetSnapshot: { state_code: 'CA' },
      state: 'CA',
    });

    const sessionRow = {
      session_id: realSessionId, recert_id: RECERT_ID,
      turn_count: 0, flags: [], done: false,
    };
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: sessionRow, error: null }));

    const turnOps: Array<{ op: 'insert' | 'update'; payload: unknown }> = [];
    const serviceClient = makeDbClient({ data: null, error: null });
    serviceClient.schema = vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation((tbl: string) => {
        const qb = makeQueryBuilder({ data: null, error: null });
        if (tbl === 'recert_practice_turns') {
          qb.insert = vi.fn().mockImplementation((payload: unknown) => {
            turnOps.push({ op: 'insert', payload });
            return qb;
          });
          qb.update = vi.fn().mockImplementation((payload: unknown) => {
            turnOps.push({ op: 'update', payload });
            return qb;
          });
        }
        return qb;
      }),
    });
    vi.mocked(withActorContext).mockResolvedValue(serviceClient);

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${RECERT_ID}/practice/${realSessionId}/respond`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ user_message: 'No changes.' }) },
      TEST_ENV,
    );
    expect(res.status).toBe(200);

    expect(turnOps.find((t) => t.op === 'update')).toBeDefined();
    expect(turnOps.find((t) => t.op === 'insert')).toBeDefined();

    const updatePayload = turnOps.find((t) => t.op === 'update')?.payload as Record<string, unknown>;
    expect(updatePayload.applicant_response).toBe('No changes.');
    expect(updatePayload.responded_at).toBeDefined();

    const insertPayload = turnOps.find((t) => t.op === 'insert')?.payload as Record<string, unknown>;
    expect(insertPayload.turn_index).toBe(1);
    expect(insertPayload.applicant_response).toBeNull();
  });

  it('respond route updates final turn but does NOT insert next when done=true', async () => {
    const { recertEngine } = await import('@civica/recert-engine');
    // First, discover how many questions the CA bank yields for this snapshot
    // by driving a throwaway session to completion.
    const { sessionId: throwaway } = recertEngine.interview.start({
      recertId: RECERT_ID,
      packetSnapshot: { state_code: 'CA' },
      state: 'CA',
    });
    let totalTurns = 0;
    for (let i = 0; i < 50; i += 1) {
      const r = await recertEngine.interview.respond({ sessionId: throwaway, userMessage: 'x' });
      totalTurns += 1;
      if (r.done) break;
    }

    // Now start a fresh session and walk it to the last unanswered turn.
    const { sessionId: freshSession } = recertEngine.interview.start({
      recertId: RECERT_ID,
      packetSnapshot: { state_code: 'CA' },
      state: 'CA',
    });
    for (let i = 0; i < totalTurns - 1; i += 1) {
      await recertEngine.interview.respond({ sessionId: freshSession, userMessage: 'placeholder' });
    }

    const sessionRow = {
      session_id: freshSession, recert_id: RECERT_ID,
      turn_count: totalTurns - 1, flags: [], done: false,
    };
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: sessionRow, error: null }));

    const turnOps: Array<{ op: 'insert' | 'update' }> = [];
    const serviceClient = makeDbClient({ data: null, error: null });
    serviceClient.schema = vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation((tbl: string) => {
        const qb = makeQueryBuilder({ data: null, error: null });
        if (tbl === 'recert_practice_turns') {
          qb.insert = vi.fn().mockImplementation(() => { turnOps.push({ op: 'insert' }); return qb; });
          qb.update = vi.fn().mockImplementation(() => { turnOps.push({ op: 'update' }); return qb; });
        }
        return qb;
      }),
    });
    vi.mocked(withActorContext).mockResolvedValue(serviceClient);

    const res = await buildTestApp(recertRouter, '/', NAVIGATOR).request(
      `/${RECERT_ID}/practice/${freshSession}/respond`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ user_message: 'Done.' }) },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.done).toBe(true);

    expect(turnOps.filter((t) => t.op === 'update')).toHaveLength(1);
    expect(turnOps.filter((t) => t.op === 'insert')).toHaveLength(0);
  });
});

