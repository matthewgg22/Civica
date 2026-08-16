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

// Round two, from a second real transcript. A rideshare driver said they made
// 3 k last month and spent 300 on gas, and got the deadlock all over again —
// because SNAP counts self-employment income as receipts MINUS business costs,
// so the only useful answer contains $2,700: a number in no regulation,
// reachable only by doing the arithmetic the programme requires. The first fix
// admitted their figures and the same figures on another pay cadence, which was
// not enough.
describe("arithmetic on their own figures", () => {
  const UBER = [
    "last month I made about 3 k on uber and then spent 300 on gas last month",
    "okay my monthly income is 3 k",
  ].join("\n");

  it("accepts receipts minus their own stated expenses", () => {
    const r = verifyNumericEquivalence("That leaves about $2,700 a month.", "", UBER);
    expect(r.mismatches).toEqual([]);
  });

  it("accepts that figure annualised", () => {
    expect(verifyNumericEquivalence("$32,400 a year", "", UBER).pass).toBe(true);
  });

  it("still refuses a gross limit we never retrieved", () => {
    expect(verifyNumericEquivalence("The limit is $3,380.", "", UBER).pass).toBe(false);
  });

  it("still refuses the standard deduction", () => {
    // A real figure, and exactly the kind this gate exists to stop: it comes
    // from the regulations, not from anything the person said.
    expect(verifyNumericEquivalence("A standard deduction of $204.", "", UBER).pass).toBe(false);
  });

  it("still refuses a maximum allotment", () => {
    expect(verifyNumericEquivalence("Up to $973 a month.", "", UBER).pass).toBe(false);
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

// Regression (live conversational QA, 2026-08-15): a furloughed-worker
// question ("no paychecks right now, backpay eventually") degraded 4/4
// identical live runs. The retrieved citations were fine every time — every
// run failed on the SAME thing: the answer correctly says the person's
// countable income is "$0" this month, and that figure could never satisfy
// the gate. admissibleFromUser() deliberately filters v <= 0 (nobody types
// "I make $0" — they describe having no paycheck), and no regulation states
// "$0" as a figure either, so this was structurally unsatisfiable no matter
// how the true, safe statement was phrased.
// Regression (real transcript, 2026-08-15): a cash-paid housekeeper said
// "$150 a day for 4 days a week" and got the SAME "I'm still stuck on the
// number" refusal on three consecutive turns, no matter how much more detail
// she supplied — household size, an expense figure, even a flat "$2,000 a
// month" restatement. The gate's own CADENCE_FACTORS ([12, 52, 26]) only
// support annual↔monthly/weekly/biweekly conversions — it has no notion of a
// WEEKLY figure converted directly to MONTHLY, which is the very first thing
// anyone paid by the day or week needs and the very first thing the model
// correctly reached for every time. That conversion is not an approximation
// Demeter invented: 7 CFR 273.10(c)(2), already in the vendored corpus,
// states it verbatim — "the State agency shall convert the income to a
// monthly amount by multiplying weekly amounts by 4.3 and biweekly amounts
// by 2.15." Every attempt to state that exact, regulation-mandated figure
// was rejected as an unverifiable invention.
describe("weekly/biweekly income converted to monthly (7 CFR 273.10(c)(2))", () => {
  it("accepts a weekly figure converted to monthly by 4.3", () => {
    // $150/day × 4 days = $600/week; × 4.3 = $2,580/month.
    const r = verifyNumericEquivalence(
      "That works out to about $2,580 a month.",
      "",
      "I get 150 a day for 4 days a week",
    );
    expect(r.mismatches).toEqual([]);
    expect(r.pass).toBe(true);
  });

  it("accepts a biweekly figure converted to monthly by 2.15", () => {
    const r = verifyNumericEquivalence(
      "That comes to about $1,290 a month.",
      "",
      "I get paid 600 every two weeks",
    );
    expect(r.mismatches).toEqual([]);
    expect(r.pass).toBe(true);
  });

  it("accepts the SAME weekly figure restated across several turns, not just once", () => {
    // The real deadlock was not one bad turn — it was every subsequent turn
    // repeating the identical refusal even as more detail was supplied.
    const transcript = [
      "I get 150 a day for 4 days a week by the house owner and its after each day",
      "I live with me and my son who is 15 and in school. I get 150 a day, 4 days a week, every month and I spend about 50 dollars on cleaning supplies monthly.",
    ].join("\n");
    const r = verifyNumericEquivalence(
      "$150 × 4 days = $600/week. Converted to monthly (× 4.3): about $2,580/month gross. Minus your $50 in supplies leaves $2,530.",
      "",
      transcript,
    );
    expect(r.mismatches).toEqual([]);
    expect(r.pass).toBe(true);
  });

  it("still refuses a monthly figure that is not actually 4.3× or 2.15× anything the person said", () => {
    // The point of the gate still holds — this must not become "any number
    // near a stated figure passes".
    const r = verifyNumericEquivalence("That comes to $9,999 a month.", "", "I get 150 a day for 4 days a week");
    expect(r.pass).toBe(false);
    expect(r.mismatches).toContain("$9,999");
  });
});

describe("zero is never treated as a fabrication", () => {
  it("accepts $0 with no grounding and no user-stated figure at all", () => {
    const r = verifyNumericEquivalence(
      "Your countable income is $0 this month since you're not receiving a paycheck.",
      "",
      "I'm furloughed, no paychecks right now",
    );
    expect(r.mismatches).toEqual([]);
    expect(r.pass).toBe(true);
  });

  it("does not let $0 launder an UNRELATED invented figure in the same answer", () => {
    // The fix targets the literal "$0" match only — a real fabrication
    // elsewhere in the same answer must still be caught.
    const r = verifyNumericEquivalence(
      "Your countable income is $0 this month, and the limit is $9,999.",
      "",
      "I'm furloughed, no paychecks right now",
    );
    expect(r.mismatches).toEqual(["$9,999"]);
    expect(r.pass).toBe(false);
  });
});
