// The crisis gate (#927). These cases ARE the specification.
//
// The distress gate already catches acute food and housing crisis. This is a
// second, higher tier for the two things a benefits chat will also receive
// and must not answer with policy: self-harm/suicidal ideation, and abuse.
//
// THE ASYMMETRY THAT SHAPES EVERY CHOICE HERE: a false negative means someone
// saying they want to die gets a paragraph about expedited service. A false
// positive means someone gets one gentle line and a phone number they did not
// need. Those are not comparable, so recall wins — but not by matching bare
// words, because a gate that fires on "this paperwork is killing me" reads as
// broken, and a product that mishandles the idiom will not be trusted with
// the real thing.
import { describe, it, expect } from "vitest";
import { detectCrisis, CRISIS_SYSTEM_ADDENDUM } from "../crisis";

describe("self-harm and suicidal ideation", () => {
  it("catches the plain statements, including the issue's own example", () => {
    for (const text of [
      "I can't do this anymore, I'd be better off dead",
      "I want to kill myself",
      "thinking about killing myself",
      "I'm going to end my life",
      "I don't want to be here anymore",
      "sometimes I want to die",
      "I've been having suicidal thoughts",
      "I've been cutting myself again",
      "I want to hurt myself",
    ]) {
      expect(detectCrisis(text), text).toBe("self_harm");
    }
  });

  it("catches it in the other three answer languages", () => {
    expect(detectCrisis("quiero matarme")).toBe("self_harm");
    expect(detectCrisis("estaría mejor muerta")).toBe("self_harm");
    expect(detectCrisis("tôi muốn tự tử")).toBe("self_harm");
    expect(detectCrisis("我想自杀")).toBe("self_harm");
  });

  it("does NOT fire on the idioms this audience actually uses", () => {
    // Every one of these is a plausible sentence on a benefits site, and a
    // crisis response to any of them would read as the product not listening.
    for (const text of [
      "I'm dying to know if I qualify",
      "this paperwork is killing me",
      "my benefits died last month",
      "I could kill for a decent grocery store nearby",
      "the deadline is killing my chances",
      "I'm dead broke",
    ]) {
      expect(detectCrisis(text), text).toBeNull();
    }
  });
});

describe("abuse and domestic violence", () => {
  it("catches disclosure in the forms people actually use", () => {
    for (const text of [
      "my husband hits me",
      "he beats me when I ask for money",
      "my partner is abusive",
      "I'm scared of my boyfriend",
      "I'm not safe at home",
      "I left because of domestic violence",
      "he threatened to kill me",
      "I have a restraining order against him",
    ]) {
      expect(detectCrisis(text), text).toBe("abuse");
    }
  });

  it("catches it in the other three answer languages", () => {
    expect(detectCrisis("mi esposo me pega")).toBe("abuse");
    expect(detectCrisis("violencia doméstica")).toBe("abuse");
    expect(detectCrisis("chồng tôi đánh tôi")).toBe("abuse");
    expect(detectCrisis("家庭暴力")).toBe("abuse");
  });
});

describe("what it leaves to the existing distress gate", () => {
  it("food and housing crisis is NOT escalated here", () => {
    // These already lead with expedited service, 211 and food banks. Routing
    // them to a suicide line instead would be worse, not safer.
    for (const text of [
      "I have no food for my kids tonight",
      "we're homeless right now",
      "my EBT was stolen",
      "no tengo comida",
    ]) {
      expect(detectCrisis(text), text).toBeNull();
    }
  });

  it("an ordinary benefits question is untouched", () => {
    expect(detectCrisis("Do I qualify if I work 20 hours a week?")).toBeNull();
    expect(detectCrisis("How long does the interview take?")).toBeNull();
  });
});

describe("the response the addendum instructs", () => {
  it("carries the right resource for each kind, with no invented number", () => {
    const selfHarm = CRISIS_SYSTEM_ADDENDUM("self_harm");
    expect(selfHarm).toContain("988");
    const abuse = CRISIS_SYSTEM_ADDENDUM("abuse");
    expect(abuse).toContain("1-800-799-7233");
    expect(abuse).toContain("88788");
  });

  it("never tells the model to refuse the benefits question", () => {
    // Someone may disclose abuse BECAUSE it bears on their case — leaving a
    // household changes who they apply as. Withholding the answer would be
    // both unhelpful and patronising.
    for (const kind of ["self_harm", "abuse"] as const) {
      const a = CRISIS_SYSTEM_ADDENDUM(kind);
      expect(a, kind).toMatch(/still answer|then answer/i);
      expect(a, kind).not.toMatch(/refuse|decline to answer|do not answer/i);
    }
  });

  it("forbids diagnosis and pressure", () => {
    for (const kind of ["self_harm", "abuse"] as const) {
      expect(CRISIS_SYSTEM_ADDENDUM(kind), kind).toMatch(/not diagnose|never diagnose/i);
    }
  });
});
