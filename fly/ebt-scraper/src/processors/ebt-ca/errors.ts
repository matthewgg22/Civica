/**
 * ebt.ca.gov-specific error detection.
 *
 * Detects in priority order:
 *   1. captcha (Cloudflare "verify you are human" or generic captcha widget)
 *   2. session expired (redirect to login or "session has expired" copy)
 *   3. PIN locked (text "PIN locked" or equivalent)
 *   4. card closed (text "card has been closed" or equivalent)
 *   5. parse error (none of above + expected DOM missing)
 *
 * Pure-function over an HTML snapshot — no DOM library required at this layer
 * (we use string contains + targeted regex). Keeps the unit tests trivial and
 * portable across portal versions.
 *
 * Selectors and copy strings are seeded from public-source observation. The
 * Lane B PoC (poc/probe.ts) will refine these against the live portal; expect
 * to revisit when PoC findings.md lands.
 */

import type { ScrapeError } from "../../errors.js";

const CAPTCHA_SIGNALS = [
  "verify you are human",
  "cf-challenge",
  "cf-turnstile",
  "g-recaptcha",
  "h-captcha",
  "challenge-running",
  "Just a moment...",
];

const SESSION_EXPIRED_SIGNALS = [
  "session has expired",
  "session expired",
  "please log in again",
  "your session has timed out",
  "id=\"loginForm\"", // implicit: redirected to login
  "name=\"cardNumber\"", // login form input
];

const PIN_LOCKED_SIGNALS = [
  "pin is locked",
  "pin locked",
  "PIN has been locked",
  "too many incorrect",
];

const CARD_CLOSED_SIGNALS = [
  "card has been closed",
  "card is closed",
  "card status: closed",
  "no longer active",
];

const PORTAL_DOWN_SIGNALS = [
  "service is currently unavailable",
  "temporarily unavailable",
  "scheduled maintenance",
  "503 Service Unavailable",
];

/** Markers that mean "we got a real authenticated page" — used by parsers to assert success. */
export const EXPECTED_BALANCE_MARKERS = [
  "food benefits", // typical label on portal balance page
  "cash benefits",
  "available balance",
];

export function detectEbtCaErrors(html: string): ScrapeError | null {
  const lower = html.toLowerCase();

  if (anyMatch(html, CAPTCHA_SIGNALS) || anyMatch(lower, CAPTCHA_SIGNALS.map((s) => s.toLowerCase()))) {
    return {
      code: "captcha",
      message: "Portal returned a captcha or anti-bot challenge.",
    };
  }

  if (anyMatch(html, PORTAL_DOWN_SIGNALS) || anyMatch(lower, PORTAL_DOWN_SIGNALS.map((s) => s.toLowerCase()))) {
    return {
      code: "portalDown",
      message: "EBT portal is currently unavailable.",
    };
  }

  if (anyMatch(html, SESSION_EXPIRED_SIGNALS) || anyMatch(lower, SESSION_EXPIRED_SIGNALS.map((s) => s.toLowerCase()))) {
    return {
      code: "sessionExpired",
      message: "Your EBT card link has expired. Please re-link to continue.",
    };
  }

  if (anyMatch(lower, PIN_LOCKED_SIGNALS.map((s) => s.toLowerCase()))) {
    return {
      code: "pinLocked",
      message: "PIN is locked after too many incorrect attempts. Contact EBT customer service.",
    };
  }

  if (anyMatch(lower, CARD_CLOSED_SIGNALS.map((s) => s.toLowerCase()))) {
    return {
      code: "cardClosed",
      message: "This EBT card has been closed. Contact your county SNAP office.",
    };
  }

  return null;
}

/**
 * Convenience: returns parseError if the HTML doesn't contain at least one of
 * the expected balance-page markers. Use AFTER `detectEbtCaErrors` returns null.
 */
export function assertBalancePageMarkers(html: string): ScrapeError | null {
  const lower = html.toLowerCase();
  for (const marker of EXPECTED_BALANCE_MARKERS) {
    if (lower.includes(marker.toLowerCase())) return null;
  }
  return {
    code: "parseError",
    message: "Balance page DOM did not match expected markers.",
  };
}

function anyMatch(haystack: string, needles: string[]): boolean {
  for (const n of needles) {
    if (haystack.includes(n)) return true;
  }
  return false;
}
