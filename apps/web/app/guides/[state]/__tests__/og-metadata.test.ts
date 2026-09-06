import { describe, it, expect } from "vitest";
import { generateMetadata } from "../page";
import { OG_IMAGE } from "../../../../lib/og-image";

// The state guides are the top acquisition surface (one per verified state,
// indexed in the sitemap). Before this they set only title/description, so a
// shared guide link fell back to the small no-image card. Pin the rich card.
describe("state guide pages carry the link-preview card", () => {
  it("sets openGraph images and the large-image twitter card", async () => {
    const md = await generateMetadata({ params: Promise.resolve({ state: "ca" }) });
    expect(md.openGraph, "openGraph must be set").toBeTruthy();
    expect(JSON.stringify(md.openGraph?.images)).toContain(OG_IMAGE.url);
    const twitter = md.twitter as { card?: string; images?: unknown };
    expect(twitter?.card).toBe("summary_large_image");
    expect(JSON.stringify(twitter?.images)).toContain(OG_IMAGE.url);
  });

  it("returns empty metadata for an unknown state (no card, no crash)", async () => {
    const md = await generateMetadata({ params: Promise.resolve({ state: "zz" }) });
    expect(md.openGraph).toBeUndefined();
  });
});
