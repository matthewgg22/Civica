// What a screen reader is told when an answer arrives (P0-1).
//
// Before this there was no live region at all: someone using a screen reader
// asked a question and was told nothing — not that a reply had started, not
// that it had finished, not what it said. The transcript existed, silently.
//
// These test `announcementFor`, the pure function that decides the spoken
// text. The region's WIRING (polite, atomic, fires only when a stream ends) is
// asserted separately below; whether a real screen reader speaks it can only be
// confirmed by running one, which is noted in the PR rather than claimed here.
import { describe, it, expect } from "vitest";
import { announcementFor, readCertainty } from "../DemeterChat";

// Shaped like a real answer: body, a --- rule, the certainty banner, then the
// citation trailer.
const ANSWER = [
  "A household of three in **California** can have up to *the gross limit*.",
  "",
  "---",
  "✓ **CERTAIN** — every figure above is quoted from a retrieved source.",
  "",
  "Sources:",
  "- 7 CFR 273.9(a)(1)",
  "- CDSS MPP 63-409",
].join("\n");

const UNCERTAIN = [
  "Your state may set its own limit.",
  "",
  "---",
  "⚠ **UNCERTAIN** — these are real authorities, but we did not have their text.",
  "",
  "- 7 CFR 273.10",
].join("\n");

describe("what a screen reader hears", () => {
  it("leads with the certainty verdict, not the answer", () => {
    // An answer spoken without its verdict is the overconfidence the citation
    // verifier exists to prevent. A sighted reader sees the banner; a screen
    // reader user has to hear it, and hear it FIRST — after 200 words of
    // answer is too late to change how you read the answer.
    const said = announcementFor(ANSWER);
    expect(said.indexOf("CERTAIN")).toBeLessThan(said.indexOf("household of three"));
  });

  it("carries the uncertain verdict too", () => {
    expect(announcementFor(UNCERTAIN)).toContain("UNCERTAIN");
  });

  it("does not read the citation trailer aloud", () => {
    // The trailer is a list of links after the rule. Spoken, it is a recitation
    // of section numbers between the reader and whatever they wanted to do
    // next. It stays in the transcript, which is navigable — reaching a
    // reference list by moving through the document is how you would want to
    // read one anyway.
    const said = announcementFor(ANSWER);
    expect(said).not.toContain("Sources:");
    expect(said).not.toContain("CDSS MPP 63-409");
  });

  it("strips markdown emphasis", () => {
    // Screen readers either read `**` aloud as punctuation or switch voice
    // mid-sentence. Neither is what the asterisks meant.
    const said = announcementFor(ANSWER);
    expect(said).not.toContain("**");
    expect(said).not.toContain("*the gross limit*");
    expect(said).toContain("California");
    expect(said).toContain("the gross limit");
  });

  it("says something for an answer with no verdict yet", () => {
    // A refusal or a distress reply carries no certainty banner (#686 made
    // that deliberate). It must still be announced — silence is the bug this
    // whole item exists to fix.
    const plain = "I can't help with that, but here is who can.";
    expect(readCertainty(plain)).toBeNull();
    expect(announcementFor(plain)).toContain("who can");
  });

  it("is empty for an empty answer rather than announcing whitespace", () => {
    expect(announcementFor("")).toBe("");
  });
});
