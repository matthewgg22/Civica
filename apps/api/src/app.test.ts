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

  it('mounts route groups (unknown subpaths return 404, not 500)', async () => {
    const app = buildApp();
    for (const path of ['/me/unknown', '/navigator/unknown', '/webhooks/unknown']) {
      const res = await app.request(path);
      expect(res.status).toBe(404);
    }
  });
});
