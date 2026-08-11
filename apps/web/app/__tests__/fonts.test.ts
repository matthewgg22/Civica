// The build must not reach the network for fonts (#697).
//
// next/font/google DOWNLOADS THE FILES DURING THE BUILD. An unreachable
// fonts.gstatic.com therefore did not degrade typography — it failed the
// deploy. It took CI down on PR #696 for a change that had nothing to do with
// fonts, and the same fetch runs on every Vercel production build.
//
// Proven once by building with all outbound HTTP blackholed
// (HTTPS_PROXY=http://127.0.0.1:1): the old layout died with ECONNREFUSED, the
// new one compiled. That control matters — without it a passing build only
// proves the proxy vars were ignored. This file is the cheap standing guard so
// the dependency cannot creep back in a later edit.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");
const layout = readFileSync(join(root, "app", "layout.tsx"), "utf8");

// Every face the layout declares, and the file each one needs. Be Vietnam Pro
// has no variable build, so its six weight/style combinations are six files;
// Newsreader and Hanken Grotesk are variable, so one file covers 400–600.
const REQUIRED_FILES = [
  "hanken-grotesk-latin-wght-normal.woff2",
  "newsreader-latin-wght-normal.woff2",
  "newsreader-latin-wght-italic.woff2",
  "be-vietnam-pro-latin-400-normal.woff2",
  "be-vietnam-pro-latin-400-italic.woff2",
  "be-vietnam-pro-latin-500-normal.woff2",
  "be-vietnam-pro-latin-500-italic.woff2",
  "be-vietnam-pro-latin-600-normal.woff2",
  "be-vietnam-pro-latin-600-italic.woff2",
];

describe("fonts are self-hosted — the build reaches no third party", () => {
  it("imports no font from Google", () => {
    // Comments explaining the migration are allowed to name it; code is not.
    const code = layout
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(code).not.toContain("next/font/google");
    expect(code).not.toContain("fonts.googleapis");
    expect(code).not.toContain("fonts.gstatic");
  });

  it("every Latin face the layout declares has its file committed", () => {
    for (const file of REQUIRED_FILES) {
      const path = join(root, "app", "fonts", file);
      expect(existsSync(path), `missing app/fonts/${file}`).toBe(true);
      // A git-lfs pointer or a truncated download would be a few hundred
      // bytes and would fail at runtime, not at build time.
      expect(statSync(path).size, file).toBeGreaterThan(10_000);
      expect(layout, `layout does not reference ${file}`).toContain(file);
    }
  });

  it("references no font file it does not ship", () => {
    // The reverse direction: a renamed or deleted woff2 that the layout still
    // points at fails the BUILD, which is loud — but a path typo in a face
    // nobody looks at is quieter, so check both ways.
    const referenced = [...layout.matchAll(/\.\/fonts\/([\w.-]+\.woff2)/g)].map((m) => m[1]);
    expect(referenced.length).toBeGreaterThan(0);
    for (const file of referenced) {
      expect(existsSync(join(root, "app", "fonts", file)), `app/fonts/${file}`).toBe(true);
    }
  });

  it("keeps the CJK faces on unicode-range subsets, not one giant file", () => {
    // These two are @fontsource imports rather than next/font/local ON PURPOSE.
    // localFont cannot express unicode-range, so a single CJK file would make
    // every /zh visitor download ~5MB to read one page. Their ~165 subset files
    // stay in node_modules — 10MB of binary does not belong in git.
    expect(layout).toContain("@fontsource/noto-serif-sc");
    expect(layout).toContain("@fontsource/noto-sans-sc");
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.dependencies["@fontsource/noto-serif-sc"]).toBeTruthy();
    expect(pkg.dependencies["@fontsource/noto-sans-sc"]).toBeTruthy();
  });

  it("declares the CJK variables in CSS, since they are no longer next/font", () => {
    // Dropping the two next/font objects removed the .variable classes that
    // used to define these. Every `var(--demeter-font-*-cjk)` use site in the
    // stylesheet would silently resolve to nothing — no error, just Latin
    // metrics applied to Chinese text.
    const css = readFileSync(join(root, "app", "globals.css"), "utf8");
    expect(css).toMatch(/--demeter-font-serif-cjk:\s*"Noto Serif SC"/);
    expect(css).toMatch(/--demeter-font-sans-cjk:\s*"Noto Sans SC"/);
    // And a system fallback after each, so a reader gets Heiti rather than a
    // page of tofu boxes if the webfont has not arrived.
    expect(css).toMatch(/--demeter-font-sans-cjk:[^;]*PingFang SC/);
  });
});
