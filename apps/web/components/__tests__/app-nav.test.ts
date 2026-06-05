// Structural guards for the applicant nav redesign (Anthropic-style primary
// CTA + dropdown, replacing the floating AppDownloadIsland). The web test
// suite runs in node env (no jsdom/RTL), so these assert the design-critical
// source structure rather than rendered DOM — same approach as
// app/apply/__tests__/next-steps.test.ts.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const NAV = readFileSync(resolve(__dirname, "../AppNav.tsx"), "utf-8");
const WELCOME = readFileSync(resolve(__dirname, "../../app/welcome/page.tsx"), "utf-8");

describe("AppNav primary-CTA dropdown", () => {
  it("renders the primary CTA as a link, not buried in tabs", () => {
    expect(NAV).toContain('className="app-nav__cta"');
    expect(NAV).toMatch(/href=\{primaryCta\.href\}/);
  });

  it("uses a native <details>/<summary> dropdown (a11y: no JS, keyboard-correct)", () => {
    expect(NAV).toContain("<details");
    expect(NAV).toContain("<summary");
    // Guard against a regression to a custom JS dropdown div.
    expect(NAV).toContain('className="app-nav__menu"');
  });

  it("marks menu items with role=menuitem and supports an icon + external link", () => {
    expect(NAV).toContain('role="menuitem"');
    expect(NAV).toContain("item.iconSrc");
    expect(NAV).toContain('rel: "noopener noreferrer"');
  });
});

describe("floating app-download island is retired", () => {
  it("the AppDownloadIsland component no longer exists", () => {
    expect(existsSync(resolve(__dirname, "../AppDownloadIsland.tsx"))).toBe(false);
  });

  it("welcome wires the iOS app into the CTA dropdown with the app icon (logo kept)", () => {
    expect(WELCOME).not.toContain("AppDownloadIsland");
    expect(WELCOME).toContain("primaryCta=");
    expect(WELCOME).toContain("/civica-app-icon.png");
    expect(WELCOME).toContain("TESTFLIGHT_URL");
  });

  it("welcome no longer lists Apply as a plain tab (it's the CTA now)", () => {
    // The Apply destination should appear via primaryCta.href, not as a tab row.
    expect(WELCOME).not.toMatch(/label:\s*t\.home_nav_apply,\s*href:\s*"\/apply"\s*\}/);
  });
});
