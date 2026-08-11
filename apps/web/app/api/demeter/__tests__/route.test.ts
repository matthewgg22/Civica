import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Route-level spec (T12): the engine is mocked — what's under test is the
// thin wrapper's own contract: referral attribution threading, state
// normalization, frame→plain-text adaptation, the unconfigured 503, and the
// after() spend settle (estimate path).

// The AnswerRequest the route handed the orchestrator. Typed loosely on purpose
// — the point of these assertions is what the ROUTE put in it, so pinning the
// engine's exact request type here would make an unrelated engine change fail
// this file. `unknown` values still force each assertion to say what it expects.
const captured = vi.hoisted(() => ({ req: null as Record<string, unknown> | null }));
const mockGate = vi.hoisted(() => vi.fn());
const mockSettle = vi.hoisted(() => vi.fn());
const afterCallbacks = vi.hoisted(() => [] as Array<() => Promise<void>>);

vi.mock("@civica/demeter-engine", () => ({
  STREAM_RECOMPOSE_MARKER: "⟲ recomposing with verified sources…",
  warmupEmbeddings: vi.fn(),
  parseMessages: (body: unknown) => {
    const b = body as { messages?: unknown };
    return Array.isArray(b?.messages)
      ? { messages: b.messages }
      : { error: "messages must be an array" };
  },
  answerQuestion: vi.fn((req: unknown) => {
    captured.req = req as Record<string, unknown>;
    return (async function* () {
      yield { type: "delta", text: "draft " };
      yield { type: "recompose" };
      yield { type: "delta", text: "verified answer" };
      yield { type: "trailer", text: "\n\n---\ntrailer" };
    })();
  }),
}));
vi.mock("@civica/demeter-engine/packs", () => ({
  VERIFIED_STATE_CODES: ["CA", "WA", "TX", "NY"],
}));
vi.mock("../../../../lib/demeter-usage", () => ({
  checkUsageGate: mockGate,
  settleSpend: mockSettle,
  costUsd: (i: number, o: number) => i * 0.000015 + o * 0.000075,
  estimateTokensFromChars: (c: number) => Math.ceil(c / 4),
}));
vi.mock("../../../../lib/demeter-audit-sink", () => ({ publicAuditSink: vi.fn() }));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (fn: () => Promise<void>) => afterCallbacks.push(fn) };
});

import { POST } from "../route";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/demeter", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const MSGS = [{ role: "user", content: "What is SNAP?" }];

/** The captured request, asserting it exists. A null here means the route never
 *  reached the engine at all, which is a different failure than a wrong field —
 *  so it fails with that message rather than "cannot read property of null". */
function capturedReq(): Record<string, unknown> {
  if (!captured.req) throw new Error("the route never called answerQuestion");
  return captured.req;
}

describe("POST /api/demeter (public wrapper)", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    mockGate.mockReset().mockResolvedValue({ allowed: true });
    mockSettle.mockReset().mockResolvedValue(undefined);
    afterCallbacks.length = 0;
    captured.req = null;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("threads the referral code into audit meta as an opaque scopeRef", async () => {
    const res = await POST(makeReq({ messages: MSGS, state: "TX", ref: "CBO-PB-01" }));
    expect(res.status).toBe(200);
    await res.text();
    expect(capturedReq().meta).toMatchObject({
      mode: "public",
      staffUserId: null,
      scopeRef: "CBO-PB-01",
    });
  });

  it("normalizes state: lowercase verified code upcases, unknown becomes the federal floor", async () => {
    await (await POST(makeReq({ messages: MSGS, state: "tx" }))).text();
    expect(capturedReq().state).toBe("TX");
    await (await POST(makeReq({ messages: MSGS, state: "ZZ" }))).text();
    expect(capturedReq().state).toBeNull();
    await (await POST(makeReq({ messages: MSGS }))).text();
    expect(capturedReq().state).toBeNull();
  });

  it("adapts engine frames to plain text with the recompose marker inline", async () => {
    const res = await POST(makeReq({ messages: MSGS }));
    const text = await res.text();
    expect(text).toBe("draft ⟲ recomposing with verified sources…verified answer\n\n---\ntrailer");
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns an honest 503 when the API key is absent", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await POST(makeReq({ messages: MSGS }));
    expect(res.status).toBe(503);
    expect(((await res.json()) as { reason: string }).reason).toBe("unconfigured");
  });

  it("settles spend via after() using the chars/4 estimate when the SDK reports no usage", async () => {
    const res = await POST(makeReq({ messages: MSGS }));
    await res.text();
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]!();
    expect(mockSettle).toHaveBeenCalledTimes(1);
    const settled = mockSettle.mock.calls[0]![0] as number;
    expect(settled).toBeGreaterThan(0);
  });
});
