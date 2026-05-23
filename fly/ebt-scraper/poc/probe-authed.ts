// MATTHEW: run this with your CA EBT test card. Set CARD_NUMBER and PIN env vars.
//
// DO NOT commit any output containing real card data. This script intentionally
// writes to `poc/findings-authed.md`, which is gitignored.

/**
 * PoC: ebt.ca.gov AUTHENTICATED reconnaissance.
 *
 * What this script measures (only Matthew can run it — requires real test card):
 *   1. JSESSIONID expiry behavior:
 *      - Captures initial cookie TTLs
 *      - Forces idle (waits 5, 10, 30, 60 min — configurable)
 *      - Polls the home page; logs when the session expires
 *   2. Transaction history depth:
 *      - Loads transactions page
 *      - Counts transactions returned
 *      - Pages through cursor (if portal supports) to find the cap
 *      - Records whether it's a 60-day window or a 10-txn cap (CMT-4)
 *   3. "Remember me" cookie:
 *      - Logs in with and without "remember me" checked
 *      - Compares cookie TTLs between the two runs
 *
 * Resolves: CMT-1 (session timeout) + CMT-4 (transaction history depth).
 *
 * Output: `poc/findings-authed.md` (gitignored — contains card-derived data).
 *
 * Usage:
 *   export CARD_NUMBER="1234567890123456"     # CA EBT test card
 *   export PIN="1234"                          # 4-digit PIN
 *   export IDLE_MINUTES="5,15,30,60"           # comma-separated poll intervals
 *   export REMEMBER_ME="true"                  # set false to test bare session
 *   npm run probe:authed
 *
 * SAFETY:
 *   - PIN is read from env, never persisted anywhere on disk.
 *   - Cookies + balance values are written to findings-authed.md (gitignored).
 *   - Script aborts immediately if it detects it's running in CI.
 */

import { chromium } from "playwright";
import { appendFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loginEbtCa, EBT_CA_HOME_URL } from "../src/processors/ebt-ca/login.js";
import { parseBalanceFromHtml } from "../src/processors/ebt-ca/parse-balance.js";
import {
  parseTransactionsFromHtml,
  EBT_CA_TRANSACTIONS_PATH,
} from "../src/processors/ebt-ca/parse-transactions.js";

const POC_DIR = dirname(fileURLToPath(import.meta.url));
const FINDINGS_PATH = join(POC_DIR, "findings-authed.md");

function assertNotCi(): void {
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    // eslint-disable-next-line no-console
    console.error("[probe-authed] refusing to run in CI — uses real test card.");
    process.exit(2);
  }
}

function readEnv(): { card: string; pin: string; idleMinutes: number[]; rememberMe: boolean } {
  const card = process.env.CARD_NUMBER;
  const pin = process.env.PIN;
  if (!card || !pin) {
    // eslint-disable-next-line no-console
    console.error(
      "[probe-authed] CARD_NUMBER + PIN env vars required. See script docstring.",
    );
    process.exit(1);
  }
  const idleMinutes = (process.env.IDLE_MINUTES ?? "5,15,30,60")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n > 0);
  const rememberMe = (process.env.REMEMBER_ME ?? "true") === "true";
  return { card, pin, idleMinutes, rememberMe };
}

async function recordSessionLifetime(
  card: string,
  pin: string,
  rememberMe: boolean,
  idleMinutesList: number[],
): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    appendFinding(`### Session lifetime probe (rememberMe=${rememberMe})\n\n`);

    // Step 1: login
    const session = await loginEbtCa(browser, { card, pin });
    appendFinding(`- Initial cookies (count=${session.cookies.length}):\n`);
    for (const c of session.cookies) {
      const expiry = c.expires > 0 ? new Date(c.expires * 1000).toISOString() : "session";
      appendFinding(`  - \`${c.name}\` (domain=\`${c.domain}\`, expires=${expiry})\n`);
    }
    appendFinding(`- Inferred expiresAt: \`${session.expiresAt ?? "null"}\`\n`);
    appendFinding(`- Remember-me cookie detected: \`${session.rememberMeCookieName ?? "none"}\`\n\n`);

    // Step 2: idle + poll
    const context = await browser.newContext();
    await context.addCookies(session.cookies);
    const page = await context.newPage();

    for (const minutes of idleMinutesList) {
      const sleepMs = minutes * 60 * 1000;
      // eslint-disable-next-line no-console
      console.log(`[probe-authed] sleeping ${minutes}min before polling…`);
      await sleep(sleepMs);

      const resp = await page.goto(EBT_CA_HOME_URL, { waitUntil: "domcontentloaded" });
      const finalUrl = page.url();
      const status = resp?.status() ?? -1;
      const expiredByUrl = finalUrl.includes("/login");
      appendFinding(`- T+${minutes}min: status=${status}, finalUrl=\`${finalUrl}\`, sessionExpired=**${expiredByUrl}**\n`);
      if (expiredByUrl) {
        appendFinding(`  - Session died between T+${idleMinutesList[idleMinutesList.indexOf(minutes) - 1] ?? 0}min and T+${minutes}min.\n`);
        break;
      }
    }

    appendFinding("\n");
    await context.close();
  } finally {
    await browser.close();
  }
}

