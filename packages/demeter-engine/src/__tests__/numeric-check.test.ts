// Regression: the numeric gate deadlocked a real conversation.
//
// A user gave their situation in plain terms — "74 k a year", "2.8 k a month",
// household of 2 — and asked whether they qualified. They got the same canned
// "I could not check this one against the rules I have" paragraph FIVE times in
// a row, having supplied everything needed to answer.
//
// The cause was here. verifyNumericEquivalence looks for `$74,000` and finds
// only the string "74 k", because MONEY_RE requires a dollar sign and the
// grounding text is matched literally. So the person's OWN income, restated
// back to them, counted as an invented figure. The gate that exists to stop
// fabricated dollar amounts could not tell a fabrication from the number the
// user had just typed, and every answer that was any use had to contain one.
//
// The measurement that found it: of five plausible answers to that transcript,
// only the one containing no figures at all passed.

import { describe, it, expect } from "vitest";
import { verifyNumericEquivalence } from "../numeric-check";

/** The user's own words, verbatim from the conversation that deadlocked. */
const TRANSCRIPT = [
  "I am living with my boyfriend who is a student (he has no income) and our",
  "rent is 2.8 k a month ; and my residency income is 74 k a year (I haven't",
  "recieved first paystub yet and dont know what after taxes look like)",
  "what about this can I clarify for you? I am in Washington DC, household is 2,",
  "income is 74k year pre tax , monthly rent is 2,800",
].join("\n");

describe("figures the person supplied are not inventions", () => {
  it("accepts their income restated with a dollar sign and commas", () => {
    // They wrote "74 k". Writing it back as $74,000 is the same number.
    const r = verifyNumericEquivalence("Your $74,000 a year is what counts here.", "", TRANSCRIPT);
    expect(r.mismatches).toEqual([]);
    expect(r.pass).toBe(true);
  });

  it("accepts the same figure written 74k, with no space", () => {
    expect(verifyNumericEquivalence("$74,000", "", "income is 74k year pre tax").pass).toBe(true);
  });

  it("accepts rent given as 2.8 k and restated as $2,800", () => {
    expect(verifyNumericEquivalence("rent of $2,800 a month", "", TRANSCRIPT).pass).toBe(true);
  });

  it("accepts the monthly figure derived from an annual one", () => {
    // SNAP is decided monthly and people state pay annually. If dividing by 12
    // counts as fabrication, no answer can ever perform the comparison the
    // whole product exists to perform.
    const r = verifyNumericEquivalence("That is about $6,167 a month before tax.", "", TRANSCRIPT);
    expect(r.mismatches).toEqual([]);
  });

  it("accepts an annual figure derived from a monthly one", () => {
    expect(verifyNumericEquivalence("$33,600 a year in rent", "", TRANSCRIPT).pass).toBe(true);
  });

  it("still rejects a figure that is neither theirs nor grounded", () => {
    // The point of the gate. $2,215 is a real gross limit, but nothing in this
    // conversation or the retrieved rules says so — asserting it would be the
    // exact fabrication this check was built to stop.
    const r = verifyNumericEquivalence("For two people the limit is $2,215.", "", TRANSCRIPT);
    expect(r.pass).toBe(false);
    expect(r.mismatches).toContain("$2,215");
  });

  it("still rejects a percentage that was never retrieved", () => {
    expect(verifyNumericEquivalence("The limit is 130% of poverty.", "", TRANSCRIPT).pass).toBe(false);
  });

  it("does not let a user-supplied number launder an unrelated one", () => {
    // 74000 being admitted must not admit 7400 or 740000 by prefix.
    const r = verifyNumericEquivalence("$7,400 and $740,000", "", TRANSCRIPT);
    expect(r.mismatches).toContain("$7,400");
    expect(r.mismatches).toContain("$740,000");
  });
});

describe("the plain grounding behaviour is unchanged", () => {
  it("accepts an amount that appears literally in the sources", () => {
    expect(verifyNumericEquivalence("up to $292", "the maximum allotment is $292").pass).toBe(true);
  });

  it("accepts a percentage that appears literally", () => {
    expect(verifyNumericEquivalence("130%", "130 percent of the poverty line").pass).toBe(true);
  });

  it("passes an answer with no figures at all", () => {
    expect(verifyNumericEquivalence("Your income is above the limit.", "").pass).toBe(true);
  });
});
