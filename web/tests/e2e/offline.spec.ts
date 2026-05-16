/**
 * Offline draft queue E2E tests.
 *
 * Verifies that answers typed while offline are stored in localStorage
 * and synced when the connection is restored.
 *
 * These tests override navigator.onLine via page.evaluate to simulate
 * offline state without actually going offline.
 */

import { test, expect } from "@playwright/test";

const QUEUE_KEY = "civica_draft_queue";

const hasAuth = () =>
  Boolean(
    process.env.E2E_TEST_EMAIL &&
      process.env.E2E_TEST_PASSWORD &&
      process.env.NEXT_PUBLIC_SUPABASE_URL
  );

test.describe("Offline draft queue", () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    if (!hasAuth()) {
      testInfo.skip(true, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured — skipping authenticated tests.");
    }
  });

  test("answer typed offline is saved to localStorage queue", async ({ page }) => {
    await page.goto("/en/app/questions");
    await page.waitForLoadState("networkidle");

    // Wait for any question input to appear
    const firstInput = page.locator('input[type="text"]').first();
    const inputCount = await firstInput.count();
    if (inputCount === 0) {
      test.skip(); // No text questions visible
      return;
    }

    // Simulate going offline by overriding navigator.onLine
    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true });
      window.dispatchEvent(new Event("offline"));
    });

    // Type an answer
    await firstInput.fill("offline answer test");
    await firstInput.blur();

    // Wait for debounce + offline queue write (500ms debounce + a small buffer)
    await page.waitForTimeout(700);

    // Verify "Saved offline" indicator appears
    const offlineLabel = page.locator('text=/saved offline/i').first();
    await expect(offlineLabel).toBeVisible({ timeout: 3_000 });

    // Verify the queue has an item in localStorage
    const queue = await page.evaluate((key) => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? "[]");
      } catch {
        return [];
      }
    }, QUEUE_KEY);

    expect(Array.isArray(queue)).toBe(true);
    expect(queue.length).toBeGreaterThan(0);
  });

  test("queue drains and shows Saved after coming back online", async ({ page }) => {
    await page.goto("/en/app/questions");
    await page.waitForLoadState("networkidle");

    const firstInput = page.locator('input[type="text"]').first();
    if ((await firstInput.count()) === 0) {
      test.skip();
      return;
    }

    // Go offline and type an answer
    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true });
      window.dispatchEvent(new Event("offline"));
    });

    await firstInput.fill("will sync on reconnect");
    await firstInput.blur();
    await page.waitForTimeout(700);

    // Come back online
    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", { get: () => true, configurable: true });
      window.dispatchEvent(new Event("online"));
    });

    // Queue should drain — allow time for server action round-trip
    await page.waitForTimeout(2_000);

    // localStorage queue should be empty after drain
    const queueAfter = await page.evaluate((key) => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? "[]");
      } catch {
        return [];
      }
    }, QUEUE_KEY);

    expect(queueAfter.length).toBe(0);
  });
});
