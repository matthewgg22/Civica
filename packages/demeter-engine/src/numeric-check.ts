// Numeric-equivalence check (originally eng review T8-bundle item 5 / outside
// voice #8, built ES-only; unconditional as of the Beeck Center/Digital
// Benefits Network audit — see orchestrator.ts's numbersOk).
//
// Citation verification confirms a CITED SECTION was actually retrieved; it
// says nothing about whether a specific dollar figure sitting next to a real
// citation is the real number or an invention borrowing that citation's
// credibility. This closes that gap: every dollar amount and percentage in
// the composed answer, in any language, must literally appear in the source
// material the answer was grounded on. A mismatch routes into the same
// retry-then-degrade path as a bad citation. (The Spanish case remains a
// real risk this also covers: verification runs on the ENGLISH corpus, and a
// Spanish answer is composed from that verified English content, so the one
// thing translation can silently break is a number.)

const MONEY_RE = /\$\s?\d[\d,]*(?:\.\d+)?/g;
const PERCENT_RE = /\d[\d.]*\s?(?:%|percent|por ciento)/gi;

function normalizeMoney(m: string): string {
  return "$" + m.replace(/[^0-9.]/g, "");
}

function normalizePercent(p: string): string {
  return (p.match(/[\d.]+/)?.[0] ?? "") + "%";
}

export interface NumericCheckResult {
  pass: boolean;
  /** Amounts in the answer with no literal match in the grounding text. */
  mismatches: string[];
}

/** Every $-amount and percentage in `answer` must appear in `groundingText`
 *  (the system blocks + retrieved sources the answer was composed from). */
export function verifyNumericEquivalence(
  answer: string,
  groundingText: string,
): NumericCheckResult {
  const groundMoney = new Set((groundingText.match(MONEY_RE) ?? []).map(normalizeMoney));
  const groundPct = new Set((groundingText.match(PERCENT_RE) ?? []).map(normalizePercent));

  const mismatches: string[] = [];
  for (const m of answer.match(MONEY_RE) ?? []) {
    if (!groundMoney.has(normalizeMoney(m))) mismatches.push(m.trim());
  }
  for (const p of answer.match(PERCENT_RE) ?? []) {
    if (!groundPct.has(normalizePercent(p))) mismatches.push(p.trim());
  }
  return { pass: mismatches.length === 0, mismatches: [...new Set(mismatches)] };
}
