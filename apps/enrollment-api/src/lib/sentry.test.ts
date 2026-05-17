import { describe, expect, it } from 'vitest';
import { scrubEvent } from './sentry.js';
import type { ErrorEvent } from '@sentry/cloudflare';

// Helpers to build minimal synthetic Sentry events without satisfying every
// required SDK field — we only need the fields scrubEvent actually touches.
function evt(partial: Record<string, unknown>): ErrorEvent {
  return partial as unknown as ErrorEvent;
}

// ── scrubEvent PII redaction ──────────────────────────────────────────────
// scrubEvent is async: it hashes user.id via Web Crypto (available in Node
// 18+ and Cloudflare Workers).

describe('scrubEvent', () => {
  it('redacts SSN, email, phone, applicant_id, and ciphertext from event.extra', async () => {
    const result = await scrubEvent(evt({
      extra: {
        ssn: '123-45-6789',
        email: 'foo@example.org',
        phone: '+1-555-555-5555',
        phone_number: '+1-555-555-5556',
        applicant_id: '00000000-0000-0000-0000-000000000099',
        content_ciphertext: 'gAAAAABencryptedblob',
        safe_field: 'keep-me',
      },
    }));
    expect(result).not.toBeNull();
    const extra = result!.extra!;
    expect(extra['ssn']).toBe('[Redacted]');
    expect(extra['email']).toBe('[Redacted]');
    expect(extra['phone']).toBe('[Redacted]');
    expect(extra['phone_number']).toBe('[Redacted]');
    expect(extra['applicant_id']).toBe('[Redacted]');
    expect(extra['content_ciphertext']).toBe('[Redacted]');
    expect(extra['safe_field']).toBe('keep-me');
  });

  it('redacts nested PII in event.contexts', async () => {
    const result = await scrubEvent(evt({
      contexts: {
        form_data: {
          ssn: '123-45-6789',
          applicant_id: 'some-uuid',
          snapshot_ciphertext: 'encrypted',
          ok: 'visible',
        },
      },
    }));
    const ctx = result!.contexts!['form_data'] as Record<string, unknown>;
    expect(ctx['ssn']).toBe('[Redacted]');
    expect(ctx['applicant_id']).toBe('[Redacted]');
    expect(ctx['snapshot_ciphertext']).toBe('[Redacted]');
    expect(ctx['ok']).toBe('visible');
  });

  it('strips request body, cookies, and non-content-type headers', async () => {
    const result = await scrubEvent(evt({
      request: {
        data: '{"ssn":"123-45-6789"}',
        cookies: { session: 'abc123' },
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer secret',
          'x-api-key': 'key123',
        },
      },
    }));
    expect(result!.request!.data).toBeUndefined();
    expect(result!.request!.cookies).toBeUndefined();
    expect(result!.request!.headers!['content-type']).toBe('application/json');
    expect(result!.request!.headers!['authorization']).toBeUndefined();
    expect(result!.request!.headers!['x-api-key']).toBeUndefined();
  });

  it('hashes user.id and strips all other user fields', async () => {
    const result = await scrubEvent(evt({
      user: {
        id: 'user-123',
        email: 'foo@example.org',
        username: 'foo',
        ip_address: '1.2.3.4',
      },
    }));
    expect(result!.user!.email).toBeUndefined();
    expect(result!.user!.username).toBeUndefined();
    expect(result!.user!.ip_address).toBeUndefined();
    // id is hashed — 16-hex-char truncated SHA-256
    expect(result!.user!.id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('redacts PII in breadcrumb data', async () => {
    const result = await scrubEvent(evt({
      breadcrumbs: [
        { message: 'form submit', data: { email: 'foo@example.org', step: 'identity' } },
        { message: 'no data' },
      ],
    }));
    const crumbs = result!.breadcrumbs!;
    expect((crumbs[0]!.data as Record<string, unknown>)['email']).toBe('[Redacted]');
    expect((crumbs[0]!.data as Record<string, unknown>)['step']).toBe('identity');
    expect(crumbs[1]!.data).toBeUndefined();
  });
});
