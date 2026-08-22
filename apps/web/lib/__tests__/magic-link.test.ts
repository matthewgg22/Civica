// The shared auth actions. These exist because the logic now has TWO callers
// (the /sign-in route and the chat's modal) and the failure mapping is the
// part that must not drift between them.
import { describe, it, expect, vi, afterEach } from "vitest";
import { googleHref, sendMagicLink } from "../magic-link";

afterEach(() => vi.unstubAllGlobals());

// Typed to fetch's own signature so `.mock.calls[0]` carries the argument
// tuple — an untyped vi.fn() infers `[]` and tsc rejects reading [1].
const reply = (status: number) =>
  vi.fn<typeof fetch>(async () => new Response(null, { status }));

describe("googleHref", () => {
  it("encodes the destination, so a next with query survives the round trip", () => {
    expect(googleHref("/chat?state=CA&q=a b")).toBe(
      "/api/auth/google?next=%2Fchat%3Fstate%3DCA%26q%3Da%20b",
    );
  });
});

describe("sendMagicLink", () => {
  it("posts the address and destination to the magic-link route", async () => {
    const f = reply(200);
    vi.stubGlobal("fetch", f);
    await sendMagicLink("a@b.com", "/chat");
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("/api/auth/magic-link");
    expect(JSON.parse(init!.body as string)).toEqual({
      email: "a@b.com",
      next: "/chat",
    });
  });

  it("distinguishes only what the person can act on", async () => {
    vi.stubGlobal("fetch", reply(400));
    expect(await sendMagicLink("bad", "/chat")).toBe("invalid_email");
    vi.stubGlobal("fetch", reply(429));
    expect(await sendMagicLink("a@b.com", "/chat")).toBe("rate_limited");
  });

  it("an unknown address still reads as sent — never 'no such account' on a benefits service", async () => {
    vi.stubGlobal("fetch", reply(200));
    expect(await sendMagicLink("nobody@nowhere.com", "/chat")).toBe("sent");
    // And a server-side failure does not leak either: 500 is not a signal
    // about the address.
    vi.stubGlobal("fetch", reply(500));
    expect(await sendMagicLink("a@b.com", "/chat")).toBe("sent");
  });

  it("a dead network is the one failure worth naming", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => { throw new Error("offline"); }));
    expect(await sendMagicLink("a@b.com", "/chat")).toBe("error");
  });
});
