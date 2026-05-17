import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./staffLookup.js', () => ({
  resolveStaffId: vi.fn().mockResolvedValue('staff-row-1'),
}));

import { buildApp } from '../app.js';
import { _resetSecretCache } from './verify.js';
import { resolveStaffId } from './staffLookup.js';

const TEST_SECRET = 'test-secret-that-is-at-least-32-bytes!!';

async function sign(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .setSubject(claims['sub'] as string ?? 'test-sub')
    .sign(new TextEncoder().encode(TEST_SECRET));
}

function applicantToken(sub = 'applicant-1') {
  return sign({ sub });
}

function staffToken(sub = 'staff-1', role: string = 'navigator') {
  return sign({ sub, email: 'nav@civica.org', app_metadata: { role } });
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_JWT_SECRET', TEST_SECRET);
  _resetSecretCache();
  // Re-set in case prior test ran vi.resetAllMocks()
  vi.mocked(resolveStaffId).mockResolvedValue('staff-row-1');
});

afterEach(() => {
  vi.unstubAllEnvs();
  _resetSecretCache();
});

// ── /healthz is public ─────────────────────────────────────────────────────

describe('GET /healthz (public)', () => {
  it('responds 200 without any token', async () => {
    const res = await buildApp().request('/healthz');
    expect(res.status).toBe(200);
  });
});

// ── /me requires applicant JWT ─────────────────────────────────────────────

describe('GET /me/* (applicant-only)', () => {
  it('returns 401 with no token', async () => {
    const res = await buildApp().request('/me/anything');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a staff JWT (hard wall)', async () => {
    const token = await staffToken();
    const res = await buildApp().request('/me/anything', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('staff_token_on_applicant_endpoint');
  });

  it('passes through with a valid applicant JWT', async () => {
    const token = await applicantToken();
    // No handler registered yet — expect 404, not 401.
    const res = await buildApp().request('/me/anything', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await buildApp().request('/me/anything', {
      headers: { Authorization: 'Bearer not.a.jwt' },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('invalid_token');
  });
});

// ── /navigator requires staff JWT ─────────────────────────────────────────

describe('GET /navigator/* (staff-only)', () => {
  it('returns 401 with no token', async () => {
    const res = await buildApp().request('/navigator/anything');
    expect(res.status).toBe(401);
  });

  it('returns 401 with an applicant JWT (hard wall)', async () => {
    const token = await applicantToken();
    const res = await buildApp().request('/navigator/anything', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('applicant_token_on_staff_endpoint');
  });

  it('passes through with a valid staff JWT (navigator role)', async () => {
    const token = await staffToken('staff-1', 'navigator');
    const res = await buildApp().request('/navigator/anything', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404); // no handler yet — 404 proves auth passed
  });

  it('passes through with supervisor and admin roles', async () => {
    for (const role of ['supervisor', 'admin']) {
      const token = await staffToken('staff-2', role);
      const res = await buildApp().request('/navigator/anything', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(404);
    }
  });

  it('returns 401 for an unknown role claim', async () => {
    const token = await staffToken('staff-3', 'unknown_role');
    const res = await buildApp().request('/navigator/anything', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('applicant_token_on_staff_endpoint');
  });

  it('returns 401 for an expired token', async () => {
    const expired = await new SignJWT({ sub: 'staff-1', email: 'nav@civica.org', app_metadata: { role: 'navigator' } })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(TEST_SECRET));
    const res = await buildApp().request('/navigator/anything', {
      headers: { Authorization: `Bearer ${expired}` },
    });
    expect(res.status).toBe(401);
  });
});
