/**
 * Axe accessibility smoke tests — WCAG 2.1 AA.
 *
 * These tests hit publicly reachable pages (sign-in, root redirect)
 * that do not require auth. The full authenticated-flow a11y check
 * lives in the happy-path E2E test.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Pages accessible without auth
const PUBLIC_PAGES = [
  { name: "sign-in (en)", path: "/en/sign-in" },
  { name: "sign-in (es)", path: "/es/sign-in" },
];

for (const { name, path } of PUBLIC_PAGES) {
  test(`a11y: ${name}`, async ({ page }) => {
    await page.goto(path);
    // Wait for content to stabilise
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // Radix portals render outside the main tree; axe needs the whole page
      .analyze();

    expect(results.violations).toEqual([]);
  });
}
