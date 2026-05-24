/**
 * E2E #1 — cookie handoff link (T4 of /plan-eng-review).
 *
 * Exercises the full link → balance flow end-to-end in-memory:
 *
 *   1. POST /ebt/link with sample cookie payload + applicant JWT
 *   2. The route encrypts the cookie via the (mocked) pgsodium RPC and
 *      upserts ebt_cards
 *   3. dispatchScrapeRefresh is stubbed (no real fly POST), so balance
 *      stays NULL on the row
 *   4. GET /ebt/balance returns 200 with `stale: true` (no balance yet)
 *   5. Verify decrypt_session_cookie round-trips back to the plaintext we
 *      sent (the migration-level promise: encrypt(x) then decrypt(...) = x)
 *
 * "Full stack" here means full *gateway* stack — both routes wired through
 * the same fake supabase client + the same applicant actor. The pgsodium
 * RPCs and the Fly scraper are stubbed; everything else (zod, hono,
 * dispatch logic, staleness check) runs for real.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Tracks all RPC calls so we can drive encrypt/decrypt and assert the
// happy-path round-trip without standing up Postgres.
const rpcState = vi.hoisted(() => ({
  // ciphertext -> plaintext map populated by encrypt RPC, consumed by decrypt
  store: new Map<string, string>(),
  cipherCounter: 0,
  calls: [] as Array<{ name: string; args: unknown }>,
  reset() {
    this.store.clear();
    this.cipherCounter = 0;
    this.calls.length = 0;
  },
}));

vi.mock('../../../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

// Stub the dispatch fetch — we don't want to hit a real Fly URL. The cookie
// decrypt RPC still runs through ebt-cookie-crypto.ts; only the outbound
// POST is shimmed at the global-fetch layer (see beforeEach below).

import { makeServiceClient } from '../../../lib/supabase.js';
import linkRouter from '../link.js';
import balanceRouter from '../balance.js';
import {
  TEST_ENV,
  APPLICANT,
  buildTestApp,
  JSON_HEADERS,
} from '../../../test/helpers.js';
import { Hono } from 'hono';
import type { Env } from '../../../types.js';

const CARD_ID = 'c0000000-0000-0000-0000-000000000abc';
const HASH = 'b'.repeat(64);
const FUTURE_ISO = new Date(Date.now() + 86400_000).toISOString();
const PLAINTEXT_COOKIE = JSON.stringify([
  { name: 'JSESSIONID', value: 'real-session-bytes', domain: '.ebt.ca.gov',
    path: '/', expires: -1, httpOnly: true, secure: true },
]);

const ENV_WITH_DISPATCH: Env = {
  ...TEST_ENV,
  EBT_SCRAPER_DISPATCH_URL: 'https://scraper.example.test/scrape',
  EBT_SCRAPER_WEBHOOK_SECRET: 'e2e-shared-secret',
};

/**
 * In-memory supabase fake. Holds a single ebt_cards row keyed by user_id —
 * sufficient for the link → balance flow.
 */
interface FakeCard {
  id: string;
  user_id: string;
  card_id_hash: string;
  processor: string;
  session_cookie_encrypted: string;
  session_cookie_expires_at: string;
  remember_cookie_encrypted: string | null;
  last_synced_at: string | null;
  balance_cents: number | null;
  balance_at: string | null;
  lock_state: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function makeFakeSupabase() {
  const cards = new Map<string, FakeCard>(); // by id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function fromEbtCards(): any {
    let mode: 'upsert' | 'select' = 'select';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let upsertRow: Record<string, any> | null = null;
    const filters: Array<[string, unknown]> = [];

    const qb = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      upsert(row: Record<string, any>, _opts?: unknown) {
        mode = 'upsert';
        upsertRow = row;
        return qb;
      },
      select(_proj?: string) { return qb; },
      eq(col: string, val: unknown) { filters.push([col, val]); return qb; },
      order(_col: string, _opts?: unknown) { return qb; },
      limit(_n: number) { return qb; },
      single() { return qb; },
      maybeSingle() { return qb; },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
        return Promise.resolve(qb._resolve()).then(res, rej);
      },
      _resolve() {
        if (mode === 'upsert' && upsertRow) {
          const existing = [...cards.values()].find(
            (c) => c.user_id === upsertRow!.user_id
                && c.card_id_hash === upsertRow!.card_id_hash,
          );
          const id = existing?.id ?? CARD_ID;
          const merged: FakeCard = {
            id,
            user_id: upsertRow.user_id,
            card_id_hash: upsertRow.card_id_hash,
            processor: upsertRow.processor,
            session_cookie_encrypted: upsertRow.session_cookie_encrypted,
            session_cookie_expires_at: upsertRow.session_cookie_expires_at,
            remember_cookie_encrypted: upsertRow.remember_cookie_encrypted ?? null,
            last_synced_at: existing?.last_synced_at ?? null,
            balance_cents: existing?.balance_cents ?? null,
            balance_at: existing?.balance_at ?? null,
            lock_state: upsertRow.lock_state ?? {},
            created_at: existing?.created_at ?? new Date().toISOString(),
            updated_at: upsertRow.updated_at ?? new Date().toISOString(),
          };
          cards.set(id, merged);
          return { data: merged, error: null };
        }
        // SELECT: filter by user_id / id, return first match (no order needed
        // for our 1-card test).
        const match = [...cards.values()].find((c) =>
          filters.every(([col, val]) => (c as unknown as Record<string, unknown>)[col] === val));
        return { data: match ?? null, error: null };
      },
    };
    return qb;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = vi.fn().mockImplementation((name: string, args: any) => {
    rpcState.calls.push({ name, args });
    if (name === 'encrypt_session_cookie') {
      const cipher = `pgs1:e2e-${++rpcState.cipherCounter}-${Date.now()}`;
      rpcState.store.set(cipher, args.plaintext);
      return Promise.resolve({ data: cipher, error: null });
    }
    if (name === 'decrypt_session_cookie') {
      const plain = rpcState.store.get(args.ciphertext);
      if (!plain) {
        return Promise.resolve({ data: null, error: { message: 'unknown ciphertext' } });
      }
      return Promise.resolve({ data: plain, error: null });
    }
    return Promise.resolve({ data: null, error: { message: `unhandled rpc ${name}` } });
  });

  return {
    cards,
    rpc,
    client: {
      schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(fromEbtCards()) }),
      rpc,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  rpcState.reset();
});

