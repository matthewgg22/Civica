import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("POST /api/auth/otp", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "stub-anon-key";
  });

  it("rejects empty phone with 400", async () => {
    const { POST } = await import("../otp/route");
    const res = await POST(new Request("https://w/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "" }),
    }));
    expect(res.status).toBe(400);
  });

  it("normalizes 10-digit US phones to E.164", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const { POST } = await import("../otp/route");
    const res = await POST(new Request("https://w/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "(415) 555-0199" }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.phone).toBe("+14155550199");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://stub.supabase.co/auth/v1/otp");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ phone: "+14155550199" });
  });

  it("returns 502 when Supabase rejects", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const { POST } = await import("../otp/route");
    const res = await POST(new Request("https://w/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+14155550199" }),
    }));
    expect(res.status).toBe(502);
  });
});
