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
import consentsRouter from './consents.js';
import fullApp from '../index.js';
import { TEST_ENV, NAVIGATOR, APPLICANT, makeDbClient, buildTestApp, JSON_HEADERS } from '../test/helpers.js';

const APPLICANT_ID = 'a0000000-0000-0000-0000-000000000001';

afterEach(() => vi.resetAllMocks());

// ── 401 via full app ──────────────────────────────────────────────────────

describe('auth guard', () => {
  it('rejects requests with no Bearer token', async () => {
    const res = await fullApp.request(`/v1/enrollment/applicants/${APPLICANT_ID}/consents`, {}, TEST_ENV);
    expect(res.status).toBe(401);
  });
});

// ── GET /applicants/:applicantId/consents ─────────────────────────────────

describe('GET /applicants/:applicantId/consents', () => {
  it('returns consent list on happy path', async () => {
    const consents = [
      { consent_id: 'c1', consent_kind: 'privacy_notice', consented_at: '2026-05-01T00:00:00Z' },
    ];
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: consents, error: null }));

    const res = await buildTestApp(consentsRouter, '/', NAVIGATOR).request(
      `/applicants/${APPLICANT_ID}/consents`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it('applicant can list consents (no role gate)', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: [], error: null }));

    const res = await buildTestApp(consentsRouter, '/', APPLICANT).request(
      `/applicants/${APPLICANT_ID}/consents`, {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
  });
});

// ── POST /consents ────────────────────────────────────────────────────────

describe('POST /consents', () => {
  it('returns 400 for invalid consent_kind', async () => {
    const res = await buildTestApp(consentsRouter, '/', NAVIGATOR).request(
      `/consents`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          applicant_id: APPLICANT_ID,
          consent_kind: 'not_a_kind',
          policy_version: '1.0',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when policy_version is missing', async () => {
    const res = await buildTestApp(consentsRouter, '/', NAVIGATOR).request(
      `/consents`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          applicant_id: APPLICANT_ID,
          consent_kind: 'privacy_notice',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('records consent and returns 201 on happy path', async () => {
    const created = {
      consent_id: 'c-new',
      consent_kind: 'privacy_notice',
      consented_at: '2026-05-17T00:00:00Z',
    };
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: created, error: null }));

    const res = await buildTestApp(consentsRouter, '/', NAVIGATOR).request(
      `/consents`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          applicant_id: APPLICANT_ID,
          consent_kind: 'privacy_notice',
          policy_version: '1.0',
          consent_method: 'navigator_proxy',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { consent_kind: string };
    expect(body.consent_kind).toBe('privacy_notice');
  });

  it('records the consent_method from the request body', async () => {
    const created = {
      consent_id: 'c2',
      consent_kind: 'data_sharing',
      consent_method: 'paper_form',
    };
    vi.mocked(withActorContext).mockResolvedValue(makeDbClient({ data: created, error: null }));

    const res = await buildTestApp(consentsRouter, '/', NAVIGATOR).request(
      `/consents`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          applicant_id: APPLICANT_ID,
          consent_kind: 'data_sharing',
          policy_version: '1.0',
          consent_method: 'paper_form',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { consent_method: string };
    expect(body.consent_method).toBe('paper_form');
  });
});