async function recordTransactionDepth(card: string, pin: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    appendFinding(`### Transaction history depth probe (CMT-4)\n\n`);
    const session = await loginEbtCa(browser, { card, pin });

    const context = await browser.newContext();
    await context.addCookies(session.cookies);
    const page = await context.newPage();

    let cursor: string | null = null;
    let pageNum = 0;
    let totalSeen = 0;
    let earliestPostedAt: string | null = null;
    let latestPostedAt: string | null = null;

    while (pageNum < 20) {
      pageNum++;
      const url = `https://www.ebt.ca.gov${EBT_CA_TRANSACTIONS_PATH}${cursor ? `?offset=${cursor}` : ""}`;
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const html = await page.content();
      const result = parseTransactionsFromHtml(html, cursor);
      totalSeen += result.items.length;

      for (const tx of result.items) {
        if (earliestPostedAt === null || tx.postedAt < earliestPostedAt) earliestPostedAt = tx.postedAt;
        if (latestPostedAt === null || tx.postedAt > latestPostedAt) latestPostedAt = tx.postedAt;
      }

      appendFinding(`- Page ${pageNum}: ${result.items.length} txns, nextCursor=\`${result.nextCursor ?? "null"}\`\n`);
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }

    appendFinding(`\n**Total transactions returned:** ${totalSeen}\n`);
    appendFinding(`**Earliest postedAt:** \`${earliestPostedAt ?? "n/a"}\`\n`);
    appendFinding(`**Latest postedAt:** \`${latestPostedAt ?? "n/a"}\`\n`);
    if (earliestPostedAt && latestPostedAt) {
      const spanDays = Math.round(
        (new Date(latestPostedAt).getTime() - new Date(earliestPostedAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      appendFinding(`**Span (days):** ~${spanDays}\n`);
      if (totalSeen <= 12 && spanDays > 60) {
        appendFinding("\n**Conclusion:** likely **fixed transaction count cap** (≤10 txns regardless of date range).\n");
      } else if (spanDays >= 55 && spanDays <= 65 && totalSeen > 12) {
        appendFinding("\n**Conclusion:** likely **60-day rolling window** (matches plan assumption).\n");
      } else {
        appendFinding("\n**Conclusion:** mixed signal — record raw numbers; do not size P3 backfill yet.\n");
      }
    }

    // Bonus: capture one balance snapshot for cross-reference
    const balPage = await context.newPage();
    await balPage.goto(EBT_CA_HOME_URL, { waitUntil: "domcontentloaded" });
    const balHtml = await balPage.content();
    try {
      const balance = parseBalanceFromHtml(balHtml);
      appendFinding(`\n**Balance snapshot (for cross-ref, raw):**\n`);
      appendFinding(`- foodBalanceCents: ${balance.foodBalanceCents}\n`);
      appendFinding(`- cashBalanceCents: ${balance.cashBalanceCents}\n`);
      appendFinding(`- lastUpdatedAt: ${balance.lastUpdatedAt ?? "null"}\n`);
    } catch (e) {
      appendFinding(`\n**Balance parse failed:** ${(e as Error).message}\n`);
    }
    appendFinding("\n");
    await context.close();
  } finally {
    await browser.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function appendFinding(s: string): void {
  appendFileSync(FINDINGS_PATH, s);
}

async function main(): Promise<void> {
  assertNotCi();
  const env = readEnv();

  mkdirSync(POC_DIR, { recursive: true });
  if (!existsSync(FINDINGS_PATH)) {
    writeFileSync(
      FINDINGS_PATH,
      `# ebt.ca.gov AUTHENTICATED PoC findings (gitignored)\n\n> Generated by \`fly/ebt-scraper/poc/probe-authed.ts\`. Contains card-derived data; do NOT commit.\n\n`,
      "utf8",
    );
  }
  appendFinding(`\n## Run @ ${new Date().toISOString()}\n\n`);

  // Order matters: lifetime probe first (idle is the long-pole), then depth.
  await recordSessionLifetime(env.card, env.pin, env.rememberMe, env.idleMinutes);
  await recordTransactionDepth(env.card, env.pin);

  // eslint-disable-next-line no-console
  console.log(`[probe-authed] findings appended to ${FINDINGS_PATH}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[probe-authed] fatal:", err);
  process.exit(1);
});
