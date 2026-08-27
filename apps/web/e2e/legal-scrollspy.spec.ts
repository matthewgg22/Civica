// The contents marker, in a real browser.
//
// This is here because it CANNOT be checked anywhere else. The unit tests
// drive the IntersectionObserver callback directly, so they prove the choosing
// logic and nothing about whether the observer ever fires — and the band that
// decides "current" (a rootMargin) only means anything against a real viewport
// with real scrolling. A wrong band leaves the marker stuck on section 1,
// which is exactly the failure a reader notices first and no jsdom test sees.
import { test, expect } from "@playwright/test";

type Page = import("@playwright/test").Page;

const current = async (page: Page) =>
  page.locator(".lgl__toc-list a[aria-current]").first().textContent();

/** Put a section's top INSIDE the band that decides "current".
 *
 *  Not scrollIntoViewIfNeeded: that leaves the heading wherever it happens to
 *  land — measured at 255px with the band at 101-252, which put the PREVIOUS
 *  section in the band and made this test fail against correct behaviour. */
async function scrollIntoBand(page: Page, id: string) {
  await page.evaluate((sectionId) => {
    const el = document.getElementById(sectionId)!;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top - window.innerHeight * 0.18);
  }, id);
  await page.waitForTimeout(150);
}

test.describe("legal contents scrollspy", () => {
  test("marks the first section before you scroll", async ({ page }) => {
    await page.goto("/terms");
    expect(await current(page)).toContain("This agreement");
  });

  test("follows the reader down the document", async ({ page }) => {
    await page.goto("/terms");

    await scrollIntoBand(page, "disputes");
    await expect
      .poll(async () => await current(page), { timeout: 5000 })
      .toContain("Dispute resolution");

    // And back up again — the marker has to move in both directions, which a
    // one-way test would not catch if the band only ever grew downwards.
    await scrollIntoBand(page, "who");
    await expect
      .poll(async () => await current(page), { timeout: 5000 })
      .toContain("Who can use Demeter");
  });

  test("reaches the last section at the bottom", async ({ page }) => {
    // The tail sections are short enough that they may never cross the band.
    await page.goto("/terms");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect
      .poll(async () => await current(page), { timeout: 5000 })
      .toContain("Contact");
  });

  test("marks exactly one entry, as a location", async ({ page }) => {
    await page.goto("/terms");
    await scrollIntoBand(page, "accounts");
    await expect(page.locator(".lgl__toc-list a[aria-current]")).toHaveCount(1);
    await expect(page.locator(".lgl__toc-list a[aria-current]")).toHaveAttribute(
      "aria-current",
      "location",
    );
  });
});
