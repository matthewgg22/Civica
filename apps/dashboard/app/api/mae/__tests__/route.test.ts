import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockAnswer = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })),
}));

vi.mock("../../../../lib/supabase", () => ({
  createServerClientFromCookies: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
  createServiceClient: vi.fn(() => ({})),
}));

// The route is a THIN wrapper (eng review 5A): mock the engine's orchestrator,
// keep the real parseMessages so input validation is tested for real.
vi.mock("@civica/demeter-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@civica/demeter-engine")>();
  return { ...actual, answerQuestion: mockAnswer };
});

import { POST } from "../route";
import { STREAM_RECOMPOSE_MARKER as RECOMPOSE_MARKER } from "@civica/demeter-engine";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/mae", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function readAll(res: Response): Promise<string> {
  return await res.text();
}

const VALID_BODY = { messages: [{ role: "user", content: "What is the shelter deduction?" }] };

async function* frames(list: Array<{ type: string; text?: string }>) {
  for (const f of list) yield f;
}

describe("POST /api/mae (staff wrapper)", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("NEXT_PUBLIC_MAE_PREVIEW", "");
    mockGetUser.mockReset();
    mockAnswer.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("401s anonymous users (auth matrix: dashboard side stays gated)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("403s signed-in non-staff", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: { role: "applicant" } } } });
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("503s when ANTHROPIC_API_KEY is unset", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: { role: "navigator" } } } });
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(503);
  });

  it("400s invalid message shapes via the real parseMessages", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: { role: "navigator" } } } });
    const res = await POST(makeReq({ messages: [{ role: "assistant", content: "hi" }] }));
    expect(res.status).toBe(400);
  });

  it("streams delta + trailer frames as plain text for staff", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: { role: "navigator" } } } });
    mockAnswer.mockReturnValue(
      frames([
        { type: "delta", text: "The shelter deduction is capped. " },
        { type: "trailer", text: "\n\nSources as of 2026-06-02." },
      ]),
    );
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(200);
    expect(await readAll(res)).toBe("The shelter deduction is capped. \n\nSources as of 2026-06-02.");
  });

  it("renders recompose frames as the marker MaeChat splits on", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: { role: "supervisor" } } } });
    mockAnswer.mockReturnValue(
      frames([
        { type: "delta", text: "Draft with a bad cite" },
        { type: "recompose" },
        { type: "delta", text: "Verified answer." },
      ]),
    );
    const res = await POST(makeReq(VALID_BODY));
    const text = await readAll(res);
    expect(text).toContain(RECOMPOSE_MARKER);
    expect(text.split(RECOMPOSE_MARKER)[1]).toBe("Verified answer.");
  });

  it("passes meta.state through to the engine (state threading)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: { role: "navigator" } } } });
    mockAnswer.mockReturnValue(frames([{ type: "delta", text: "ok" }]));
    await POST(makeReq({ ...VALID_BODY, meta: { mode: "case", state: "TX", ref: "pkt_1" } }));
    expect(mockAnswer).toHaveBeenCalledWith(expect.objectContaining({ state: "TX" }));
  });

  it("allows anonymous when NEXT_PUBLIC_MAE_PREVIEW=true (preview demo mode)", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAE_PREVIEW", "true");
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockAnswer.mockReturnValue(frames([{ type: "delta", text: "ok" }]));
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(200);
  });
});
