// Engine grounding for chat (#895) — the synthesis step.
//
// In default chat mode the model used to free-hand every piece of household
// arithmetic in prose, with numeric-check.ts pattern-matching the result
// against an allowlist of permitted operations after the fact. Every numeric
// deadlock found in live testing (rideshare expenses, furlough $0, the
// housekeeper weekly-pay loop) was that architecture failing in a new shape,
// while a fully verified calculator (snap-rules, 53/53 jurisdictions,
// oracle-tested) sat unreached in the same process — consulted only by the
// opt-in worksheet.
//
// This module closes that gap per-request: extract the household facts the
// user has stated in the visible conversation, run them through the SAME
// classification layer the worksheet trusts (classifyScreening →
// composeVerdict/screenExpedited/evaluateCategorical), and hand the result to
// the model as a self-describing system block. The block's figures land in
// the numeric gate's grounding text automatically (numericSource is built
// from the system blocks), so engine-computed numbers pass verification with
// zero gate changes — and when the engine CAN'T compute, the block says what
// is still needed, so the model asks instead of inventing a figure and
// praying the regex allows it.
//
// Deliberately stateless: nothing here persists facts anywhere. The block is
// rebuilt from the visible window on every triggered request, which also
// makes it a compact restatement of the established facts each turn — a
// structured memory backbone inside the window (#891's context-carryover
// notes).

import { extractFacts, type PartialFacts } from "./facts-extraction";
import { classifyScreening } from "./classify";

/** Money-ish signal in a USER turn: "$1,500", "150 a day", "74k a year",
 *  "2000 a month". Deliberately loose — a false positive costs one extraction
 *  call, a false negative silently keeps a computable household on freehand
 *  math. Bare small integers ("30 days", "2 kids") don't trigger on their
 *  own. */
const MONEYISH_RE =
  /\$\s?\d|\b\d[\d,]*(?:\.\d+)?\s*(?:k|thousand)\b|\b\d[\d,]*(?:\.\d+)?\s*(?:a|per|each|every)\s+(?:hour|day|week|month|year|shift|paycheck)/i;

/** Cheap gate for whether the (paid) extraction step is worth attempting.
 *  Requires a state — the engine computes nothing on the federal floor — and
 *  at least one user turn carrying a money-like figure. */
export function shouldAttemptEngineGrounding(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  state: string | null | undefined,
): boolean {
  if (!state) return false;
  return messages.some((m) => m.role === "user" && MONEYISH_RE.test(m.content));
}

export interface EngineGroundingResult {
  /** The system block to append, or null when extraction found nothing usable. */
  text: string | null;
  usage: { inputTokens: number; outputTokens: number };
}

function describeFacts(facts: PartialFacts): string[] {
  const lines: string[] = [];
  if (facts.household?.length) {
    const members = facts.household
      .map((m) => {
        const bits: string[] = [];
        if (m.age !== undefined) bits.push(`age ${m.age}`);
        if (m.role) bits.push(String(m.role));
        if (m.elderly) bits.push("elderly");
        if (m.disability) bits.push("disabled");
        if (m.student) bits.push(`student (${m.student})`);
        return bits.length ? `1 member (${bits.join(", ")})` : "1 member";
      })
      .join("; ");
    lines.push(`- Household: ${facts.household.length} member(s) — ${members}`);
  }
  for (const inc of facts.income ?? []) {
    lines.push(`- Income: $${inc.amount} ${inc.freq ?? ""} (${inc.type ?? "unspecified type"})`.trim());
  }
  if (facts.shelter?.rent !== undefined) lines.push(`- Shelter cost: $${facts.shelter.rent}/month`);
  if (typeof facts.assets === "number") lines.push(`- Stated countable assets: $${facts.assets}`);
  if (facts.cat_elig) lines.push(`- Categorical status: ${facts.cat_elig}`);
  return lines;
}

/** Run extraction + the verified engine over the visible conversation and
 *  format the result as a self-describing system block. Throws NOTHING that
 *  the caller must handle — any internal failure returns { text: null } so a
 *  grounding hiccup can never break the answer itself. */
