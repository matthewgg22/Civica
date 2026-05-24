/**
 * Sentry tag helpers — every captureException in the scraper goes through these
 * so we can build metric alerts in the Sentry UI keyed on tag values.
 *
 * Tag schema (locked by /plan-eng-review T6):
 *   scrape.code       — ScrapeErrorException code, or "unknown" for unexpected throws
 *   scrape.processor  — registered processor id (e.g. "ebt-ca")
 *   scrape.state      — two-letter state code; "CA" for now (single-state launch)
 *   scrape.action     — "balance" | "transactions" | "full" | "probe"
 *
 * Why a helper instead of inlining `Sentry.withScope` everywhere: keeps the
 * tag-name strings in ONE place, and makes the "every throw also captures"
 * pattern below a single function call instead of 12 copies.
 *
 * See docs/sentry-alerts.md for how the tags drive the Slack alert.
 */

import * as Sentry from "@sentry/node";
import { ScrapeErrorException, isScrapeErrorCode } from "./errors.js";

export type ScrapeActionTag = "balance" | "transactions" | "full" | "probe";

export interface ScrapeSentryTags {
  /** Processor id from the registry, e.g. "ebt-ca". */
  processor: string;
  /** Two-letter state code. CA only at launch. */
  state: string;
  /** Which stage of the pipeline the error fired in. */
  action: ScrapeActionTag;
}

/**
 * Capture an exception to Sentry with the scrape.* tags applied.
 *
 * For `ScrapeErrorException`, `scrape.code` is set to the error's code. For
 * any other throw, it defaults to "unknown" so the metric alert can split
 * "we threw a typed code" vs "we crashed with an unexpected error" cleanly.
 */
export function captureScrapeException(err: unknown, tags: ScrapeSentryTags): void {
  Sentry.withScope((scope) => {
    scope.setTag("scrape.processor", tags.processor);
    scope.setTag("scrape.state", tags.state);
    scope.setTag("scrape.action", tags.action);

    let code = "unknown";
    if (err instanceof ScrapeErrorException) {
      code = err.code;
    } else if (typeof err === "object" && err !== null && "code" in err) {
      const c = (err as { code: unknown }).code;
      if (isScrapeErrorCode(c)) code = c;
    }
    scope.setTag("scrape.code", code);

    Sentry.captureException(err);
  });
}

/**
 * Throw a `ScrapeErrorException` AND mirror it to Sentry with the scrape.* tags.
 *
 * Use everywhere we'd otherwise write `throw new ScrapeErrorException(...)` —
 * lets the metric alert fire on parser-internal errors that get caught + remapped
 * by the gateway, not just unhandled crashes that reach the /scrape catch block.
 */
export function throwAndCapture(
  code: import("./errors.js").ScrapeErrorCode,
  message: string,
  tags: ScrapeSentryTags,
  context?: Record<string, unknown>,
): never {
  const err = new ScrapeErrorException(code, message, context);
  captureScrapeException(err, tags);
  throw err;
}

/** Default state code — single-state launch (CA). Pull from env if/when we add another state. */
export const DEFAULT_STATE = "CA";
