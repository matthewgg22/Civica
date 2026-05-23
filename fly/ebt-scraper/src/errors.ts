/**
 * Typed scrape errors — wire format per plan §16.2.
 *
 * Codes MUST stay in lockstep with the iOS `EBTScrapeError` enum
 * (`Civica/Features/SNAP/EBTBalance/EBTScrapeError.swift`) and the gateway
 * error emitter in `apps/enrollment-api/src/routes/ebt/`. Three-point change
 * per plan §16.2: scraper emitter (here) → gateway emitter → iOS enum.
 */

export const SCRAPE_ERROR_CODES = [
  "networkTimeout",
  "portalDown",
  "sessionExpired",
  "captcha",
  "pinLocked",
  "cardClosed",
  "parseError",
] as const;

export type ScrapeErrorCode = (typeof SCRAPE_ERROR_CODES)[number];

export interface ScrapeError {
  code: ScrapeErrorCode;
  /** Human-safe message — gateway may overwrite with localized copy. */
  message: string;
  /** Optional raw signal (HTTP status, DOM snippet) — kept on server side; not forwarded to clients. */
  context?: Record<string, unknown>;
}

export class ScrapeErrorException extends Error {
  readonly code: ScrapeErrorCode;
  readonly context: Record<string, unknown> | undefined;

  constructor(code: ScrapeErrorCode, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "ScrapeErrorException";
    this.code = code;
    this.context = context;
  }

  toJSON(): ScrapeError {
    return {
      code: this.code,
      message: this.message,
      ...(this.context !== undefined ? { context: this.context } : {}),
    };
  }
}

export function isScrapeErrorCode(value: unknown): value is ScrapeErrorCode {
  return typeof value === "string" && (SCRAPE_ERROR_CODES as readonly string[]).includes(value);
}
