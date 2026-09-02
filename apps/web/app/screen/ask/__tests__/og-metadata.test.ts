import { describe, it, expect } from "vitest";
import { metadata } from "../page";
import { OG_IMAGE } from "../../../../lib/og-image";

// The bare domain 301s to /screen/ask, so THIS is the page a shared link
// resolves to — and it sets its own `openGraph`, which meant the file-convention
// image on "/" never reached it. The card fell back to the small, no-image
// format. These pin the fix (launch audit 2026-08-29): the route a shared link
// lands on must carry the image AND the large-image twitter card.
describe("/screen/ask carries the link-preview image", () => {
  it("references the OG image in openGraph", () => {
    const images = metadata.openGraph?.images;
    expect(images, "openGraph.images must be set").toBeTruthy();
    expect(JSON.stringify(images)).toContain(OG_IMAGE.url);
  });

  it("asks for the large-image twitter card, not the small summary", () => {
    // Next's Twitter metadata type is a union; card lives on the summary member.
    const twitter = metadata.twitter as { card?: string; images?: unknown };
    expect(twitter?.card).toBe("summary_large_image");
    expect(JSON.stringify(twitter?.images)).toContain(OG_IMAGE.url);
  });
});

describe("OG_IMAGE is a well-formed 1200x630 reference", () => {
  it("points at the generated image route with dimensions and alt", () => {
    expect(OG_IMAGE.url).toBe("/opengraph-image");
    expect(OG_IMAGE.width).toBe(1200);
    expect(OG_IMAGE.height).toBe(630);
    expect(OG_IMAGE.alt.length).toBeGreaterThan(10);
  });
});
