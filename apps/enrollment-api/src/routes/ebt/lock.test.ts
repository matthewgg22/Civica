import { describe, it, expect } from 'vitest';

import lockRouter from './lock.js';
import { TEST_ENV, APPLICANT, NAVIGATOR, buildTestApp } from '../../test/helpers.js';

describe('POST /ebt/lock', () => {
  it('returns 403 for navigator role', async () => {
    const app = buildTestApp(lockRouter, '/', NAVIGATOR);
    const res = await app.request('/', { method: 'POST' }, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it('returns 501 cardLockUnsupported with CA-specific copy and open_url CTA', async () => {
    const app = buildTestApp(lockRouter, '/', APPLICANT);
    const res = await app.request('/', { method: 'POST' }, TEST_ENV);
    expect(res.status).toBe(501);
    const body = await res.json() as {
      error: { type: string; code: string; message: string; cta: { kind: string; target: string }; doc_url?: string };
    };
    expect(body.error.type).toBe('ebt_scrape_error');
    expect(body.error.code).toBe('cardLockUnsupported');
    expect(body.error.message).toContain('California');
    expect(body.error.cta.kind).toBe('open_url');
    expect(body.error.cta.target).toBe('https://www.ebt.ca.gov/');
  });
});

describe('DELETE /ebt/lock', () => {
  it('returns 403 for navigator role', async () => {
    const app = buildTestApp(lockRouter, '/', NAVIGATOR);
    const res = await app.request('/', { method: 'DELETE' }, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it('returns 501 cardLockUnsupported with the same body as POST', async () => {
    const app = buildTestApp(lockRouter, '/', APPLICANT);
    const res = await app.request('/', { method: 'DELETE' }, TEST_ENV);
    expect(res.status).toBe(501);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('cardLockUnsupported');
  });
});
