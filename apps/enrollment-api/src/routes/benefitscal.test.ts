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
import benefitsCalRouter from './benefitscal.js';
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

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const PACKET_ID = 'p0000000-0000-0000-0000-000000000001';
const SUBMISSION_ID = 's0000000-0000-0000-0000-000000000001';
const ORG_ID = 'org-001';

/** A minimal snap_packets row with applicant join */
const packetRow = {
  packet_id: PACKET_ID,
  status: 'In Navigator Review',
  state_code: 'CA',
  org_id: ORG_ID,
  county: 'Los Angeles',
  submitted_at: null,
  applicants: {
    applicant_id: 'a0000000-0000-0000-0000-000000000001',
    full_name_ciphertext: 'encrypted_name',
    date_of_birth_ciphertext: 'encrypted_dob',
    phone_ciphertext: 'encrypted_phone',
    address_ciphertext: 'encrypted_address',
    preferred_language: 'en',
  },
};

const answersRows = [
  { question_key: 'income_type', applicant_answer: 'wages', navigator_confirmed_value: null },
  { question_key: 'income_amount', applicant_answer: '1500', navigator_confirmed_value: null },
];

const docRows = [
  { document_id: 'd1', document_kind: 'paystub', processing_status: 'extracted' },
  { document_id: 'd2', document_kind: 'photo_id', processing_status: 'extracted' },
];

const submissionRow = {
  submission_id: SUBMISSION_ID,
  packet_id: PACKET_ID,
  status: 'pending_review',
  consent_type: 'async_portal',
  benefitscal_confirmation_number: null,
  submitted_at: null,
  submitted_by: null,
  assister_account_id: null,
  error_message: null,
  retry_count: 0,
  created_at: '2026-05-18T12:00:00.000Z',
  updated_at: '2026-05-18T12:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Auth guard (via full app)
// ---------------------------------------------------------------------------

describe('auth guard', () => {
  it('rejects requests with no Bearer token', async () => {
    const res = await fullApp.request(
      `/v1/enrollment/benefitscal/status/${PACKET_ID}`,
      {},
      TEST_ENV,
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /benefitscal/prepare-export/:packetId
// ---------------------------------------------------------------------------

describe('POST /benefitscal/prepare-export/:packetId', () => {
  it('returns 403 when caller is applicant', async () => {
    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', APPLICANT).request(
      `/benefitscal/prepare-export/${PACKET_ID}`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ consent_type: 'async_portal' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('returns 422 when telephonic consent timestamp missing for telephonic type', async () => {
    // First DB call needs to return a packet so we reach the validation check
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: packetRow, error: null }));

    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', NAVIGATOR).request(
      `/benefitscal/prepare-export/${PACKET_ID}`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ consent_type: 'telephonic' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });

  it('returns 400 when consent_type is invalid', async () => {
    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', NAVIGATOR).request(
      `/benefitscal/prepare-export/${PACKET_ID}`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ consent_type: 'invalid_value' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when packet not found', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'Row not found' } }),
    );

    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', NAVIGATOR).request(
      `/benefitscal/prepare-export/${PACKET_ID}`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ consent_type: 'async_portal' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('creates submission and returns 201 on happy path', async () => {
    // Build a mock db client that handles the multi-step query flow.
    // The route makes 3 separate DB query chains + a storage call + an insert.
    // We use a single makeDbClient so all queries resolve to the same mock data.
    // In tests, only the final shape matters — we verify the 201 response body.
    const insertedSubmission = { submission_id: SUBMISSION_ID, status: 'pending_review', created_at: '2026-05-18T12:00:00.000Z' };

    // Chain 1 (packet query): returns packetRow
    // Chain 2 (answers query): returns answersRows
    // Chain 3 (docs query): returns docRows
    // The simple makeDbClient returns the same result for every query.
    // We override per-call below by sequencing mock return values.

    const packetQb = makeQueryBuilder({ data: packetRow, error: null });
    const answersQb = makeQueryBuilder({ data: answersRows, error: null });
    const docsQb = makeQueryBuilder({ data: docRows, error: null });

    let queryCallCount = 0;
    const db = {
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          queryCallCount++;
          if (queryCallCount === 1) return packetQb;  // snap_packets
          if (queryCallCount === 2) return answersQb;  // packet_answers
          return docsQb;                               // uploaded_documents + insert
        }),
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://storage.example.com/signed-url' },
            error: null,
          }),
        }),
      },
    };

    vi.mocked(makeAnonClient).mockReturnValue(db as unknown as ReturnType<typeof makeAnonClient>);
    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: insertedSubmission, error: null }),
    );

    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', NAVIGATOR).request(
      `/benefitscal/prepare-export/${PACKET_ID}`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ consent_type: 'async_portal' }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(201);
    const body = await res.json() as {
      submission_id: string;
      status: string;
      payload: { packet_id: string; consent_type: string };
    };
    expect(body.submission_id).toBe(SUBMISSION_ID);
    expect(body.status).toBe('pending_review');
    expect(body.payload.packet_id).toBe(PACKET_ID);
    expect(body.payload.consent_type).toBe('async_portal');
  });
});

// ---------------------------------------------------------------------------
// GET /benefitscal/status/:packetId
// ---------------------------------------------------------------------------

describe('GET /benefitscal/status/:packetId', () => {
  it('returns 403 when caller is applicant', async () => {
    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', APPLICANT).request(
      `/benefitscal/status/${PACKET_ID}`,
      {},
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('returns the most recent submission row on happy path', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: submissionRow, error: null }));

    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', NAVIGATOR).request(
      `/benefitscal/status/${PACKET_ID}`,
      {},
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { submission_id: string; status: string; packet_id: string };
    expect(body.submission_id).toBe(SUBMISSION_ID);
    expect(body.status).toBe('pending_review');
    expect(body.packet_id).toBe(PACKET_ID);
  });

  it('returns 404 when no submission exists for the packet', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'Row not found' } }),
    );

    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', NAVIGATOR).request(
      `/benefitscal/status/${PACKET_ID}`,
      {},
      TEST_ENV,
    );

    expect(res.status).toBe(404);
  });

  it('returns 500 on unexpected DB error', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { message: 'connection timeout' } }),
    );

    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', NAVIGATOR).request(
      `/benefitscal/status/${PACKET_ID}`,
      {},
      TEST_ENV,
    );

    expect(res.status).toBe(500);
  });
});
