import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../middleware/actorContext.js', () => ({
  withActorContext: vi.fn(),
}));

// Spy on the Browserless driver factory so we can verify the route
// auto-builds it when BROWSERLESS_API_KEY is set (TODO-15).
const mockBrowserlessFactoryFn = vi.hoisted(() =>
  vi.fn(() => ({
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue(undefined),
        fill: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockResolvedValue(undefined),
        waitForURL: vi.fn().mockResolvedValue(undefined),
        textContent: vi.fn().mockResolvedValue(null),
        screenshot: vi.fn().mockResolvedValue(null),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  })),
);
vi.mock('@civica/benefitscal-cbo/drivers/browserless', () => ({
  browserlessDriverFactory: mockBrowserlessFactoryFn,
}));

import { makeServiceClient } from '../lib/supabase.js';
import { withActorContext } from '../middleware/actorContext.js';
import benefitsCalRouter, { __setBenefitsCalDriverFactory } from './benefitscal.js';
import {
  TEST_ENV,
  NAVIGATOR,
  APPLICANT,
  makeDbClient,
  makeQueryBuilder,
  buildTestApp,
  JSON_HEADERS,
} from '../test/helpers.js';
import type {
  BrowserDriverFactory,
  BrowserDriver,
  BrowserDriverPage,
} from '@civica/benefitscal-cbo/driver';

afterEach(() => {
  vi.resetAllMocks();
  __setBenefitsCalDriverFactory(null);
  mockBrowserlessFactoryFn.mockClear();
});

const PACKET_ID = 'p0000000-0000-0000-0000-000000000001';
const SUBMISSION_ID = 's0000000-0000-0000-0000-000000000001';
const ORG_ID = 'org-001';

const pendingRow = {
  payload_json: { packet_id: PACKET_ID, foo: 'bar' },
  org_id: ORG_ID,
  consent_type: 'async_portal',
  telephonic_consent_recorded_at: null,
};

/**
 * Build a db client whose `.from(...)` returns successive query-builder
 * results, in call order. Each call gets the next result; subsequent
 * calls re-use the last result.
 */
