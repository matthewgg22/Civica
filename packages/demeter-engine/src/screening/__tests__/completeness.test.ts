import { describe, it, expect } from "vitest";
import { assessCompleteness } from "../completeness";
import type { PartialFacts } from "../facts-extraction";

describe("assessCompleteness", () => {
  it("an empty screening is not computable and asks for household size first", () => {
    const r = assessCompleteness({});
    expect(r.computable).toBe(false);
    expect(r.stillNeeded[0]).toBe("Household size");
  });

  it("becomes computable once every field is EXPLICITLY known", () => {
    const r = assessCompleteness({
      household: [{ member_id: "applicant", age: 62, role: "head", immigration: "citizen" }],
      income: [{ member: "applicant", type: "ssa", amount: 1180 }],
      shelter: { rent: 600, sua_tier: "none" },
      deductions: {},
      assets: 500,
      cat_elig: "NPA",
    });
    expect(r.computable).toBe(true);
    expect(r.stillNeeded).toEqual([]);
  });

  it("$0 assets confirmed is NOT the same as assets never asked", () => {
    const asked = assessCompleteness({
      household: [{ member_id: "a", age: 40, role: "head", immigration: "citizen" }],
      shelter: { rent: 500, sua_tier: "none" },
      cat_elig: "NPA",
      assets: 0, // explicitly confirmed zero
    });
    expect(asked.stillNeeded).not.toContain("Countable assets, if any");

    const notAsked = assessCompleteness({
      household: [{ member_id: "a", age: 40, role: "head", immigration: "citizen" }],
      shelter: { rent: 500, sua_tier: "none" },
      cat_elig: "NPA",
      // assets omitted entirely — never asked
    });
    expect(notAsked.stillNeeded).toContain("Countable assets, if any");
  });

  it("asks about citizenship per member, once a household exists", () => {
    const r = assessCompleteness({
      household: [{ member_id: "applicant", age: 62, role: "head" }], // no immigration
    });
    expect(r.stillNeeded).toContain("Citizenship or qualified status");
  });

  it("a mostly-complete screening still lists the mockup's own still-needed items", () => {
    // Frame 03's exact "Still needed: 4 items" state — everything about the
    // person is known except these four.
    const r = assessCompleteness({
      household: [{ member_id: "applicant", age: 62, role: "head" }],
      income: [{ member: "applicant", type: "ssa", amount: 1180 }],
      deductions: { medical_unreimbursed: 175 },
    });
    expect(r.computable).toBe(false);
    expect(r.stillNeeded).toEqual(
      expect.arrayContaining([
        "Citizenship or qualified status",
        "Countable assets, if any",
        "Whether the household receives SSI or TANF",
        "Rent or shelter cost",
      ]),
    );
    expect(r.stillNeeded).not.toContain("Household size");
  });

  it("a malformed field surfaces visibly rather than vanishing", () => {
    const r = assessCompleteness({
      household: [{ member_id: "a", age: -5, role: "head", immigration: "citizen" }], // fails age min(0)
      shelter: { rent: 500, sua_tier: "none" },
      cat_elig: "NPA",
      assets: 0,
    });
    expect(r.computable).toBe(false);
    expect(r.stillNeeded.length).toBeGreaterThan(0);
    expect(r.rawErrors.length).toBeGreaterThan(0);
  });

  // The panel said "Missing: household.0.age" and "Missing: household.1.age" —
  // internal field paths, one per member, in a list otherwise written in
  // English. It told the reader nothing about what to say next.
  it("names fields in English, and only once however many members are missing one", () => {
    const r = assessCompleteness({
      household: [
        { member_id: "a", age: -5, role: "head", immigration: "citizen" },
        { member_id: "b", age: -9, role: "spouse", immigration: "citizen" },
      ],
      shelter: { rent: 500, sua_tier: "none" },
      cat_elig: "NPA",
      assets: 0,
    });
    expect(r.stillNeeded.filter((x) => x.includes("age"))).toHaveLength(1);
    expect(r.stillNeeded.join(" ")).not.toMatch(/household\.\d|Missing:/);
  });

  // Dropping an unmapped path silently would let stillNeeded empty out while
  // the data is still malformed, and composeVerdict would be handed facts Zod
  // has already rejected.
  it("never reports computable while Zod is still rejecting the facts", () => {
    const r = assessCompleteness({
      household: [{ member_id: "a", age: -5, role: "head", immigration: "citizen" }],
      shelter: { rent: 500, sua_tier: "none" },
      cat_elig: "NPA",
      assets: 0,
    });
    expect(r.rawErrors.length).toBeGreaterThan(0);
    expect(r.computable).toBe(false);
  });

  it("computable:true means composeVerdict can ACTUALLY run — not just that Zod is happy with a default", () => {
    // Regression: assessCompleteness used to default `deductions: {}` for
    // ITS OWN internal Zod check while classifyScreening cast the raw,
    // un-defaulted facts straight to Facts before calling composeVerdict —
    // so "computable: true" and "the engine can actually run on this"
    // silently disagreed whenever nobody had mentioned a deduction. A
    // caseworker never gets asked "any deductions?" as its own item, so a
    // household with none stated legitimately reaches computable:true and
    // must be directly callable, not just Zod-shaped.
    const facts: PartialFacts = {
      household: [{ member_id: "a", age: 62, role: "head", immigration: "citizen" }],
      income: [{ member: "a", type: "ssa", amount: 1180 }],
      shelter: { rent: 600, sua_tier: "none" },
      assets: 500,
      cat_elig: "NPA",
      // deductions deliberately omitted — nobody mentioned any.
    };
    const r = assessCompleteness(facts);
    expect(r.computable).toBe(true);
    expect(r.rawErrors).toEqual([]);
  });

  it("de-duplicates repeated checklist items", () => {
    const r = assessCompleteness({});
    const counts = new Map<string, number>();
    for (const item of r.stillNeeded) counts.set(item, (counts.get(item) ?? 0) + 1);
    for (const [, n] of counts) expect(n).toBe(1);
  });
});
