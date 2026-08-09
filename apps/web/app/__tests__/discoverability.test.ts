import { describe, it, expect, afterEach, vi } from "vitest";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

// Discoverability is easy to get subtly wrong in ways nobody notices for
// months: a sitemap full of per-deployment hostnames, or a robots.txt that
// invites crawlers to walk a metered LLM endpoint. These pin the choices.

afterEach(() => vi.unstubAllEnvs());

async function fresh<T>(mod: string): Promise<T> {
  vi.resetModules();
  return (await import(mod)) as T;
}

describe("sitemap", () => {
  it("lists every verified state guide — new packs index themselves", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://demeter.ai");
    const { default: sitemap } = await fresh<{ default: () => Array<{ url: string }> }>(
      "../sitemap",
    );
    const urls = sitemap().map((e) => e.url);
    for (const s of VERIFIED_STATES) {
      expect(urls, `guide for ${s.code}`).toContain(
        `https://demeter.ai/guides/${s.code.toLowerCase()}`,
      );
    }
    expect(urls).toContain("https://demeter.ai/demeter");
    expect(urls).toContain("https://demeter.ai/verify");
  });

  it("emits absolute URLs on the canonical domain only", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://demeter.ai");
    const { default: sitemap } = await fresh<{ default: () => Array<{ url: string }> }>(
      "../sitemap",
    );
    for (const e of sitemap()) {
      expect(e.url.startsWith("https://demeter.ai/")).toBe(true);
    }
  });

  it("dates each guide from its pack's own verification date", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://demeter.ai");
    const { default: sitemap } = await fresh<{
      default: () => Array<{ url: string; lastModified?: Date }>;
    }>("../sitemap");
    const ga = sitemap().find((e) => e.url.endsWith("/guides/ga"));
    const pack = VERIFIED_STATES.find((s) => s.code === "GA")!;
    expect(ga?.lastModified?.toISOString().slice(0, 10)).toBe(pack.verification.verified_on);
  });

  it("never falls back to a per-deployment hostname", async () => {
    // VERCEL_URL is the throwaway hash. A sitemap built from it would train
    // Google on URLs that die on the next push.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "web-abc123-civica-app.vercel.app");
    const { default: sitemap } = await fresh<{ default: () => Array<{ url: string }> }>(
      "../sitemap",
    );
    for (const e of sitemap()) expect(e.url).not.toContain("web-abc123");
  });
});

describe("robots", () => {
  it("keeps crawlers off the metered answer endpoint", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://demeter.ai");
    const { default: robots } = await fresh<{ default: () => { rules: unknown; sitemap?: string } }>(
      "../robots",
    );
    const r = robots();
    const rule = (Array.isArray(r.rules) ? r.rules[0] : r.rules) as {
      allow?: string;
      disallow?: string | string[];
    };
    expect(rule.allow).toBe("/");
    expect(String(rule.disallow)).toContain("/api/");
    expect(r.sitemap).toBe("https://demeter.ai/sitemap.xml");
  });

  it("blocks indexing entirely until a canonical domain is configured", async () => {
    // Indexing a preview hostname leaves stale results outliving the mistake
    // by months. Silence is the safer default.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    const { default: robots } = await fresh<{ default: () => { rules: unknown } }>("../robots");
    const rule = (Array.isArray(robots().rules) ? (robots().rules as unknown[])[0] : robots().rules) as {
      disallow?: string;
    };
    expect(rule.disallow).toBe("/");
  });
});
