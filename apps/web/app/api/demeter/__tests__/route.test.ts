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
  isAnswerLang: (v: unknown) => v === "en" || v === "es" || v === "vi" || v === "zh",
  // Real shape, small fixture. Puerto Rico is the case that matters: it does
  // NOT run SNAP, so the route must answer without going near the model.
  napJurisdiction: (code: string | null) =>
    code?.toUpperCase() === "PR"
      ? {
          code: "PR",
          name: "Puerto Rico",
          program: "Programa de Asistencia Nutricional (PAN / NAP)",
          agency: "Departamento de la Familia — ADSEF",
          agencyUrl: "https://www.adsef.pr.gov/",
        }
      : null,
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

/** For the cases where NOT reaching the engine is the point. */
function capturedReqOrNull(): Record<string, unknown> | null {
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

  // Regression (launch audit 2026-08-28): the route clamped lang to en|es, a
  // narrowing that predated vi/zh and silently answered every Vietnamese and
  // Chinese reader in English despite the localized UI sending their language.
  // All four ANSWER_LANGS must reach the engine; anything else is the floor.
  it("threads every answer language through to the engine, not just en|es", async () => {
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      await (await POST(makeReq({ messages: MSGS, lang }))).text();
      expect(capturedReq().lang, lang).toBe(lang);
    }
    // An unrecognized value falls back to English, never through raw.
    await (await POST(makeReq({ messages: MSGS, lang: "fr" }))).text();
    expect(capturedReq().lang).toBe("en");
  });

  it("adapts engine frames to plain text with the recompose marker inline", async () => {
    const res = await POST(makeReq({ messages: MSGS }));
    const text = await res.text();
    expect(text).toBe("draft ⟲ recomposing with verified sources…verified answer\n\n---\ntrailer");
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("answers a NAP territory WITHOUT calling the model", async () => {
    // Puerto Rico does not run SNAP — USDA provides NAP block grants there "in
    // lieu of" it, and the territory sets its own eligibility and benefit
    // levels. So the federal floor, which is a correct answer for any
    // unverified STATE, is a confidently wrong answer here: income limits,
    // deductions, allotments, ABAWD, none of it applies.
    //
    // The model is never asked, because there is nothing for it to be right
    // about and every incentive for it to fabricate from a corpus full of SNAP
    // figures. Asserting the engine was NOT called is the real test.
    const res = await POST(makeReq({ messages: MSGS, state: "PR" }));
    expect(res.status).toBe(200);
    const text = await res.text();

    // `captured.req` is nulled in beforeEach, so it being null here means the
    // engine was not reached BY THIS REQUEST. Asserting on the mock's call
    // count instead would be wrong: it is created once in the mock factory and
    // accumulates across every test in the file, so it is already non-zero by
    // the time this one runs.
    expect(capturedReqOrNull()).toBeNull();
    expect(text).toContain("does not run SNAP");
    expect(text).toContain("Departamento de la Familia");
    // Named so someone can act, not just be turned away.
    expect(text).toContain("adsef.pr.gov");
  });

  it("does not short-circuit a real state", async () => {
    // Guam and the US Virgin Islands DO run SNAP, and so does every state
    // without a verified pack — the federal floor is right for all of them.
    // Only the three NAP territories are special.
    await (await POST(makeReq({ messages: MSGS, state: "WA" }))).text();
    expect(capturedReq().state).toBe("WA");
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
