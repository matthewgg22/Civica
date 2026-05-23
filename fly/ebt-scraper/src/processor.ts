/**
 * Processor interface — one implementation per EBT portal.
 *
 * Why an interface (and not a class hierarchy): each processor's portal differs
 * enough that a class hierarchy would be cargo-culted (CA's portal looks nothing
 * like a hypothetical FIS direct API). The interface keeps each processor a
 * self-contained module under `src/processors/<name>/`.
 *
 * See plan §16.4 for the extension recipe.
 */

import type { Browser, BrowserContext } from "playwright";
import type { ScrapeError } from "./errors.js";

/**
 * Session state returned by `login()`. Cookie-only — PINs never persist here
 * (per plan D4 / CMT-1).
 */
export interface Session {
  /** Cookie jar payload — Playwright `BrowserContext.cookies()` shape. */
  cookies: SessionCookie[];
  /** Server-side hint at when the session likely expires; refined by probe. */
  expiresAt: string | null;
  /** Optional long-lived "remember me" cookie name, if present. */
  rememberMeCookieName: string | null;
}

export interface SessionCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number; // unix seconds; -1 for session cookies
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None" | undefined;
}

/**
 * Login inputs. `card` is the 16-digit card number; `pin` is ONLY supplied by
 * the PoC `probe-authed.ts` runner. In production, `pin` is undefined and we
 * use the cookie handoff from the iOS WebView (per D4).
 */
export interface LoginInput {
  card: string;
  pin?: string;
  cookieHandoff?: SessionCookie[];
}

/** Normalized balance — matches iOS `EBTAccount` shape. */
export interface Balance {
  foodBalanceCents: number;
  cashBalanceCents: number;
  /** ISO-8601 timestamp from portal; null if portal omits it. */
  lastUpdatedAt: string | null;
}

/** Normalized transaction — matches iOS `EBTTransaction` shape. */
export interface Transaction {
  /** Stable id derived from portal (e.g., `<posted_at>:<amount>:<merchant>`) — used for dedupe. */
  externalId: string;
  postedAt: string; // ISO-8601
  amountCents: number;
  merchant: string;
  /** Raw portal description, before merchant-string normalization. */
  rawDescription: string;
}

export interface TransactionPage {
  items: Transaction[];
  nextCursor: string | null;
}

/**
 * The Processor contract every portal adapter must satisfy.
 *
 * Each method takes an isolated `BrowserContext` so concurrent scrapes on the
 * same Fly machine don't share cookies. Implementations should be:
 *   - DOM-tolerant (portal HTML drifts; use loose selectors + assertions)
 *   - error-precise (throw `ScrapeErrorException` with the right code; the
 *     dispatcher fans those out as typed events per plan §16.2)
 */
export interface Processor {
  /** Unique processor id used in `ebt_cards.processor` enum. */
  readonly id: string;

  login(browser: Browser, input: LoginInput): Promise<Session>;
  parseBalance(context: BrowserContext, session: Session): Promise<Balance>;
  parseTransactions(
    context: BrowserContext,
    session: Session,
    cursor: string | null,
  ): Promise<TransactionPage>;

  /**
   * Pure-function error detector — given an HTML snapshot, returns a typed
   * error if the page is an error state, else null. Called by the dispatcher
   * before every parse step; lets us classify portal-down / captcha / etc
   * without each parser duplicating detection logic.
   */
  detectErrors(html: string): ScrapeError | null;
}
