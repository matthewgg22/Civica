/**
 * Parse transactions from ebt.ca.gov transaction-history page.
 *
 * Strategy: row-oriented regex over `<tr>` blocks. Each row should contain
 * a posted-at date, a merchant string, and a debit/credit amount. Pagination
 * on the portal is offset-based (cursor = offset).
 *
 * IMPORTANT: Transaction history depth is a Phase-1 prereq (CMT-4 in plan).
 * The portal may return either:
 *   - 60-day window (rolling)
 *   - 10-txn cap (fixed)
 * `probe-authed.ts` measures actual behavior; this parser is conservative —
 * it parses whatever is returned and pages until the response is empty.
 */

import type { BrowserContext } from "playwright";
import type { Session, Transaction, TransactionPage } from "../../processor.js";
import { ScrapeErrorException } from "../../errors.js";
import { EBT_CA_BASE_URL } from "./login.js";
import { detectEbtCaErrors } from "./errors.js";

export const EBT_CA_TRANSACTIONS_PATH = "/cardholder/transactions";

/** Row-level regex. Wrapped in (?:<tr ... >...</tr>) to match block-by-block. */
export const TX_ROW_REGEX = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

/** Returns ISO-8601 or null. Portal date format is "MM/DD/YYYY" or "MM/DD/YYYY HH:MM AM/PM". */
export function parsePostedAt(cellText: string): string | null {
  const m = cellText.match(/([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}(?:\s+[0-9]{1,2}:[0-9]{2}\s*(?:AM|PM))?)/);
  if (!m) return null;
  const parsed = new Date(m[1]!);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/** "-$12.34" → -1234 (cents). "+$10.00" → 1000. Defaults to negative if no sign. */
export function parseTxAmountCents(cellText: string): number | null {
  const m = cellText.match(/([+-])?\s*\$\s*([0-9,]+\.[0-9]{2})/);
  if (!m) return null;
  const sign = m[1] === "+" ? 1 : -1;
  const num = parseFloat(m[2]!.replace(/,/g, ""));
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100) * sign;
}

export function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Stable external id: combines posted_at + amount + merchant. Portal doesn't
 * expose a stable transaction id, so we derive one for dedupe.
 */
export function deriveExternalId(postedAt: string, amountCents: number, merchant: string): string {
  return `${postedAt}|${amountCents}|${merchant.toLowerCase()}`;
}

/**
 * Pure-function form. Returns the transactions parseable from `html` and a
 * naive `nextCursor` heuristic (null if the row count is below the page size).
 */
export function parseTransactionsFromHtml(
  html: string,
  cursor: string | null,
  pageSize = 20,
): TransactionPage {
  const err = detectEbtCaErrors(html);
  if (err) {
    throw new ScrapeErrorException(err.code, err.message, err.context);
  }

  const items: Transaction[] = [];
  const rows = html.matchAll(TX_ROW_REGEX);

  for (const rowMatch of rows) {
    const rowHtml = rowMatch[1]!;
    // Split into cells. We don't need perfect TD parsing — cell ordering on
    // the portal is: date, description, amount (subject to PoC verification).
    const cellMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cellMatches.length < 3) continue;

    const dateCell = stripTags(cellMatches[0]![1]!);
    const descCell = stripTags(cellMatches[1]![1]!);
    const amountCell = stripTags(cellMatches[cellMatches.length - 1]![1]!);

    const postedAt = parsePostedAt(dateCell);
    const amountCents = parseTxAmountCents(amountCell);
    if (postedAt === null || amountCents === null) continue;

    const merchant = descCell;
    items.push({
      externalId: deriveExternalId(postedAt, amountCents, merchant),
      postedAt,
      amountCents,
      merchant,
      rawDescription: descCell,
    });
  }

  // Cursor scheme: offset-based. If we got fewer than pageSize rows, assume
  // last page. Real cursor format will be refined post-PoC.
  const nextCursor = items.length >= pageSize
    ? String((parseInt(cursor ?? "0", 10) || 0) + items.length)
    : null;

  return { items, nextCursor };
}

/** Live form — fetches the transactions page and parses. */
export async function parseEbtCaTransactions(
  context: BrowserContext,
  _session: Session,
  cursor: string | null,
): Promise<TransactionPage> {
  const page = await context.newPage();
  try {
    const offset = cursor !== null ? `?offset=${encodeURIComponent(cursor)}` : "";
    const url = `${EBT_CA_BASE_URL}${EBT_CA_TRANSACTIONS_PATH}${offset}`;
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    if (response && response.status() >= 400) {
      throw new ScrapeErrorException(
        "portalDown",
        `Portal returned ${response.status()} on transactions fetch.`,
      );
    }
    const html = await page.content();
    return parseTransactionsFromHtml(html, cursor);
  } finally {
    await page.close();
  }
}