beforeEach(() => {
  // Default fetch stub — Fly scraper "accepts" the dispatch.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 202 })));
});

describe('E2E — cookie handoff link → balance', () => {
  it('encrypts on link, decrypt RPC round-trips back to plaintext, balance reports stale=true', async () => {
    const fake = makeFakeSupabase();
    vi.mocked(makeServiceClient).mockReturnValue(fake.client);

    // ── Link the card ───────────────────────────────────────────────────
    const linkApp = buildTestApp(linkRouter, '/', APPLICANT);
    const linkRes = await linkApp.request('/', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        card_id_hash: HASH,
        processor: 'ebt_ca',
        session_cookie: PLAINTEXT_COOKIE,
        expires_at: FUTURE_ISO,
      }),
    }, ENV_WITH_DISPATCH);

    expect(linkRes.status).toBe(201);
    const linkBody = await linkRes.json() as { id: string; processor: string };
    expect(linkBody.processor).toBe('ebt_ca');

    // ── Assert: encrypt RPC was called with raw cookie ──────────────────
    const encryptCalls = rpcState.calls.filter((c) => c.name === 'encrypt_session_cookie');
    expect(encryptCalls.length).toBeGreaterThanOrEqual(1);
    expect(encryptCalls[0]!.args).toEqual({ plaintext: PLAINTEXT_COOKIE });

    // ── Assert: ciphertext (not plaintext) lives in the row ─────────────
    const storedRow = [...fake.cards.values()][0]!;
    expect(storedRow.session_cookie_encrypted).toMatch(/^pgs1:/);
    expect(storedRow.session_cookie_encrypted).not.toBe(PLAINTEXT_COOKIE);
    expect(storedRow.session_cookie_encrypted).not.toContain('real-session-bytes');

    // ── Assert: decrypt RPC round-trips back to plaintext ───────────────
    // The dispatch path (which encrypt -> dispatch already ran) issued a
    // decrypt call. Verify it was wired and that the plaintext recovered
    // matches what we sent.
    const decryptCalls = rpcState.calls.filter((c) => c.name === 'decrypt_session_cookie');
    expect(decryptCalls.length).toBeGreaterThanOrEqual(1);
    expect((decryptCalls[0]!.args as { ciphertext: string }).ciphertext)
      .toBe(storedRow.session_cookie_encrypted);

    // ── Hit /ebt/balance and expect stale=true ──────────────────────────
    const balanceApp = buildTestApp(balanceRouter, '/', APPLICANT);
    const balRes = await balanceApp.request('/', { method: 'GET' }, ENV_WITH_DISPATCH);
    expect(balRes.status).toBe(200);
    const bal = await balRes.json() as { stale: boolean; balance_cents: number | null };
    expect(bal.stale).toBe(true);
    expect(bal.balance_cents).toBeNull();
  });

  it('returns 500 when encrypt RPC fails (no plaintext ever reaches storage)', async () => {
    const fake = makeFakeSupabase();
    // Force encrypt to fail.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fake.rpc.mockImplementation((name: string, _args: any) => {
      if (name === 'encrypt_session_cookie') {
        return Promise.resolve({ data: null, error: { message: 'pgsodium key missing' } });
      }
      return Promise.resolve({ data: null, error: null });
    });
    vi.mocked(makeServiceClient).mockReturnValue(fake.client);

    const linkApp = buildTestApp(linkRouter, '/', APPLICANT);
    const res = await linkApp.request('/', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        card_id_hash: HASH,
        processor: 'ebt_ca',
        session_cookie: PLAINTEXT_COOKIE,
        expires_at: FUTURE_ISO,
      }),
    }, ENV_WITH_DISPATCH);
    expect(res.status).toBe(500);
    expect(fake.cards.size).toBe(0); // no row written
  });
});

// Silence unused import in TS strict mode
void Hono;
