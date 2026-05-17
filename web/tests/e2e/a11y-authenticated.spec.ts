/**
 * WCAG 2.1 AA axe tests for authenticated app flows.
 *
 * Requires the same E2E credentials as happy-path.spec.ts. Skips gracefully
 * when credentials are not configured.
 *
 * Pages covered: questions, documents, consent, packet, inbox, resources.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const hasAuth = () =>
  Boolean(
    process.env.E2E_TEST_EMAIL &&
      process.env.E2E_TEST_PASSWORD &&
      process.env.NEXT_PUBLIC_SUPABASE_URL
  );

const APP_PAGES = [
  { name: "questions", path: "/en/app/questions" },
  { name: "documents", path: "/en/app/documents" },
  { name: "consent", path: "/en/app/consent" },
  { name: "packet status", path: "/en/app/packet" },
  { name: "inbox", path: "/en/app/inbox" },
  { name: "resources", path: "/en/app/resources" },
];

test.describe("WCAG 2.1 AA — authenticated flows", () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    if (!hasAuth()) {
      testInfo.skip(
        true,
        "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured — skipping authenticated a11y tests."
      );
    }
  });

  for (const { name, path } of APP_PAGES) {
    test(`a11y: ${name}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // If auth redirect happened (page not onboarded etc.) the URL changed —
      // still run axe on whatever page we landed on.
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});

test.describe("WCAG 2.1 AA — Spanish locale authenticated flows", () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    if (!hasAuth()) {
      testInfo.skip(
        true,
        "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured — skipping authenticated a11y tests."
      );
    }
  });

  // Spot-check the question flow in Spanish — most likely to surface missing
  // aria-label translations.
  test("a11y: questions (es)", async ({ page }) => {
    await page.goto("/es/app/questions");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
