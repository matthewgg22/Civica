import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../lib/applicant.js', () => ({
  getOrCreateApplicant: vi.fn(),
}));

import { makeAnonClient } from '../lib/supabase.js';
import meRouter from './me.js';
import { TEST_ENV, NAVIGATOR, APPLICANT, makeDbClient, buildTestApp } from '../test/helpers.js';

afterEach(() => vi.resetAllMocks());

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

describe('GET /me/re-entry-suggestion', () => {
  it('returns candidate=true with prior_packet when most recent close is within 90 days', async () => {
    const closedAt = daysAgoISO(30);
    const packetRow = {
      packet_id: 'pkt-001',
      state_code: 'CA',
      county: 'Alameda',
      county_fips: '06001',
      status: 'Closed',
      closed_at: closedAt,
    };
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: packetRow, error: null }));

    const res = await buildTestApp(meRouter, '/', APPLICANT).request(
      '/re-entry-suggestion', {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.candidate).toBe(true);
    expect(body.days_since_close).toBeGreaterThanOrEqual(29);
    expect(body.days_since_close).toBeLessThanOrEqual(31);
    expect((body.prior_packet as Record<string, unknown>).packet_id).toBe('pkt-001');
    expect((body.prior_packet as Record<string, unknown>).state_code).toBe('CA');
  });

  it('returns candidate=false with prior_packet=null when no closed packets exist', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(meRouter, '/', APPLICANT).request(
      '/re-entry-suggestion', {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.candidate).toBe(false);
    expect(body.prior_packet).toBeNull();
  });

  it('returns candidate=false when most recent close is older than 90 days (stale)', async () => {
    const stale = {
      packet_id: 'pkt-old',
      state_code: 'CA',
      county: 'Alameda',
      county_fips: '06001',
      status: 'Closed',
      closed_at: daysAgoISO(120),
    };
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: stale, error: null }));

    const res = await buildTestApp(meRouter, '/', APPLICANT).request(
      '/re-entry-suggestion', {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.candidate).toBe(false);
    expect(body.prior_packet).toBeNull();
  });

  it('treats the 90-day boundary as inclusive (day 90 still a candidate)', async () => {
    const boundary = {
      packet_id: 'pkt-boundary',
      state_code: 'CA',
      county: 'Alameda',
      county_fips: '06001',
      status: 'Closed',
      closed_at: daysAgoISO(89),
    };
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: boundary, error: null }));

    const res = await buildTestApp(meRouter, '/', APPLICANT).request(
      '/re-entry-suggestion', {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.candidate).toBe(true);
  });

  it('returns candidate=false when packet has Closed status but no closed_at timestamp (data integrity edge)', async () => {
    const noTimestamp = {
      packet_id: 'pkt-bad',
      state_code: 'CA',
      county: 'Alameda',
      county_fips: '06001',
      status: 'Closed',
      closed_at: null,
    };
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: noTimestamp, error: null }));

    const res = await buildTestApp(meRouter, '/', APPLICANT).request(
      '/re-entry-suggestion', {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.candidate).toBe(false);
  });

  it('returns 403 for navigator/staff actors', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(meRouter, '/', NAVIGATOR).request(
      '/re-entry-suggestion', {}, TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it('returns 500 on unexpected Supabase error', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: '08000', message: 'connection failure' } }),
    );

    const res = await buildTestApp(meRouter, '/', APPLICANT).request(
      '/re-entry-suggestion', {}, TEST_ENV,
    );
    expect(res.status).toBe(500);
  });

  it('tolerates PGRST116 "no rows" error code as not-found (returns candidate=false)', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(
      makeDbClient({ data: null, error: { code: 'PGRST116', message: 'no rows' } }),
    );

    const res = await buildTestApp(meRouter, '/', APPLICANT).request(
      '/re-entry-suggestion', {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.candidate).toBe(false);
  });
});
