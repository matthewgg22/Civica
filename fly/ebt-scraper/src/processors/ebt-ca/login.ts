/**
 * ebt.ca.gov login flow.
 *
 * Two paths supported:
 *   1. Cookie handoff (production / D4) — iOS WebView already authenticated
 *      the user; we receive `cookieHandoff` from the gateway. We import those
 *      cookies into a fresh BrowserContext, navigate to the portal home, and
 *      verify the session is live (not redirected to login). PIN never touches
 *      this server.
 *   2. Card + PIN (PoC only) — `probe-authed.ts` runs Matthew's test card
 *      through the actual login form to measure session lifetime. Not used in
 *      production; gated by `input.pin !== undefined`.
 *
 * URLs + selectors are seeded from public observation; PoC findings will
 * refine these before we ship the production code path.
 */

import type { Browser } from "playwright";
import type { LoginInput, Session, SessionCookie } from "../../processor.js";
import { ScrapeErrorException } from "../../errors.js";
import { detectEbtCaErrors } from "./errors.js";

export const EBT_CA_BASE_URL = "https://www.ebt.ca.gov";
export const EBT_CA_HOME_URL = `${EBT_CA_BASE_URL}/cardholder/`;
export const EBT_CA_LOGIN_URL = `${EBT_CA_BASE_URL}/cardholder/login`;

/**
 * Selector / form-field names — to be confirmed by PoC. Keep these in one
 * place so updates after PoC findings.md don't sprawl.
 */
export const EBT_CA_SELECTORS = {
  cardNumberInput: 'input[name="cardNumber"]',
  pinInput: 'input[name="pin"]',
  submitButton: 'button[type="submit"], input[type="submit"]',
  // Heuristic: balance-page assertion happens via text marker, not a selector,
  // since the portal HTML drifts.
} as const;

export async function loginEbtCa(browser: Browser, input: LoginInput): Promise<Session> {
  if (input.cookieHandoff && input.cookieHandoff.length > 0) {
    return verifyCookieHandoff(browser, input.cookieHandoff);
  }
  if (input.pin) {
    return cardAndPinLogin(browser, input);
  }
  throw new ScrapeErrorException(
    "sessionExpired",
    "No session cookies and no PIN provided — cannot authenticate.",
  );
}

/**
 * Production path: verify the cookies we received from iOS WebView are still
 * valid. If the portal redirects us to login, the session is expired.
 */
// iPhone 15 UA — ebt.ca.gov WAF blocks HeadlessChrome but passes mobile Safari.
export const IPHONE_CONTEXT = {
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  viewport: { width: 390, height: 844 },
  locale: "en-US",
  timezoneId: "America/Los_Angeles",
} as const;

async function verifyCookieHandoff(
  browser: Browser,
  cookieHandoff: SessionCookie[],
): Promise<Session> {
  const context = await browser.newContext(IPHONE_CONTEXT);
  try {
    await context.addCookies(cookieHandoff);
    const page = await context.newPage();
    const response = await page.goto(EBT_CA_HOME_URL, { waitUntil: "domcontentloaded" });

    const finalUrl = page.url();
    if (response && response.status() >= 400) {
      throw new ScrapeErrorException(
        "portalDown",
        `Portal returned ${response.status()} on session verify.`,
      );
    }
    if (finalUrl.includes("/login")) {
      throw new ScrapeErrorException(
        "sessionExpired",
        "Cookie handoff did not produce an authenticated session.",
      );
    }

    const html = await page.content();
    const err = detectEbtCaErrors(html);
    if (err) {
      throw new ScrapeErrorException(err.code, err.message, err.context);
    }

    const cookies = await context.cookies();
    return {
      cookies,
      expiresAt: inferEarliestExpiry(cookies),
      rememberMeCookieName: findRememberMeCookie(cookies),
    };
  } finally {
    await context.close();
  }
}

/**
 * PoC-only path: drive the actual login form. Runs in probe-authed.ts to
 * measure JSESSIONID TTL + "remember me" cookie presence. Never runs in
 * production (gateway never sends a PIN to this server).
 */
async function cardAndPinLogin(browser: Browser, input: LoginInput): Promise<Session> {
  const context = await browser.newContext(IPHONE_CONTEXT);
  try {
    const page = await context.newPage();
    await page.goto(EBT_CA_LOGIN_URL, { waitUntil: "domcontentloaded" });

    // Pre-flight: did we land on a captcha?
    const preHtml = await page.content();
    const preErr = detectEbtCaErrors(preHtml);
    if (preErr) {
      throw new ScrapeErrorException(preErr.code, preErr.message, preErr.context);
    }

    await page.fill(EBT_CA_SELECTORS.cardNumberInput, input.card);
    if (!input.pin) {
      throw new ScrapeErrorException("sessionExpired", "PIN required for credentialed login path.");
    }
    await page.fill(EBT_CA_SELECTORS.pinInput, input.pin);
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.click(EBT_CA_SELECTORS.submitButton),
    ]);

    const postHtml = await page.content();
    const postErr = detectEbtCaErrors(postHtml);
    if (postErr) {
      throw new ScrapeErrorException(postErr.code, postErr.message, postErr.context);
    }

    const cookies = await context.cookies();
    return {
      cookies,
      expiresAt: inferEarliestExpiry(cookies),
      rememberMeCookieName: findRememberMeCookie(cookies),
    };
  } finally {
    await context.close();
  }
}

/** Returns the earliest non-session cookie expiry as ISO-8601, or null. */
export function inferEarliestExpiry(cookies: SessionCookie[]): string | null {
  let earliest: number | null = null;
  for (const c of cookies) {
    if (c.expires > 0) {
      if (earliest === null || c.expires < earliest) earliest = c.expires;
    }
  }
  if (earliest === null) return null;
  return new Date(earliest * 1000).toISOString();
}

/**
 * Identify a likely "remember me" cookie — long-lived (>7d), non-session.
 * Used by gateway to schedule re-link prompts BEFORE the session dies.
 */
export function findRememberMeCookie(cookies: SessionCookie[]): string | null {
  const now = Math.floor(Date.now() / 1000);
  const sevenDays = 7 * 24 * 60 * 60;
  for (const c of cookies) {
    if (c.expires > 0 && c.expires - now > sevenDays) {
      return c.name;
    }
  }
  return null;
}
