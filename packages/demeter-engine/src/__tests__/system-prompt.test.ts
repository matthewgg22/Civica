import { describe, it, expect } from "vitest";
import { STAFF_SYSTEM_PROMPT, PUBLIC_SYSTEM_PROMPT, MAE_MODEL, MAE_DISCLAIMER } from "../system-prompt";

// These guardrails are the contract of both personas — Mae (staff) and
// Demeter (public), two distinct names since 2026-08-09 so the internal
// staff assistant doesn't share a name with the public product. If someone
// edits a prompt and drops one, this test fails — the behavior the user
// asked for (cite regs, refuse non-SNAP + PII, disclaim) must survive edits.

describe("shared model/disclaimer", () => {
  it("pins Sonnet 5, and every caller reads that one pin", () => {
    expect(MAE_MODEL).toBe("claude-sonnet-5");
  });

  it("facts extraction uses the same pin rather than its own copy", async () => {
    // facts-extraction.ts hardcoded its own model string, so the two could
    // drift silently — the answer path and the screening path would have been
    // billed and behaved differently with nothing to catch it. Reading the
    // source is the only way to assert a constant is *referenced*: asserting
    // on the resolved value would pass just as happily against a second
    // hardcoded copy that happens to match today.
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../screening/facts-extraction.ts", import.meta.url), "utf8"),
    );
    expect(src).toContain("model: MAE_MODEL");
    expect(src).not.toMatch(/model:\s*"claude-/);
  });

  it("ships a non-empty UI disclaimer that identifies as Mae, not Demeter", () => {
    // MAE_DISCLAIMER's only consumer is apps/dashboard's staff chat — apps/web's
    // public chat renders its own, separately-worded disclaimer inline.
    expect(MAE_DISCLAIMER.length).toBeGreaterThan(40);
    expect(MAE_DISCLAIMER.toLowerCase()).toContain("verify");
    expect(MAE_DISCLAIMER).toContain("Mae");
    expect(MAE_DISCLAIMER).not.toMatch(/\bDemeter\b/);
  });
});

