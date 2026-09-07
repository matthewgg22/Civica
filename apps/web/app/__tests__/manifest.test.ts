import { describe, it, expect } from "vitest";
import manifest from "../manifest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The manifest is what a phone uses when someone adds Demeter to a home screen:
// the name, the launch URL, the icon. Getting it wrong is silent — the OS just
// falls back to the URL and a screenshot — so pin the shape here.
describe("PWA manifest", () => {
  const m = manifest();

  it("names the product rather than the URL", () => {
    expect(m.name).toMatch(/Demeter/);
    expect(m.short_name).toBe("Demeter");
  });

  it("launches into the chat, standalone, on a white ground", () => {
    expect(m.start_url).toBe("/screen/ask");
    expect(m.display).toBe("standalone");
    expect(m.background_color).toBe("#FFFFFF");
    expect(m.theme_color).toBe("#FFFFFF");
  });

  it("ships icons that point at an asset that actually exists", () => {
    const icons = m.icons ?? [];
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.src).toBe("/demeter-wheat-mark.png");
      expect(icon.type).toBe("image/png");
    }
    // The src is served from public/, so the file must be there or every
    // install gets a broken icon.
    expect(() =>
      readFileSync(join(process.cwd(), "public", "demeter-wheat-mark.png")),
    ).not.toThrow();
  });

  it("keeps dollar figures out of shipped copy (house rule)", () => {
    expect(m.description ?? "").not.toMatch(/\$\d/);
  });
});
