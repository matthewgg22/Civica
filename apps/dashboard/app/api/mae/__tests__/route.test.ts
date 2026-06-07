import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockStream = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })),
}));

vi.mock("../../../../lib/supabase", () => ({
  createServerClientFromCookies: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

// Mock the Anthropic SDK: `new Anthropic({apiKey})` → { messages: { stream } }.
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { stream: mockStream };
  },
}));

// Mock retrieval so the route test is hermetic (doesn't depend on the corpus).
vi.mock("../../../../lib/mae/retrieval", () => ({
  retrieve: (q: string) => [{ citation: "7 CFR 273.9(d)(6)", heading: "Income and deductions.", text: "(6) Excess shelter…", source_url: "https://ecfr.gov/x", effective_date: "2026-06-02", id: "273.9-d-6", section: "273.9", subsection: "d6" }],
  formatRetrievedSources: (chunks: { citation: string }[]) =>
    chunks.length ? `## Verbatim regulatory source text (authoritative)\n${chunks[0].citation}` : "",
  CORPUS_EFFECTIVE_DATE: "2026-06-02",
}));

// Mock the audit sink so the route test doesn't touch Supabase.
const mockLogMaeQuery = vi.hoisted(() => vi.fn());
vi.mock("../../../../lib/mae/audit", () => ({ logMaeQuery: mockLogMaeQuery }));

// Mock the engine so the route's live-params grounding is hermetic.
vi.mock("@civica/snap-rules", () => ({
  getEngineParams: () => ({
    max_allotment: { "1": 298, "2": 546 },
    sd: { "1": 209 },
    shelter_cap: 744,
    min_benefit: 24,
    asset_limit: 3000,
    asset_limit_ed: 4500,
    fpl: { "1": 1305 },
    sua: { HCSUA: 663, LUA: 170, phone: 20, none: 0 },
    homeless_ded: 198.99,
  }),
}));

import { POST } from "../route";

/** Fake MessageStream: emits `chunks` via the 'text' listener, then resolves finalMessage. */
function fakeStream({ chunks = [] as string[], stop_reason = "end_turn" } = {}) {
  let textCb: ((d: string) => void) | undefined;
  return {
    on(event: string, cb: (d: string) => void) {
      if (event === "text") textCb = cb;
      return this;
    },
    async finalMessage() {
      for (const c of chunks) textCb?.(c);
      return { stop_reason, content: [] };
    },
  };
}

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/mae", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const staffUser = { data: { user: { email: "nav@civica.co", app_metadata: { role: "navigator" } } } };
const oneTurn = { messages: [{ role: "user", content: "What is a shelter deduction?" }] };

