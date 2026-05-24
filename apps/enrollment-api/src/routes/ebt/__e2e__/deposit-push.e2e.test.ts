/**
 * E2E #2 — deposit-landed push (T4 of /plan-eng-review).
 *
 * Exercises the webhooks → APNs path end-to-end in-memory:
 *
 *   1. Seed: a card (owner = USER_ID), a device token, a prefs row with
 *      deposit_on=true
 *   2. Stub the apns-send fetch dep (we don't want to hit api.push.apple.com)
 *   3. POST /webhooks/ebt-scraper with a `deposit_posted` event, HMAC-signed
 *      with the shared secret
 *   4. Assert: 200 response, ebt_deposits row was upserted, the apns-send
 *      fetch was called exactly once with the right apns-topic, and the
 *      push body included the dollars amount (formatted from cents).
 *
 * Why we stub apns-send's `fetch` and not the whole apns-send module: this
 * way the JWT builder, quiet-hours check, prefs lookup, and the
 * `cents -> "$X.YZ"` formatter all run for real — same code path that ships
 * to prod. Only the final `POST api.push.apple.com` HTTP is shimmed.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../../../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from '../../../lib/supabase.js';
import webhooksRouter from '../webhooks.js';
import { TEST_ENV } from '../../../test/helpers.js';
import type { Env } from '../../../types.js';

const CARD_ID = 'c0000000-0000-0000-0000-000000000def';
const USER_ID = 'user-deposit-001';
const DEVICE_TOKEN = 'deadbeefcafef00d0011223344556677';
const SECRET = 'e2e-deposit-secret';
const AMOUNT_CENTS = 23200;
const SCHEDULED = '2026-06-01';
const POSTED_AT = '2026-06-01T06:30:00Z';

// Test ES256 key (PEM) — same one apns-send.test.ts uses. NOT a real Apple key.
const TEST_P8 = [
  '-----BEGIN PRIVATE KEY-----',
  'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgevZzL1gdAFr88hb2',
  'OF/2NxApJCzGCEDdfSp6VQO30hyhRANCAAQRWz+jn65BtOMvdyHKcvjBeBSDZH2r',
  '1RTwjmYSi9R/zpBnuQ4EiMnCqfMPWiZqB4QdbAd0E7oH50VpuZ1P087G',
  '-----END PRIVATE KEY-----',
].join('\n');

const ENV: Env = {
  ...TEST_ENV,
  EBT_SCRAPER_WEBHOOK_SECRET: SECRET,
  APNS_KEY_P8: TEST_P8,
  APNS_KEY_ID: 'TESTKEYID12',
  APNS_TEAM_ID: 'TESTTEAMID1',
  APNS_TOPIC: 'com.civica.test',
  APNS_ENV: 'development',
};

/**
 * In-memory supabase fake for the deposit-push flow. Backs:
 *   - ebt_deposits (select existing | insert | update)
 *   - ebt_cards (select user_id)
 *   - ebt_notification_prefs (select)
 *   - ebt_device_tokens (select rows)
 */
