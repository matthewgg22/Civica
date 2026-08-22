// Input PII redaction — scrubs applicant identifiers out of a caseworker's
// message BEFORE it leaves the server to the Anthropic API (and before it is
// embedded for retrieval or written to the audit log). Mae answers policy
// questions; a specific person's SSN/phone/email/DOB/case number adds nothing to
// a policy question, so redacting structured identifiers preserves the question
// while keeping PII off the wire.
//
// Scope: HIGH-CONFIDENCE structured identifiers only (SSN, phone, email, slash-
// date, long account/EBT/case numbers). Names are intentionally NOT redacted —
// name detection is error-prone (false positives would mangle real questions),
// and the system prompt already forbids Mae from echoing names. This is a
// privacy control, not a guarantee; pair it with the "don't paste PII" prompt.

interface Rule {
  tag: string;
  re: RegExp;
}

// Order matters: more-specific patterns first so a value is tagged once,
// correctly (e.g. an email before its digits, a dashed SSN before a phone).
const RULES: Rule[] = [
  { tag: "[EMAIL]", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { tag: "[SSN]", re: /\b\d{3}-\d{2}-\d{4}\b/g }, // 123-45-6789
  { tag: "[PHONE]", re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g }, // 10-digit
  { tag: "[SSN]", re: /\b\d{9}\b/g }, // bare 9-digit (very likely an SSN in this context)
  { tag: "[DATE]", re: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g }, // DOB-style MM/DD/YYYY
  { tag: "[ID]", re: /\b\d{11,}\b/g }, // case / EBT / account numbers (16-19 digits etc.)
];

/** SSN FRAGMENTS. "My last four are 6789" is the way a real person volunteers
 *  part of an SSN, and four bare digits match none of the rules above — so the
 *  fragment was being stored while the policy promised no part of an SSN is
 *  kept. Making the promise true is cheaper than narrowing it.
 *
 *  TWO NARROW RULES RATHER THAN ONE BROAD ONE, because the obvious broad version
 *  is actively dangerous here. This product reasons about incomes, household
 *  sizes and years, and in SNAP specifically, "social security" usually means
 *  SSI or SSDI INCOME — a countable income source — not an identifier. A gate on
 *  the bare phrase redacted the 1450 in "I get social security of 1450 a month",
 *  which corrupts the eligibility conversation to protect a number that was
 *  never an SSN. Likewise a loose "last 4" gate eats the 2400 in "in the last 4
 *  months I made 2400".
 *
 *  So: the identifier rule fires only on wording that means the NUMBER (ssn,
 *  "social security number", "soc sec #"), and the last-four rule requires the
 *  digits to follow almost immediately, with only a connective between.
 *
 *  Each keeps the introducing phrase and replaces only the digits, so the
 *  question still reads. */
const SSN_FRAGMENT_RULES: RegExp[] = [
  // "ssn 6789", "SSN ends in 6789", "social security number is 6789", "soc sec # 6789"
  /\b((?:ssn|soc(?:ial)?\.?\s*sec(?:urity)?\.?\s*(?:(?:number|num|no)\b|#))[^\d\n]{0,24})(\d{4})\b/gi,
  // "my last four are 6789", "last 4 digits 6789", "last four of my ssn is 6789"
  /\b((?:last\s*(?:four|4)(?:\s*(?:digits?|numbers?))?)\s*(?:of\s*(?:my|her|his|their)\s*(?:ssn|social(?:\s*security)?)\s*)?(?:is|are|:|=|#)?\s*)(\d{4})\b/gi,
];

export interface RedactionResult {
  redacted: string;
  /** Count of identifiers scrubbed (for the audit log / transparency). */
  found: number;
}

/** Replace structured PII with typed placeholders. Never throws. */
export function redactPii(text: string): RedactionResult {
  let out = text;
  let found = 0;
  for (const { tag, re } of RULES) {
    out = out.replace(re, () => {
      found += 1;
      return tag;
    });
  }
  // After the full-value rules, so a complete SSN is already [SSN] and cannot
  // be double-counted by the fragment pass.
  for (const re of SSN_FRAGMENT_RULES) {
    out = out.replace(re, (_m, lead: string) => {
      found += 1;
      return `${lead}[SSN]`;
    });
  }
  return { redacted: out, found };
}
