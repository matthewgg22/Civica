import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from '../lib/supabase.js';
import argyleWebhookRouter from './argyle-webhook.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { TEST_ENV, makeDbClient, makeQueryBuilder, JSON_HEADERS } from '../test/helpers.js';
import type { Env } from '../types.js';

afterEach(() => vi.resetAllMocks());

const ARGYLE_USER_ID = 'argyle-user-abc123';
const APPLICANT_ID = 'a0000000-0000-0000-0000-000000000001';
const PACKET_ID = 'b0000000-0000-0000-0000-000000000001';

const PAYCHECK_BODY = {
  event: 'paycheck.added',
  data: {
    user: ARGYLE_USER_ID,
    paycheck: {
      id: 'paycheck-001',
      employer: 'Campus Dining',
      gross_pay_amount: 61200,  // $612.00 in cents
      currency: 'USD',
      pay_date: '2026-05-15',
    },
  },
};

function buildWebhookApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route('/webhooks/argyle', argyleWebhookRouter);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}

describe('POST /webhooks/argyle', () => {
  it('returns 200 and records paycheck on happy path (no cliff)', async () => {
    const fromMock = vi.fn()
      .mockReturnValueOnce(makeQueryBuilder({   // argyle_connections lookup
        data: { applicant_id: APPLICANT_ID, packet_id: PACKET_ID },
        error: null,
      }))
      .mockReturnValueOnce(makeQueryBuilder({   // snap_packets lookup
        data: { org_id: 'org-001', state_code: 'CA', current_benefit_usd: 292 },
        error: null,
      }))
      .mockReturnValueOnce(makeQueryBuilder({   // marketplace_paychecks insert
        data: { marketplace_paycheck_id: 'mp-001' },
        error: null,
      }));

    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({ from: fromMock }),
    } as never);

    const app = buildWebhookApp();
    const res = await app.request(
      '/webhooks/argyle',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(PAYCHECK_BODY) },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('paycheck_recorded');
    expect(body.marketplace_paycheck_id).toBe('mp-001');
  });

  it('returns 200 with cliff_event_queued when projected benefit reaches 0', async () => {
    const fromMock = vi.fn()
      .mockReturnValueOnce(makeQueryBuilder({
        data: { applicant_id: APPLICANT_ID, packet_id: PACKET_ID },
        error: null,
      }))
      .mockReturnValueOnce(makeQueryBuilder({
        // current_benefit_usd is low enough that a $3200/mo job hits cliff
        data: { org_id: 'org-001', state_code: 'CA', current_benefit_usd: 100 },
        error: null,
      }))
      .mockReturnValueOnce(makeQueryBuilder({   // marketplace_paychecks insert
        data: { marketplace_paycheck_id: 'mp-002' },
        error: null,
      }))
      .mockReturnValueOnce(makeQueryBuilder({   // navigator_outreach_queue insert
        data: { outreach_task_id: 'task-001' },
        error: null,
      }));

    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({ from: fromMock }),
    } as never);

    // Override gross_pay_amount to force cliff: $320000 cents = $3200/mo
    const cliffBody = {
      ...PAYCHECK_BODY,
      data: { ...PAYCHECK_BODY.data, paycheck: { ...PAYCHECK_BODY.data.paycheck, gross_pay_amount: 320000 } },
    };

    const app = buildWebhookApp();
    const res = await app.request(
      '/webhooks/argyle',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(cliffBody) },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('cliff_event_queued');
    expect(body.projected_benefit_usd).toBe(0);
  });

  it('ignores non-paycheck.added events', async () => {
    const app = buildWebhookApp();
    const res = await app.request(
      '/webhooks/argyle',
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ event: 'account.connected', data: { user: ARGYLE_USER_ID } }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('ignored');
    expect(body.event).toBe('account.connected');
  });

  it('ignores paycheck from unknown Argyle user', async () => {
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(makeQueryBuilder({
          data: null,
          error: { code: 'PGRST116' },
        })),
      }),
    } as never);

    const app = buildWebhookApp();
    const res = await app.request(
      '/webhooks/argyle',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(PAYCHECK_BODY) },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('ignored');
    expect(body.reason).toBe('no_connection');
  });

  it('returns 400 on malformed payload', async () => {
    const app = buildWebhookApp();
    const res = await app.request(
      '/webhooks/argyle',
      { method: 'POST', headers: JSON_HEADERS, body: 'not-json' },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });
});