// Both prompts, exercised identically, so a fact that's missing from ONE of
// them fails loudly instead of only being caught on whichever surface someone
// happens to test by hand. Identity (which name each persona uses) is
// deliberately NOT checked here — see the two persona-specific describe
// blocks below, since staff and public now use different names.
describe.each([
  ["staff", STAFF_SYSTEM_PROMPT],
  ["public", PUBLIC_SYSTEM_PROMPT],
])("%s system prompt", (_name, PROMPT) => {
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
  it("identifies as Mae, never Demeter (2026-08-09: distinct from the public product)", () => {
    expect(STAFF_SYSTEM_PROMPT).toContain("Mae");
    // Guards against a stray "Demeter" surviving a find/replace pass.
    expect(STAFF_SYSTEM_PROMPT).not.toMatch(/\bDemeter\b/);
  });

  it("is anchored to the real over-verification authorities, not the wrong ACL", () => {
    // Anchored to the authorities CDSS ME reviewers actually cite for verification
    // limits (NOT ACL 21-58, which the ME corpus shows is a student-exemption cite).
    expect(STAFF_SYSTEM_PROMPT).toContain("MPP 63-300");
    expect(STAFF_SYSTEM_PROMPT).toContain("ACL 20-48");
    expect(STAFF_SYSTEM_PROMPT).not.toContain("ACL 21-58");
  });

  it("states the CA ABAWD operative forms and the pending-guidance caveat", () => {
    expect(STAFF_SYSTEM_PROMPT).toContain("CF 886");
    // The tribal-exemption and child-under-14 items this used to flag as
    // "pending FNS guidance" were resolved by later ACLs (self-attestation;
    // same-CalFresh-household requirement) — see the LA County DPSS CPRA
    // findings, 2026-08-15. §10105/§10106 remain genuinely unresolved as of
    // the newest guidance on file; the caveat now names those instead.
    expect(STAFF_SYSTEM_PROMPT.toLowerCase()).toContain("implementation guidance is forthcoming");
  });

  // Regression (LA County DPSS CPRA production, Bates COLA002162/COLA002298/
  // COLA002520, 2026-08-15): the prompt was stale or silent on several
  // ABAWD specifics a real CDSS ACL has since pinned down.
  it("states the current CA ABAWD waiver counties, the VA any-rating exemption, and the household-membership requirement", () => {
    // California's statewide waiver ended 2026-01-31; a separate waiver
    // covers exactly these 7 counties through 2026-10-31 — an earlier
    // "confirm the specific county" hedge with no names risked staff never
    // learning this list exists at all.
    for (const county of ["Colusa", "Imperial", "Tulare", "Alpine", "Merced", "Monterey", "Plumas"]) {
      expect(STAFF_SYSTEM_PROMPT).toContain(county);
    }
    // Any VA disability rating — even 0-10% — meets the ABAWD unfitness
    // threshold; this is narrower for Medi-Cal (100%/total), a real
    // cross-program mismatch worth being precise about.
    expect(STAFF_SYSTEM_PROMPT.toLowerCase()).toContain("any percentage rating");
    expect(STAFF_SYSTEM_PROMPT).toContain("Medi-Cal");
    // ACL 25-93E (April 2026) narrowed the dependent-child-under-14
    // exemption to require the child share the adult's OWN CalFresh
    // household — an earlier ACL 25-93 (Dec 2025) reading allowed informal,
    // non-co-resident caregiving to qualify. Stating the exemption the old
    // way is now wrong, and directly mismatches a joint/shared-custody
    // household that isn't the child's primary CalFresh household.
    expect(STAFF_SYSTEM_PROMPT.toLowerCase()).toContain("same calfresh household");
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
  it("identifies as Demeter, never Mae", () => {
    expect(PUBLIC_SYSTEM_PROMPT).toContain("Demeter");
    // Guards against a stray "Mae" surviving a find/replace pass. "Maeve" etc.
    // would also trip this, but the prompt doesn't use those words.
    expect(PUBLIC_SYSTEM_PROMPT).not.toMatch(/\bMae\b/);
  });

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

  // From a real transcript: someone said they live with a partner who is a
  // student with no income, and got an answer that treated it as a household
  // of two throughout. Household size sets every threshold downstream and the
  // reader never sees the assumption, so both halves of this have to be said.
  // Regression (LA County DPSS CPRA production, Bates COLA002279-80/
  // COLA002277, 2026-08-15): the public prompt deferred to "given below for
  // ABAWD" for the current non-citizen-eligibility rule, but the ABAWD
  // section never actually stated it — a reader asking specifically about
  // refugee/asylee/parolee eligibility got no override fact at all. Also
  // adds the LIHEAP/"heat and eat" narrowing, in plain language.
  it("states the current non-citizen eligible categories and the narrowed LIHEAP/heat-and-eat rule, in plain language", () => {
    const p = PUBLIC_SYSTEM_PROMPT.toLowerCase();
    expect(p).toContain("compact of free association");
    expect(p).toMatch(/parole|parolees/);
    expect(p).toContain("liheap");
    expect(p).toMatch(/elderly or disabled/);
  });

  it("does not let living together become being one household", () => {
    const p = PUBLIC_SYSTEM_PROMPT.toLowerCase();
    expect(p).toMatch(/purchase food and prepare meals together|buy and cook food together/);
    expect(p).toContain("273.1");
    // The counter-intuitive half: an ineligible student makes the household
    // SMALLER, which lowers the limit rather than raising it.
    expect(p).toContain("273.5");
    expect(p).toMatch(/smaller/);
  });

  it("corrects take-home pay to gross, unprompted", () => {
    const p = PUBLIC_SYSTEM_PROMPT.toLowerCase();
    expect(p).toMatch(/tested on gross income|test is gross/);
    expect(p).toMatch(/before tax/);
  });

  it("reads back a figure that cannot be right rather than computing on it", () => {
    const p = PUBLIC_SYSTEM_PROMPT.toLowerCase();
    expect(p).toMatch(/cannot be right|slip, not a new fact/);
  });
});
