import { describe, it, expect } from "vitest";
import { STAFF_SYSTEM_PROMPT, PUBLIC_SYSTEM_PROMPT, MAE_MODEL, MAE_DISCLAIMER } from "../system-prompt";

// These guardrails are the contract of both Demeter personas. If someone edits
// a prompt and drops one, this test fails — the behavior the user asked for
// (cite regs, refuse non-SNAP + PII, disclaim) must survive edits.

describe("shared model/disclaimer", () => {
  it("uses Opus 4.8", () => {
    expect(MAE_MODEL).toBe("claude-opus-4-8");
  });

  it("ships a non-empty UI disclaimer that identifies as Demeter, not Mae", () => {
    expect(MAE_DISCLAIMER.length).toBeGreaterThan(40);
    expect(MAE_DISCLAIMER.toLowerCase()).toContain("verify");
    expect(MAE_DISCLAIMER).toContain("Demeter");
    expect(MAE_DISCLAIMER).not.toMatch(/\bMae\b/);
  });
});

// Both prompts, exercised identically, so a fact that's missing from ONE of
// them fails loudly instead of only being caught on whichever surface someone
// happens to test by hand.
describe.each([
  ["staff", STAFF_SYSTEM_PROMPT],
  ["public", PUBLIC_SYSTEM_PROMPT],
])("%s system prompt", (_name, PROMPT) => {
  it("identifies as Demeter, never Mae", () => {
    expect(PROMPT).toContain("Demeter");
    // Guards against a stray "Mae" surviving a find/replace pass. "Maeve" etc.
    // would also trip this, but neither prompt uses those words.
    expect(PROMPT).not.toMatch(/\bMae\b/);
  });

  it("instructs citing 7 CFR 273", () => {
    expect(PROMPT).toContain("7 CFR 273");
  });

  it("scopes to SNAP / CalFresh and refuses off-topic", () => {
    expect(PROMPT).toMatch(/SNAP/);
    expect(PROMPT).toMatch(/CalFresh/);
    expect(PROMPT.toLowerCase()).toMatch(/decline|outside|scope/);
  });

  it("forbids handling personal identifying information", () => {
    expect(PROMPT.toLowerCase()).toMatch(/personal|personally identifiable|pii/);
    expect(PROMPT.toLowerCase()).toMatch(/ssn|date of birth|case number/);
  });

  it("forbids issuing a determination and frames answers as guidance to verify", () => {
    // Public says "decide anyone's case" rather than the term of art.
    expect(PROMPT.toLowerCase()).toMatch(/determination|decide.*case/);
    expect(PROMPT.toLowerCase()).toMatch(/verify|county|state/);
  });

  // FOIA-2026-07-23 training: the documented-error guardrail (B1) + CA ABAWD
  // specifics (B2). If an edit drops these, the coaching behavior regresses.
  // The two prompts are DELIBERATELY voiced differently (staff gets the
  // term-of-art "over-verification"; public gets "re-prove"/"already gave
  // them" so it never has to define jargon) — so this checks the FACT
  // survives, not that both prompts use identical words for it.
  it("carries the documented-error (over-verification) guardrail", () => {
    expect(PROMPT.toLowerCase()).toMatch(/over-verif|re-prove|already gave them/);
  });

  it("states the California ABAWD effective date", () => {
    expect(PROMPT).toContain("2026-06-01");
  });

  // #584 — the highest-severity factual gap: without this Demeter tells
  // someone that pre-2026 countable months still bar them. Same voicing note
  // as above: public says "through the end of 2025" rather than the raw ISO
  // date, which is exact and unambiguous for a lay reader.
  it("knows CA's fixed 36-month ABAWD clock ended 2025-12-31 and does not carry forward", () => {
    expect(PROMPT).toMatch(/2025-12-31|end of 2025/);
    expect(PROMPT.toLowerCase()).toMatch(/do not carry forward|don't carry forward|clock reset/);
  });
});

describe("staff system prompt — persona-specific", () => {
  it("is anchored to the real over-verification authorities, not the wrong ACL", () => {
    // Anchored to the authorities CDSS ME reviewers actually cite for verification
    // limits (NOT ACL 21-58, which the ME corpus shows is a student-exemption cite).
    expect(STAFF_SYSTEM_PROMPT).toContain("MPP 63-300");
    expect(STAFF_SYSTEM_PROMPT).toContain("ACL 20-48");
    expect(STAFF_SYSTEM_PROMPT).not.toContain("ACL 21-58");
  });

  it("states the CA ABAWD operative forms and the pending-guidance caveat", () => {
    expect(STAFF_SYSTEM_PROMPT).toContain("CF 886");
    expect(STAFF_SYSTEM_PROMPT.toLowerCase()).toContain("pending fns guidance");
  });

  it("addresses trained staff, not the applicant", () => {
    expect(STAFF_SYSTEM_PROMPT.toLowerCase()).toContain("trained staff");
  });

  it("still tells staff how document submission works in Civica", () => {
    // Deliberately staff-only — see the public prompt test below for why it
    // must NOT appear there.
    expect(STAFF_SYSTEM_PROMPT.toLowerCase()).toContain("upload it in civica");
  });
});

describe("public system prompt — persona-specific", () => {
  it("addresses the applicant directly, not staff", () => {
    const p = PUBLIC_SYSTEM_PROMPT.toLowerCase();
    expect(p).not.toContain("trained staff");
    expect(p).not.toContain("caseworker dashboard");
  });

  it("does NOT describe the Civica document-upload submission rail (parked, doesn't exist on this surface)", () => {
    const p = PUBLIC_SYSTEM_PROMPT.toLowerCase();
    expect(p).not.toContain("upload it in civica");
    expect(p).not.toContain("county filing");
  });

  it("instructs a non-personified, non-emotional voice", () => {
    const p = PUBLIC_SYSTEM_PROMPT.toLowerCase();
    expect(p).toMatch(/not a (person|companion)/);
    expect(p).toContain("never claim to be human");
    expect(p).toMatch(/exclamation/);
  });

  it("states the applicant-facing missed-interview and over-verification rights (FOIA 2026-08-09)", () => {
    const p = PUBLIC_SYSTEM_PROMPT.toLowerCase();
    expect(p).toContain("day 30");
    expect(p).toMatch(/re-prove|already gave|already provided/);
  });

  // Advisor review (2026-08-09): users often don't know whether a benefits
  // chatbot has access to their actual case, which is exactly what makes a
  // vague or evasive answer to "where's my application" actively misleading.
  it("says plainly it has no access to anyone's actual case, and redirects", () => {
    const p = PUBLIC_SYSTEM_PROMPT.toLowerCase();
    expect(p).toMatch(/no access to (anyone's )?(actual )?case/);
    expect(p).toMatch(/state's online portal|snap agency phone line/);
  });
});
