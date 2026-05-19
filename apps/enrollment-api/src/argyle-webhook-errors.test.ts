import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('./lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn().mockReturnValue({}),
}));

import argyleWebhookRouter from './routes/argyle-webhook.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env, Variables } from './types.js';
import type { Logger } from './lib/logger.js';

const TEST_ENV: Env = {
  SUPABASE_URL: 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key',
  SUPABASE_ANON_KEY: 'placeholder-anon-key',
  SNAP_FERNET_KEY: 'placeholder-fernet-key-32bytes!!',
  SENTRY_DSN: '',
  ARGYLE_WEBHOOK_SECRET: '', // signature verification skipped
};

afterEach(() => vi.resetAllMocks());

function buildApp(): { app: Hono<{ Bindings: Env; Variables: Variables }>; log: Logger } {
  const log: Logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  app.use('*', async (c, next) => {
    c.set('log', log);
    c.set('requestId', 'test-req');
    await next();
  });
  app.route('/webhooks/argyle', argyleWebhookRouter);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Internal server error' }, 500);
  });
  return { app, log };
}

describe('argyle-webhook error logging', () => {
  it('logs stage:"json" when body is not valid JSON', async () => {
    const { app, log } = buildApp();
    const res = await app.request(
      '/webhooks/argyle',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'this-is-not-json-{',
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
    expect(log.error).toHaveBeenCalledWith(
      'argyle webhook parse failed',
      expect.objectContaining({ stage: 'json' }),
    );
  });

  it('logs stage:"event" when event field is missing', async () => {
    const { app, log } = buildApp();
    const res = await app.request(
      '/webhooks/argyle',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foo: 'bar' }), // no `event` key
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
    expect(log.error).toHaveBeenCalledWith(
      'argyle webhook parse failed',
      expect.objectContaining({ stage: 'event' }),
    );
  });

  it('logs stage:"zod" when paycheck.added payload fails schema', async () => {
    const { app, log } = buildApp();
    const res = await app.request(
      '/webhooks/argyle',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Correct event type but data block is missing required fields → Zod fail
        body: JSON.stringify({ event: 'paycheck.added', data: {} }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
    expect(log.error).toHaveBeenCalledWith(
      'argyle webhook parse failed',
      expect.objectContaining({ stage: 'zod' }),
    );
  });
});
