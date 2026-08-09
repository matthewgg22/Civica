// @vitest-environment node
// Regression guard (FOIA 2026-07-23, backlog task D2): Demeter must NOT coach
// anyone into over-verification — the single most common documented CalFresh
// error (CDSS Management Evaluation reviews, 37/38 counties). We can't run the LLM
// offline, so we pin the two things that make the wrong answer structurally hard:
//   (1) the verification-limits supplement (7 CFR 273.2(f); MPP 63-300 / ACL 20-48
//       cluster — NOT ACL 21-58, a student-exemption cite) is the TOP retrieved
//       authority for the over-verification fact-patterns, and
//   (2) BOTH system prompts carry the guardrail, each voiced for its audience.
import { describe, it, expect } from "vitest";
import { retrieve } from "../retrieval";
import { STAFF_SYSTEM_PROMPT, PUBLIC_SYSTEM_PROMPT } from "../system-prompt";

// The fact-patterns from the ME denial narratives that tempt a "request more /
// just to be safe" answer.
const TRAP_QUESTIONS = [
  "They already gave me pay stubs — should I request them again just to be safe?",
  "Can I deny for failure to provide verification the household already provided?",
  "Should I ask the household for income proof before I check The Work Number?",
  "To be thorough, should I verify the rent even though nothing about it is questionable?",
  "The document is already on file — can I require a fresh copy anyway?",
];

describe("Demeter over-verification guardrail (D2 regression)", { timeout: 60_000 }, () => {
  it("surfaces the verification-limits supplement as the TOP authority for over-verification traps", async () => {
    for (const q of TRAP_QUESTIONS) {
      const top = (await retrieve(q, { k: 1 }))[0];
      expect(top?.citation, `top authority for: ${q}`).toContain("273.2(f)");
      // Anchored to the real ME-corpus cluster, not ACL 21-58 (a student-exemption cite).
      expect(top?.citation, `over-verification cite for: ${q}`).toContain("MPP 63-300");
    }
  });

  it("the staff prompt tells Demeter to verify for correctness, not volume", () => {
    const p = STAFF_SYSTEM_PROMPT.toLowerCase();
    expect(p).toContain("over-verification");
    expect(p).toContain("not for volume");
  });

  it("the public prompt tells the applicant they don't have to re-prove what's already on file", () => {
    // Deliberately doesn't assert the jargon term "over-verification" here —
    // the public prompt is written to never require defining a term of art;
    // it states the right in plain language instead.
    const p = PUBLIC_SYSTEM_PROMPT.toLowerCase();
    expect(p).toMatch(/re-prove|don't have to.*already/);
  });
});
