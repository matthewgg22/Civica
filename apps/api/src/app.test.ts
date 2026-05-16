import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('app skeleton', () => {
  it('GET /healthz returns ok payload', async () => {
    const app = buildApp();
    const res = await app.request('/healthz');

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string; timestamp: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('@civica/api');
    expect(typeof body.timestamp).toBe('string');
  });

  it('GET /openapi.json returns a valid OpenAPI 3.1.0 document', async () => {
    const app = buildApp();
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { openapi: string; info: { title: string }; paths: Record<string, unknown> };
    expect(body.openapi).toBe('3.1.0');
    expect(body.info.title).toBe('Civica SNAP API');
    expect(Object.keys(body.paths).length).toBeGreaterThanOrEqual(18);
  });

  it('GET /docs returns HTML with Scalar loader', async () => {
    const app = buildApp();
    const res = await app.request('/docs');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain('api-reference');
    expect(html).toContain('/openapi.json');
  });

  it('public routes return non-500 responses without a token', async () => {
    const app = buildApp();
    // /healthz is public — should be 200
    expect((await app.request('/healthz')).status).toBe(200);
    // /webhooks has no auth yet — unknown subpath returns 404
    expect((await app.request('/webhooks/unknown')).status).toBe(404);
    // /me and /navigator require auth — 401 without a token, never 500
    expect((await app.request('/me/unknown')).status).toBe(401);
    expect((await app.request('/navigator/unknown')).status).toBe(401);
  });
});
