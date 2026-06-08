// Freshness / expiry monitoring.
//
// Mae's grounding is a dated snapshot: the eCFR corpus is pinned to one issue
// date, the federal dollar figures are FY-bound (COLA renews Oct 1), and the CA
// ABAWD county-waiver picture has an explicit end date. Those WILL go stale —
// the stale-ABAWD-age catch from the review is the canonical example. This
// surfaces an explicit "sources as of …" line on every answer and raises a
// warning when a source has passed its renewal date, so a caseworker is never
// silently relying on expired rules and the team has a signal to re-pull.

// Federal COLA figures (max allotment, deductions, income/asset limits, SUA)
// are FY26 — effective 2025-10-01 through this date. After it, getEngineParams
// must be on FY27 values or every dollar figure is wrong.
const FY_FIGURES_EXPIRE = "2026-09-30";

// CA ABAWD waiver coverage runs through this date per CDSS ACL 25-93; after it,
// the per-county waiver picture must be re-confirmed.
const CA_ABAWD_WAIVER_THROUGH = "2026-10-31";

// eCFR is re-issued frequently; if our pinned snapshot is older than this,
// re-run build-ecfr-corpus.py to catch amendments (esp. OBBBA incorporation).
const CORPUS_MAX_AGE_DAYS = 120;

const DAY_MS = 86_400_000;

export interface Freshness {
  asOf: string;
  warnings: string[];
}

/** Assess source freshness for a given "now". Pure (date injected for tests). */
export function assessFreshness(now: Date, corpusDate: string): Freshness {
  const warnings: string[] = [];
  const t = now.getTime();

  if (t > Date.parse(`${FY_FIGURES_EXPIRE}T23:59:59Z`)) {
    warnings.push(
      "Federal FY26 figures expired Oct 1 — confirm the engine is on FY27 COLA values before quoting any dollar amount.",
    );
  }
  if (t > Date.parse(`${CA_ABAWD_WAIVER_THROUGH}T23:59:59Z`)) {
    warnings.push(
      "CA ABAWD county-waiver data (through 2026-10-31, ACL 25-93) is past its end date — re-confirm the current waiver list.",
    );
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

/** Render the "sources as of" footer (always) plus any staleness warnings. */
export function formatFreshnessFooter(now: Date, corpusDate: string): string {
  const { asOf, warnings } = assessFreshness(now, corpusDate);
  const lines = [`\n\n*Sources as of: ${asOf}.*`];
  for (const w of warnings) lines.push(`\n> ⚠️ ${w}`);
  return lines.join("");
}
