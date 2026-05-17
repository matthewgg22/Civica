import pino from 'pino';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { REDACT_PATHS } from './logger.js';

// ── REDACT_PATHS coverage ────────────────────────────────────────────────

describe('REDACT_PATHS static coverage', () => {
  const paths = new Set(REDACT_PATHS);

  for (const field of ['applicant_name', 'dob', 'ssn', 'ssn_last4']) {
    it(`contains direct and nested path for '${field}'`, () => {
      expect(paths.has(field)).toBe(true);
      expect(paths.has(`*.${field}`)).toBe(true);
    });
  }

  for (const col of [
    'content_ciphertext',
    'snapshot_ciphertext',
    'extracted_payload_ciphertext',
    'user_corrections_ciphertext',
    'household_snapshot_ciphertext',
    'result_ciphertext',
  ]) {
    it(`contains direct and nested path for '${col}'`, () => {
      expect(paths.has(col)).toBe(true);
      expect(paths.has(`*.${col}`)).toBe(true);
    });
  }

  it('redacts authorization header', () => {
    expect(paths.has('req.headers.authorization')).toBe(true);
  });
});

// ── Runtime redaction ────────────────────────────────────────────────────
// Uses a synchronous Writable stream — pino writes synchronously to raw streams.

function makeTestLogger() {
  const lines: string[] = [];
  const dest = new Writable({
    write(chunk: Buffer, _: BufferEncoding, cb: () => void) {
      lines.push(chunk.toString());
      cb();
    },
  });
  const log = pino(
    { level: 'trace', redact: { paths: REDACT_PATHS, censor: '[Redacted]' } },
    dest,
  );
  return { log, lines };
}

function lastRecord(lines: string[]): Record<string, unknown> {
  return JSON.parse(lines.at(-1)!.trim());
}

describe('pino runtime redaction', () => {
  it('redacts applicant_name at top level', () => {
    const { log, lines } = makeTestLogger();
    log.info({ applicant_name: 'Jane Smith', action: 'test' });
    expect(lastRecord(lines)['applicant_name']).toBe('[Redacted]');
  });

  it('redacts dob at top level', () => {
    const { log, lines } = makeTestLogger();
    log.info({ dob: '1990-01-01' });
    expect(lastRecord(lines)['dob']).toBe('[Redacted]');
  });

  it('redacts ssn at top level', () => {
    const { log, lines } = makeTestLogger();
    log.info({ ssn: '123-45-6789' });
    expect(lastRecord(lines)['ssn']).toBe('[Redacted]');
  });

  it('redacts nested applicant_name via wildcard path', () => {
    const { log, lines } = makeTestLogger();
    log.info({ session: { applicant_name: 'John Doe' } });
    const record = lastRecord(lines) as { session: { applicant_name: string } };
    expect(record.session.applicant_name).toBe('[Redacted]');
  });

  it('redacts ciphertext column at top level', () => {
    const { log, lines } = makeTestLogger();
    log.info({ content_ciphertext: 'snap_v1::abc123' });
    expect(lastRecord(lines)['content_ciphertext']).toBe('[Redacted]');
  });

  it('does NOT redact unrelated fields', () => {
    const { log, lines } = makeTestLogger();
    log.info({ session_id: 'abc-123', status: 'active' });
    const record = lastRecord(lines);
    expect(record['session_id']).toBe('abc-123');
    expect(record['status']).toBe('active');
  });
});
