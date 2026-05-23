import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mock factories before vi.mock() usage
const mockUpload = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ error: null, data: { path: 'user-001/receipt-1.jpg' } }),
);
const mockCreateSignedUrl = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    data: { signedUrl: 'https://example.supabase.co/receipt.jpg' },
    error: null,
  }),
);
const mockMatchReceipt = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

vi.mock('../../jobs/match-receipt.js', () => ({
  matchReceipt: mockMatchReceipt,
}));

import { makeServiceClient } from '../../lib/supabase.js';
import receiptsRouter from './receipts.js';
import {
  TEST_ENV,
  APPLICANT,
  NAVIGATOR,
  makeQueryBuilder,
  buildTestApp,
} from '../../test/helpers.js';

const CAPTURED_AT = new Date('2026-05-23T10:00:00Z').toISOString();

const MOCK_RECEIPT_ROW = {
  id: 'receipt-uuid-1',
  user_id: 'user-001',
  transaction_id: null,
  image_url: 'https://example.supabase.co/receipt.jpg',
  ocr_total_cents: 2763,
  ocr_merchant: 'WALMART',
  captured_at: CAPTURED_AT,
  match_status: 'pending_match',
  user_confirmed: false,
};

// Build a mock DB with separate upload/signedUrl mocks + insert qb
function buildDb(insertResult: { data: unknown; error: unknown }) {
  const qb = makeQueryBuilder(insertResult);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(qb) }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockUpload,
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  };
  return db;
}

// Build a mock DB for list-style queries (just returns data from qb)
function buildListDb(listResult: { data: unknown; error: unknown }) {
  const qb = makeQueryBuilder(listResult);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(qb) }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockUpload,
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  };
  return db;
}

function buildMultipart(fields: Record<string, string>, imageData = new Uint8Array([0xff, 0xd8, 0xff])) {
  const boundary = 'TestBoundary123';
  const parts: string[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    );
  }
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="receipt.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
  );
  const textEncoder = new TextEncoder();
  const prefix = textEncoder.encode(parts.join(''));
  const suffix = textEncoder.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(prefix.length + imageData.length + suffix.length);
  body.set(prefix);
  body.set(imageData, prefix.length);
  body.set(suffix, prefix.length + imageData.length);
  return { body: body.buffer, contentType: `multipart/form-data; boundary=${boundary}` };
}

beforeEach(() => {
  mockUpload.mockResolvedValue({ error: null, data: { path: 'user-001/receipt-1.jpg' } });
  mockCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://example.supabase.co/receipt.jpg' },
    error: null,
  });
  mockMatchReceipt.mockResolvedValue(undefined);
});

afterEach(() => vi.resetAllMocks());

// MARK: - POST /ebt/receipts

describe('POST /ebt/receipts', () => {
  it('returns 403 for navigator role', async () => {
    const db = buildDb({ data: null, error: null });
    vi.mocked(makeServiceClient).mockReturnValue(db);
    const app = buildTestApp(receiptsRouter, '/', NAVIGATOR);
    const { body, contentType } = buildMultipart({ captured_at: CAPTURED_AT });
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    }, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it('returns 415 when content-type is not multipart', async () => {
    const db = buildDb({ data: null, error: null });
    vi.mocked(makeServiceClient).mockReturnValue(db);
    const app = buildTestApp(receiptsRouter, '/', APPLICANT);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, TEST_ENV);
    expect(res.status).toBe(415);
  });

  it('returns 400 when image field is missing', async () => {
    const db = buildDb({ data: null, error: null });
    vi.mocked(makeServiceClient).mockReturnValue(db);
    const app = buildTestApp(receiptsRouter, '/', APPLICANT);
    const boundary = 'TestBoundary';
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="captured_at"\r\n\r\n${CAPTURED_AT}\r\n--${boundary}--\r\n`;
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    }, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('inserts receipt and returns 201 with receipt data', async () => {
    const db = buildDb({ data: MOCK_RECEIPT_ROW, error: null });
    vi.mocked(makeServiceClient).mockReturnValue(db);
    const app = buildTestApp(receiptsRouter, '/', APPLICANT);
    const { body, contentType } = buildMultipart({
      ocr_total_cents: '2763',
      ocr_merchant: 'WALMART',
      captured_at: CAPTURED_AT,
    });
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    }, TEST_ENV);
    expect(res.status).toBe(201);
    const json = await res.json() as Record<string, unknown>;
    expect(json.match_status).toBe('pending_match');
    expect(json.ocr_merchant).toBe('WALMART');
    expect(json.ocr_total_cents).toBe(2763);
  });

  it('fires match job after insert', async () => {
    const db = buildDb({ data: MOCK_RECEIPT_ROW, error: null });
    vi.mocked(makeServiceClient).mockReturnValue(db);
    const app = buildTestApp(receiptsRouter, '/', APPLICANT);
    const { body, contentType } = buildMultipart({ captured_at: CAPTURED_AT });
    await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    }, TEST_ENV);
    // Allow fire-and-forget to settle
    await Promise.resolve();
    expect(mockMatchReceipt).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when storage upload fails', async () => {
    mockUpload.mockResolvedValueOnce({ error: { message: 'bucket full' }, data: null });
    const db = buildDb({ data: null, error: null });
    vi.mocked(makeServiceClient).mockReturnValue(db);
    const app = buildTestApp(receiptsRouter, '/', APPLICANT);
    const { body, contentType } = buildMultipart({ captured_at: CAPTURED_AT });
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    }, TEST_ENV);
    expect(res.status).toBe(500);
  });
});

// MARK: - GET /ebt/receipts

describe('GET /ebt/receipts', () => {
  it('returns 403 for navigator', async () => {
    const db = buildListDb({ data: [], error: null });
    vi.mocked(makeServiceClient).mockReturnValue(db);
    const app = buildTestApp(receiptsRouter, '/', NAVIGATOR);
    const res = await app.request('/', {}, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it('returns empty list when user has no receipts', async () => {
    const db = buildListDb({ data: [], error: null });
    vi.mocked(makeServiceClient).mockReturnValue(db);
    const app = buildTestApp(receiptsRouter, '/', APPLICANT);
    const res = await app.request('/', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const json = await res.json() as { items: unknown[] };
    expect(json.items).toEqual([]);
  });

  it('returns formatted receipts', async () => {
    const db = buildListDb({ data: [MOCK_RECEIPT_ROW], error: null });
    vi.mocked(makeServiceClient).mockReturnValue(db);
    const app = buildTestApp(receiptsRouter, '/', APPLICANT);
    const res = await app.request('/', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const json = await res.json() as { items: Array<Record<string, unknown>> };
    expect(json.items).toHaveLength(1);
    expect(json.items[0]?.id).toBe('receipt-uuid-1');
    expect(json.items[0]?.match_status).toBe('pending_match');
  });

  it('returns 500 on DB error', async () => {
    const db = buildListDb({ data: null, error: { message: 'connection failed' } });
    vi.mocked(makeServiceClient).mockReturnValue(db);
    const app = buildTestApp(receiptsRouter, '/', APPLICANT);
    const res = await app.request('/', {}, TEST_ENV);
    expect(res.status).toBe(500);
  });
});
