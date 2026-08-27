// @vitest-environment jsdom
//
// "the chat broke down… especially when i began flickering through states"
// (owner, 2026-08-27, with a transcript ending in `http_400`).
//
// WHAT HAPPENED. Every streaming write targets messages[length - 1] if it is
// an assistant. changeState APPENDED its divider and the state's portal blurb,
// so changing state while an answer was still streaming put an assistant
// message BEHIND the half-written one. The stream then wrote the answer into
// the portal message, and the empty placeholder was stranded mid-transcript.
//
// An empty assistant turn is invalid. Reproduced against the running route:
//   400 {"error":"message.content must be a non-empty string"}
// with no `reason` field — which the client renders as
//   "Demeter couldn't read that … (http_400)"
//
// And it STICKS: the invalid turn stays in history, so every retry resends it.
// That is why the conversation never recovered.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DemeterChat } from "../DemeterChat";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const src = () => readFileSync(join(__dirname, "..", "DemeterChat.tsx"), "utf8");

function sendAndCapture(initialMessages: Array<{ role: "user" | "assistant"; content: string }>) {
  const payloads: Array<Array<{ role: string; content: string }>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url) === "/api/demeter" && init?.body) {
        const body = JSON.parse(String(init.body)) as {
          messages?: Array<{ role: string; content: string }>;
        };
        if (body.messages) payloads.push(body.messages);
      }
      return new Response("an answer", { status: 200 });
    }),
  );
  const c = render(
    <DemeterChat
      states={VERIFIED_STATES}
      initialState={null}
      initialQuestion={null}
      initialMessages={initialMessages}
      initialWorksheet={null}
      savedConversationId={null}
      pendingSave={false}
      geoHint={null}
    />,
  ).container;
  fireEvent.change(c.querySelector("textarea")!, {
    target: { value: "Im from guam; but I am currently living in Massachusetts" },
  });
  fireEvent.submit(c.querySelector("form")!);
  return payloads;
}

describe("an empty turn never reaches the server", () => {
  it("is dropped from the payload instead of returning a 400 that sticks", async () => {
    // EXACTLY the transcript's stranded state: an empty assistant left behind
    // by a state change that landed mid-answer.
    const payloads = sendAndCapture([
      { role: "user", content: "I want to find out if I am eligible" },
      { role: "assistant", content: "" },
      { role: "assistant", content: "Guam isn't part of the regular SNAP program." },
    ]);

    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    for (const p of payloads) {
      for (const m of p) {
        expect(
          m.content.trim().length,
          `an empty ${m.role} turn went to the server — this is the 400`,
        ).toBeGreaterThan(0);
      }
    }
    // The real content still travels; this drops the empty turn, not the turn.
    expect(payloads[0]!.some((m) => m.content.includes("Guam isn't part"))).toBe(true);
    expect(payloads[0]![payloads[0]!.length - 1]!.role, "the server needs a user last").toBe("user");
    expect(payloads[0]![0]!.role, "and a user first").toBe("user");
  });
});

describe("the two windows agree", () => {
  it("the send path filters empty turns, as changeState always did", () => {
    // changeState has always built its worksheet window with
    // `x.role !== "divider" && Boolean(x.content)`. The chat's own window
    // filtered only dividers — and the chat's is the one sent to the model.
    // The two disagreeing IS the bug.
    const s = src();
    const i = s.indexOf("const chatTurns = messages.filter(");
    expect(i, "chatTurns is built here").toBeGreaterThan(-1);
    const block = s.slice(i, s.indexOf(");", i) + 2);
    expect(block).toContain('m.role !== "divider"');
    expect(block, "empty turns still reach the server").toContain("Boolean(m.content)");
  });

  it("puts a mid-stream divider IN FRONT of the streaming placeholder", () => {
    // The stream owns the last slot, so inserts have to go before it — or the
    // answer overwrites the portal blurb and strands the placeholder.
    expect(src()).toContain(
      "streaming ? [...m.slice(0, -1), ...inserts, tail] : [...m, ...inserts]",
    );
  });
});

describe("the stop control", () => {
  it("centres its hexagon in the viewBox", () => {
    // It ran y=1 to y=15 in an 18-high box — one pixel of air above, three
    // below — so it sat visibly high in a round button.
    const path = src().match(/d="(M6\.2[^"]+)"/)?.[1] ?? "";
    expect(path, "the stop hexagon path").not.toBe("");
    const ys = [...path.matchAll(/[HhVv]?(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    expect(path, "still one pixel high").not.toContain("M6.2 1h");
    expect(ys.length).toBeGreaterThan(0);
    expect(path).toContain("M6.2 2h");
  });

  it("wears the same terracotta as send, not send's hover colour", () => {
    // --demeter-terracotta-deep IS the send button's hover, so the stop
    // control read as a send button stuck in a hover state.
    const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");
    for (const m of css.matchAll(/\.demeter__send--stop\s*\{([^}]*)\}/g)) {
      expect(m[1], "stop is wearing send's hover colour").not.toMatch(
        /background:\s*var\(--demeter-terracotta-deep\)/,
      );
    }
  });
});
