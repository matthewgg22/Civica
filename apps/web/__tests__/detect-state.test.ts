// Detection has to be RIGHT more than it has to be thorough. Every false
// positive re-scopes someone's answer to a state they do not live in — and the
// failure this fixes was already that shape, answering a Massachusetts
// household with California's rules.
import { describe, expect, it } from "vitest";
import { detectState } from "../lib/detect-state";

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
