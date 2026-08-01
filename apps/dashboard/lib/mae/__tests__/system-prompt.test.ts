import { describe, it, expect } from "vitest";
import { MAE_SYSTEM_PROMPT, MAE_MODEL, MAE_DISCLAIMER } from "../system-prompt";

// These guardrails are the contract of the caseworker assistant. If someone
// edits the prompt and drops one, this test fails — the behavior the user
// asked for (cite regs, refuse non-SNAP + PII, disclaim) must survive edits.
describe("Mae system prompt", () => {
  it("uses Opus 4.8", () => {
    expect(MAE_MODEL).toBe("claude-opus-4-8");
  });

  it("instructs citing 7 CFR 273", () => {
    expect(MAE_SYSTEM_PROMPT).toContain("7 CFR 273");
  });

  it("scopes to SNAP / CalFresh and refuses off-topic", () => {
    expect(MAE_SYSTEM_PROMPT).toMatch(/SNAP/);
    expect(MAE_SYSTEM_PROMPT).toMatch(/CalFresh/);
    expect(MAE_SYSTEM_PROMPT.toLowerCase()).toMatch(/decline|outside|scope/);
  });

  it("forbids handling applicant PII", () => {
    expect(MAE_SYSTEM_PROMPT).toMatch(/PII|personally identifiable/);
    expect(MAE_SYSTEM_PROMPT.toLowerCase()).toMatch(/ssn|date of birth|case number/);
  });

  it("forbids issuing a determination and frames answers as guidance", () => {
    expect(MAE_SYSTEM_PROMPT.toLowerCase()).toContain("determination");
    expect(MAE_SYSTEM_PROMPT.toLowerCase()).toMatch(/verify|county/);
  });

  it("ships a non-empty UI disclaimer", () => {
    expect(MAE_DISCLAIMER.length).toBeGreaterThan(40);
    expect(MAE_DISCLAIMER.toLowerCase()).toContain("verify");
  });

  // FOIA-2026-07-23 training: the documented-error guardrail (B1) + CA ABAWD
  // specifics (B2). If an edit drops these, the coaching behavior regresses.
  it("carries the documented-error (over-verification) guardrail", () => {
    expect(MAE_SYSTEM_PROMPT.toLowerCase()).toContain("over-verification");
    // Anchored to the authorities CDSS ME reviewers actually cite for verification
    // limits (NOT ACL 21-58, which the ME corpus shows is a student-exemption cite).
    expect(MAE_SYSTEM_PROMPT).toContain("MPP 63-300");
    expect(MAE_SYSTEM_PROMPT).toContain("ACL 20-48");
    expect(MAE_SYSTEM_PROMPT).not.toContain("ACL 21-58");
  });

  it("states the California ABAWD effective date and operative forms", () => {
    expect(MAE_SYSTEM_PROMPT).toContain("2026-06-01");
    expect(MAE_SYSTEM_PROMPT).toContain("CF 886");
    expect(MAE_SYSTEM_PROMPT.toLowerCase()).toContain("pending fns guidance");
  });

  // #584 — the highest-severity factual gap: without this Mae tells a household
  // that pre-2026 countable months still bar them.
  it("knows CA's fixed 36-month ABAWD clock ended 2025-12-31 and does not carry forward", () => {
    expect(MAE_SYSTEM_PROMPT).toContain("2025-12-31");
    expect(MAE_SYSTEM_PROMPT.toLowerCase()).toContain("do not carry forward");
  });
});
