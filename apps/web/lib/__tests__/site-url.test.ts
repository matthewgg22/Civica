import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// REGRESSION: production outage 2026-09-12.
//
// NEXT_PUBLIC_SITE_URL was set to a bare hostname with no scheme. The root
// layout does `metadataBase: new URL(siteUrl())`, so metadata resolution threw
// ERR_INVALID_URL on every render. Static routes had their metadata baked in at
// build time and kept serving, so /questions, /states, /safety and the sitemap
// all looked healthy — while /chat, /screen/ask, /screen and /sign-in (every
// dynamic route) showed the error boundary. The product was down and the
// monitoring was green.
//
// These pin the invariant that fell over: siteUrl() must always return
// something new URL() accepts, whatever is in the environment.

const ENV_KEYS = ["NEXT_PUBLIC_SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL"] as const;

/** The module memoizes its "already warned" flag, so each case needs a fresh
 *  copy to observe warning behavior independently. */
async function loadFresh() {
  vi.resetModules();
  return import("../site-url");
}

describe("siteUrl", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.restoreAllMocks();
  });

  it("never returns a value new URL() rejects, for any env shape", async () => {
    const hostile = [
      "civica-applicant.vercel.app", // the actual outage value: no scheme
      "  civica-applicant.vercel.app  ", // pasted with whitespace
      "https://", // scheme with no host
      "://broken",
      "not a url at all",
      "mailto:someone@example.com", // parses, but not a web origin
      "",
      "   ",
    ];
    for (const value of hostile) {
      process.env.NEXT_PUBLIC_SITE_URL = value;
      const { siteUrl } = await loadFresh();
      // The assertion that would have caught the outage.
      expect(() => new URL(siteUrl())).not.toThrow();
    }
  });

  it("rescues a scheme-less hostname as https rather than falling back", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "civica-applicant.vercel.app";
    const { siteUrl } = await loadFresh();
    expect(siteUrl()).toBe("https://civica-applicant.vercel.app");
  });

  it("falls through to the Vercel production host when the explicit value is junk", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "not a url at all";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "civica-applicant.vercel.app";
    const { siteUrl } = await loadFresh();
    expect(siteUrl()).toBe("https://civica-applicant.vercel.app");
  });

  it("warns once when a configured value is unusable, so it is still a visible bug", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "not a url at all";
    const { siteUrl } = await loadFresh();
    siteUrl();
    siteUrl();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls[0][0]).toContain("NEXT_PUBLIC_SITE_URL");
  });

  it("keeps the documented resolution order and trailing-slash trim", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://demeter.example/";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "ignored.vercel.app";
    const { siteUrl } = await loadFresh();
    expect(siteUrl()).toBe("https://demeter.example");
  });

  it("preserves a sub-path deployment instead of flattening it to the origin", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/demeter/";
    const { siteUrl, absoluteUrl } = await loadFresh();
    expect(siteUrl()).toBe("https://example.com/demeter");
    expect(absoluteUrl("/questions")).toBe("https://example.com/demeter/questions");
  });

  it("reports no canonical domain when nothing usable is configured", async () => {
    const { siteUrl, hasCanonicalDomain } = await loadFresh();
    expect(siteUrl()).toBe("http://localhost:3000");
    expect(hasCanonicalDomain()).toBe(false);
  });

  it("does not advertise to crawlers on a malformed canonical value", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "not a url at all";
    const { hasCanonicalDomain } = await loadFresh();
    expect(hasCanonicalDomain()).toBe(false);
  });
});
