import { describe, it, expect } from "vitest";
import { redactPii } from "../pii";

describe("Mae PII redaction", () => {
  it("scrubs SSN, phone, email, DOB, and long account numbers", () => {
    const r = redactPii(
      "Client jane@example.com, SSN 123-45-6789, phone (916) 555-0142, DOB 4/2/1968, EBT 6011456789012345.",
    );
    expect(r.redacted).toContain("[EMAIL]");
    expect(r.redacted).toContain("[SSN]");
    expect(r.redacted).toContain("[PHONE]");
    expect(r.redacted).toContain("[DATE]");
    expect(r.redacted).toContain("[ID]");
    expect(r.redacted).not.toMatch(/123-45-6789|555-0142|jane@example/);
    expect(r.found).toBeGreaterThanOrEqual(5);
  });

  it("catches a bare 9-digit SSN", () => {
    const r = redactPii("her social is 123456789 ok");
    expect(r.redacted).toContain("[SSN]");
    expect(r.redacted).not.toContain("123456789");
  });

  it("leaves a clean policy question and ordinary numbers untouched", () => {
    const r = redactPii("Is a household of 3 making $1,800/mo over the gross income limit?");
    expect(r.found).toBe(0);
    expect(r.redacted).toContain("$1,800");
    expect(r.redacted).toContain("household of 3");
  });
});

// GROUPED / SPACED IDENTIFIERS. The original rules only matched unspaced runs,
// so the exact shapes people actually type — a card in four groups, an SSN with
// spaces — sailed through to the model and the audit log. These pin the closure
// (launch audit 2026-08-28) and, as always here, pin that income/household talk
// with several 4-digit numbers is NOT mistaken for a card.
describe("grouped and spaced identifiers", () => {
  it("scrubs a 16-digit card/EBT number typed in four groups", () => {
    for (const s of ["my card is 1234 5678 9012 3456", "EBT 1234-5678-9012-3456"]) {
      const r = redactPii(s);
      expect(r.redacted).toContain("[CARD]");
      expect(r.redacted).not.toMatch(/\d{4}[ -]\d{4}/);
      expect(r.found).toBe(1);
    }
  });

  it("scrubs an SSN written with spaces or dots, not just dashes", () => {
    for (const s of ["ssn 123 45 6789", "it's 123.45.6789"]) {
      const r = redactPii(s);
      expect(r.redacted).toContain("[SSN]");
      expect(r.redacted).not.toMatch(/123[ .]45[ .]6789/);
    }
  });

  it("does not mistake several spaced 4-digit incomes for a card", () => {
    // A card is consumed as ONE tag; a list of amounts must survive verbatim.
    const r = redactPii("last four months I made 1000 then 2000 then 3000");
    expect(r.found).toBe(0);
    expect(r.redacted).toContain("1000");
    expect(r.redacted).toContain("3000");
  });
});

// SSN FRAGMENTS. The policy promises no part of a Social Security number is
// stored; four bare digits matched none of the original rules, so "my last four
// are 6789" was being written to the audit log. These pin the fix — and, just as
// importantly, pin that ordinary numbers survive: this product reasons about
// incomes, household sizes and years, and a filter that ate them would be traded
// for a worse failure than the one it fixed.
describe("SSN fragments", () => {
  it.each([
    "my last four are 6789",
    "last 4 digits 6789",
    "SSN ends in 6789",
    "her social security number is 6789",
    "soc sec # 6789",
  ])("redacts the fragment in %j", (input) => {
    const r = redactPii(input);
    expect(r.redacted).toContain("[SSN]");
    expect(r.redacted).not.toContain("6789");
    expect(r.found).toBeGreaterThanOrEqual(1);
  });

  it("keeps the phrase so the question still reads", () => {
    const r = redactPii("my last four are 6789, does that matter?");
    expect(r.redacted).toContain("last four");
    expect(r.redacted).toContain("does that matter?");
  });

  it("leaves incomes, years and household sizes alone", () => {
    const r = redactPii("I made 2400 last month and 28000 in 2025 for a household of 4.");
    expect(r.found).toBe(0);
    expect(r.redacted).toContain("2400");
    expect(r.redacted).toContain("2025");
  });

  // The gate is the introducing phrase, not mere co-occurrence. A message that
  // asks about Social Security INCOME — extremely common in SNAP, where SSI and
  // SSDI are countable income — must not have its dollar figures eaten.
  it("does not fire on Social Security income questions", () => {
    const r = redactPii("I get social security of 1450 a month, and my rent is 1200.");
    expect(r.redacted).toContain("1200");
    expect(r.found).toBe(0);
  });

  // A loose "last 4" gate ate the 2400 here. Income history over recent months
  // is one of the most common things a SNAP applicant types.
  it("leaves recent-months income phrasing alone", () => {
    const r = redactPii("in the last 4 months I made 2400, and the last four weeks 800");
    expect(r.found).toBe(0);
    expect(r.redacted).toContain("2400");
    expect(r.redacted).toContain("800");
  });

  it("does not double-count a full SSN", () => {
    const r = redactPii("SSN 123-45-6789");
    expect(r.found).toBe(1);
    expect(r.redacted).toBe("SSN [SSN]");
  });
});
