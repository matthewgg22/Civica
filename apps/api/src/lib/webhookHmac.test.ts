import { describe, expect, it } from 'vitest';
import { computeWebhookSignature, verifyWebhookSignature } from './webhookHmac.js';

const SECRET = 'test-webhook-secret-32-bytes-min!!';
const BODY = '{"document_id":"doc-1","status":"success"}';

describe('computeWebhookSignature', () => {
  it('returns sha256= prefixed hex string', () => {
    const sig = computeWebhookSignature(SECRET, BODY);
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('is deterministic for the same secret and body', () => {
    expect(computeWebhookSignature(SECRET, BODY)).toBe(computeWebhookSignature(SECRET, BODY));
  });

  it('differs for different secrets', () => {
    expect(computeWebhookSignature(SECRET, BODY)).not.toBe(
      computeWebhookSignature('other-secret-32-bytes-min!!!!!', BODY),
    );
  });

  it('differs for different bodies', () => {
    expect(computeWebhookSignature(SECRET, BODY)).not.toBe(
      computeWebhookSignature(SECRET, '{"document_id":"doc-2","status":"success"}'),
    );
  });
});

describe('verifyWebhookSignature', () => {
  it('returns true for a valid signature', () => {
    const sig = computeWebhookSignature(SECRET, BODY);
    expect(verifyWebhookSignature(BODY, sig, SECRET)).toBe(true);
  });

  it('returns false for a wrong secret', () => {
    const sig = computeWebhookSignature('wrong-secret-32-bytes-minimum!!!', BODY);
    expect(verifyWebhookSignature(BODY, sig, SECRET)).toBe(false);
  });

  it('returns false for a tampered body', () => {
    const sig = computeWebhookSignature(SECRET, BODY);
    expect(verifyWebhookSignature(BODY + ' ', sig, SECRET)).toBe(false);
  });

  it('returns false when header is missing the sha256= prefix', () => {
    const sig = computeWebhookSignature(SECRET, BODY).slice(7); // strip sha256=
    expect(verifyWebhookSignature(BODY, sig, SECRET)).toBe(false);
  });

  it('returns false for an empty signature header', () => {
    expect(verifyWebhookSignature(BODY, '', SECRET)).toBe(false);
  });

  it('returns false for a truncated hex digest', () => {
    const sig = computeWebhookSignature(SECRET, BODY).slice(0, 32); // half the digest
    expect(verifyWebhookSignature(BODY, sig, SECRET)).toBe(false);
  });
});
