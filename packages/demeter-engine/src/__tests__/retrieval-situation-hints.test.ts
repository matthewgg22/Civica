import { describe, it, expect } from "vitest";
import { retrieve } from "../retrieval";

// Rules the SITUATION triggers but the person's words never name (#957).
//
// MEASURED, 2026-08-22. "I was laid off, I have no income, no savings, and I
// just became homeless. It's just me. Do I qualify for SNAP?" retrieved
// 273.8 (resources) three times, 273.2(m) and 273.4 — "no savings" pulls hard
// toward the asset test — and nothing about the ABAWD time limit. The same
// corpus answers "does the ABAWD time limit apply to me if I have no job"
// with 273.24(a)(b)(d) instantly. Retrieval was never the problem for people
// who already know the words.
//
// That gap shipped: a homeless, laid-off, no-income adult in Vermont was told
// they "clear every test easily", with the rule that ends their benefits after
// three months never mentioned — because the model was never handed it.
//
// The two halves of the contract are FIRES and DOES NOT OVER-FIRE. A hint that
// attaches the time limit to every question would be its own bug: it is
// irrelevant to most of them, and the prompt's "answer what was asked" rule
// exists for good reason.
const cites = async (q: string, state: string | null = "VT") =>
  (await retrieve(q, { state })).map((c) => c.citation).join(" | ");

describe("work-status language reaches the ABAWD time limit", () => {
  it("surfaces 273.24 for the transcript's own question", async () => {
    const got = await cites(
      "I'm in Vermont. I was laid off, I have no income, no savings, and I just became homeless. It's just me. Do I qualify for SNAP?",
    );
    expect(got).toContain("273.24");
  }, 60_000);

  it.each([
    "I lost my job last month, can I get food assistance?",
    "I'm unemployed right now — do I qualify?",
    "I'm out of work and need help with groceries",
  ])("surfaces it for: %s", async (q) => {
    expect(await cites(q)).toContain("273.24");
  }, 60_000);

  it("does NOT attach it to an unrelated question", async () => {
    // Reporting a rent change is 273.12/273.11 work. Pulling the time limit
    // in here would push a real answer out of the budget to make room for one
    // nobody asked about.
    expect(await cites("How do I report that my rent went up?")).not.toContain("273.24");
  }, 60_000);

  it("still answers a named ABAWD question the way it always did", async () => {
    // The hint must not have displaced the direct route.
    const got = await cites("does the ABAWD time limit apply to me if I have no job");
    expect(got).toContain("273.24");
  }, 60_000);
});
