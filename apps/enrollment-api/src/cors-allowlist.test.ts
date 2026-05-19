import { describe, it, expect } from 'vitest';
import { app } from './index.js';

// CORS allowlist tests for app.use("*", cors({...})) in index.ts.
//
// Hono's cors() middleware reflects an origin only when its `origin`
// callback returns a string. When the callback returns `null` (our
// disallow signal), the Access-Control-Allow-Origin header is omitted
// so the browser will block the cross-origin response.

const TEST_ENV = {
  SUPABASE_URL: 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key',
  SUPABASE_ANON_KEY: 'placeholder-anon-key',
  SNAP_FERNET_KEY: 'placeholder-fernet-key-32bytes!!',
  SENTRY_DSN: '',
};

async function preflight(origin: string): Promise<Response> {
  return app.request(
    '/health',
    {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
      },
    },
    TEST_ENV,
  );
}

async function simpleGet(origin: string | null): Promise<Response> {
  const headers: Record<string, string> = {};
  if (origin) headers.Origin = origin;
  return app.request('/health', { method: 'GET', headers }, TEST_ENV);
}

describe('CORS allowlist (apps/enrollment-api index.ts)', () => {
  it('reflects allowed production dashboard origin', async () => {
    const res = await preflight('https://civica-dashboard.vercel.app');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://civica-dashboard.vercel.app',
    );
  });

  it('reflects allowed marketing origin', async () => {
    const res = await preflight('https://civica.app');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://civica.app');
  });

  it('reflects localhost:3000 for dev', async () => {
    const res = await preflight('http://localhost:3000');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
  });

  it('reflects a Vercel preview deploy that matches the regex', async () => {
    const previewOrigin = 'https://civica-dashboard-git-feature-foo.vercel.app';
    const res = await preflight(previewOrigin);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(previewOrigin);
  });

  it('omits ACAO header for a disallowed origin', async () => {
    const res = await simpleGet('https://attacker.example.com');
    const acao = res.headers.get('Access-Control-Allow-Origin');
    // Hono omits the header when origin callback returns null.
    expect(acao === null || acao === '' || acao === 'null').toBe(true);
  });

  it('omits ACAO header for an unrelated vercel.app project', async () => {
    const res = await simpleGet('https://some-other-app.vercel.app');
    const acao = res.headers.get('Access-Control-Allow-Origin');
    expect(acao === null || acao === '' || acao === 'null').toBe(true);
  });

  it('does not emit ACAO when there is no Origin header (same-origin / server-to-server)', async () => {
    const res = await simpleGet(null);
    const acao = res.headers.get('Access-Control-Allow-Origin');
    expect(acao === null || acao === '' || acao === 'null').toBe(true);
  });
});
