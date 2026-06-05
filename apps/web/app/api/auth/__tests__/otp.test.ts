import { describe, it, expect, beforeEach, vi } from "vitest";
import { __resetOtpRateLimitForTests } from "../rate-limit";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("POST /api/auth/otp", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    __resetOtpRateLimitForTests();
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

  it("rejects ambiguous non-US digit string with non_us_phone", async () => {
    // 8-digit number with no + prefix — can't safely guess country code.
    // Regression: old code would prepend +1 and silently call a wrong US number.
    const { POST } = await import("../otp/route");
    const res = await POST(new Request("https://w/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "52355512" }),
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("non_us_phone");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts explicit E.164 international number (+52...)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const { POST } = await import("../otp/route");
    const res = await POST(new Request("https://w/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+525512345678" }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.phone).toBe("+525512345678");
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ phone: "+525512345678" });
  });

  it("accepts 11-digit US number starting with 1", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const { POST } = await import("../otp/route");
    const res = await POST(new Request("https://w/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "14155550199" }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.phone).toBe("+14155550199");
  });

  it("returns 429 after 5 OTP requests from the same IP", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const { POST } = await import("../otp/route");
    const req = () => new Request("https://w/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4" },
      body: JSON.stringify({ phone: "(415) 555-0199" }),
    });
    for (let i = 0; i < 5; i++) await POST(req());
    const sixth = await POST(req());
    expect(sixth.status).toBe(429);
    const body = await sixth.json();
    expect(body.error).toBe("rate_limited");
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
