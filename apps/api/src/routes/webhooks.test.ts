import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/client.js');
vi.mock('../audit/withAudit.js');

import { buildApp } from '../app.js';
import { withAudit } from '../audit/withAudit.js';
import { getDb } from '../db/client.js';
import { computeWebhookSignature } from '../lib/webhookHmac.js';

// ── Helpers ───────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-webhook-secret-32-bytes-min!!';

function signedRequest(body: unknown, secret = TEST_SECRET) {
  const raw = JSON.stringify(body);
  return {
    method: 'POST' as const,
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': computeWebhookSignature(secret, raw),
    },
    body: raw,
  };
}

function makeDb(opts: {
  takeFirsts?: (Record<string, unknown> | null | undefined)[];
  executes?: unknown[][];
} = {}) {
  let tfIdx = 0;
  let execIdx = 0;
  const chain: Record<string, unknown> = {};
  const noop = () => chain;
  Object.assign(chain, {
    selectFrom: noop,
    select: noop,
    where: noop,
    updateTable: noop,
    set: noop,
    execute: () => Promise.resolve((opts.executes ?? [])[execIdx++] ?? []),
    executeTakeFirst: () => Promise.resolve((opts.takeFirsts ?? [])[tfIdx++] ?? null),
    executeTakeFirstOrThrow: () => {
      const val = (opts.takeFirsts ?? [])[tfIdx++];
      if (val == null) throw new Error('no result');
      return Promise.resolve(val);
    },
    transaction: () => ({ execute: (fn: (t: unknown) => Promise<unknown>) => fn(chain) }),
  });
  return chain as unknown as ReturnType<typeof getDb>;
}

beforeEach(() => {
  vi.stubEnv('OCR_WEBHOOK_HMAC_SECRET', TEST_SECRET);
  vi.mocked(withAudit).mockImplementation(async (db, _actor, _action, _sid, fn) => fn(db as never));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

// ── Signature verification ────────────────────────────────────────────────

describe('POST /webhooks/ocr — signature', () => {
  it('returns 503 when OCR_WEBHOOK_HMAC_SECRET is not set', async () => {
    vi.stubEnv('OCR_WEBHOOK_HMAC_SECRET', '');
    vi.mocked(getDb).mockReturnValue(makeDb());
    const res = await buildApp().request('/webhooks/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: 'doc-1', status: 'success' }),
    });
    expect(res.status).toBe(503);
  });

  it('returns 401 for a missing signature header', async () => {
    vi.mocked(getDb).mockReturnValue(makeDb());
    const res = await buildApp().request('/webhooks/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: 'doc-1', status: 'success' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('invalid_signature');
  });

  it('returns 401 for a wrong secret', async () => {
    vi.mocked(getDb).mockReturnValue(makeDb());
    const req = signedRequest({ document_id: 'doc-1', status: 'success' }, 'wrong-secret-32-bytes-minimum!!!');
    const res = await buildApp().request('/webhooks/ocr', req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when body is tampered after signing', async () => {
    vi.mocked(getDb).mockReturnValue(makeDb());
    const raw = JSON.stringify({ document_id: 'doc-1', status: 'success' });
    const res = await buildApp().request('/webhooks/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': computeWebhookSignature(TEST_SECRET, raw),
      },
      body: raw + ' ', // tampered
    });
    expect(res.status).toBe(401);
  });
});

// ── Payload validation ────────────────────────────────────────────────────

describe('POST /webhooks/ocr — payload validation', () => {
  it('returns 400 when document_id is missing', async () => {
    vi.mocked(getDb).mockReturnValue(makeDb());
    const res = await buildApp().request('/webhooks/ocr', signedRequest({ status: 'success' }));
    expect(res.status).toBe(400);
    const body = await res.json() as { field: string };
    expect(body.field).toBe('document_id');
  });

  it('returns 400 when status is missing', async () => {
    vi.mocked(getDb).mockReturnValue(makeDb());
    const res = await buildApp().request('/webhooks/ocr', signedRequest({ document_id: 'doc-1' }));
    expect(res.status).toBe(400);
    const body = await res.json() as { field: string };
    expect(body.field).toBe('status');
  });
});

// ── Document lookup ───────────────────────────────────────────────────────

describe('POST /webhooks/ocr — document lookup', () => {
  it('returns 404 when document is not found', async () => {
    vi.mocked(getDb).mockReturnValue(makeDb({ takeFirsts: [null] }));
    const res = await buildApp().request(
      '/webhooks/ocr',
      signedRequest({ document_id: 'missing', status: 'success' }),
    );
    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('document_not_found');
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────

describe('POST /webhooks/ocr — idempotency', () => {
  it.each(['confirmed', 'rejected'] as const)(
    'returns 200 already_processed for terminal status %s',
    async (terminalStatus) => {
      vi.mocked(getDb).mockReturnValue(
        makeDb({
          takeFirsts: [{ document_id: 'doc-1', session_id: 'sess-1', processing_status: terminalStatus }],
        }),
      );
      const res = await buildApp().request(
        '/webhooks/ocr',
        signedRequest({ document_id: 'doc-1', status: 'success' }),
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe('already_processed');
      expect(vi.mocked(withAudit)).not.toHaveBeenCalled();
    },
  );
});

// ── Happy paths ───────────────────────────────────────────────────────────

describe('POST /webhooks/ocr — processing', () => {
  it('sets awaiting_confirmation and writes audit on success', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        takeFirsts: [{ document_id: 'doc-1', session_id: 'sess-1', processing_status: 'extracting' }],
        executes: [[]],
      }),
    );
    const res = await buildApp().request(
      '/webhooks/ocr',
      signedRequest({
        document_id: 'doc-1',
        status: 'success',
        document_type: 'paystub',
        classification_confidence: 0.97,
        extraction_confidence: 0.91,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { processing_status: string };
    expect(body.processing_status).toBe('awaiting_confirmation');
    expect(vi.mocked(withAudit)).toHaveBeenCalledWith(
      expect.anything(),
      { kind: 'background_job' },
      'OCR_RESULT_RECEIVED',
      'sess-1',
      expect.any(Function),
      expect.objectContaining({ reason: 'ocr success' }),
    );
  });

  it('sets rejected and writes audit on failure', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        takeFirsts: [{ document_id: 'doc-1', session_id: 'sess-1', processing_status: 'extracting' }],
        executes: [[]],
      }),
    );
    const res = await buildApp().request(
      '/webhooks/ocr',
      signedRequest({ document_id: 'doc-1', status: 'failure', error_code: 'low_quality' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { processing_status: string };
    expect(body.processing_status).toBe('rejected');
    expect(vi.mocked(withAudit)).toHaveBeenCalledWith(
      expect.anything(),
      { kind: 'background_job' },
      'OCR_RESULT_RECEIVED',
      'sess-1',
      expect.any(Function),
      expect.objectContaining({ reason: 'ocr failure: low_quality' }),
    );
  });

  it('returns document_id in response', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDb({
        takeFirsts: [{ document_id: 'doc-abc', session_id: 'sess-1', processing_status: 'classifying' }],
        executes: [[]],
      }),
    );
    const res = await buildApp().request(
      '/webhooks/ocr',
      signedRequest({ document_id: 'doc-abc', status: 'success' }),
    );
    const body = await res.json() as { document_id: string };
    expect(body.document_id).toBe('doc-abc');
  });
});
