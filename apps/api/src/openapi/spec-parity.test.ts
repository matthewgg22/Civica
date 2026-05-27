/**
 * Static parity check: every path+method documented in the OpenAPI spec has a
 * live handler registered in the Hono app, and vice-versa for the SNAP/navigator
 * routes (civic legacy routes are intentionally excluded from the spec).
 *
 * Runs in CI without a live server. Update expectations when adding/removing routes.
 */

import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { buildOpenAPIDocument } from './spec.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert OpenAPI {param} to Hono :param */
function toHonoPath(openApiPath: string): string {
  return openApiPath.replace(/\{([^}]+)\}/g, ':$1');
}

/** Build a set of "METHOD /path" strings from the OpenAPI spec. */
function specEntries(): Set<string> {
  const doc = buildOpenAPIDocument();
  const entries = new Set<string>();
  for (const [path, methods] of Object.entries(doc.paths ?? {})) {
    for (const method of Object.keys(methods as object)) {
      if (['get', 'post', 'patch', 'put', 'delete'].includes(method)) {
        entries.add(`${method.toUpperCase()} ${toHonoPath(path)}`);
      }
    }
  }
  return entries;
}

/** Build a set of "METHOD /path" strings from the live Hono app. */
function liveEntries(): Set<string> {
  const app = buildApp();
  return new Set(
    app.routes
      .filter((r) => r.method !== 'ALL')
      .map((r) => `${r.method} ${r.path}`),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OpenAPI spec parity', () => {
  it('every spec path+method has a live Hono handler', () => {
    const spec = specEntries();
    const live = liveEntries();

    const missing = [...spec].filter((entry) => !live.has(entry));
    expect(
      missing,
      `Spec documents these routes but no live handler is registered:\n  ${missing.join('\n  ')}`,
    ).toHaveLength(0);
  });

  it('navigator, applicant, and webhook live routes are all documented in the spec', () => {
    const spec = specEntries();
    const live = liveEntries();

    // Only check the routes this API owns — civic/legacy/snap-handoff routes
    // are intentionally excluded from the SNAP navigator spec.
    const ownedPrefixes = ['/navigator/', '/me/', '/webhooks/'];
    const undocumented = [...live].filter(
      (entry) =>
        ownedPrefixes.some((prefix) => entry.split(' ')[1]?.startsWith(prefix)) &&
        !spec.has(entry),
    );

    expect(
      undocumented,
      `Live routes missing from the spec:\n  ${undocumented.join('\n  ')}`,
    ).toHaveLength(0);
  });
});
