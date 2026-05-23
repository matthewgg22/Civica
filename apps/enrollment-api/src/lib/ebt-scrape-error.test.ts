import { describe, it, expect } from 'vitest';
import {
  EBT_SCRAPE_ERROR_CODES,
  EBT_SCRAPE_ERROR_CTA_KINDS,
  EBT_SCRAPE_ERROR_DEFAULT_STATUS,
  emitScrapeError,
  type EBTScrapeErrorCode,
} from './ebt-scrape-error.js';

describe('EBT_SCRAPE_ERROR_CODES', () => {
  it('contains every code referenced by the iOS Swift enum', () => {
    // If iOS Lane C adds/removes a case, this array MUST be updated in lockstep —
    // a typo here would silently fall through the iOS decoder's default case.
    expect(EBT_SCRAPE_ERROR_CODES).toEqual([
      'networkTimeout',
      'portalDown',
      'sessionExpired',
      'captcha',
      'pinLocked',
      'cardClosed',
      'parseError',
      'cardLockUnsupported',
    ]);
  });

  it('has a default HTTP status for every code', () => {
    for (const code of EBT_SCRAPE_ERROR_CODES) {
      expect(EBT_SCRAPE_ERROR_DEFAULT_STATUS[code]).toBeGreaterThanOrEqual(400);
      expect(EBT_SCRAPE_ERROR_DEFAULT_STATUS[code]).toBeLessThan(600);
    }
  });
});

describe('EBT_SCRAPE_ERROR_CTA_KINDS', () => {
  it('exposes the four expected CTA kinds', () => {
    expect(EBT_SCRAPE_ERROR_CTA_KINDS).toEqual([
      're_link',
      'retry',
      'open_url',
      'contact_support',
    ]);
  });
});

describe('emitScrapeError', () => {
  it('returns a minimal body when only code + message are provided', () => {
    const body = emitScrapeError('networkTimeout', 'Took too long');
    expect(body).toEqual({
      error: {
        type: 'ebt_scrape_error',
        code: 'networkTimeout',
        message: 'Took too long',
      },
    });
  });

  it('omits cta entirely when only ctaKind is provided (kind without target is invalid)', () => {
    const body = emitScrapeError('parseError', 'Could not parse', 're_link');
    expect(body.error.cta).toBeUndefined();
  });

  it('omits cta entirely when only ctaTarget is provided', () => {
    const body = emitScrapeError(
      'parseError',
      'Could not parse',
      undefined,
      'civica://something',
    );
    expect(body.error.cta).toBeUndefined();
  });

  it('includes cta when both kind and target are provided', () => {
    const body = emitScrapeError(
      'sessionExpired',
      'Re-link required',
      're_link',
      'civica://ebt/link',
    );
    expect(body.error.cta).toEqual({ kind: 're_link', target: 'civica://ebt/link' });
  });

  it('includes doc_url when provided', () => {
    const body = emitScrapeError(
      'sessionExpired',
      'Re-link required',
      're_link',
      'civica://ebt/link',
      'https://help.civica.app/ebt/re-link',
    );
    expect(body.error.doc_url).toBe('https://help.civica.app/ebt/re-link');
  });

  it('omits doc_url when not provided', () => {
    const body = emitScrapeError('captcha', 'Please try again later');
    expect(body.error).not.toHaveProperty('doc_url');
  });

  it('includes request_id at top level when provided', () => {
    const body = emitScrapeError(
      'cardClosed',
      'This card is closed',
      'contact_support',
      'tel:+18773289677',
      undefined,
      'req_abc123',
    );
    expect(body.request_id).toBe('req_abc123');
  });

  it('matches the §16.2 wire format example exactly', () => {
    const body = emitScrapeError(
      'sessionExpired',
      'Your EBT card link has expired. Please re-link to continue.',
      're_link',
      'civica://ebt/link',
      'https://help.civica.app/ebt/re-link',
      'req_abc123',
    );
    expect(body).toEqual({
      error: {
        type: 'ebt_scrape_error',
        code: 'sessionExpired',
        message: 'Your EBT card link has expired. Please re-link to continue.',
        cta: { kind: 're_link', target: 'civica://ebt/link' },
        doc_url: 'https://help.civica.app/ebt/re-link',
      },
      request_id: 'req_abc123',
    });
  });

  it('emits a body for every known code (no type-mismatch trap)', () => {
    for (const code of EBT_SCRAPE_ERROR_CODES as readonly EBTScrapeErrorCode[]) {
      const body = emitScrapeError(code, 'message');
      expect(body.error.type).toBe('ebt_scrape_error');
      expect(body.error.code).toBe(code);
    }
  });
});
