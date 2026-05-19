import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../middleware/actorContext.js', () => ({
  withActorContext: vi.fn(),
}));

import { makeAnonClient, makeServiceClient } from '../lib/supabase.js';
import oauthCanvasRouter from './oauth-canvas.js';
import {
  TEST_ENV,
  APPLICANT,
  makeDbClient,
  makeQueryBuilder,
  buildTestApp,
  JSON_HEADERS,
} from '../test/helpers.js';

afterEach(() => vi.resetAllMocks());

const PACKET_ID = 'c0000000-0000-0000-0000-000000000001';

const CANVAS_ENV = {
  ...TEST_ENV,
  CANVAS_CLIENT_ID: 'canvas-client-id',
  CANVAS_CLIENT_SECRET: 'canvas-client-secret',
  CANVAS_INSTANCE_URL: 'https://test.instructure.com',
  CANVAS_REDIRECT_URI: 'https://api.civica.app/v1/enrollment/oauth/canvas/exchange',
};

describe('GET /oauth/canvas/status', () => {
  it('returns connected: false when no connection row exists', async () => {
    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(makeQueryBuilder({
          data: null, error: { code: 'PGRST116' },
        })),
      }),
    } as never);

    const app = buildTestApp(oauthCanvasRouter, '/oauth/canvas', APPLICANT);
    const res = await app.request('/oauth/canvas/status', { method: 'GET' }, CANVAS_ENV);

    expect(res.status).toBe(200);
    const body = await res.json() as { connected: boolean };
    expect(body.connected).toBe(false);
  });

  it('returns connected: true when valid non-expired connection exists', async () => {
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    vi.mocked(makeAnonClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(makeQueryBuilder({
          data: { expires_at: expiresAt, revoked_at: null },
          error: null,
        })),
      }),
    } as never);

    const app = buildTestApp(oauthCanvasRouter, '/oauth/canvas', APPLICANT);
    const res = await app.request('/oauth/canvas/status', { method: 'GET' }, CANVAS_ENV);

    expect(res.status).toBe(200);
    const body = await res.json() as { connected: boolean };
    expect(body.connected).toBe(true);
  });
});

describe('DELETE /oauth/canvas', () => {
  it('revokes connection and returns connected: false', async () => {
    vi.mocked(makeServiceClient).mockReturnValue(
      makeDbClient({ data: null, error: null }),
    );

    const app = buildTestApp(oauthCanvasRouter, '/oauth/canvas', APPLICANT);
    const res = await app.request('/oauth/canvas', { method: 'DELETE' }, CANVAS_ENV);

    expect(res.status).toBe(200);
    const body = await res.json() as { connected: boolean };
    expect(body.connected).toBe(false);
  });
});

describe('GET /oauth/canvas/schedule', () => {
  it('returns 404 when Canvas is not connected', async () => {
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(makeQueryBuilder({
          data: null, error: { code: 'PGRST116' },
        })),
      }),
    } as never);

    const app = buildTestApp(oauthCanvasRouter, '/oauth/canvas', APPLICANT);
    const res = await app.request('/oauth/canvas/schedule', { method: 'GET' }, CANVAS_ENV);
    expect(res.status).toBe(404);
  });
});

describe('POST /oauth/canvas/exchange', () => {
  it('returns 503 when Canvas env vars are not set', async () => {
    const app = buildTestApp(oauthCanvasRouter, '/oauth/canvas', APPLICANT);
    const res = await app.request(
      '/oauth/canvas/exchange',
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: 'auth-code', packet_id: PACKET_ID }),
      },
      TEST_ENV,  // no CANVAS_CLIENT_ID
    );
    expect(res.status).toBe(503);
  });

  it('returns 400 on invalid body', async () => {
    const app = buildTestApp(oauthCanvasRouter, '/oauth/canvas', APPLICANT);
    const res = await app.request(
      '/oauth/canvas/exchange',
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: '' }),   // missing packet_id, empty code
      },
      CANVAS_ENV,
    );
    expect(res.status).toBe(400);
  });
});
