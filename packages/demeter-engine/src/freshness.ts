// Freshness / expiry monitoring.
//
// Mae's grounding is a dated snapshot: the eCFR corpus is pinned to one issue
// date, the federal dollar figures are FY-bound (COLA renews Oct 1), and each
// state pack carries its own dated facts (e.g. CA's ABAWD waiver window). Those
// WILL go stale — the stale-ABAWD-age catch from the review is the canonical
// example. This surfaces an explicit "sources as of …" line on every answer and
// raises a warning when a source has passed its renewal date, so a caseworker is
// never silently relying on expired rules and the team has a signal to re-pull.
//
// Federal dates live here (one copy — framework §3 layering); state dates live
// in states/<code>/freshness.json and are merged per request.

import { getStatePack } from "./states";
import type { AnswerLang } from "./lang";

// Federal COLA figures (max allotment, deductions, income/asset limits, SUA)
// are FY26 — effective 2025-10-01 through this date. After it, getEngineParams
// must be on FY27 values or every dollar figure is wrong.
const FY_FIGURES_EXPIRE = "2026-09-30";

// eCFR is re-issued frequently; if our pinned snapshot is older than this,
// re-run build-ecfr-corpus.py to catch amendments (esp. OBBBA incorporation).
const CORPUS_MAX_AGE_DAYS = 120;

const DAY_MS = 86_400_000;

export interface Freshness {
  asOf: string;
  warnings: string[];
}

/** Assess source freshness for a given "now". Pure (date injected for tests). */
export function assessFreshness(now: Date, corpusDate: string, state?: string | null): Freshness {
  const warnings: string[] = [];
  const t = now.getTime();

  if (t > Date.parse(`${FY_FIGURES_EXPIRE}T23:59:59Z`)) {
    warnings.push(
      "Federal FY26 figures expired Oct 1 — confirm the engine is on FY27 COLA values before quoting any dollar amount.",
    );
  }

  // State-pack dated facts. "expires" warns once now is PAST the date
  // (end-of-day); "not-yet-effective" warns while now is BEFORE it (start-of-day)
  // so a pre-launch answer doesn't state a future rule as live.
  for (const e of getStatePack(state)?.freshness ?? []) {
    if (e.kind === "expires" && t > Date.parse(`${e.date}T23:59:59Z`)) {
      warnings.push(e.warning);
    } else if (e.kind === "not-yet-effective" && t < Date.parse(`${e.date}T00:00:00Z`)) {
      warnings.push(e.warning);
    }
  }

  const ageDays = corpusDate ? Math.floor((t - Date.parse(`${corpusDate}T00:00:00Z`)) / DAY_MS) : NaN;
  if (Number.isFinite(ageDays) && ageDays > CORPUS_MAX_AGE_DAYS) {
    warnings.push(
      `The eCFR corpus is ${ageDays} days old — re-run build-ecfr-corpus.py to pick up amendments.`,
    );
  }

  const asOf = `eCFR ${corpusDate || "unknown"}; federal figures FY26 (current through 2026-09-30)`;
  return { asOf, warnings };
}

/** Render the "sources as of" footer (always) plus any staleness warnings.
 * Staleness warnings stay in English — they're operator-facing (re-run a
 * build script), not reader-facing. */
export function formatFreshnessFooter(
  now: Date,
  corpusDate: string,
  state?: string | null,
  lang: AnswerLang = "en",
): string {
  const { asOf, warnings } = assessFreshness(now, corpusDate, state);
  const asOfLocalized =
    lang === "es"
      ? asOf.replace("federal figures FY26 (current through", "cifras federales FY26 (vigentes hasta")
      : asOf;
  const label = lang === "es" ? "Fuentes al" : "Sources as of";
  const lines = [`\n\n*${label}: ${asOfLocalized}.*`];
  for (const w of warnings) lines.push(`\n> ⚠️ ${w}`);
  return lines.join("");
}
