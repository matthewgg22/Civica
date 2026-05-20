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

  it('returns 410 when session done but transcript no longer in memory', async () => {
    const sessionRow = {
      session_id: SESSION_ID,   // sentinel sessionId not in orchestrator memory
      recert_id: RECERT_ID,
      state_code: 'CA',
      flags: [],
      done: true,
    };
    const seqClient = makeDbClient({ data: null, error: null });
    seqClient.schema = vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation((tbl: string) => {
        const result = tbl === 'recert_practice_sessions'
          ? { data: sessionRow, error: null }
          : { data: null, error: { code: 'PGRST116', message: 'Not found' } };
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
    expect(res.status).toBe(410);
  });
});

