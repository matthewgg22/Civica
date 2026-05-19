import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@civica/recert-engine/outreach', () => {
  const recordOptOut = vi.fn().mockResolvedValue(undefined);
  const recordOptIn = vi.fn().mockResolvedValue(undefined);
  const NoopTwilioAdapter = vi.fn().mockImplementation(() => ({
    recordOptOut,
    recordOptIn,
  }));
  const LiveTwilioAdapter = vi.fn();
  return {
    NoopTwilioAdapter,
    LiveTwilioAdapter,
    TwilioWebhookBodySchema: {
      safeParse: (raw: Record<string, unknown>) =>
        typeof raw['From'] === 'string'
          ? { success: true, data: { Body: raw['Body'] ?? '', From: raw['From'], To: raw['To'] ?? '' } }
          : { success: false },
    },
    smsTemplates: {},
  };
});

vi.mock('./lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn().mockReturnValue({}),
}));

import twilioWebhookRouter from './routes/twilio-webhook.js';
import { Hono } from 'hono';
import type { Env, Variables } from './types.js';
import type { Logger } from './lib/logger.js';

const TEST_ENV: Env = {
  SUPABASE_URL: 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key',
  SUPABASE_ANON_KEY: 'placeholder-anon-key',
  SNAP_FERNET_KEY: 'placeholder-fernet-key-32bytes!!',
  SENTRY_DSN: '',
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
  app.route('/', twilioWebhookRouter);
  return { app, log };
}

describe('twilio-webhook error logging', () => {
  it('logs stage:"formData" when body is not parseable as form data', async () => {
    const { app, log } = buildApp();
    // Send Content-Type: application/json with a JSON body — formData()
    // throws on this combo (no boundary, wrong content type).
    const res = await app.request(
      '/webhooks/twilio/sms',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Body: 'STOP', From: '+15551234567' }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
    expect(log.error).toHaveBeenCalledWith(
      'twilio webhook parse failed',
      expect.objectContaining({ stage: 'formData' }),
    );
  });
});
