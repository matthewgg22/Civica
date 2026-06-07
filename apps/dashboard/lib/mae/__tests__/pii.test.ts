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
