/**
 * POST/DELETE /ebt/lock — Phase 1 graceful stub (CA card-lock unavailable).
 *
 * California's EBT processor does not currently expose a card-lock API to
 * third parties. Per §5 Phase 1 + Q8.2, this route ships a 501 stub with
 * CA-specific copy that deep-links the recipient to ebt.ca.gov for the
 * official portal-managed lock.
 *
 * Phase 2 (T19): wire real lock once a processor exposes it. iOS handles
 * the 501 via the typed EBTScrapeError decoder — the `cardLockUnsupported`
 * code drives "Coming soon to your state" banner copy.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { requireApplicant } from '../../lib/auth.js';
import {
  EBT_SCRAPE_ERROR_DEFAULT_STATUS,
  emitScrapeError,
} from '../../lib/ebt-scrape-error.js';
import type { Env } from '../../types.js';

const app = new Hono<{ Bindings: Env }>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unsupportedResponse(c: Context<any>) {
  const requestId = (c.get('requestId') as string | undefined) ?? undefined;
  const body = emitScrapeError(
    'cardLockUnsupported',
    'Card lock not yet available in California. Use the ebt.ca.gov portal for now.',
    'open_url',
    'https://www.ebt.ca.gov/',
    'https://help.civica.app/ebt/card-lock',
    requestId,
  );
  return c.json(body, EBT_SCRAPE_ERROR_DEFAULT_STATUS.cardLockUnsupported as 501);
}

app.post('/', async (c) => {
  requireApplicant(c.get('actor').kind);
  return unsupportedResponse(c);
});

app.delete('/', async (c) => {
  requireApplicant(c.get('actor').kind);
  return unsupportedResponse(c);
});

export default app;
