import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// REGRESSION: production outage 2026-09-12 (root cause shipped in #1089).
//
// `app/opengraph-image.tsx` is a root FILE CONVENTION, so Next imports it while
// resolving metadata for every route inheriting the root layout — not only when
// it renders the card. It had four module-level readFileSync calls, and
// next.config.ts traces those files into the `/opengraph-image` lambda ONLY.
// Every other dynamic route therefore threw ENOENT during metadata resolution.
//
// Metadata is baked in at build time for static routes and resolved per request
// for dynamic ones, so the failure hit /chat, /screen/ask, /screen and /sign-in
// while /questions, /states, /safety, /sitemap.xml and /api/health kept serving
// 200 — the product down, the uptime check green. It never reproduced locally
// because `next start` has the whole repo on disk.
//
// This pins the invariant: importing the module must touch no filesystem.

vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(
      public element: unknown,
      public options: unknown,
    ) {}
  },
}));

/** A filesystem that behaves like a lambda the assets were not traced into. */
function mockMissingFiles() {
  const readFileSync = vi.fn(() => {
    throw Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" });
  });
  vi.doMock("node:fs", () => ({ readFileSync, default: { readFileSync } }));
  return readFileSync;
}

describe("app/opengraph-image module", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("node:fs");
    vi.resetModules();
  });

  it("imports without touching the filesystem, even when the assets are missing", async () => {
    const readFileSync = mockMissingFiles();
    // The assertion that would have caught the outage: this import is what Next
    // performs for every inheriting route's metadata.
    await expect(import("../opengraph-image")).resolves.toBeDefined();
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("exposes the metadata Next reads during resolution without any file access", async () => {
    const readFileSync = mockMissingFiles();
    const mod = await import("../opengraph-image");
    expect(mod.size).toEqual({ width: 1200, height: 630 });
    expect(mod.contentType).toBe("image/png");
    expect(typeof mod.alt).toBe("string");
    expect(mod.alt.length).toBeGreaterThan(0);
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("still reads the real fonts and mark when the card is actually rendered", async () => {
    const mod = await import("../opengraph-image");
    expect(() => mod.default()).not.toThrow();
  });

  it("reads each asset exactly once, then reuses them on a warm lambda", async () => {
    const readFileSync = vi.fn(() => Buffer.from("stub"));
    vi.doMock("node:fs", () => ({ readFileSync, default: { readFileSync } }));
    const mod = await import("../opengraph-image");
    mod.default();
    mod.default();
    mod.default();
    // Four assets, three renders: 4 reads, not 12.
    expect(readFileSync).toHaveBeenCalledTimes(4);
  });
});