export async function buildEngineGroundingBlock(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  state: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<EngineGroundingResult> {
  const none = { inputTokens: 0, outputTokens: 0 };
  try {
    const { patch: facts, empty, usage } = await extractFacts(
      messages,
      apiKey,
      signal,
      "conversation",
    );
    if (empty) return { text: null, usage };

    const classification = classifyScreening(facts, state, new Date());
    const factLines = describeFacts(facts);

    const header =
      "VERIFIED ENGINE COMPUTATION — computed by Civica's eligibility engine from the " +
      "household facts the user has stated in this conversation (listed below). These " +
      "results are authoritative for this household: use them verbatim. Do NOT perform " +
      "your own eligibility or benefit arithmetic — the only arithmetic you may add is " +
      "restating the user's own figures. This is still an estimate to confirm with the " +
      "state agency, not a determination — say so once, briefly.";

    const factsSection = factLines.length
      ? `\nFacts used (as stated by the user):\n${factLines.join("\n")}`
      : "";

    let resultSection: string;
    switch (classification.outcome) {
      case "not_enough_information":
        // classify's summary for this outcome is a hardcoded mockup string
        // ("Household size and income are still unknown") that is often FALSE
        // about which items are missing — the stillNeeded list below is the
        // accurate statement, so it speaks alone.
        resultSection =
          `\nEngine result: CANNOT COMPUTE YET.\n` +
          (classification.completeness.stillNeeded.length
            ? `Still needed before the engine can compute:\n${classification.completeness.stillNeeded
                .map((s) => `- ${s}`)
                .join("\n")}\n` +
              "Ask for the single most important missing item (in plain words) instead of " +
              "estimating a figure yourself."
            : "Do not estimate a figure yourself.");
        break;
      case "needs_county_review":
        resultSection =
          `\nEngine result: NEEDS COUNTY REVIEW — ${classification.summary}\n` +
          "Do not assert an exact benefit figure. You may compare the user's own stated " +
          "figures against the income limits in the live engine parameters above, labeled " +
          "as a rough screen; the county calculates the exact number.";
        break;
      case "expedited":
        resultSection =
          `\nEngine result: LIKELY ELIGIBLE, EXPEDITED SERVICE (7 CFR 273.2(i)) — ${classification.summary}\n` +
          "Lead with the 7-day expedited timeline and filing today.";
        break;
      case "categorically_eligible":
      case "likely_eligible": {
        const benefit = classification.verdict?.benefit;
        // The completeness layer defaults an unknown SUA tier to "none" —
        // the conservative floor (utility allowances only raise deductions,
        // and higher deductions only raise the benefit). Say so, so the
        // model can pass the direction of the error on to the reader.
        const suaDefaulted = facts.shelter && facts.shelter.sua_tier === undefined;
        resultSection =
          `\nEngine result: ${classification.outcome === "categorically_eligible" ? "CATEGORICALLY ELIGIBLE" : "LIKELY ELIGIBLE"} — ${classification.summary}` +
          (typeof benefit === "number"
            ? `\nEstimated monthly benefit: $${benefit}` +
              (suaDefaulted
                ? "\n(Computed without a utility allowance — if the household pays " +
                  "utilities separately from rent, the actual benefit is likely HIGHER " +
                  "than this. Say so, and ask about utilities if it hasn't come up.)"
                : "")
            : "\nA dollar estimate is not computable for this household/state yet — do not invent one.");
        break;
      }
      case "likely_ineligible":
        resultSection =
          `\nEngine result: LIKELY INELIGIBLE — ${classification.summary}\n` +
          "Say this gently and name what could change it (deductions they haven't " +
          "mentioned, household changes); the agency makes the actual decision.";
        break;
    }

    return { text: `${header}${factsSection}${resultSection}`, usage };
  } catch {
    // Grounding is an enhancement — a failure here must never cost the reader
    // their answer. The orchestrator proceeds exactly as before this feature.
    return { text: null, usage: none };
  }
}
