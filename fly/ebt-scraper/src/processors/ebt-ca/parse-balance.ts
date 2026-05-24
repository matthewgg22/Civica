/**
 * Parse balance from ebt.ca.gov post-login page.
 *
 * Strategy: regex over the HTML rather than full DOM walk. The portal's
 * formatting (jQuery-era table layout) drifts between releases; loose regex
 * over "$X.YY" with a "food benefits" / "cash benefits" label proximity
 * heuristic is more robust than a brittle CSS selector chain.
 *
 * PoC findings (poc/findings.md / findings-authed.md) will refine the
 * label phrasing if real HTML differs from the public-source guess.
 */

import type { BrowserContext } from "playwright";
import type { Balance, Session } from "../../processor.js";
import { EBT_CA_HOME_URL } from "./login.js";
import { assertBalancePageMarkers, detectEbtCaErrors } from "./errors.js";
import { throwAndCapture, DEFAULT_STATE, type ScrapeSentryTags } from "../../sentry-tags.js";

const TAGS_BALANCE: ScrapeSentryTags = {
  processor: "ebt-ca",
  state: DEFAULT_STATE,
  action: "balance",
};

const FOOD_LABEL_PATTERNS = [
  /food\s+(?:benefits|stamps|account)/i,
  /SNAP\s+balance/i,
  /CalFresh\s+balance/i,
];

const CASH_LABEL_PATTERNS = [
  /cash\s+(?:benefits|aid|account)/i,
  /CalWORKs\s+balance/i,
];

/** "$1,234.56" → 123456 (cents). Returns null if no parseable amount found. */
export function parseDollarAmountCents(input: string): number | null {
  const match = input.match(/\$\s*([0-9,]+\.[0-9]{2})/);
  if (!match) return null;
  const num = parseFloat(match[1]!.replace(/,/g, ""));
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100);
}

/**
 * Search for a dollar amount within a window of HTML *near* one of the label
 * patterns. Returns cents, or null if no match.
 */
export function findBalanceNearLabel(html: string, labelPatterns: RegExp[]): number | null {
  for (const pattern of labelPatterns) {
    const match = pattern.exec(html);
    if (!match) continue;
    // Look in the 500-char window following the label.
    const window = html.slice(match.index, match.index + 500);
    const cents = parseDollarAmountCents(window);
    if (cents !== null) return cents;
  }
  return null;
}

/** "Last updated: 5/22/2026 9:42 AM" or similar → ISO-8601, or null. */
export function parseLastUpdated(html: string): string | null {
  const m = html.match(/last\s+updated[:\s]+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}(?:\s+[0-9]{1,2}:[0-9]{2}\s*(?:AM|PM))?)/i);
  if (!m) return null;
  const parsed = new Date(m[1]!);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/**
 * Pure-function form — given an HTML snapshot, returns the parsed Balance or
 * throws ScrapeErrorException. Exported separately so unit tests can drive it
 * against fixture HTML without a real browser.
 */
export function parseBalanceFromHtml(html: string): Balance {
  const err = detectEbtCaErrors(html);
  if (err) {
    throwAndCapture(err.code, err.message, TAGS_BALANCE, err.context);
  }
  const marker = assertBalancePageMarkers(html);
  if (marker) {
    throwAndCapture(marker.code, marker.message, TAGS_BALANCE, marker.context);
  }

  const foodCents = findBalanceNearLabel(html, FOOD_LABEL_PATTERNS);
  const cashCents = findBalanceNearLabel(html, CASH_LABEL_PATTERNS);

  if (foodCents === null) {
    throwAndCapture(
      "parseError",
      "Could not locate food benefits balance.",
      TAGS_BALANCE,
    );
  }

  return {
    foodBalanceCents: foodCents,
    // Cash account is optional — many CalFresh-only recipients have no Cash Aid.
    cashBalanceCents: cashCents ?? 0,
    lastUpdatedAt: parseLastUpdated(html),
  };
}

/**
 * Live form — navigates the existing authenticated context to the home page
 * and parses the balance off the response HTML.
 */
export async function parseEbtCaBalance(
  context: BrowserContext,
  _session: Session,
): Promise<Balance> {
  const page = await context.newPage();
  try {
    const response = await page.goto(EBT_CA_HOME_URL, { waitUntil: "domcontentloaded" });
    if (response && response.status() >= 400) {
      throwAndCapture(
        "portalDown",
        `Portal returned ${response.status()} on balance fetch.`,
        TAGS_BALANCE,
      );
    }
    const html = await page.content();
    return parseBalanceFromHtml(html);
  } finally {
    await page.close();
  }
}
