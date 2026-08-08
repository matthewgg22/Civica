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
  return { redacted: out, found };
}
