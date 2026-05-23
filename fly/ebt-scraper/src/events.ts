/**
 * Outbound webhook emitter: scraper → gateway `/webhooks/ebt-scraper`.
 *
 * Each event is HMAC-signed with `GATEWAY_WEBHOOK_SECRET`. The gateway verifies
 * (mirror of the inbound verify in `src/server.ts`) and fans out side-effects:
 *   - balance_updated     → updates `ebt_cards.balance_cents + balance_at`
 *   - transactions_updated → upserts into `ebt_transactions`
 *   - session_expired     → triggers APNs "please re-link" push
 *   - captcha             → ops alert; backs off scrape attempts for that card
 *   - parse_error         → Sentry + ops alert; does NOT push to recipient
 *   - portal_down         → ops alert; back off scrape attempts globally
 */

import { createHmac } from "node:crypto";
import type { Balance, Transaction } from "./processor.js";
import type { ScrapeError } from "./errors.js";

export type WebhookEventType =
  | "balance_updated"
  | "transactions_updated"
  | "session_expired"
  | "captcha"
  | "parse_error"
  | "portal_down";

export interface WebhookEvent {
  type: WebhookEventType;
  /** Civica internal card id; opaque to scraper. */
  cardId: string;
  /** Processor id (e.g., "ebt-ca"). */
  processor: string;
  /** ISO-8601 timestamp when scraper emitted the event. */
  emittedAt: string;
  payload: Record<string, unknown>;
}

export interface EmitContext {
  gatewayUrl: string;
  secret: string;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Sign + POST an event to the gateway webhook. Returns the gateway's response
 * status; does NOT retry on its own (Fly machine-level retries handled by the
 * caller — typically the queue consumer).
 */
export async function emitEvent(
  ctx: EmitContext,
  event: WebhookEvent,
): Promise<{ status: number; body: string }> {
  const body = JSON.stringify(event);
  const signature = signPayload(body, ctx.secret);
  const fetcher = ctx.fetchImpl ?? fetch;

  const res = await fetcher(ctx.gatewayUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-scraper-signature": signature,
    },
    body,
  });

  const text = await res.text();
  return { status: res.status, body: text };
}

export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience constructors — call site stays readable
// ─────────────────────────────────────────────────────────────────────────────

export function balanceUpdated(
  cardId: string,
  processor: string,
  balance: Balance,
): WebhookEvent {
  return {
    type: "balance_updated",
    cardId,
    processor,
    emittedAt: new Date().toISOString(),
    payload: { balance },
  };
}

export function transactionsUpdated(
  cardId: string,
  processor: string,
  transactions: Transaction[],
  nextCursor: string | null,
): WebhookEvent {
  return {
    type: "transactions_updated",
    cardId,
    processor,
    emittedAt: new Date().toISOString(),
    payload: { transactions, nextCursor },
  };
}

export function scrapeError(
  cardId: string,
  processor: string,
  error: ScrapeError,
): WebhookEvent {
  const type: WebhookEventType =
    error.code === "sessionExpired" ? "session_expired"
    : error.code === "captcha" ? "captcha"
    : error.code === "portalDown" ? "portal_down"
    : "parse_error";

  return {
    type,
    cardId,
    processor,
    emittedAt: new Date().toISOString(),
    payload: { error },
  };
}
