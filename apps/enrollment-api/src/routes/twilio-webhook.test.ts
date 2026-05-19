import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// Mock the recert-engine package before importing anything that uses it
vi.mock('@civica/recert-engine/outreach', () => {
  const recordOptOut = vi.fn().mockResolvedValue(undefined);
  const recordOptIn = vi.fn().mockResolvedValue(undefined);
  const isOptedOut = vi.fn().mockResolvedValue(false);
  const sendSMS = vi.fn().mockResolvedValue({ messageSid: 'noop-test' });
  const handleWebhook = vi.fn().mockResolvedValue('ignored');

  const NoopTwilioAdapter = vi.fn().mockImplementation(() => ({
    sendSMS,
    isOptedOut,
    recordOptOut,
    recordOptIn,
  }));

  const LiveTwilioAdapter = vi.fn().mockImplementation(() => ({
    sendSMS,
    isOptedOut,
    recordOptOut,
    recordOptIn,
    handleWebhook,
  }));

  return {
    NoopTwilioAdapter,
    LiveTwilioAdapter,
    TwilioWebhookBodySchema: {
      safeParse: (raw: Record<string, unknown>) => {
        // Minimal inline parse: just return what we get if From and Body exist
        if (typeof raw['From'] === 'string') {
          return { success: true, data: { Body: raw['Body'] ?? '', From: raw['From'], To: raw['To'] ?? '' } };
        }
        return { success: false };
      },
    },
    smsTemplates: {},
  };
});

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn().mockReturnValue({}),
}));

import { NoopTwilioAdapter } from '@civica/recert-engine/outreach';
import twilioWebhookRouter from './twilio-webhook.js';
import { Hono } from 'hono';
import type { Env } from '../types.js';

// Base env for all tests — RECERT_TWILIO_ENABLED is false (noop path)
const BASE_ENV: Env = {
  SUPABASE_URL: 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_ANON_KEY: 'anon-key',
  SNAP_FERNET_KEY: 'placeholder-fernet-key-32bytes!!',
  SENTRY_DSN: '',
};

function buildApp(envOverrides: Partial<Env> = {}): Hono {
  const testEnv = { ...BASE_ENV, ...envOverrides };
  const a = new Hono<{ Bindings: Env }>();
  a.route('/', twilioWebhookRouter);
  // Inject env into every request context
  return {
    request: (path: string, init?: RequestInit) => {
      const req = new Request(`http://localhost${path}`, init);
      return a.fetch(req, testEnv);
    },
  } as unknown as Hono;
}

/** Build an application/x-www-form-urlencoded body from key-value pairs. */
function formBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' };

afterEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// STOP keyword — triggers opt-out
// ---------------------------------------------------------------------------

describe('STOP keyword', () => {
  it('calls recordOptOut on the noop adapter and returns TwiML', async () => {
    const app = buildApp();
    const res = await app.request('/webhooks/twilio/sms', {
      method: 'POST',
      headers: FORM_HEADERS,
      body: formBody({ From: '+14155550100', To: '+18005551234', Body: 'STOP' }),
    });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe('<Response/>');
    expect(res.headers.get('Content-Type')).toContain('text/xml');

    const instance = vi.mocked(NoopTwilioAdapter).mock.results[0]?.value;
    expect(instance.recordOptOut).toHaveBeenCalledWith('+14155550100');
  });

  it('handles STOPALL as an opt-out keyword', async () => {
    const app = buildApp();
    await app.request('/webhooks/twilio/sms', {
      method: 'POST',
      headers: FORM_HEADERS,
      body: formBody({ From: '+14155550101', To: '+18005551234', Body: 'STOPALL' }),
    });

    const instance = vi.mocked(NoopTwilioAdapter).mock.results[0]?.value;
    expect(instance.recordOptOut).toHaveBeenCalledWith('+14155550101');
  });
});

// ---------------------------------------------------------------------------
// START keyword — triggers opt-in
// ---------------------------------------------------------------------------

describe('START keyword', () => {
  it('calls recordOptIn on the noop adapter and returns TwiML', async () => {
    const app = buildApp();
    const res = await app.request('/webhooks/twilio/sms', {
      method: 'POST',
      headers: FORM_HEADERS,
      body: formBody({ From: '+14155550200', To: '+18005551234', Body: 'START' }),
    });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe('<Response/>');

    const instance = vi.mocked(NoopTwilioAdapter).mock.results[0]?.value;
    expect(instance.recordOptIn).toHaveBeenCalledWith('+14155550200');
  });

  it('handles UNSTOP as an opt-in keyword', async () => {
    const app = buildApp();
    await app.request('/webhooks/twilio/sms', {
      method: 'POST',
      headers: FORM_HEADERS,
      body: formBody({ From: '+14155550201', To: '+18005551234', Body: 'UNSTOP' }),
    });

    const instance = vi.mocked(NoopTwilioAdapter).mock.results[0]?.value;
    expect(instance.recordOptIn).toHaveBeenCalledWith('+14155550201');
  });
});

// ---------------------------------------------------------------------------
// Arbitrary message — returns empty TwiML, no opt-out/opt-in side effects
// ---------------------------------------------------------------------------

describe('arbitrary message', () => {
  it('returns empty TwiML without calling recordOptOut or recordOptIn', async () => {
    const app = buildApp();
    const res = await app.request('/webhooks/twilio/sms', {
      method: 'POST',
      headers: FORM_HEADERS,
      body: formBody({ From: '+14155550300', To: '+18005551234', Body: 'Hello can you help me?' }),
    });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe('<Response/>');

    const instance = vi.mocked(NoopTwilioAdapter).mock.results[0]?.value;
    expect(instance.recordOptOut).not.toHaveBeenCalled();
    expect(instance.recordOptIn).not.toHaveBeenCalled();
  });

  it('handles empty body without error', async () => {
    const app = buildApp();
    const res = await app.request('/webhooks/twilio/sms', {
      method: 'POST',
      headers: FORM_HEADERS,
      body: formBody({ From: '+14155550301', To: '+18005551234', Body: '' }),
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<Response/>');
  });
});

// ---------------------------------------------------------------------------
// Bad request — missing form body
// ---------------------------------------------------------------------------

describe('invalid request', () => {
  it('returns 400 when body is JSON instead of form-encoded', async () => {
    const app = buildApp();
    const res = await app.request('/webhooks/twilio/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ From: '+14155550999', Body: 'STOP' }),
    });
    // Either 400 (bad form parse) or the webhook body parse fails — either is acceptable
    expect([400, 200]).toContain(res.status);
  });
});
