/**
 * EBT scrape-error wire format (T8 / §16.2).
 *
 * Mirrors the iOS Swift `EBTScrapeError` enum (Lane C). When the gateway
 * surfaces a scrape failure to the iOS app, the body MUST match this shape
 * so the typed decoder on the client can drive per-variant banner copy
 * and CTA behavior:
 *
 *   {
 *     "error": {
 *       "type": "ebt_scrape_error",
 *       "code": "sessionExpired",
 *       "message": "Your EBT card link has expired. Please re-link to continue.",
 *       "cta":  { "kind": "re_link", "target": "civica://ebt/link" },
 *       "doc_url": "https://help.civica.app/ebt/re-link"
 *     },
 *     "request_id": "req_abc123"
 *   }
 *
 * Adding a new variant is a three-point change:
 *   1. add the code to `EBTScrapeErrorCode` here,
 *   2. add the case to the iOS Swift enum,
 *   3. add EN+ES banner copy (parity test catches forgotten ES).
 */

/**
 * Closed enum of scrape-error codes. Codes match the iOS `EBTScrapeError`
 * enum exactly — adding here without the iOS counterpart will silently
 * fall through the iOS decoder's default case.
 */
export const EBT_SCRAPE_ERROR_CODES = [
  'networkTimeout',
  'portalDown',
  'sessionExpired',
  'captcha',
  'pinLocked',
  'cardClosed',
  'parseError',
  'cardLockUnsupported',
] as const;

export type EBTScrapeErrorCode = (typeof EBT_SCRAPE_ERROR_CODES)[number];

/**
 * CTA kinds the iOS banner can render. `target` semantics depend on kind:
 *   - `re_link`  → universal link / deep link to the in-app WebView
 *   - `retry`   → re-issue the failed request
 *   - `open_url` → open `target` in the system browser (used for cardLockUnsupported)
 *   - `contact_support` → mailto: or tel: link
 */
export const EBT_SCRAPE_ERROR_CTA_KINDS = [
  're_link',
  'retry',
  'open_url',
  'contact_support',
] as const;

export type EBTScrapeErrorCtaKind = (typeof EBT_SCRAPE_ERROR_CTA_KINDS)[number];

export interface EBTScrapeErrorCta {
  kind: EBTScrapeErrorCtaKind;
  target: string;
}

export interface EBTScrapeErrorPayload {
  type: 'ebt_scrape_error';
  code: EBTScrapeErrorCode;
  message: string;
  cta?: EBTScrapeErrorCta;
  doc_url?: string;
}

export interface EBTScrapeErrorBody {
  error: EBTScrapeErrorPayload;
  request_id?: string;
}

/**
 * Build a wire-format scrape-error body. Pass `requestId` from the Hono
 * context's `requestId` variable so a recipient reporting an error gives
 * the team the exact string to grep Sentry with.
 *
 * The default mapping below maps each enum case → http status. Callers can
 * still pass any status when emitting via `c.json(emit..., status)`.
 */
export function emitScrapeError(
  code: EBTScrapeErrorCode,
  message: string,
  ctaKind?: EBTScrapeErrorCtaKind,
  ctaTarget?: string,
  docUrl?: string,
  requestId?: string,
): EBTScrapeErrorBody {
  const payload: EBTScrapeErrorPayload = {
    type: 'ebt_scrape_error',
    code,
    message,
  };
  if (ctaKind && ctaTarget) {
    payload.cta = { kind: ctaKind, target: ctaTarget };
  }
  if (docUrl) {
    payload.doc_url = docUrl;
  }
  const body: EBTScrapeErrorBody = { error: payload };
  if (requestId) body.request_id = requestId;
  return body;
}

/**
 * Default HTTP status per error code. Routes can override but using this
 * map keeps client retry/backoff logic stable across variants.
 *
 *   networkTimeout       — 504 (upstream timed out)
 *   portalDown           — 502 (bad upstream)
 *   sessionExpired       — 401 (re-link required)
 *   captcha              — 503 (degraded; recipient should try later)
 *   pinLocked            — 423 (locked — distinct so iOS can show locked-PIN copy)
 *   cardClosed           — 410 (gone; recipient must call state)
 *   parseError           — 502 (we couldn't parse what came back)
 *   cardLockUnsupported  — 501 (not implemented in this state yet)
 */
export const EBT_SCRAPE_ERROR_DEFAULT_STATUS: Record<EBTScrapeErrorCode, number> = {
  networkTimeout: 504,
  portalDown: 502,
  sessionExpired: 401,
  captcha: 503,
  pinLocked: 423,
  cardClosed: 410,
  parseError: 502,
  cardLockUnsupported: 501,
};