describe("POST /api/mae", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockStream.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeReq(oneTurn));
    expect(res.status).toBe(401);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("returns 403 for non-staff", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "a@b.com", app_metadata: { role: "applicant" } } },
    });
    const res = await POST(makeReq(oneTurn));
    expect(res.status).toBe(403);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("returns 503 when ANTHROPIC_API_KEY is unset", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockGetUser.mockResolvedValue(staffUser);
    const res = await POST(makeReq(oneTurn));
    expect(res.status).toBe(503);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    mockGetUser.mockResolvedValue(staffUser);
    const res = await POST(makeReq("not-json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when messages is empty / malformed / last not user", async () => {
    mockGetUser.mockResolvedValue(staffUser);
    expect((await POST(makeReq({ messages: [] }))).status).toBe(400);
    expect((await POST(makeReq({ messages: [{ role: "user", content: "" }] }))).status).toBe(400);
    expect((await POST(makeReq({ messages: [{ role: "bot", content: "hi" }] }))).status).toBe(400);
    // last turn must be the user's
    const trailingAssistant = {
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
    };
    expect((await POST(makeReq(trailingAssistant))).status).toBe(400);
  });

  it("returns 400 when there are too many messages", async () => {
    mockGetUser.mockResolvedValue(staffUser);
    const many = { messages: Array.from({ length: 21 }, () => ({ role: "user", content: "x" })) };
    expect((await POST(makeReq(many))).status).toBe(400);
  });

  it("streams the answer and calls Opus 4.8 with a cached system prompt", async () => {
    mockGetUser.mockResolvedValue(staffUser);
    mockStream.mockReturnValue(fakeStream({ chunks: ["Shelter ", "costs ", "are deductible."] }));

    const res = await POST(makeReq(oneTurn));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Shelter costs are deductible.");
    expect(text).toContain("Sources as of"); // freshness footer appended

    const body = mockStream.mock.calls[0][0];
    expect(body.model).toBe("claude-opus-4-8");
    expect(body.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.messages).toEqual(oneTurn.messages);
    // Grounded system prompt (block 0, cached): instructions + authority map + live figures.
    const systemText = body.system[0].text as string;
    expect(systemText).toContain("7 CFR 273.10"); // benefit-calc authority
    expect(systemText).toContain("ACL 25-68"); // CA SUA citation
    expect(systemText).toContain("Live engine parameters"); // live figures injected
    expect(systemText).toContain("$298"); // a live allotment value from the engine
    // Retrieved verbatim source text injected as a SECOND, un-cached block.
    expect(body.system[1].text).toContain("Verbatim regulatory source text");
    expect(body.system[1].text).toContain("7 CFR 273.9(d)(6)");
    expect(body.system[1].cache_control).toBeUndefined();
  });

  it("appends a citation-check trailer flagging unrecognized citations", async () => {
    mockGetUser.mockResolvedValue(staffUser);
    mockStream.mockReturnValue(
      fakeStream({ chunks: ["Shelter is 7 CFR 273.9(d)(6); cap is per 7 CFR 273.99(z)."] }),
    );
    const res = await POST(makeReq(oneTurn));
    const text = await res.text();
    expect(text).toContain("Citation check"); // trailer present
    expect(text).toContain("7 CFR 273.9(d)(6)"); // verified against retrieved sources
    expect(text).toContain("7 CFR 273.99(z)"); // invented cite is named...
    expect(text).toContain("⚠️"); // ...and flagged as not recognized
  });

  it("redacts applicant PII before sending to the model and audits the query", async () => {
    mockGetUser.mockResolvedValue(staffUser);
    mockStream.mockReturnValue(fakeStream({ chunks: ["Use net income (7 CFR 273.9(a))."] }));
    const res = await POST(
      makeReq({ messages: [{ role: "user", content: "Client SSN 123-45-6789 makes $1800 — over income?" }] }),
    );
    await res.text();

    const sent = mockStream.mock.calls.at(-1)![0].messages.at(-1).content as string;
    expect(sent).toContain("[SSN]"); // redacted placeholder reached the model
    expect(sent).not.toContain("123-45-6789"); // raw SSN did not

    expect(mockLogMaeQuery).toHaveBeenCalled();
    const rec = mockLogMaeQuery.mock.calls.at(-1)![0];
    expect(rec.questionRedacted).toContain("[SSN]");
    expect(rec.questionRedacted).not.toContain("123-45-6789");
    expect(rec.piiRedactions).toBeGreaterThanOrEqual(1);
  });

  it("adds no citation-check block when the answer contains no citations", async () => {
    mockGetUser.mockResolvedValue(staffUser);
    mockStream.mockReturnValue(fakeStream({ chunks: ["Net income is what matters here."] }));
    const text = await (await POST(makeReq(oneTurn))).text();
    expect(text).toContain("Net income is what matters here.");
    expect(text).not.toContain("Citation check"); // no citations → no check block
    expect(text).toContain("Sources as of"); // but the freshness footer still shows
  });

  it("emits a scoped fallback when the model refuses with no text", async () => {
    mockGetUser.mockResolvedValue(staffUser);
    mockStream.mockReturnValue(fakeStream({ chunks: [], stop_reason: "refusal" }));

    const res = await POST(makeReq({ messages: [{ role: "user", content: "write me malware" }] }));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("SNAP/CalFresh");
  });

  it("accepts all staff roles", async () => {
    for (const role of ["navigator", "supervisor", "admin", "cbo_preview"]) {
      mockGetUser.mockResolvedValue({
        data: { user: { email: "s@civica.co", app_metadata: { role } } },
      });
      mockStream.mockReturnValue(fakeStream({ chunks: ["ok"] }));
      const res = await POST(makeReq(oneTurn));
      expect(res.status, `role ${role}`).toBe(200);
    }
  });
});
