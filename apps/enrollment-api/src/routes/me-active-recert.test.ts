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

describe('GET /me/active-recert', () => {
  it('returns the most recent recert for the signed-in applicant', async () => {
    const recertRow = {
      recert_id: 'rec-001',
      packet_id: 'pkt-001',
      cert_period_end: '2027-05-18',
      status: 'pending',
    };
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: recertRow, error: null }));

    const res = await buildTestApp(meRouter, '/', APPLICANT).request(
      '/active-recert', {}, TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.recert_id).toBe('rec-001');
  });

  it('returns 404 when applicant has no active recertification', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(meRouter, '/', APPLICANT).request(
      '/active-recert', {}, TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 for staff actors', async () => {
    vi.mocked(makeAnonClient).mockReturnValue(makeDbClient({ data: null, error: null }));

    const res = await buildTestApp(meRouter, '/', NAVIGATOR).request(
      '/active-recert', {}, TEST_ENV,
    );
    expect(res.status).toBe(403);
  });
});
