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

// A number as a PERSON writes it: "74 k", "74k", "2.8 k", "2,800", "$2,800".
// Nobody types "$74,000.00" into a chat box, and the literal match above was
// only ever looking for what a regulation looks like.
const SPOKEN_NUMBER_RE = /(\d[\d,]*(?:\.\d+)?)\s*(k\b|thousand\b)?/gi;

/** Annual ↔ monthly ↔ weekly ↔ biweekly. SNAP is decided monthly and people
 *  state their pay annually, so this conversion is not an embellishment — it
 *  is the arithmetic the comparison requires. Bounded to these factors: this
 *  admits a restatement of the person's own figure on a different cadence, not
 *  arbitrary arithmetic. */
const CADENCE_FACTORS = [12, 52, 26];

function spokenValues(text: string): number[] {
  const out: number[] = [];
  for (const [, digits, suffix] of text.matchAll(SPOKEN_NUMBER_RE)) {
    const n = Number((digits ?? "").replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    out.push(suffix ? n * 1000 : n);
  }
  return out;
}

/** Every value the person's own words entitle an answer to contain: what they
 *  said, and the same amount on a different pay cadence. Rounded to the dollar
 *  and to the nearest ten, because $74,000/12 is $6,166.67 and an answer will
 *  sensibly write $6,167 or $6,170 — but not $6,200, which is a different
 *  claim wearing their number's clothes. */
function admissibleFromUser(userText: string): Set<number> {
  const admissible = new Set<number>();
  const add = (v: number) => {
    if (!Number.isFinite(v) || v <= 0) return;
    admissible.add(v);
    admissible.add(Math.round(v));
    admissible.add(Math.round(v / 10) * 10);
  };
  // Their figures, and what those figures make when put together.
  //
  // SUBTRACTION IS THE POINT. A rideshare driver said they made 3 k last month
  // and spent 300 on gas; SNAP counts self-employment income as receipts minus
  // business costs, so the only useful answer contains $2,700 — a number that
  // appears nowhere, in no regulation, and could only be arrived at by doing
  // the arithmetic the programme requires. Refusing it deadlocked that
  // conversation exactly as the last one deadlocked.
  //
  // Bounded to PAIRS of things they actually said. That admits 2,700 and 3,300
  // from {3,000, 300} and nothing else — not the $3,380 gross limit, not the
  // $204 standard deduction, which are policy figures and still have to be
  // retrieved before they can be stated.
  const said = spokenValues(userText).filter((v) => v > 0);
  const combos = [...said];
  for (let i = 0; i < said.length; i++) {
    for (let j = i + 1; j < said.length; j++) {
      combos.push(said[i]! + said[j]!, Math.abs(said[i]! - said[j]!));
    }
  }
  for (const v of combos) {
    add(v);
    for (const f of CADENCE_FACTORS) {
      add(v * f);
      add(v / f);
    }
  }
  return admissible;
}

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
  /** The person's own turns. Figures they supplied are not fabrications, and
   *  treating them as such deadlocked a real conversation — see
   *  __tests__/numeric-check.test.ts. Kept separate from `groundingText`
   *  deliberately: bare numbers are read loosely here, which is safe for what
   *  someone typed about themselves and would be far too loose applied to the
   *  system prompt, where "273.8" would quietly admit "$273.80". */
  userText = "",
): NumericCheckResult {
  const groundMoney = new Set((groundingText.match(MONEY_RE) ?? []).map(normalizeMoney));
  const groundPct = new Set((groundingText.match(PERCENT_RE) ?? []).map(normalizePercent));
  const fromUser = admissibleFromUser(userText);
  const userSaid = (raw: string): boolean => {
    const n = Number(raw.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && fromUser.has(n);
  };

  const mismatches: string[] = [];
  for (const m of answer.match(MONEY_RE) ?? []) {
    if (!groundMoney.has(normalizeMoney(m)) && !userSaid(m)) mismatches.push(m.trim());
  }
  for (const p of answer.match(PERCENT_RE) ?? []) {
    if (!groundPct.has(normalizePercent(p)) && !userSaid(p)) mismatches.push(p.trim());
  }
  return { pass: mismatches.length === 0, mismatches: [...new Set(mismatches)] };
}
