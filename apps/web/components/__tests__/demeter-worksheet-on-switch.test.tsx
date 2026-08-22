// @vitest-environment jsdom
//
// Turning the estimate ON reads the conversation you already had.
//
// THE BUG THIS PINS: extraction ran only inside send(). Switching to "Build my
// estimate" after a full conversation changed the heading and nothing else —
// the outline sat on its empty template until the user happened to send
// another message. In a real transcript (2026-08-22) someone had already given
// state, household size and income in ask mode; switching produced an empty
// panel, which reads as broken at the exact moment they asked for the feature.
//
// AND THE LINE THAT MUST NOT MOVE: ask mode extracts NOTHING and makes no paid
// call. Switching is the consent. So the same test that proves the estimate
// populates on switch also proves ask mode never posts.
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

import { DemeterChat } from "../DemeterChat";
import { T } from "../../lib/i18n/demeter-chat-copy";

Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
afterEach(cleanup);

const worksheetCalls: Array<{ messages: Array<{ role: string; content: string }> }> = [];

beforeEach(() => {
  worksheetCalls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/demeter/worksheet")) {
        worksheetCalls.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ facts: {}, classification: null }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }),
  );
});

const PRIOR = [
  { role: "user" as const, content: "I want to find out if I am eligible" },
  { role: "assistant" as const, content: "Which state are you in, and how many people?" },
  { role: "user" as const, content: "Just me, no income, I was laid off" },
  { role: "assistant" as const, content: "Understood — household of one, no income." },
];

function mount(state: string | null) {
  return render(
    <DemeterChat
      states={VERIFIED_STATES}
      initialState={state}
      initialQuestion={null}
      initialMessages={PRIOR}
      initialWorksheet={null}
      savedConversationId={null}
      pendingSave={false}
      geoHint={null}
    />,
  );
}

function switchTo(label: string) {
  fireEvent.click(screen.getByRole("radio", { name: label }));
}

describe("switching to the estimate acts on the conversation already had", () => {
  it("posts the prior turns for extraction the moment it is turned on", async () => {
    mount(VERIFIED_STATES[0]!.code);
    expect(worksheetCalls, "ask mode must not have extracted anything").toHaveLength(0);

    switchTo(T.en.worksheet.modeEstimate);

    await waitFor(() => expect(worksheetCalls.length).toBeGreaterThan(0));
    const sent = worksheetCalls[0]!.messages;
    // The facts it needs were in the conversation before the switch.
    expect(sent.map((m) => m.content).join(" ")).toContain("laid off");
    // The server rejects a history that opens on the assistant (#833).
    expect(sent[0]!.role).toBe("user");
  });

  it("still extracts nothing in ask mode — switching is the consent", async () => {
    mount(VERIFIED_STATES[0]!.code);
    switchTo(T.en.worksheet.modeAsk);
    await new Promise((r) => setTimeout(r, 20));
    expect(worksheetCalls).toHaveLength(0);
  });

  it("does not attempt extraction with no state — there is no honest estimate", async () => {
    mount(null);
    // The control may not even be reachable without a state; either way,
    // nothing may be posted.
    const btn = screen.queryByRole("radio", { name: T.en.worksheet.modeEstimate });
    if (btn) fireEvent.click(btn);
    await new Promise((r) => setTimeout(r, 20));
    expect(worksheetCalls).toHaveLength(0);
  });
});
