/**
 * Member-index counter tests for the step-2 People sub-flow (V1-5 PR4, #314).
 *
 * These cover the runtime advancement logic that the benefitscal-cbo harness
 * tests CANNOT reach: the sessionStorage counter that tracks which household
 * member the extension is currently filling. The harness proves "given index N,
 * the right member fills"; this proves "the index advances to N correctly across
 * repeated ABNMI_MEMBER page visits."
 *
 * Simulated walk:
 *   ABHSD (gate)         → enterPeopleSection()  → index resets to -1
 *   ABNMI_MEMBER (mem 1) → startNextMember()     → 0
 *   ABNMI_MEMBER (mem 2) → startNextMember()     → 1
 *   ...the member's other pages (ABHHR/ABPSM/...) read getMemberIndex() (stable)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  inPeopleSection,
  getMemberIndex,
  enterPeopleSection,
  startNextMember,
} from "../src/content";

describe("People sub-flow member-index counter", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("is not in the People section before ABHSD", () => {
    expect(inPeopleSection()).toBe(false);
    expect(getMemberIndex()).toBe(-1);
  });

  it("enterPeopleSection() flags the section and resets the index", () => {
    sessionStorage.setItem("civica.memberIndex", "7"); // stale from a prior tab walk
    enterPeopleSection();
    expect(inPeopleSection()).toBe(true);
    expect(getMemberIndex()).toBe(-1);
  });

  it("startNextMember() advances 0, 1, 2 on successive member pages", () => {
    enterPeopleSection();
    expect(startNextMember()).toBe(0);
    expect(startNextMember()).toBe(1);
    expect(startNextMember()).toBe(2);
  });

  it("getMemberIndex() stays stable between member-page visits", () => {
    enterPeopleSection();
    startNextMember(); // → 0 (ABNMI_MEMBER for member 1)
    // The member's other pages (ABHHR, ABPSM, ABBPF, ABLNA, ABHAD) all read the
    // same index without advancing it.
    expect(getMemberIndex()).toBe(0);
    expect(getMemberIndex()).toBe(0);
    startNextMember(); // → 1 (next ABNMI_MEMBER)
    expect(getMemberIndex()).toBe(1);
  });

  it("re-entering the section (new walk) resets the counter cleanly", () => {
    enterPeopleSection();
    startNextMember(); // 0
    startNextMember(); // 1
    // A fresh activation (e.g. staff restarts the application in the same tab)
    enterPeopleSection();
    expect(getMemberIndex()).toBe(-1);
    expect(startNextMember()).toBe(0);
  });
});
