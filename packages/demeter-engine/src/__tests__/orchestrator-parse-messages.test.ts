import { describe, it, expect } from "vitest";
import { parseMessages, ANSWER_LIMITS } from "../orchestrator";

// Regression for #833: a real production conversation got permanently
// locked out with "Conversation must start with a user message" past ~10
// exchanges. Root cause is client-side (apps/web/components/DemeterChat.tsx
// tail-slices raw history to MAX_MESSAGES without checking the surviving
// array still starts with "user"), but this spec pins the SERVER's half of
// the fix: parseMessages must self-heal a leading non-user message by
// trimming it, not hard-reject a window that is otherwise a perfectly valid
// tail of a real conversation.
//
// The math: a strictly alternating, user-first history has ODD length once
// the newest user question is appended. Slicing that odd-length array down
// to MAX_MESSAGES (20, even) always drops an ODD number of leading
// elements — so the surviving array's first element is always the
// assistant, on EVERY turn after the conversation first crosses this
// length, not just once.
function alternatingHistory(totalMessages: number): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (let i = 0; i < totalMessages; i++) {
    out.push({ role: i % 2 === 0 ? "user" : "assistant", content: `turn ${i}` });
  }
  return out;
}

describe("parseMessages — leading non-user message (#833)", () => {
  it("trims a dangling leading assistant message instead of rejecting", () => {
    // 21 messages, alternating starting with user: index 0 is user, so a
    // naive slice(-20) drops exactly message 0, leaving an assistant first.
    const raw = alternatingHistory(21);
    const windowed = raw.slice(-ANSWER_LIMITS.MAX_MESSAGES);
    expect(windowed[0]!.role).toBe("assistant"); // confirms the window IS the bug shape

    const result = parseMessages({ messages: windowed });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.messages[0]!.role).toBe("user");
    expect(result.messages[result.messages.length - 1]!.role).toBe("user");
    // Trimmed exactly the one dangling leader, nothing else.
    expect(result.messages.length).toBe(ANSWER_LIMITS.MAX_MESSAGES - 1);
  });

  it("still rejects a conversation with no user message at all", () => {
    const result = parseMessages({
      messages: [{ role: "assistant", content: "orphaned assistant turn" }],
    });
    expect(result).toEqual({ error: "Conversation must start with a user message" });
  });

  it("leaves an already user-first, user-last conversation untouched", () => {
    const raw = alternatingHistory(9); // ends assistant; make it end user:
    raw.push({ role: "user", content: "final question" });
    const result = parseMessages({ messages: raw });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.messages).toEqual(raw);
  });

  it("still rejects when the last message is not from the user", () => {
    const result = parseMessages({
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
    });
    expect(result).toEqual({ error: "The last message must be from the user" });
  });
});
