import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../internal/engineClient.js');

import { buildApp } from '../app.js';
import { _resetSecretCache } from '../auth/verify.js';
import { getEngineClient } from '../internal/engineClient.js';

// ── Helpers ───────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-secret-that-is-at-least-32-bytes!!';

async function applicantToken(sub = 'applicant-sub-1'): Promise<string> {
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .setSubject(sub)
    .sign(new TextEncoder().encode(TEST_SECRET));
}

function makeAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function mockEngine(overrides: Partial<ReturnType<typeof defaultMockClient>> = {}) {
  const client = { ...defaultMockClient(), ...overrides };
  vi.mocked(getEngineClient).mockReturnValue(client as unknown as ReturnType<typeof getEngineClient>);
  return client;
}

function defaultMockClient() {
  return {
    get: vi.fn().mockResolvedValue({ ok: true, status: 200, data: { ok: true } }),
    post: vi.fn().mockResolvedValue({ ok: true, status: 200, data: { ok: true } }),
    patch: vi.fn().mockResolvedValue({ ok: true, status: 200, data: { ok: true } }),
    postMultipart: vi.fn().mockResolvedValue({ ok: true, status: 200, data: { ok: true } }),
    fetchRaw: vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="test.pdf"',
        },
      }),
    ),
    sign: vi.fn(),
  };
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_JWT_SECRET', TEST_SECRET);
  _resetSecretCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  _resetSecretCache();
});

// ── POST /me/sessions ─────────────────────────────────────────────────────

describe('POST /me/sessions', () => {
  it('proxies to /snap/sessions and returns 200', async () => {
    const client = mockEngine({
      post: vi.fn().mockResolvedValue({ ok: true, status: 200, data: { session_id: 'sess-abc' } }),
    });
    const token = await applicantToken();
    const res = await buildApp().request('/me/sessions', {
      method: 'POST',
      headers: { ...makeAuthHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'CA', language: 'en' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { session_id: string };
    expect(body.session_id).toBe('sess-abc');
    expect(client.post).toHaveBeenCalledWith('/snap/sessions', { state: 'CA', language: 'en' }, 'applicant-sub-1');
  });

  it('forwards 4xx from engine as-is', async () => {
    mockEngine({
      post: vi.fn().mockResolvedValue({ ok: false, status: 422, data: { detail: 'invalid_state' } }),
    });
    const token = await applicantToken();
    const res = await buildApp().request('/me/sessions', {
      method: 'POST',
      headers: { ...makeAuthHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'XX' }),
    });
    expect(res.status).toBe(422);
  });
});

// ── POST /me/sessions/recover ─────────────────────────────────────────────

describe('POST /me/sessions/recover', () => {
  it('proxies to /snap/sessions/recover', async () => {
    const client = mockEngine({
      post: vi.fn().mockResolvedValue({ ok: false, status: 501, data: { detail: 'not_implemented' } }),
    });
    const token = await applicantToken();
    const res = await buildApp().request('/me/sessions/recover', {
      method: 'POST',
      headers: { ...makeAuthHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'magic-link-token' }),
    });
    expect(res.status).toBe(501);
    expect(client.post).toHaveBeenCalledWith(
      '/snap/sessions/recover',
      { token: 'magic-link-token' },
      'applicant-sub-1',
    );
  });

  it('is not shadowed by the /:id route', async () => {
    // If routing were wrong, "recover" would be treated as a session ID
    const client = mockEngine();
    const token = await applicantToken();
    await buildApp().request('/me/sessions/recover', {
      method: 'POST',
      headers: { ...makeAuthHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'x' }),
    });
    expect(client.post).toHaveBeenCalledWith('/snap/sessions/recover', expect.anything(), expect.anything());
    expect(client.post).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/snap\/sessions\/recover\/turns/),
      expect.anything(),
      expect.anything(),
    );
  });
});

// ── POST /me/sessions/:id/turns ───────────────────────────────────────────

describe('POST /me/sessions/:id/turns', () => {
  it('proxies to /snap/sessions/:id/turns', async () => {
    const client = mockEngine({
      post: vi.fn().mockResolvedValue({
        ok: true, status: 200,
        data: { turn_id: 't-1', role: 'assistant', content: 'Hello' },
      }),
    });
    const token = await applicantToken();
    const res = await buildApp().request('/me/sessions/sess-xyz/turns', {
      method: 'POST',
      headers: { ...makeAuthHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_text: 'Hello' }),
    });
    expect(res.status).toBe(200);
    expect(client.post).toHaveBeenCalledWith(
      '/snap/sessions/sess-xyz/turns',
      { user_text: 'Hello' },
      'applicant-sub-1',
    );
  });
});

// ── GET /me/sessions/:id/transcript ──────────────────────────────────────

