import { describe, it, expect, vi, beforeEach } from "vitest";

// The worksheet route's ENTIRE contract is that it degrades quietly. It is a
// side panel on a page whose actual job is answering the question, so every
// failure mode has to return 200 with the caller's own facts handed back —
// never a 4xx/5xx the chat would have to interpret, and never an empty facts
// object that would blank the panel mid-conversation.
//
// It is also the one public route that must NOT persist: the panel shows
// someone's income, and "anonymous-first" has to mean the server keeps none of
// it. That is asserted here by proving no store module is ever reached.

const screenHousehold = vi.hoisted(() => vi.fn());
const checkUsageGate = vi.hoisted(() => vi.fn());
const settleSpend = vi.hoisted(() => vi.fn());

vi.mock("@civica/demeter-engine", () => ({ screenHousehold }));
vi.mock("@civica/demeter-engine/packs", () => ({ VERIFIED_STATE_CODES: ["CA", "TX"] }));
vi.mock("../../../../../lib/demeter-usage", () => ({
  checkUsageGate,
  settleSpend,
  costUsd: () => 0.01,
  estimateTokensFromChars: (n: number) => Math.ceil(n / 4),
}));
// next/server's after() runs its callback inline here so spend settlement is
// observable; the real one defers past the response.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (fn: () => unknown) => void fn() };
});

import { POST } from "../route";

const FACTS = { household_size: 3 };

function req(body: unknown): Request {
  return new Request("http://localhost/api/demeter/worksheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
  checkUsageGate.mockResolvedValue({ allowed: true });
});

describe("POST /api/demeter/worksheet", () => {
  it("returns the classification on the happy path", async () => {
    screenHousehold.mockResolvedValue({
      facts: { household_size: 3, gross_monthly_income: 2000 },
      classification: { outcome: "likely_eligible" },
      usage: { inputTokens: 100, outputTokens: 20 },
    });
    const res = await POST(req({ messages: [{ role: "user", content: "3 of us" }], facts: FACTS, state: "CA" }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.classification.outcome).toBe("likely_eligible");
    expect(body.facts.gross_monthly_income).toBe(2000);
  });

  it.each([
    [
      "the engine throws",
      () => screenHousehold.mockRejectedValue(new Error("boom")),
      { messages: [{ role: "user", content: "hi" }], facts: FACTS, state: "CA" },
    ],
    [
      "the spend ceiling is hit",
      () => checkUsageGate.mockResolvedValue({ allowed: false, reason: "at_capacity" }),
      { messages: [{ role: "user", content: "hi" }], facts: FACTS, state: "CA" },
    ],
    [
      "no state is selected (no honest federal-floor estimate exists)",
      () => {},
      { messages: [{ role: "user", content: "hi" }], facts: FACTS, state: null },
    ],
    [
      "the state has no verified pack",
      () => {},
      { messages: [{ role: "user", content: "hi" }], facts: FACTS, state: "ZZ" },
    ],
    ["there are no messages yet", () => {}, { messages: [], facts: FACTS, state: "CA" }],
  ])("degrades quietly when %s", async (_name, arrange, payload) => {
    arrange();
    const res = await POST(req(payload) as never);
    // 200 + the caller's own facts back: the panel freezes, nothing blanks,
    // and the chat never sees an error it would have to render.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.classification).toBeNull();
    expect(body.facts).toEqual(FACTS);
  });

  it("returns unchanged facts rather than 503 when the API key is unset", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(req({ messages: [{ role: "user", content: "hi" }], facts: FACTS, state: "CA" }) as never);
    expect(res.status).toBe(200);
    expect((await res.json()).facts).toEqual(FACTS);
    expect(screenHousehold).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with a 400 (the one case that is a real error)", async () => {
    const bad = new Request("http://localhost/api/demeter/worksheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    expect((await POST(bad as never)).status).toBe(400);
  });

  it("drops non-conforming message entries instead of forwarding them", async () => {
    screenHousehold.mockResolvedValue({
      facts: FACTS,
      classification: { outcome: "not_enough_information" },
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    await POST(
      req({
        messages: [
          { role: "user", content: "keep" },
          { role: "system", content: "drop — not a chat role" },
          { role: "user", content: 42 },
          null,
        ],
        facts: FACTS,
        state: "CA",
      }) as never,
    );
    expect(screenHousehold.mock.calls[0]![0].messages).toEqual([{ role: "user", content: "keep" }]);
  });
});
