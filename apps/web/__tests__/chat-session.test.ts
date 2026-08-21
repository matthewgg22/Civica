/** @vitest-environment jsdom */
// Regression: a conversation was destroyed by clicking a link in the header.
//
// Someone worked through their whole situation, opened "Application questions"
// to read something, came back, and there was nothing there. No warning, and
// nothing had offered to keep it.
//
// Worth being precise about why a beforeunload handler would not have helped:
// Next.js moves between /chat and /questions on the CLIENT. The page never
// unloads, so the browser never asks — the component just unmounts and the
// state goes with it. The fix is for the navigation to stop losing anything,
// not to warn about it.

import { describe, it, expect, beforeEach } from "vitest";
import { saveChatSession, readChatSession, clearChatSession } from "../lib/chat-session";

const CONVO = {
  messages: [
    { role: "user" as const, content: "I am in Massachusetts, household of 2" },
    { role: "assistant" as const, content: "Here is what that means…" },
  ],
  state: "MA",
  lang: "en",
};

beforeEach(() => window.sessionStorage.clear());

describe("a conversation survives leaving the page", () => {
  it("comes back with its messages, state and language intact", () => {
    saveChatSession(CONVO);
    expect(readChatSession()).toEqual(CONVO);
  });

  it("returns null on a fresh tab", () => {
    expect(readChatSession()).toBeNull();
  });

  it("starting a new conversation does not hand the old one back", () => {
    saveChatSession(CONVO);
    clearChatSession();
    expect(readChatSession()).toBeNull();
  });

  it("an emptied conversation clears the store rather than persisting []", () => {
    saveChatSession(CONVO);
    saveChatSession({ ...CONVO, messages: [] });
    expect(readChatSession()).toBeNull();
  });

  it("survives corrupt stored data without throwing", () => {
    window.sessionStorage.setItem("demeter:chat", "{not json");
    expect(readChatSession()).toBeNull();
  });

  it("refuses a stored value of the wrong shape", () => {
    window.sessionStorage.setItem("demeter:chat", JSON.stringify({ messages: "nope" }));
    expect(readChatSession()).toBeNull();
  });

  it("drops a transcript too large to store rather than throwing on quota", () => {
    saveChatSession({
      ...CONVO,
      messages: [{ role: "user", content: "x".repeat(300_000) }],
    });
    expect(readChatSession()).toBeNull();
  });

  // #898 P2-9: the transcript survived a page change but the drafted
  // application did not — the worksheet (mode, gathered facts, engine
  // classification) lived only in component state, so navigating out and back
  // restored the conversation with the estimate rail wiped.
  it("carries the worksheet — mode, facts and classification — through the round trip", () => {
    const worksheet = {
      mode: "estimate" as const,
      facts: { household: [{ member_id: "a", age: 45, role: "head" }] },
      classification: {
        outcome: "likely_eligible",
        summary: "Net income falls under the one-person limit.",
        completeness: { computable: true, stillNeeded: [] },
      },
    };
    saveChatSession({ ...CONVO, worksheet } as Parameters<typeof saveChatSession>[0]);
    expect(readChatSession()).toEqual({ ...CONVO, worksheet });
  });

  it("a stored session from before the worksheet existed still reads back", () => {
    window.sessionStorage.setItem("demeter:chat", JSON.stringify(CONVO));
    expect(readChatSession()).toEqual(CONVO);
  });

  it("uses sessionStorage, so closing the tab still ends it", () => {
    // The panel promises "close this tab and you cannot return to this
    // conversation". localStorage here would quietly make that untrue, and on
    // a shared machine would leave it for the next person.
    saveChatSession(CONVO);
    expect(window.sessionStorage.getItem("demeter:chat")).not.toBeNull();
    // Emptying the tab-scoped store is enough to lose it — nothing is kept
    // anywhere that would outlive the tab.
    window.sessionStorage.clear();
    expect(readChatSession()).toBeNull();
  });
});
