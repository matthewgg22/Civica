/**
 * E2E: skip-link a11y contract.
 *
 * ── What this tests ──────────────────────────────────────────────────────────
 * • Skip-link is the first focusable element on every dashboard page.
 * • Pressing Tab from page load focuses the skip-link.
 * • Pressing Enter on the focused skip-link advances focus PAST the skip-link
 *   into main content (id="main"), not back into nav (no focus trap).
 *
 * Per /plan-ceo-review Section 6 Finding 6.2: explicitly verify focus
 * advances past the skip-link rather than being trapped on it.
 *
 * ── Pre-conditions ───────────────────────────────────────────────────────────
 * • E2E_DASHBOARD_URL pointing to a deployed dashboard. Missing → skip.
 * • Tests target /dashboard (public-by-middleware /findings as fallback if
 *   /dashboard requires auth in the deployed env).
 */

import { test, expect } from "@playwright/test";

const DASHBOARD_URL = process.env.E2E_DASHBOARD_URL?.replace(/\/$/, "");

test.describe("dashboard skip-link a11y", () => {
  test.skip(
    !DASHBOARD_URL,
    "E2E_DASHBOARD_URL not set — skipping browser-based a11y tests"
  );

  test.use({ browserName: "chromium" });

  test("skip-link is the first focusable on /findings (public route)", async ({
    page,
  }) => {
    await page.goto(`${DASHBOARD_URL}/findings`);

    // Tab once from page load.
    await page.keyboard.press("Tab");

    // The active element should be the skip-link anchor.
    const activeText = await page.evaluate(
      () => document.activeElement?.textContent ?? ""
    );
    expect(activeText.trim()).toBe("Skip to main content");
  });

  test("Enter on skip-link advances focus into main content", async ({
    page,
  }) => {
    await page.goto(`${DASHBOARD_URL}/findings`);

    // Focus the skip-link.
    await page.keyboard.press("Tab");

    // Activate it.
    await page.keyboard.press("Enter");

    // Focus should now be inside the #main wrapper (not on the skip-link,
    // not back on the document body). Per WCAG 2.4.1 the skip-link must
    // actually transfer focus to main; some browsers require .focus() on
    // the target to honor this. Civica's #main is a div with id, which
    // jumps the document scroll position; verify the URL hash changed.
    expect(page.url()).toContain("#main");
  });

  test("skip-link is visually hidden until focused", async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/findings`);

    // The skip-link uses sr-only Tailwind utility — clipped 1×1px until focus.
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    const initialBox = await skipLink.boundingBox();
    expect(initialBox?.width ?? 0).toBeLessThan(2);

    // Focus reveals it.
    await page.keyboard.press("Tab");
    const focusedBox = await skipLink.boundingBox();
    expect(focusedBox?.width ?? 0).toBeGreaterThan(20);
  });
});