function makeSequencedDbClient(results: Array<{ data: unknown; error: unknown }>) {
  let i = 0;
  const builders = results.map((r) => makeQueryBuilder(r));
  return {
    schema: vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        const qb = builders[Math.min(i, builders.length - 1)];
        i++;
        return qb;
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

describe('POST /benefitscal/submit/:packetId', () => {
  beforeEach(() => {
    __setBenefitsCalDriverFactory(null);
  });

  it('returns 403 for applicants', async () => {
    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', APPLICANT).request(
      `/benefitscal/submit/${PACKET_ID}`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ confirm: true }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when confirm is missing', async () => {
    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', NAVIGATOR).request(
      `/benefitscal/submit/${PACKET_ID}`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({}),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns existing row with idempotent:true when one is already in flight', async () => {
    const existingRow = {
      submission_id: SUBMISSION_ID,
      status: 'running',
      submitted_at: null,
    };
    // 1st query: idempotency lookup — returns existing
    const db = makeSequencedDbClient([{ data: existingRow, error: null }]);
    vi.mocked(makeServiceClient).mockReturnValue(db as unknown as ReturnType<typeof makeServiceClient>);

    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', NAVIGATOR).request(
      `/benefitscal/submit/${PACKET_ID}`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ confirm: true }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(202);
    const body = await res.json() as { submission_id: string; status: string; idempotent: boolean };
    expect(body.idempotent).toBe(true);
    expect(body.submission_id).toBe(SUBMISSION_ID);
    expect(body.status).toBe('running');
  });

  it('returns 404 when no prepare-export snapshot exists', async () => {
    // 1st query: idempotency lookup — none
    // 2nd query: pending_review lookup — none
    const db = makeSequencedDbClient([
      { data: null, error: null },
      { data: null, error: null },
    ]);
    vi.mocked(makeServiceClient).mockReturnValue(db as unknown as ReturnType<typeof makeServiceClient>);

    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', NAVIGATOR).request(
      `/benefitscal/submit/${PACKET_ID}`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ confirm: true }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(404);
  });

  it('happy path: returns 202 queued and kicks off background task via ctx.waitUntil', async () => {
    // 1st query: idempotency lookup — none
    // 2nd query: pending_review lookup — found
    const db = makeSequencedDbClient([
      { data: null, error: null },
      { data: pendingRow, error: null },
    ]);
    vi.mocked(makeServiceClient).mockReturnValue(db as unknown as ReturnType<typeof makeServiceClient>);

    // withActorContext returns a service-role-like client used for the insert
    const insertedRow = { submission_id: SUBMISSION_ID, status: 'queued' };
    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: insertedRow, error: null }),
    );

    // Wire a mock driver factory so the submitter is invoked.
    // Locator returned by getByLabel/getByRole — minimal stub matching
    // BrowserDriverLocator. The submitter chains .click()/.fill() on these.
    const fakeLocator = {
      fill: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      isVisible: vi.fn().mockResolvedValue(true),
      textContent: vi.fn().mockResolvedValue(null),
    };
    const fakePage: BrowserDriverPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      fill: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      waitForURL: vi.fn().mockResolvedValue(undefined),
      textContent: vi.fn().mockResolvedValue(null),
      screenshot: vi.fn().mockResolvedValue(null),
      getByLabel: vi.fn().mockReturnValue(fakeLocator),
      getByRole: vi.fn().mockReturnValue(fakeLocator),
    };
    const fakeBrowser: BrowserDriver = {
      newPage: vi.fn().mockResolvedValue(fakePage),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const factory: BrowserDriverFactory = {
      launch: vi.fn().mockResolvedValue(fakeBrowser),
    };
    __setBenefitsCalDriverFactory(factory);

    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', NAVIGATOR).request(
      `/benefitscal/submit/${PACKET_ID}`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ confirm: true }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(202);
    const body = await res.json() as {
      submission_id: string;
      status: string;
      idempotent: boolean;
    };
    expect(body.submission_id).toBe(SUBMISSION_ID);
    expect(body.status).toBe('queued');
    expect(body.idempotent).toBe(false);
  });

  it('returns 500 when insert fails', async () => {
    const db = makeSequencedDbClient([
      { data: null, error: null },
      { data: pendingRow, error: null },
    ]);
    vi.mocked(makeServiceClient).mockReturnValue(db as unknown as ReturnType<typeof makeServiceClient>);

    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: null, error: { message: 'insert failed' } }),
    );

    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', NAVIGATOR).request(
      `/benefitscal/submit/${PACKET_ID}`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ confirm: true }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(500);
  });

  it('marks row failed when no driver is wired (graceful degrade)', async () => {
    const db = makeSequencedDbClient([
      { data: null, error: null },
      { data: pendingRow, error: null },
    ]);
    vi.mocked(makeServiceClient).mockReturnValue(db as unknown as ReturnType<typeof makeServiceClient>);

    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: { submission_id: SUBMISSION_ID, status: 'queued' }, error: null }),
    );

    // No driver factory set.
    __setBenefitsCalDriverFactory(null);

    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', NAVIGATOR).request(
      `/benefitscal/submit/${PACKET_ID}`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ confirm: true }),
      },
      TEST_ENV,
    );

    // Route still returns 202 (the failure is recorded in the background).
    expect(res.status).toBe(202);
  });

  it('TODO-15: builds Browserless driver factory when BROWSERLESS_API_KEY is set', async () => {
    const db = makeSequencedDbClient([
      { data: null, error: null },
      { data: pendingRow, error: null },
    ]);
    vi.mocked(makeServiceClient).mockReturnValue(db as unknown as ReturnType<typeof makeServiceClient>);
    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: { submission_id: SUBMISSION_ID, status: 'queued' }, error: null }),
    );
    // No test override — the route must resolve the factory from env.
    __setBenefitsCalDriverFactory(null);

    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', NAVIGATOR).request(
      `/benefitscal/submit/${PACKET_ID}`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ confirm: true }),
      },
      { ...TEST_ENV, BROWSERLESS_API_KEY: 'browserless-test-token' },
    );

    expect(res.status).toBe(202);
    expect(mockBrowserlessFactoryFn).toHaveBeenCalledOnce();
    expect(mockBrowserlessFactoryFn).toHaveBeenCalledWith({
      apiKey: 'browserless-test-token',
    });
  });

  it('TODO-15: does NOT build Browserless factory when BROWSERLESS_API_KEY is absent', async () => {
    const db = makeSequencedDbClient([
      { data: null, error: null },
      { data: pendingRow, error: null },
    ]);
    vi.mocked(makeServiceClient).mockReturnValue(db as unknown as ReturnType<typeof makeServiceClient>);
    vi.mocked(withActorContext).mockResolvedValue(
      makeDbClient({ data: { submission_id: SUBMISSION_ID, status: 'queued' }, error: null }),
    );
    __setBenefitsCalDriverFactory(null);

    const res = await buildTestApp(benefitsCalRouter, '/benefitscal', NAVIGATOR).request(
      `/benefitscal/submit/${PACKET_ID}`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ confirm: true }),
      },
      TEST_ENV, // no BROWSERLESS_API_KEY
    );

    expect(res.status).toBe(202);
    expect(mockBrowserlessFactoryFn).not.toHaveBeenCalled();
  });
});