function makeDepositSupabase(seed: {
  card: { id: string; user_id: string };
  prefs: {
    deposit_on: boolean; low_balance_on: boolean;
    perks_on: boolean; recert_on: boolean;
    quiet_start_minutes: number; quiet_end_minutes: number;
  };
  deviceTokens: string[];
}) {
  const deposits = new Map<string, { id: string; card_id: string; scheduled_for: string; posted_at: string | null; amount_cents: number }>();
  let depositIdCounter = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function fromTable(table: string): any {
    const filters: Array<[string, unknown]> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pendingInsert: Record<string, any> | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pendingUpdate: Record<string, any> | null = null;

    const qb = {
      select(_proj?: string) { return qb; },
      eq(col: string, val: unknown) { filters.push([col, val]); return qb; },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insert(row: Record<string, any> | Record<string, any>[]) {
        pendingInsert = Array.isArray(row) ? row[0]! : row;
        return qb;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update(row: Record<string, any>) { pendingUpdate = row; return qb; },
      maybeSingle() { return qb; },
      single() { return qb; },
      order(_col: string, _opts?: unknown) { return qb; },
      limit(_n: number) { return qb; },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
        return Promise.resolve(qb._resolve()).then(res, rej);
      },
      _resolve(): { data: unknown; error: unknown } {
        // ── INSERT ─────────────────────────────────────────────────────
        if (pendingInsert) {
          if (table === 'ebt_deposits') {
            const id = `dep-${++depositIdCounter}`;
            deposits.set(id, {
              id,
              card_id: pendingInsert.card_id,
              scheduled_for: pendingInsert.scheduled_for,
              posted_at: pendingInsert.posted_at ?? null,
              amount_cents: pendingInsert.amount_cents,
            });
            return { data: null, error: null };
          }
          return { data: null, error: null };
        }
        // ── UPDATE ─────────────────────────────────────────────────────
        if (pendingUpdate) {
          if (table === 'ebt_deposits') {
            const idFilter = filters.find(([c]) => c === 'id');
            const id = idFilter?.[1] as string | undefined;
            if (id && deposits.has(id)) {
              const cur = deposits.get(id)!;
              deposits.set(id, { ...cur, ...pendingUpdate });
            }
            return { data: null, error: null };
          }
          return { data: null, error: null };
        }
        // ── SELECT ─────────────────────────────────────────────────────
        if (table === 'ebt_deposits') {
          const cardId = filters.find(([c]) => c === 'card_id')?.[1];
          const sched  = filters.find(([c]) => c === 'scheduled_for')?.[1];
          const match = [...deposits.values()].find(
            (d) => d.card_id === cardId && d.scheduled_for === sched,
          );
          return { data: match ?? null, error: null };
        }
        if (table === 'ebt_cards') {
          const idFilter = filters.find(([c]) => c === 'id')?.[1];
          if (idFilter === seed.card.id) {
            return { data: { user_id: seed.card.user_id }, error: null };
          }
          return { data: null, error: null };
        }
        if (table === 'ebt_notification_prefs') {
          const uid = filters.find(([c]) => c === 'user_id')?.[1];
          if (uid === seed.card.user_id) {
            return { data: seed.prefs, error: null };
          }
          return { data: null, error: null };
        }
        if (table === 'ebt_device_tokens') {
          const uid = filters.find(([c]) => c === 'user_id')?.[1];
          if (uid === seed.card.user_id) {
            return { data: seed.deviceTokens.map((t) => ({ apns_token: t })), error: null };
          }
          return { data: [], error: null };
        }
        return { data: null, error: null };
      },
    };
    return qb;
  }

  return {
    deposits,
    client: {
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((tbl: string) => fromTable(tbl)),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

async function signHmac(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildWebhookApp(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  // Inject the minimal Variables (log) the webhook reads. Logger is optional
  // (the code uses c.get('log')?.info(...)), so we can leave it undefined.
  app.route('/', webhooksRouter);
  return app;
}

let originalFetch: typeof globalThis.fetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.resetAllMocks();
});

describe('E2E — deposit-landed push', () => {
  it('persists deposit, calls APNs with $-formatted body, returns 200', async () => {
    const fake = makeDepositSupabase({
      card: { id: CARD_ID, user_id: USER_ID },
      prefs: {
        deposit_on: true, low_balance_on: true, perks_on: true, recert_on: true,
        // Quiet hours 21:00→08:00 — pin "now" via Date to a daytime UTC slot.
        quiet_start_minutes: 21 * 60, quiet_end_minutes: 8 * 60,
      },
      deviceTokens: [DEVICE_TOKEN],
    });
    vi.mocked(makeServiceClient).mockReturnValue(fake.client);

    // Pin time to 10:30 UTC so we're outside the default quiet window.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T10:30:00Z'));

    // Stub the outbound APNs fetch.
    const apnsFetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    globalThis.fetch = apnsFetch as unknown as typeof fetch;

    const body = JSON.stringify({
      type: 'deposit_posted',
      card_id: CARD_ID,
      scheduled_for: SCHEDULED,
      amount_cents: AMOUNT_CENTS,
      posted_at: POSTED_AT,
    });
    const sig = await signHmac(SECRET, body);

    const app = buildWebhookApp();
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'X-Civica-Signature': `sha256=${sig}` },
      body,
    }, ENV);

    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; action: string };
    expect(json.action).toBe('deposit_posted');

    // ── Side-effect: deposit row was inserted ──────────────────────────
    expect(fake.deposits.size).toBe(1);
    const deposit = [...fake.deposits.values()][0]!;
    expect(deposit.card_id).toBe(CARD_ID);
    expect(deposit.amount_cents).toBe(AMOUNT_CENTS);
    expect(deposit.posted_at).toBe(POSTED_AT);

    // ── Side-effect: APNs fetch invoked exactly once ───────────────────
    expect(apnsFetch).toHaveBeenCalledTimes(1);
    const [url, init] = apnsFetch.mock.calls[0]!;
    expect(String(url)).toContain(`/3/device/${DEVICE_TOKEN}`);
    // apns-topic header MUST match the configured bundle id.
    const headers = init.headers as Record<string, string>;
    expect(headers['apns-topic']).toBe('com.civica.test');
    // Body should include dollars-formatted amount ($232.00 from 23200 cents).
    const sentPayload = JSON.parse(init.body as string);
    expect(sentPayload.aps.alert.body).toContain('$232.00');
    expect(sentPayload.aps.alert.body).not.toContain('23200');
    expect(sentPayload.category).toBe('deposit_landed');

    vi.useRealTimers();
  });

  it('returns 401 when HMAC signature does not match', async () => {
    const fake = makeDepositSupabase({
      card: { id: CARD_ID, user_id: USER_ID },
      prefs: { deposit_on: true, low_balance_on: true, perks_on: true,
               recert_on: true, quiet_start_minutes: 21 * 60, quiet_end_minutes: 8 * 60 },
      deviceTokens: [DEVICE_TOKEN],
    });
    vi.mocked(makeServiceClient).mockReturnValue(fake.client);

    const body = JSON.stringify({
      type: 'deposit_posted',
      card_id: CARD_ID,
      scheduled_for: SCHEDULED,
      amount_cents: AMOUNT_CENTS,
      posted_at: POSTED_AT,
    });
    const wrongSig = await signHmac('not-the-secret', body);

    const app = buildWebhookApp();
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'X-Civica-Signature': `sha256=${wrongSig}` },
      body,
    }, ENV);

    expect(res.status).toBe(401);
    expect(fake.deposits.size).toBe(0);
  });
});
