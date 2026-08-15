// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { PackMeta } from "@civica/demeter-engine/packs";
import { DemeterChat } from "../DemeterChat";
import { T } from "../../lib/i18n/demeter-chat-copy";

// Regression for #833: a real production conversation got a permanent 400
// ("Conversation must start with a user message") once it passed ~10
// exchanges, and every send after that failed identically — the only way
// out was to abandon the thread and start over.
//
// Root cause: `send()` tail-windows the raw history to the server's
// MAX_MESSAGES (20) with a bare `.slice(-20)`. A strictly alternating,
// user-first history is ODD length once the new question is appended
// (2N+1 for N complete exchanges); slicing an odd-length array down to an
// EVEN window always drops an ODD number of leading elements, so the
// surviving array's first element is always the assistant — deterministically,
// on every turn from the first time the conversation crosses this length
// onward, not as an occasional edge case.

const verification = {
  verified_on: "2026-08-05",
  method: "test fixture",
  gates: "n/a",
  sources: [],
};
const STATES: PackMeta[] = [
  {
    code: "FL",
    program: "Florida SNAP",
    agency: "Florida Department of Children and Families",
    adminModel: "state",
    portal: undefined,
    verified: true,
    verification,
  },
];

function streamedResponse(text: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(text));
      c.close();
    },
  });
  return new Response(stream, { status: 200 });
}

const fetchMock = vi.fn();

Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

beforeEach(() => {
  let turn = 0;
  fetchMock.mockReset().mockImplementation(async () => {
    turn += 1;
    return streamedResponse(`answer ${turn}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function sendQuestion(text: string, expectAnswer: string) {
  fireEvent.change(screen.getByPlaceholderText(T.en.inputPlaceholder), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(screen.getAllByText(expectAnswer).length).toBeGreaterThan(0));
}

describe("DemeterChat message window (#833)", () => {
  it("keeps every request's messages array starting with a user turn past 10 exchanges", async () => {
    render(<DemeterChat states={STATES} initialState="FL" />);

    // 12 exchanges — well past the 20-message/10-exchange threshold where the
    // naive slice(-20) always lands on an assistant-first window.
    for (let i = 1; i <= 12; i++) {
      await sendQuestion(`question ${i}`, `answer ${i}`);
    }

    expect(fetchMock).toHaveBeenCalledTimes(12);
    for (let i = 0; i < 12; i++) {
      const body = JSON.parse((fetchMock.mock.calls[i]![1] as RequestInit).body as string);
      const messages = body.messages as Array<{ role: string; content: string }>;
      expect(messages.length).toBeGreaterThan(0);
      expect(
        messages[0]!.role,
        `request ${i + 1} sent an assistant-first window (len ${messages.length}) — the exact #833 shape`,
      ).toBe("user");
      expect(messages[messages.length - 1]!.role).toBe("user");
      expect(messages.length).toBeLessThanOrEqual(20);
    }
  });
});
