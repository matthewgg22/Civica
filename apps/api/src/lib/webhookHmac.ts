import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Computes the expected `sha256=<hex>` signature for a webhook body.
 * Used both server-side (to verify) and in tests (to produce valid headers).
 */
export function computeWebhookSignature(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

/**
 * Constant-time comparison of the provided signature header against the
 * expected HMAC-SHA256. Returns false if the header is missing, malformed,
 * wrong length, or the digests don't match.
 */
export function verifyWebhookSignature(body: string, signatureHeader: string, secret: string): boolean {
  if (!signatureHeader.startsWith('sha256=')) return false;
  const provided = Buffer.from(signatureHeader.slice(7), 'hex');
  if (provided.length === 0) return false;
  const expected = Buffer.from(
    createHmac('sha256', secret).update(body).digest('hex'),
    'hex',
  );
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
