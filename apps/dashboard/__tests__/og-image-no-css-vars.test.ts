// Regression for the 2026-05-29 production build break.
//
// Satori (the `next/og` ImageResponse renderer used by opengraph-image /
// twitter-image routes) CANNOT resolve CSS custom properties. A `var(--…)` in
// an OG route's inline styles crashes `next build` at prerender time with
// "Unexpected token type: word in CSS rule `background: initial`", which took
// down the dashboard's production deploy (the var was `var(--color-wheat)` in
// app/compliance/opengraph-image.tsx, introduced in PR #244). Use literal color
// values in these routes. This test scans every OG/twitter-image route source
// and fails if any CSS variable reappears.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APP_DIR = join(__dirname, "..", "app");

function findOgRoutes(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      out.push(...findOgRoutes(p));
    } else if (/(opengraph-image|twitter-image)\.tsx$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

describe("OG/twitter image routes avoid CSS variables (Satori cannot resolve them)", () => {
  const files = findOgRoutes(APP_DIR);

  it("finds at least one OG image route to guard", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = file.split("/app/")[1] ?? file;
    it(`${rel} contains no var(--…) in styles`, () => {
      const offenders = readFileSync(file, "utf8").match(/var\(--[^)]+\)/g) ?? [];
      expect(offenders).toEqual([]);
    });
  }
});
