/**
 * Dispatcher — routes inbound `/scrape` requests to the correct processor.
 *
 * Why this lives in its own module: the dispatcher is the registry of supported
 * processors, and registering a new processor is a single-file edit here per
 * plan §16.4. Server.ts stays unaware of which processors exist.
 */

import type { Browser } from "playwright";
import { chromium as playwrightChromium } from "playwright";
import { chromium as stealthChromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { LoginInput, Processor, SessionCookie } from "./processor.js";
import { ScrapeErrorException } from "./errors.js";
import { ebtCaProcessor } from "./processors/ebt-ca/index.js";

// Apply stealth patches: spoofs ~12 Chromium fingerprinting signals that Akamai
// and Cloudflare use to detect headless browsers (TLS JA3, navigator.webdriver,
// chrome runtime, permissions API, plugin list, etc).
stealthChromium.use(StealthPlugin());

/** Registered processors keyed by id. Add a new entry here when shipping one. */
const REGISTRY: Record<string, Processor> = {
  "ebt-ca": ebtCaProcessor,
};

export type ScrapeAction = "balance" | "transactions" | "full";

export interface ScrapeRequest {
  processor: string;
  cardId: string;
  action: ScrapeAction;
  login: LoginInput;
  /** For paginated transactions; null/absent on first page. */
  cursor?: string | null;
}

export interface ScrapeResult {
  processor: string;
  cardId: string;
  action: ScrapeAction;
  /** Populated when action is "balance" or "full". */
  balance?: import("./processor.js").Balance;
  /** Populated when action is "transactions" or "full". */
  transactions?: import("./processor.js").Transaction[];
  nextCursor?: string | null;
  /** Session cookies returned by login — gateway may persist refreshed cookies. */
  session: {
    cookies: SessionCookie[];
    expiresAt: string | null;
    rememberMeCookieName: string | null;
  };
}

export function getProcessor(id: string): Processor {
  const processor = REGISTRY[id];
  if (!processor) {
    throw new ScrapeErrorException(
      "portalDown",
      `Unknown processor: ${id}`,
      { available: Object.keys(REGISTRY) },
    );
  }
  return processor;
}

/**
 * Run a single scrape end-to-end. Caller owns the Browser lifecycle so a
 * single Fly machine can multiplex N parallel scrapes against one Chromium.
 */
export async function runScrape(
  browser: Browser,
  request: ScrapeRequest,
): Promise<ScrapeResult> {
  const processor = getProcessor(request.processor);
  const session = await processor.login(browser, request.login);

  const context = await browser.newContext();
  try {
    await context.addCookies(session.cookies);

    let balance: import("./processor.js").Balance | undefined;
    let transactions: import("./processor.js").Transaction[] | undefined;
    let nextCursor: string | null | undefined;

    if (request.action === "balance" || request.action === "full") {
      balance = await processor.parseBalance(context, session);
    }

    if (request.action === "transactions" || request.action === "full") {
      const page = await processor.parseTransactions(context, session, request.cursor ?? null);
      transactions = page.items;
      nextCursor = page.nextCursor;
    }

    return {
      processor: request.processor,
      cardId: request.cardId,
      action: request.action,
      ...(balance !== undefined ? { balance } : {}),
      ...(transactions !== undefined ? { transactions } : {}),
      ...(nextCursor !== undefined ? { nextCursor } : {}),
      session: {
        cookies: session.cookies,
        expiresAt: session.expiresAt,
        rememberMeCookieName: session.rememberMeCookieName,
      },
    };
  } finally {
    await context.close();
  }
}

/**
 * Convenience for the HTTP handler: launches a browser, runs one scrape,
 * tears down. Use `runScrape` directly if you're batching multiple scrapes
 * inside one machine invocation.
 */
export async function runStandaloneScrape(request: ScrapeRequest): Promise<ScrapeResult> {
  // Use stealth chromium to bypass Akamai bot detection on ebt.ca.gov.
  // Falls back to plain chromium if stealth launch fails (defensive).
  let browser: Browser;
  try {
    browser = await stealthChromium.launch({ headless: true }) as Browser;
  } catch {
    browser = await playwrightChromium.launch({ headless: true });
  }
  try {
    return await runScrape(browser, request);
  } finally {
    await browser.close();
  }
}

export function registeredProcessors(): string[] {
  return Object.keys(REGISTRY);
}
