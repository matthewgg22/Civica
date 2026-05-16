import { Hono } from 'hono';
import { withAudit } from '../audit/withAudit.js';
import { getDb } from '../db/client.js';
import type { DocumentProcessingStatus, DocumentType } from '../db/schema.js';
import { verifyWebhookSignature } from '../lib/webhookHmac.js';

export const webhookRoutes = new Hono();

// ── Payload shape sent by Textract / Document AI adapter ──────────────────

interface OcrWebhookPayload {
  document_id: string;
  status: 'success' | 'failure';
  document_type?: DocumentType;
  classification_confidence?: number;
  extraction_confidence?: number;
  /** Opaque JSON. Stored encrypted by FastAPI; forwarded when FastAPI exposes
   *  the internal encryption endpoint (POST /snap/documents/:id/extraction). */
  extracted_data?: unknown;
  error_code?: string;
}

// ── POST /webhooks/ocr ────────────────────────────────────────────────────

webhookRoutes.post('/ocr', async (c) => {
  const secret = process.env.OCR_WEBHOOK_HMAC_SECRET;
  if (!secret) return c.json({ error: 'webhook_not_configured' }, 503);

  // Read raw body before any parsing — signature covers the exact bytes received.
  const rawBody = await c.req.text();
  const sigHeader = c.req.header('x-webhook-signature') ?? '';

  if (!verifyWebhookSignature(rawBody, sigHeader, secret)) {
    return c.json({ error: 'invalid_signature' }, 401);
  }

  let payload: OcrWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as OcrWebhookPayload;
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  if (!payload.document_id) {
    return c.json({ error: 'missing_field', field: 'document_id' }, 400);
  }
  if (payload.status !== 'success' && payload.status !== 'failure') {
    return c.json({ error: 'missing_field', field: 'status' }, 400);
  }

  const db = getDb();

  const doc = await db
    .selectFrom('snap_documents')
    .select(['document_id', 'session_id', 'processing_status'])
    .where('document_id', '=', payload.document_id)
    .executeTakeFirst();

  if (!doc) return c.json({ error: 'document_not_found' }, 404);

  // Idempotency: already in a terminal state — acknowledge without reprocessing.
  const TERMINAL: DocumentProcessingStatus[] = ['confirmed', 'rejected'];
  if (TERMINAL.includes(doc.processing_status)) {
    return c.json({ document_id: doc.document_id, status: 'already_processed' });
  }

  const newStatus: DocumentProcessingStatus =
    payload.status === 'success' ? 'awaiting_confirmation' : 'rejected';

  const updateFields: Partial<{
    processing_status: DocumentProcessingStatus;
    document_type: DocumentType;
    classification_confidence: number;
    extraction_confidence: number;
  }> = { processing_status: newStatus };

  if (payload.document_type !== undefined) updateFields.document_type = payload.document_type;
  if (payload.classification_confidence !== undefined)
    updateFields.classification_confidence = payload.classification_confidence;
  if (payload.extraction_confidence !== undefined)
    updateFields.extraction_confidence = payload.extraction_confidence;

  await withAudit(
    db,
    { kind: 'background_job' },
    'OCR_RESULT_RECEIVED',
    doc.session_id,
    (trx) =>
      trx
        .updateTable('snap_documents')
        .set(updateFields)
        .where('document_id', '=', payload.document_id)
        .execute(),
    {
      reason: `ocr ${payload.status}${payload.error_code ? `: ${payload.error_code}` : ''}`,
      columnOrResource: `snap_documents/${payload.document_id}`,
    },
  );

  // TODO: Once FastAPI exposes POST /snap/documents/:id/extraction (internal),
  // call getEngineClient().post(...) here to store payload.extracted_data
  // Fernet-encrypted in extracted_payload_ciphertext.

  return c.json({ document_id: doc.document_id, processing_status: newStatus });
});
