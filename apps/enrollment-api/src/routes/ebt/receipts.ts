/**
 * POST /ebt/receipts — upload a scanned receipt (multipart/form-data)
 * GET  /ebt/receipts — list receipts for the caller (paginated, RLS-scoped)
 *
 * Per plan D6 (receipt matching): the match job runs asynchronously.
 * The upload route inserts a row with match_status='pending_match' and
 * returns immediately; match-receipt.ts runs the matching logic.
 *
 * Image storage: Supabase Storage bucket `ebt-receipts/`.
 * Path: `{user_id}/{receipt_id}.jpg`
 * Signed URL TTL: 90 days (7_776_000 seconds).
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { makeServiceClient } from '../../lib/supabase.js';
import { requireApplicant } from '../../lib/auth.js';
import { matchReceipt } from '../../jobs/match-receipt.js';
import type { Env } from '../../types.js';

const app = new Hono<{ Bindings: Env }>();

const SIGNED_URL_TTL = 7_776_000; // 90 days in seconds
const BUCKET = 'ebt-receipts';

// Query params for GET
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// MARK: - POST /ebt/receipts

app.post('/', async (c) => {
  const actor = c.get('actor');
  requireApplicant(actor.kind);

  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    throw new HTTPException(415, {
      message: 'Expected multipart/form-data with an image field.',
    });
  }

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    throw new HTTPException(400, { message: 'Could not parse multipart form data.' });
  }

  const imageFile = formData.get('image');
  // In CF Workers FormDataEntryValue is string | File; check for Blob/File duck-typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!imageFile || typeof (imageFile as any).arrayBuffer !== 'function') {
    throw new HTTPException(400, { message: 'Missing required field: image (File).' });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageBlob = imageFile as any as Blob;

  // Parse optional OCR fields
  const ocrTotalCentsRaw = formData.get('ocr_total_cents');
  const ocrMerchant = formData.get('ocr_merchant');
  const capturedAtRaw = formData.get('captured_at');

  const ocrTotalCents: number | null =
    ocrTotalCentsRaw && typeof ocrTotalCentsRaw === 'string'
      ? parseInt(ocrTotalCentsRaw, 10)
      : null;

  const capturedAt: string =
    capturedAtRaw && typeof capturedAtRaw === 'string'
      ? capturedAtRaw
      : new Date().toISOString();

  const db = makeServiceClient(c.env);
  const receiptId = crypto.randomUUID();
  const storagePath = `${actor.id}/${receiptId}.jpg`;

  // Upload to Supabase Storage
  const imageBytes = await imageBlob.arrayBuffer();
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, imageBytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw new HTTPException(500, {
      message: `Storage upload failed: ${(uploadError as { message?: string }).message ?? 'unknown'}`,
    });
  }

  // Generate a long-lived signed URL
  const { data: signedData, error: signedError } = await db.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL);

  if (signedError || !signedData) {
    throw new HTTPException(500, { message: 'Could not generate signed URL for uploaded receipt.' });
  }

  const imageUrl = signedData.signedUrl;

  // Insert ebt_receipts row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: insertError } = await (db.schema('snap_enrollment').from('ebt_receipts' as any) as any)
    .insert({
      id: receiptId,
      user_id: actor.id,
      image_url: imageUrl,
      ocr_total_cents: Number.isNaN(ocrTotalCents) ? null : ocrTotalCents,
      ocr_merchant:
        ocrMerchant && typeof ocrMerchant === 'string' ? ocrMerchant : null,
      captured_at: capturedAt,
      match_status: 'pending_match',
      user_confirmed: false,
    })
    .select()
    .single() as {
    data: ReceiptRow | null;
    error: { message: string } | null;
  };

  if (insertError || !row) {
    throw new HTTPException(500, {
      message: `Failed to save receipt: ${insertError?.message ?? 'unknown'}`,
    });
  }

  // Kick off async match job (fire-and-forget; failures are non-fatal)
  void matchReceipt(db, row).catch(() => {
    /* match failures are non-fatal — logged inside matchReceipt */
  });

  return c.json(formatRow(row), 201);
});

// MARK: - GET /ebt/receipts

app.get('/', zValidator('query', listQuerySchema), async (c) => {
  const actor = c.get('actor');
  requireApplicant(actor.kind);

  const { limit = 25, offset = 0 } = c.req.valid('query');
  const db = makeServiceClient(c.env);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema('snap_enrollment').from('ebt_receipts' as any) as any)
    .select('*')
    .eq('user_id', actor.id)
    .order('captured_at', { ascending: false })
    .limit(limit) as {
    data: ReceiptRow[] | null;
    error: { message: string } | null;
  };

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({ items: (data ?? []).map(formatRow) });
});

export default app;

// MARK: - Types + formatting

interface ReceiptRow {
  id: string;
  user_id: string;
  transaction_id: string | null;
  image_url: string;
  ocr_total_cents: number | null;
  ocr_merchant: string | null;
  captured_at: string;
  match_status: string;
  user_confirmed: boolean;
}

function formatRow(row: ReceiptRow) {
  return {
    id: row.id,
    transaction_id: row.transaction_id,
    image_url: row.image_url,
    ocr_total_cents: row.ocr_total_cents,
    ocr_merchant: row.ocr_merchant,
    captured_at: row.captured_at,
    match_status: row.match_status,
    user_confirmed: row.user_confirmed,
  };
}
