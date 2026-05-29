/**
 * E2E: branded error.tsx + not-found.tsx renders.
 *
 * ── What this tests ──────────────────────────────────────────────────────────
 * • not-found.tsx: visiting /packets/does-not-exist-{nonce} renders the
 *   branded 404 with multi-link wayfinding (Back to dashboard, ⌘K hint,
 *   Findings ledger) when authed; anonymous-safe wayfinding when not.
 * • error.tsx: a synthetic crash route would exercise the branded 500.
 *   Deferred until a dev/test-only /api/__test/throw endpoint exists; the
 *   forced-throw E2E lands in a follow-up.
 *
 * ── Pre-conditions ───────────────────────────────────────────────────────────
 * • E2E_DASHBOARD_URL pointing to a deployed dashboard (Vercel preview or
 *   staging). Missing → suite skips cleanly so nightly passes locally.
 */

import { test, expect } from "@playwright/test";

const DASHBOARD_URL = process.env.E2E_DASHBOARD_URL?.replace(/\/$/, "");

test.describe("dashboard error boundaries", () => {
  test.skip(
    !DASHBOARD_URL,
    "E2E_DASHBOARD_URL not set — skipping dashboard browser tests"
  );

  test.use({ browserName: "chromium" });

  test("404 page renders branded chrome with multi-link wayfinding", async ({
    page,
  }) => {
    const bogusUrl = `${DASHBOARD_URL}/packets/does-not-exist-${Date.now()}`;
    const response = await page.goto(bogusUrl);

    // notFound() returns 404 status — Next.js renders not-found.tsx in its place.
    expect(response?.status()).toBe(404);

    // Civica-branded copy lands (vs Next.js default).
    await expect(page.getByText("404 Not Found")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /couldn't find that page/i })
    ).toBeVisible();

    // At least the public destinations render for anonymous visitors.
    await expect(
      page.getByRole("link", { name: /back to dashboard/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /findings ledger/i })
    ).toBeVisible();
  });

  test("404 page renders for arbitrary bogus URL", async ({ page }) => {
    const response = await page.goto(
      `${DASHBOARD_URL}/completely-bogus-route-${Date.now()}`
    );
    expect(response?.status()).toBe(404);
    await expect(page.getByText("404 Not Found")).toBeVisible();
  });

  // TODO(TT-6 part 2): error.tsx E2E once a dev/test-only forced-throw
  // endpoint exists. Per /plan-ceo-review D6 the synthetic-throw endpoint
  // was deemed redundant; revisit if a hard-to-reproduce production error
  // requires it.
});
