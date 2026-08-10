import { describe, it, expect, afterEach, vi } from "vitest";
import { ANSWER_LANGS, LANG_TAG } from "@civica/demeter-engine/packs";

// hreflang fails silently. A set that is not reciprocal, or that omits
// x-default, is simply ignored by search engines — no error, no warning, the
// localized pages just never get associated with each other. So the contract
// is pinned here rather than left to a manual read of the rendered <head>.

afterEach(() => vi.unstubAllEnvs());

async function fresh() {
  vi.resetModules();
  return import("../routes");
}

describe("localized route shape", () => {
  it("keeps English un-prefixed and prefixes every other language", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://demeter.ai");
    const { askPath, PREFIXED_LANGS } = await fresh();
    // English is the already-indexed URL — moving it to /en/ would discard
    // whatever ranking it has for cosmetic symmetry.
    expect(askPath("en")).toBe("/screen/ask");
    expect(PREFIXED_LANGS).not.toContain("en");
    for (const l of PREFIXED_LANGS) expect(askPath(l)).toBe(`/${l}/screen/ask`);
  });

  it("annotates EVERY language plus x-default, so the set is reciprocal", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://demeter.ai");
    const { alternateLanguages, askUrl } = await fresh();
    const alts = alternateLanguages();
    // Every supported language present, keyed by its BCP-47 tag.
    for (const l of ANSWER_LANGS) {
      expect(alts[LANG_TAG[l]], `missing ${l}`).toBe(askUrl(l));
    }
    // x-default points at English — the fallback for an unmatched locale.
    expect(alts["x-default"]).toBe(askUrl("en"));
    expect(Object.keys(alts)).toHaveLength(ANSWER_LANGS.length + 1);
  });

  it("emits absolute URLs on the canonical host", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://demeter.ai");
    const { alternateLanguages } = await fresh();
    for (const url of Object.values(alternateLanguages())) {
      expect(url.startsWith("https://demeter.ai/")).toBe(true);
    }
  });

  it("never bakes a per-deployment hostname into hreflang", async () => {
    // The same rule the sitemap follows: a preview hostname in an hreflang set
    // trains search engines on URLs that die on the next push.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "web-abc123-civica-app.vercel.app");
    const { alternateLanguages } = await fresh();
    for (const url of Object.values(alternateLanguages())) {
      expect(url).not.toContain("web-abc123");
    }
  });
});
