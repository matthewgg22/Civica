// The first-visit card, met the way a first visitor meets it.
//
// ITS OWN FILE ON PURPOSE. smoke.spec.ts and reflow.spec.ts seed
// "demeter.welcome.seen" in a beforeEach, because the card is a modal and
// would otherwise stand in front of every one of their ~14 navigations to
// "/" and "/screen/ask". This file does no seeding, so the browser context
// starts as a genuine first visit.
//
// THE FIRST ATTEMPT AT THIS LIVED IN smoke.spec.ts AND WAS WRONG. It tried to
// opt out of the seed with an addInitScript that REMOVED the key — but
// addInitScript runs before every navigation, not once, so it cleared the key
// again on the way to /chat and undid the very dismissal the test existed to
// verify. Hence a separate file rather than a cleverer opt-out.
import { test, expect } from "@playwright/test";

test("greets someone arriving at the front door, once", async ({ page }) => {
  // The bare domain redirects to /screen/ask, so this is the door almost
  // everyone comes through — and the card used to exist only on /chat.
  await page.goto("/screen/ask");
  await expect(page.locator(".dmwel")).toBeVisible();

  // The required USDA notice rides with the logo, in English on every
  // language. That is the condition of being allowed to show the mark at all.
  await expect(page.locator(".dmwel__mark")).toContainText("service mark");

  // The dismiss is the SECONDARY action; the primary is a sign-in LINK, which
  // navigates rather than closing.
  await page.locator(".dmwel__secondary").click();
  await expect(page.locator(".dmwel")).toHaveCount(0);

  // ONE KEY, BOTH DOORS. Having met it here, the chat must not introduce the
  // product a second time. This is the regression that two copies of the
  // storage logic would have caused, and it is invisible from either surface
  // on its own.
  await page.goto("/chat");
  await expect(page.locator(".dmwel")).toHaveCount(0);
});

test("stays dismissed across a reload of the landing page", async ({ page }) => {
  await page.goto("/screen/ask");
  await page.locator(".dmwel__secondary").click();
  await expect(page.locator(".dmwel")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".dmwel")).toHaveCount(0);
});
