import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock('../lib/applicant.js', () => ({
  getOrCreateApplicant: vi.fn().mockResolvedValue({ applicant_id: 'user-001' }),
}));

import { makeAnonClient } from '../lib/supabase.js';
import { getOrCreateApplicant } from '../lib/applicant.js';
import mePacketsRouter from './me-packets.js';
import { TEST_ENV, APPLICANT, makeQueryBuilder, buildTestApp } from '../test/helpers.js';

afterEach(() => vi.resetAllMocks());
beforeEach(() => {
  vi.mocked(getOrCreateApplicant).mockResolvedValue({ applicant_id: 'user-001' } as never);
});

const PACKET_ID = 'b0000000-0000-0000-0000-000000000001';
const MOCK_PACKET = { packet_id: PACKET_ID };

function mockListDocs(items: unknown[]) {
  const qbPacket = makeQueryBuilder({ data: MOCK_PACKET, error: null });
  const qbItems = makeQueryBuilder({ data: items, error: null });
  vi.mocked(makeAnonClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi.fn()
        .mockReturnValueOnce(qbPacket)   // snap_packets ownership check
        .mockReturnValueOnce(qbItems),   // required_document_items join
    }),
  } as never);
}

// Regression guard for the silently-never-firing branch fixed in this PR.
// Prior code checked processing_status === "complete" / "processing" which
// never existed in the DB CHECK constraint, so every uploaded doc fell
// through to "Uploaded" regardless of navigator state.
describe('GET /me/packets/:packetId/documents — processing_status branches', () => {
  it('returns "Accepted for Packet" when resolved_at is set AND processing_status === "confirmed"', async () => {
    mockListDocs([
      {
        item_id: 'item-1',
        label: 'Photo ID',
        is_required: true,
        document_kind: 'photo_id',
        resolved_at: '2026-05-19T10:00:00Z',
        waived_at: null,
        uploaded_documents: {
          document_id: 'doc-1',
          processing_status: 'confirmed',
          uploaded_at: '2026-05-19T09:00:00Z',
        },
        created_at: '2026-05-18T00:00:00Z',
      },
    ]);

    const app = buildTestApp(mePacketsRouter, '/me/packets', APPLICANT);
    const res = await app.request(`/me/packets/${PACKET_ID}/documents`, {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ status: string }>;
    expect(body[0]?.status).toBe('Accepted for Packet');
  });

  it('returns "Needs Review" when processing_status === "awaiting_confirmation"', async () => {
    mockListDocs([
      {
        item_id: 'item-1',
        label: 'Pay stub',
        is_required: true,
        document_kind: 'paystub',
        resolved_at: null,
        waived_at: null,
        uploaded_documents: {
          document_id: 'doc-1',
          processing_status: 'awaiting_confirmation',
          uploaded_at: '2026-05-19T09:00:00Z',
        },
        created_at: '2026-05-18T00:00:00Z',
      },
    ]);

    const app = buildTestApp(mePacketsRouter, '/me/packets', APPLICANT);
    const res = await app.request(`/me/packets/${PACKET_ID}/documents`, {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ status: string }>;
    expect(body[0]?.status).toBe('Needs Review');
  });

  it('returns "Uploaded" when doc is mid-pipeline (uploaded/classifying/extracting)', async () => {
    for (const procStatus of ['uploaded', 'classifying', 'extracting'] as const) {
      mockListDocs([
        {
          item_id: 'item-1',
          label: 'Utility bill',
          is_required: true,
          document_kind: 'utility_bill',
          resolved_at: null,
          waived_at: null,
          uploaded_documents: {
            document_id: 'doc-1',
            processing_status: procStatus,
            uploaded_at: '2026-05-19T09:00:00Z',
          },
          created_at: '2026-05-18T00:00:00Z',
        },
      ]);

      const app = buildTestApp(mePacketsRouter, '/me/packets', APPLICANT);
      const res = await app.request(`/me/packets/${PACKET_ID}/documents`, {}, TEST_ENV);
      const body = (await res.json()) as Array<{ status: string }>;
      expect(body[0]?.status, `status for ${procStatus}`).toBe('Uploaded');
    }
  });

  it('returns "Not Started" when no document is uploaded and item is required', async () => {
    mockListDocs([
      {
        item_id: 'item-1',
        label: 'Photo ID',
        is_required: true,
        document_kind: 'photo_id',
        resolved_at: null,
        waived_at: null,
        uploaded_documents: null,
        created_at: '2026-05-18T00:00:00Z',
      },
    ]);

    const app = buildTestApp(mePacketsRouter, '/me/packets', APPLICANT);
    const res = await app.request(`/me/packets/${PACKET_ID}/documents`, {}, TEST_ENV);
    const body = (await res.json()) as Array<{ status: string }>;
    expect(body[0]?.status).toBe('Not Started');
  });

  it('returns "N/A" when waived_at is set (regardless of other state)', async () => {
    mockListDocs([
      {
        item_id: 'item-1',
        label: 'Tax return',
        is_required: false,
        document_kind: 'tax_return',
        resolved_at: null,
        waived_at: '2026-05-19T11:00:00Z',
        uploaded_documents: null,
        created_at: '2026-05-18T00:00:00Z',
      },
    ]);

    const app = buildTestApp(mePacketsRouter, '/me/packets', APPLICANT);
    const res = await app.request(`/me/packets/${PACKET_ID}/documents`, {}, TEST_ENV);
    const body = (await res.json()) as Array<{ status: string }>;
    expect(body[0]?.status).toBe('N/A');
  });
});
