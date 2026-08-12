// Detection has to be RIGHT more than it has to be thorough. Every false
// positive re-scopes someone's answer to a state they do not live in — and the
// failure this fixes was already that shape, answering a Massachusetts
// household with California's rules.
import { describe, expect, it } from "vitest";
import { detectState, detectUncoveredPlace } from "../lib/detect-state";

describe("finds the state someone names", () => {
  it.each([
    ["im in boston", "MA"],
    ["I am in Massachusetts", "MA"],
    ["lets do nevada", "NV"],
    ["New York?", "NY"],
    ["i live in san francisco", "CA"],
    ["we're in NYC", "NY"],
  ])("%s → %s", (text, code) => {
    expect(detectState(text)?.code ?? null).toBe(code);
  });

  it("calls it back by the STATE's name", () => {
    expect(detectState("im in boston")).toMatchObject({ code: "MA", name: "Massachusetts" });
  });
});

describe("refuses rather than guesses", () => {
  it("says nothing when two states are named", () => {
    // Asking about the wrong one is worse than not asking.
    expect(detectState("is it different in Texas or California?")).toBeNull();
  });

  it("ignores a hypothetical", () => {
    expect(detectState("if I moved to Texas would I still qualify?")).toBeNull();
    expect(detectState("what about Nevada?")).toBeNull();
    expect(detectState("when I lived in Ohio it was different")).toBeNull();
  });

  it("does not read lowercase words that happen to be state codes", () => {
    // "in", "or", "me", "hi", "ok", "la", "pa" are all real state codes.
    expect(detectState("can i get help or is it too late")).toBeNull();
    expect(detectState("ok so what do i do")).toBeNull();
    expect(detectState("me and my kids need food")).toBeNull();
    expect(detectState("hi can you help me")).toBeNull();
  });

  it("reads a capitalised code as a state", () => {
    expect(detectState("I'm in MA")?.code).toBe("MA");
  });

  it("skips ambiguous city names entirely", () => {
    // Springfield, Portland and Columbus exist in several states.
    expect(detectState("i live in springfield")).toBeNull();
    expect(detectState("im in portland")).toBeNull();
    expect(detectState("columbus")).toBeNull();
  });

  it("says nothing on a misspelling rather than guessing at one", () => {
    // Real input, from the transcript. Fuzzy-matching state names would be a
    // way to get this wrong confidently; the offer simply does not appear.
    expect(detectState("there is three of us ; income is 6 k in Massahcusetts")).toBeNull();
  });

  it("handles empty input", () => {
    expect(detectState("")).toBeNull();
  });
});

// Regression: "I am in Washington dc" was answered as Washington State.
//
// `hay` contains " washington " — the trailing space belongs to "washington dc"
// — so the substring pass matched WA and returned it as a confident single hit.
// The person was shown a different agency, a different portal and different
// figures for a jurisdiction they had named correctly and unambiguously.
describe("places this product does not cover", () => {
  it.each([
    "I am in Washington dc",
    "im in Washington, D.C.",
    "I live in the District of Columbia",
    "washington d.c. household of 2",
  ])("does not read %s as Washington State", (text) => {
    expect(detectState(text)).toBeNull();
    expect(detectUncoveredPlace(text)).toBe("Washington, D.C.");
  });

  it("still detects Washington State when D.C. is not what they said", () => {
    expect(detectState("I am in Washington")?.code).toBe("WA");
    expect(detectState("I live in Seattle")?.code).toBe("WA");
    expect(detectUncoveredPlace("I am in Washington")).toBeNull();
  });

  it("flags Puerto Rico, which runs NAP rather than SNAP", () => {
    // Not a coverage gap we can close with a state pack: it is a different
    // programme, so every figure on this site is wrong there.
    expect(detectUncoveredPlace("I live in Puerto Rico")).toBe("Puerto Rico");
    expect(detectState("I live in Puerto Rico")).toBeNull();
  });

  it("leaves ordinary messages alone", () => {
    expect(detectUncoveredPlace("how much could I get")).toBeNull();
  });
});

// Regression: "but he gets VA benefits?" offered to re-scope a California
// conversation to Virginia, mid-answer, after the state was already settled.
//
// Veterans are not an edge case here. VA income, VA disability and VA health
// care come up in SNAP screening constantly, and every one of them reads as a
// state code to a bare two-letter match.
describe("two-letter codes that are acronyms for something else", () => {
  it.each([
    "but he gets VA benefits? my income is 2 k a month",
    "he has a VA disability rating",
    "I go to the VA hospital",
    "waiting on my VA claim",
  ])("does not read %s as Virginia", (text) => {
    expect(detectState(text)).toBeNull();
  });

  it("still detects Virginia when they mean the state", () => {
    expect(detectState("I live in VA")?.code).toBe("VA");
    expect(detectState("I am in Virginia")?.code).toBe("VA");
    expect(detectState("we moved to Richmond")?.code).toBe("VA");
  });

  // The rule keys off the NOUN that follows, not off the code alone — so it
  // catches the phrasings that actually turn up in benefits conversations and
  // deliberately does not try to catch every possible acronym. "my MD said I
  // cannot work" is still read as Maryland; that is a known limit, not an
  // oversight, and widening it costs real detections.
  it("covers the same shape for other codes", () => {
    expect(detectState("the DE office lost my form")).toBeNull();
    expect(detectState("I applied for an OK loan")).toBeNull();
  });
});
