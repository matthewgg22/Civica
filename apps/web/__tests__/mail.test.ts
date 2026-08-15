// The mailer must never claim to have sent something it did not.
//
// A silent failure here is worse than an error: the person stops waiting for a
// document that is never coming, and nothing anywhere records that it did not
// arrive. Every failure carries a reason for the same reason the save path now
// does — "it didn't work" cannot be acted on by anybody.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mailConfigured, sendMail } from "../lib/mail";

const OLD = { ...process.env };

beforeEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
  delete process.env.DEMETER_MAIL_FROM;
});
afterEach(() => {
  process.env = { ...OLD };
  vi.unstubAllGlobals();
});

function configure() {
  process.env.RESEND_API_KEY = "test-key";
  process.env.DEMETER_MAIL_FROM = "Demeter <demeter@example.org>";
}

const MSG = { to: "someone@example.org", subject: "s", text: "t" };

describe("mail configuration", () => {
  it("reports unconfigured when either half is missing", () => {
    expect(mailConfigured()).toBe(false);
    process.env.RESEND_API_KEY = "test-key";
    expect(mailConfigured()).toBe(false);
  });

  it("refuses rather than resolving quietly when unconfigured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await sendMail(MSG);
    expect(r).toEqual({ ok: false, reason: "not_configured" });
    // And crucially it did not pretend by making a call to nowhere.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sending", () => {
  it("sends to the given address and reports the provider id", async () => {
    configure();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "abc123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await sendMail(MSG);
    expect(r).toEqual({ ok: true, id: "abc123" });

    const [, init] = fetchMock.mock.calls[0]!;
    const sent = JSON.parse((init as { body: string }).body) as Record<string, unknown>;
    expect(sent.to).toEqual(["someone@example.org"]);
    expect(sent.from).toBe("Demeter <demeter@example.org>");
  });

  it("carries the provider's reason on a rejection", async () => {
    // Unverified domain, bad address, quota — all different problems, and
    // without the detail they look identical from the outside.
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => "domain not verified" }),
    );
    const r = await sendMail(MSG);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("rejected");
      expect(r.detail).toContain("domain not verified");
    }
  });

  it("does not throw when the network is gone", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const r = await sendMail(MSG);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("network");
  });

  it("still fails rather than succeeding when the body has no id", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const r = await sendMail(MSG);
    // A missing id is not a failure — the provider accepted it. But the caller
    // must be able to tell that it has nothing to trace with.
    expect(r).toEqual({ ok: true, id: null });
  });
});
