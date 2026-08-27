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

/** Never throws: returns "" when nothing is marked yet, so a poll retries
 *  instead of failing on the first look. On a cold production server the page
 *  can be scrolled before React has hydrated and attached the observer. */
const current = (page: Page) =>
  page.evaluate(
    () => document.querySelector(".lgl__toc-list a[aria-current]")?.textContent ?? "",
  );

/** Scroll, then poll — RE-SCROLLING each time. Scrolling once before hydration
 *  and then waiting is the flake this fixes: the observer attaches after the
 *  scroll and never sees it. Re-applying the same position is idempotent, and
 *  the first iteration after hydration lands it. */
async function expectCurrent(page: Page, id: string, text: string) {
  await expect
    .poll(
      async () => {
        await scrollIntoBand(page, id);
        return current(page);
      },
      { timeout: 10_000 },
    )
    .toContain(text);
}

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

    await expectCurrent(page, "disputes", "Dispute resolution");
    // And back up again — the marker has to move in both directions, which a
    // one-way test would not catch if the band only ever grew downwards.
    await expectCurrent(page, "who", "Who can use Demeter");
  });

  test("reaches the last section at the bottom", async ({ page }) => {
    // The tail sections are short enough that they may never cross the band.
    await page.goto("/terms");
    await expect
      .poll(
        async () => {
          await page.evaluate(() =>
            window.scrollTo(0, document.documentElement.scrollHeight),
          );
          await page.waitForTimeout(120);
          return current(page);
        },
        { timeout: 10_000 },
      )
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
