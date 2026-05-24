/**
 * Daily authed probe — drift detection for the ebt.ca.gov portal.
 *
 * Runs at 14:00 UTC (6 AM PT, after CA's daily issuance window). Fetches the
 * single seeded test card's encrypted cookies from Supabase, asks the Fly
 * scraper to render the balance + transactions pages READ-ONLY, computes a
 * structural fingerprint, diffs against `ebt-probe-baseline.json`, and pings
 * Slack on drift.
 *
 * Why this exists: silent selector drift on ebt.ca.gov has been our biggest
 * scraper fear since /plan-eng-review. Without a daily probe, parseError
 * rates climb gradually and we only notice when push notifications stop. With
 * the probe, drift surfaces within 24h with a Slack message that names the
 * exact field that changed (inputNames? table column count? anchor text?).
 *
 * Surfaced by: /plan-eng-review T5.
 *
 * Operator setup:
 *   1. Seed `snap_enrollment.ebt_cards` with a single row whose
 *      `is_test_probe_card = true` and whose `session_cookie_encrypted` holds
 *      cookies for Matthew's test card. (Manual one-time step.)
 *   2. `wrangler secret put SLACK_OBSERVABILITY_WEBHOOK_URL` with the
 *      `#ops` incoming-webhook URL. Skip and the cron logs the drift but
 *      sends nothing.
 *   3. `wrangler secret put EBT_SCRAPER_DISPATCH_URL` already set for /scrape;
 *      the probe reuses that base URL (swaps `/scrape` → `/probe-selectors-authed`).
 */

import type { Env } from "../types.js";
import { makeServiceClient } from "../lib/supabase.js";
import BASELINE_JSON from "./ebt-probe-baseline.json";

// ---------------------------------------------------------------------------
// Types — mirror the scraper's wire format. Kept here as a small copy rather
// than importing from `fly/ebt-scraper` because Workers and Node packages
// shouldn't share a tsconfig path mapping (different runtimes).
// ---------------------------------------------------------------------------

interface PageFingerprint {
  url: string;
  status: number;
  inputNames: string[];
  tableColumnCounts: number[];
  anchorTextPresence: Record<string, boolean>;
}

export interface ProbeFingerprintResult {
  balance: PageFingerprint;
  transactions: PageFingerprint;
  capturedAt: string;
}

export interface FingerprintDiff {
  equal: boolean;
  changes: Array<{
    page: "balance" | "transactions";
    field: string;
    baseline: unknown;
    current: unknown;
  }>;
}

export interface ProbeRunResult {
  ran: boolean;
  reason?: string;
  diff?: FingerprintDiff;
  slackPosted?: boolean;
}

// ---------------------------------------------------------------------------
// Pure-function diff (mirrors `fly/ebt-scraper/src/probe-fingerprint.ts`).
// Exported separately so the unit test can drive it without any I/O.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// HMAC helper — Web Crypto so this runs in the Worker isolate.
// ---------------------------------------------------------------------------

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Test card lookup — finds the single seeded test row in ebt_cards. If
// none exists, the probe skips with a warning (so the cron path is observable
// even before the operator seeds a card).
// ---------------------------------------------------------------------------

interface TestCard {
  id: string;
  session_cookie_encrypted: string;
}

