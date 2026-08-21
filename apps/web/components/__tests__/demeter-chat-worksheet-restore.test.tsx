// @vitest-environment jsdom
//
// The drafted application survives coming back (#898 P2-9).
//
// A real 25-turn tester built up a full estimate — household, income, rent —
// pressed Save at the end, went through sign-in, and came back to find "the
// whole drafted application tracking removed". The transcript survived (the
// chat-session and pending-save stashes both carry messages/state/lang) but
// NEITHER carried the worksheet: the mode toggle reset to "Just asking",
// factsRef remounted empty, and the classification was gone. The same hole
// exists on plain in-tab navigation (header link out and back).
//
// These drive the real DemeterChat through the sessionStorage restore path
// with a worksheet in the stored session, and assert the estimate rail comes
// back exactly as it was left: estimate mode active, the engine outcome and
// summary on screen.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { PackMeta } from "@civica/demeter-engine/packs";

import { DemeterChat } from "../DemeterChat";
import { T } from "../../lib/i18n/demeter-chat-copy";
import { OUTCOME_COPY } from "../../lib/screening-worksheet-shape";

Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

const verification = {
  verified_on: "2026-08-05",
  method: "test fixture",
  gates: "n/a",
  sources: [],
};
const STATES: PackMeta[] = [
  {
    code: "MA",
    program: "Massachusetts SNAP",
    agency: "DTA",
    adminModel: "state",
    portal: undefined,
    verified: true,
    verification,
  },
];

const SESSION = {
  messages: [
    { role: "user", content: "it's me and my two kids in Massachusetts" },
    { role: "assistant", content: "Here's how that works…" },
  ],
  state: "MA",
  lang: "en",
  worksheet: {
    mode: "estimate",
    facts: {
      household: [
        { member_id: "applicant", age: 45, role: "head" },
        { member_id: "child_15", age: 15, role: "child" },
        { member_id: "son_20", age: 20, role: "child" },
      ],
    },
    classification: {
      outcome: "likely_eligible",
      summary: "Net income falls under the three-person limit.",
      completeness: { computable: true, stillNeeded: [] },
    },
  },
};

beforeEach(() => window.sessionStorage.clear());
afterEach(cleanup);

describe("the worksheet survives a page change (#898 P2-9)", () => {
  it("restores estimate mode and the outcome the rail was showing", () => {
    window.sessionStorage.setItem("demeter:chat", JSON.stringify(SESSION));
    render(<DemeterChat states={STATES} />);

    // The transcript came back (this already worked). getAllByText: the last
    // answer also lands in the aria-live announcer, so the text appears twice.
    expect(screen.getAllByText("Here's how that works…").length).toBeGreaterThan(0);
    // …and so did the drafted application (this is the fix): the mode toggle
    // is back on "Build my estimate", not reset to the default…
    expect(
      screen.getByRole("radio", { name: T.en.worksheet.modeEstimate }).getAttribute(
        "aria-checked",
      ),
    ).toBe("true");
    // …and the engine's verdict is on screen again, not blanked.
    expect(screen.getByText(OUTCOME_COPY.likely_eligible.label)).toBeTruthy();
    expect(screen.getByText(SESSION.worksheet.classification.summary)).toBeTruthy();
  });

  it("a session without a worksheet still restores, in the default mode", () => {
    const { worksheet: _dropped, ...bare } = SESSION;
    window.sessionStorage.setItem("demeter:chat", JSON.stringify(bare));
    render(<DemeterChat states={STATES} />);

    expect(screen.getAllByText("Here's how that works…").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("radio", { name: T.en.worksheet.modeAsk }).getAttribute("aria-checked"),
    ).toBe("true");
  });
});
