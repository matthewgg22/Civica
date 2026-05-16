import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { FORBIDDEN_WORDS, findForbiddenWord } from './forbiddenWords.js';

// ── findForbiddenWord unit tests ──────────────────────────────────────────

describe('findForbiddenWord — detects all forbidden words', () => {
  for (const word of FORBIDDEN_WORDS) {
    it(`detects '${word}' (lowercase)`, () => {
      expect(findForbiddenWord(`{"status":"${word}"}`)).toBe(word);
    });

    it(`detects '${word}' (uppercase)`, () => {
      expect(findForbiddenWord(word.toUpperCase())).toBe(word);
    });

    it(`detects '${word}' (mixed case)`, () => {
      const mixed = word[0]!.toUpperCase() + word.slice(1);
      expect(findForbiddenWord(mixed)).toBe(word);
    });
  }
});

describe('findForbiddenWord — does not false-positive', () => {
  it('returns null for a clean JSON payload', () => {
    expect(findForbiddenWord('{"status":"ok","service":"@civica/api"}')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(findForbiddenWord('')).toBeNull();
  });

  // 'ineligible' contains 'eligible' — word boundaries must prevent double-match.
  it('"ineligible" matches ineligible, not eligible (boundary check)', () => {
    expect(findForbiddenWord('ineligible')).toBe('ineligible');
  });

  it('"unapproved" does not match "approved" (word boundary)', () => {
    expect(findForbiddenWord('unapproved')).toBeNull();
  });

  it('"undeniable" does not match "denied" (word boundary)', () => {
    expect(findForbiddenWord('undeniable')).toBeNull();
  });
});

// ── Route fixture — every registered route must be clean ─────────────────
// This test grows as routes are added. Add new paths to ROUTE_FIXTURES
// when new handlers are implemented.

const ROUTE_FIXTURES: Array<{ path: string; init?: RequestInit }> = [
  { path: '/healthz' },
  // Auth-gated routes return 401 without a token — their error bodies must
  // also be clean. Add authenticated fixtures in Phases 13–14.
  { path: '/me/any' },
  { path: '/navigator/any' },
  { path: '/webhooks/any' },
];

describe('route fixture — no forbidden words in any response body', () => {
  for (const { path, init } of ROUTE_FIXTURES) {
    it(`GET ${path}`, async () => {
      const res = await buildApp().request(path, init);
      const body = await res.text();
      const hit = findForbiddenWord(body);
      expect(hit, `Found forbidden word "${hit}" in response body for ${path}: ${body}`).toBeNull();
    });
  }
});
