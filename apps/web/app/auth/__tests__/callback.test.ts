import { describe, it, expect, vi, beforeEach } from "vitest";

const exchangeCodeForSession = vi.hoisted(() => vi.fn());
const cookieStore = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock("../../../lib/supabase-server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { exchangeCodeForSession } })),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "demeter_auth_next" && cookieStore.value !== undefined
        ? { value: cookieStore.value }
        : undefined,
  })),
}));

import { GET } from "../callback/route";

function req(qs: string): Request {
  return new Request(`https://demeter.test/auth/callback${qs}`);
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
    cookieStore.value = undefined;
  });

  it("sends the user to the destination stashed in the cookie", async () => {
    cookieStore.value = "/screen/ask?state=CA";
    const res = await GET(req("?code=abc"));
    expect(res.headers.get("location")).toBe("https://demeter.test/screen/ask?state=CA");
  });

  it("still honours ?next= so the Google flow is unchanged", async () => {
    const res = await GET(req("?code=abc&next=%2Fscreen%2Fask"));
    expect(res.headers.get("location")).toBe("https://demeter.test/screen/ask");
  });

  it("prefers the cookie over ?next=", async () => {
    cookieStore.value = "/screen/ask";
    const res = await GET(req("?code=abc&next=%2Fapply"));
    expect(res.headers.get("location")).toBe("https://demeter.test/screen/ask");
  });

  it("falls back to the chat, not the staff dashboard, with neither", async () => {
    // The regression this whole change exists for: an applicant finishing
    // sign-in must never be handed to software they cannot use.
    const res = await GET(req("?code=abc"));
    expect(res.headers.get("location")).toBe("https://demeter.test/screen/ask");
  });

  it("refuses an off-origin destination from either source", async () => {
    cookieStore.value = "https://evil.example/x";
    expect((await GET(req("?code=abc"))).headers.get("location")).toBe(
      "https://demeter.test/screen/ask",
    );
    cookieStore.value = undefined;
    expect(
      (await GET(req("?code=abc&next=https%3A%2F%2Fevil.example%2Fx"))).headers.get("location"),
    ).toBe("https://demeter.test/screen/ask");
  });

  it("clears the cookie on success AND on failure", async () => {
    // A stashed destination must never be able to steer a later, unrelated
    // sign-in — including one that failed and will be retried.
    cookieStore.value = "/screen/ask";
    const ok = await GET(req("?code=abc"));
    expect(ok.headers.get("set-cookie")).toMatch(/demeter_auth_next=;?/);

    exchangeCodeForSession.mockResolvedValue({ error: { message: "bad code" } });
    const bad = await GET(req("?code=abc"));
    expect(bad.headers.get("location")).toContain("/sign-in?error=oauth_exchange");
    expect(bad.headers.get("set-cookie")).toMatch(/demeter_auth_next=;?/);
  });

  it("sends a cancelled or code-less callback to sign-in", async () => {
    expect((await GET(req("?error=access_denied"))).headers.get("location")).toContain(
      "/sign-in?error=oauth_callback",
    );
    expect((await GET(req(""))).headers.get("location")).toContain("/sign-in?error=oauth_callback");
  });
});
