/**
 * Structural fingerprint extractor for ebt.ca.gov pages.
 *
 * Read-only navigation only: the daily cron POSTs cookies for the test card,
 * the scraper visits the balance + transactions pages, and we hash the
 * page *structure* (input names, table column counts, presence of anchor
 * text) into a fingerprint.
 *
 * Why a fingerprint and not the raw HTML: cookies, timestamps, and per-user
 * balances drift between calls; structure does NOT (until the portal team
 * ships a redesign, which is exactly what we want the alert to catch).
 *
 * The cron compares the returned fingerprint against
 * `apps/enrollment-api/src/cron/ebt-probe-baseline.json` and pings Slack on drift.
 */

import type { BrowserContext } from "playwright";

export interface PageFingerprint {
  /** URL fetched (after redirects). */
  url: string;
  /** HTTP status code. */
  status: number;
  /** input[name] values, sorted; e.g. ["password","userid"]. */
  inputNames: string[];
  /** Distinct table column counts on the page, sorted. ([] if no tables.) */
  tableColumnCounts: number[];
  /** Which anchor texts we expected to be present + whether they were. */
  anchorTextPresence: Record<string, boolean>;
}

export interface ProbeFingerprintResult {
  balance: PageFingerprint;
  transactions: PageFingerprint;
  /** When the probe ran (ISO-8601). Useful for the baseline diff replay. */
  capturedAt: string;
}

const BALANCE_ANCHOR_TEXT = [
  "Available Balance",
  "Food Benefits",
  "Cash Benefits",
];

const TRANSACTIONS_ANCHOR_TEXT = [
  "Transaction History",
  "Posted",
  "Amount",
];

const BALANCE_URL = "https://www.ebt.ca.gov/cardholder/Home";
const TRANSACTIONS_URL = "https://www.ebt.ca.gov/cardholder/transactions";

/**
 * Probe one page and return a structural fingerprint. Pure-data — never throws
 * for HTTP errors; instead reports `status` so the caller can decide.
 */
export async function fingerprintPage(
  context: BrowserContext,
  url: string,
  anchorText: string[],
): Promise<PageFingerprint> {
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    const status = response?.status() ?? 0;

    // $$eval / evaluate callbacks run in the page (browser) context — TS
    // can't see DOM globals from the Node tsconfig, so we annotate the
    // callback argument as `any[]` and rely on the runtime browser DOM.
    // The runtime IS the browser, so DOM methods work; this is purely a TS
    // ergonomics fix.
    const inputNames = (await page.$$eval(
      "input",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (els: any[]) =>
        els
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((el: any) => (el.getAttribute("name") as string | null) ?? "")
          .filter((n: string) => n.length > 0),
    )) as string[];

    const tableColumnCounts = (await page.$$eval(
      "table",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tables: any[]) =>
        tables.map((t) => {
          const firstRow = t.querySelector("tr");
          if (!firstRow) return 0;
          return firstRow.querySelectorAll("td,th").length as number;
        }),
    )) as number[];

    const text = (await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => ((globalThis as any).document?.body?.innerText as string | undefined) ?? "",
    )) as string;

    const anchorTextPresence: Record<string, boolean> = {};
    for (const anchor of anchorText) {
      anchorTextPresence[anchor] = text.toLowerCase().includes(anchor.toLowerCase());
    }

    return {
      url: page.url(),
      status,
      inputNames: dedupeAndSort(inputNames),
      tableColumnCounts: dedupeAndSort(tableColumnCounts),
      anchorTextPresence,
    };
  } finally {
    await page.close();
  }
}

function dedupeAndSort<T extends string | number>(arr: T[]): T[] {
  return [...new Set(arr)].sort() as T[];
}

/**
 * Returned by the diff so the cron can both log + post a useful Slack message.
 * `changes` lists which fields drifted; `equal` is true when nothing changed.
 */
export interface FingerprintDiff {
  equal: boolean;
  changes: Array<{
    page: "balance" | "transactions";
    field: string;
    baseline: unknown;
    current: unknown;
  }>;
}

/**
 * Compare two probe results. Ignores `capturedAt` and `status` for the equality
 * check (status drift means "portal is down right now", not "structure
 * drifted" — surface that via uptime instead).
 *
 * For `inputNames` and `tableColumnCounts`, we compare set membership (already
 * deduped + sorted at fingerprint time). For `anchorTextPresence`, we compare
 * the boolean map verbatim — a previously-present anchor going false IS drift.
 */
export function diffFingerprints(
  baseline: ProbeFingerprintResult,
  current: ProbeFingerprintResult,
): FingerprintDiff {
  const changes: FingerprintDiff["changes"] = [];

  for (const pageKey of ["balance", "transactions"] as const) {
    const b = baseline[pageKey];
    const c = current[pageKey];

    if (!arrayEqual(b.inputNames, c.inputNames)) {
      changes.push({ page: pageKey, field: "inputNames", baseline: b.inputNames, current: c.inputNames });
    }
    if (!arrayEqual(b.tableColumnCounts, c.tableColumnCounts)) {
      changes.push({
        page: pageKey,
        field: "tableColumnCounts",
        baseline: b.tableColumnCounts,
        current: c.tableColumnCounts,
      });
    }
    if (!objectEqual(b.anchorTextPresence, c.anchorTextPresence)) {
      changes.push({
        page: pageKey,
        field: "anchorTextPresence",
        baseline: b.anchorTextPresence,
        current: c.anchorTextPresence,
      });
    }
  }

  return { equal: changes.length === 0, changes };
}

function arrayEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function objectEqual(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  if (!arrayEqual(ak, bk)) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}

export const PROBE_PAGES = {
  balance: { url: BALANCE_URL, anchorText: BALANCE_ANCHOR_TEXT },
  transactions: { url: TRANSACTIONS_URL, anchorText: TRANSACTIONS_ANCHOR_TEXT },
} as const;