describe('GET /me/sessions/:id/transcript', () => {
  it('proxies to /snap/sessions/:id/transcript', async () => {
    const client = mockEngine({
      get: vi.fn().mockResolvedValue({
        ok: true, status: 200,
        data: { session_id: 'sess-xyz', turns: [] },
      }),
    });
    const token = await applicantToken();
    const res = await buildApp().request('/me/sessions/sess-xyz/transcript', {
      headers: makeAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    expect(client.get).toHaveBeenCalledWith('/snap/sessions/sess-xyz/transcript', 'applicant-sub-1');
  });

  it('forwards 404 from engine', async () => {
    mockEngine({
      get: vi.fn().mockResolvedValue({ ok: false, status: 404, data: { detail: 'snap_session_not_found' } }),
    });
    const token = await applicantToken();
    const res = await buildApp().request('/me/sessions/missing/transcript', {
      headers: makeAuthHeaders(token),
    });
    expect(res.status).toBe(404);
  });
});

// ── POST /me/sessions/:id/documents ──────────────────────────────────────

describe('POST /me/sessions/:id/documents', () => {
  it('proxies multipart to /snap/sessions/:id/documents', async () => {
    const client = mockEngine({
      postMultipart: vi.fn().mockResolvedValue({
        ok: true, status: 200,
        data: { document_id: 'doc-1', processing_status: 'processing' },
      }),
    });
    const token = await applicantToken();
    const formData = new FormData();
    formData.append('file', new Blob(['img'], { type: 'image/jpeg' }), 'test.jpg');
    const res = await buildApp().request('/me/sessions/sess-xyz/documents', {
      method: 'POST',
      headers: makeAuthHeaders(token),
      body: formData,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { document_id: string };
    expect(body.document_id).toBe('doc-1');
    expect(client.postMultipart).toHaveBeenCalledWith(
      '/snap/sessions/sess-xyz/documents',
      expect.any(FormData),
      'applicant-sub-1',
    );
  });
});

// ── GET /me/documents/:docId ──────────────────────────────────────────────

describe('GET /me/documents/:docId', () => {
  it('proxies to /snap/documents/:docId', async () => {
    const client = mockEngine({
      get: vi.fn().mockResolvedValue({
        ok: true, status: 200,
        data: { document_id: 'doc-1', processing_status: 'awaiting_confirmation' },
      }),
    });
    const token = await applicantToken();
    const res = await buildApp().request('/me/documents/doc-1', {
      headers: makeAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    expect(client.get).toHaveBeenCalledWith('/snap/documents/doc-1', 'applicant-sub-1');
  });
});

// ── POST /me/documents/:docId/confirm ────────────────────────────────────

describe('POST /me/documents/:docId/confirm', () => {
  it('proxies to /snap/documents/:docId/confirm', async () => {
    const client = mockEngine({
      post: vi.fn().mockResolvedValue({ ok: true, status: 200, data: { user_confirmed: true } }),
    });
    const token = await applicantToken();
    const res = await buildApp().request('/me/documents/doc-1/confirm', {
      method: 'POST',
      headers: { ...makeAuthHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ corrections: null }),
    });
    expect(res.status).toBe(200);
    expect(client.post).toHaveBeenCalledWith(
      '/snap/documents/doc-1/confirm',
      { corrections: null },
      'applicant-sub-1',
    );
  });
});

// ── POST /me/sessions/:id/application/pdf ────────────────────────────────

describe('POST /me/sessions/:id/application/pdf', () => {
  it('returns a PDF with correct headers on success', async () => {
    mockEngine({
      fetchRaw: vi.fn().mockResolvedValue(
        new Response(new Uint8Array([37, 80, 68, 70]), { // %PDF bytes
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="civica-snap-summary-abcdefgh.pdf"',
            'X-SNAP-Rendering-Path': 'html_weasyprint',
          },
        }),
      ),
    });
    const token = await applicantToken();
    const res = await buildApp().request('/me/sessions/abcdefgh-1234/application/pdf', {
      method: 'POST',
      headers: makeAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('X-SNAP-Rendering-Path')).toBe('html_weasyprint');
  });

  it('returns JSON error body when engine returns 4xx', async () => {
    mockEngine({
      fetchRaw: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'snap_session_not_found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    });
    const token = await applicantToken();
    const res = await buildApp().request('/me/sessions/missing/application/pdf', {
      method: 'POST',
      headers: makeAuthHeaders(token),
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { detail: string };
    expect(body.detail).toBe('snap_session_not_found');
  });

  it('calls fetchRaw with actor sub', async () => {
    const client = mockEngine();
    const token = await applicantToken('user-abc');
    await buildApp().request('/me/sessions/sess-1/application/pdf', {
      method: 'POST',
      headers: makeAuthHeaders(token),
    });
    expect(client.fetchRaw).toHaveBeenCalledWith('POST', '/snap/sessions/sess-1/application/pdf', null, 'user-abc');
  });
});