async function fetchTestCard(env: Env): Promise<TestCard | null> {
  const db = makeServiceClient(env);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("ebt_cards" as any) as any)
    .select("id, session_cookie_encrypted")
    .eq("is_test_probe_card", true)
    .limit(1)
    .maybeSingle() as {
      data: { id: string; session_cookie_encrypted: string } | null;
      error: { message: string } | null;
    };

  if (error) {
    throw new Error(`test card lookup failed: ${error.message}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Slack — minimal incoming-webhook POST. Failures are swallowed (the probe
// already succeeded; Slack outage shouldn't crash the cron).
// ---------------------------------------------------------------------------

async function postSlack(webhookUrl: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function formatDriftMessage(diff: FingerprintDiff, capturedAt: string): string {
  const lines = [
    ":rotating_light: *ebt.ca.gov probe — structural drift detected*",
    `Captured at: ${capturedAt}`,
    "",
    "Changes:",
  ];
  for (const change of diff.changes) {
    lines.push(`  • \`${change.page}.${change.field}\``);
    lines.push(`    baseline: \`${JSON.stringify(change.baseline)}\``);
    lines.push(`    current:  \`${JSON.stringify(change.current)}\``);
  }
  lines.push("");
  lines.push(
    "Action: inspect `fly/ebt-scraper/src/processors/ebt-ca/*.ts` selectors. " +
      "If the drift is benign, update `apps/enrollment-api/src/cron/ebt-probe-baseline.json` to silence.",
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Cron entrypoint.
// ---------------------------------------------------------------------------

export async function runEbtProbe(
  env: Env,
  log: (level: "info" | "warn" | "error", msg: string, extra?: Record<string, unknown>) => void = noopLog,
): Promise<ProbeRunResult> {
  const dispatchBase = env.EBT_SCRAPER_DISPATCH_URL;
  if (!dispatchBase) {
    log("warn", "ebt-probe skipped: EBT_SCRAPER_DISPATCH_URL not set");
    return { ran: false, reason: "no_dispatch_url" };
  }
  const secret = env.EBT_SCRAPER_WEBHOOK_SECRET;
  if (!secret) {
    log("warn", "ebt-probe skipped: EBT_SCRAPER_WEBHOOK_SECRET not set");
    return { ran: false, reason: "no_secret" };
  }

  const card = await fetchTestCard(env);
  if (!card) {
    log("warn", "ebt-probe skipped: no test card seeded (ebt_cards.is_test_probe_card)");
    return { ran: false, reason: "no_test_card" };
  }

  // session_cookie_encrypted is the same JSON-array format `dispatchScrapeRefresh`
  // uses — parsed once on the gateway side, the scraper accepts it as `cookieHandoff`.
  let cookieHandoff: unknown[];
  try {
    cookieHandoff = JSON.parse(card.session_cookie_encrypted) as unknown[];
    if (!Array.isArray(cookieHandoff)) throw new Error("not an array");
  } catch {
    log("error", "ebt-probe failed: test card cookies could not be parsed");
    return { ran: false, reason: "cookie_parse_failed" };
  }

  const probeUrl = dispatchBase.replace(/\/scrape\/?$/, "/probe-selectors-authed");
  const body = JSON.stringify({ cookieHandoff });
  const sig = await hmacHex(secret, body);

  const res = await fetch(probeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Civica-Signature": `sha256=${sig}`,
    },
    body,
  });
  if (!res.ok) {
    log("error", "ebt-probe scraper call failed", { status: res.status });
    return { ran: false, reason: `scraper_status_${res.status}` };
  }
  const current = (await res.json()) as ProbeFingerprintResult;

  const baseline = BASELINE_JSON as ProbeFingerprintResult;
  const diff = diffFingerprints(baseline, current);

  if (diff.equal) {
    log("info", "ebt-probe ok: no structural drift");
    return { ran: true, diff };
  }

  log("warn", "ebt-probe drift detected", { changes: diff.changes });

  // Slack post (best-effort).
  const slackUrl = env.SLACK_OBSERVABILITY_WEBHOOK_URL;
  if (!slackUrl) {
    // TODO: operator must `wrangler secret put SLACK_OBSERVABILITY_WEBHOOK_URL`
    // for drift to surface in #ops. Until then, drift only appears in CF logs.
    log("warn", "ebt-probe drift NOT posted to Slack — SLACK_OBSERVABILITY_WEBHOOK_URL unset");
    return { ran: true, diff, slackPosted: false };
  }

  const slackPosted = await postSlack(slackUrl, formatDriftMessage(diff, current.capturedAt));
  if (!slackPosted) {
    log("error", "ebt-probe drift detected but Slack POST failed");
  }
  return { ran: true, diff, slackPosted };
}

function noopLog(): void {
  // default logger for callers that don't care
}
