import { test, expect } from "@playwright/test";

// WCAG 1.4.10 Reflow, and 1.4.4 Resize Text.
//
// Never checked before this. The criteria asked for "layout responsiveness up
// to 200% zoom without horizontal scroll", which is the same requirement stated
// as a viewport width: zooming to 200% on a 1280px screen leaves 640 CSS px,
// and 400% leaves 320 — the width 1.4.10 actually names.
//
// Horizontal scroll is the failure that matters here because it is the one that
// makes a page unusable rather than ugly: someone reading at 400% loses the
// start of every line and has to pan back and forth for each one.
//
// Asserted on scrollWidth rather than by eye, and on EVERY Demeter route,
// because reflow breaks at the widest element on a page and that element is
// rarely the one you were looking at.

const ROUTES = [
  "/screen/ask",
  "/chat",
  "/questions",
  "/states",
  "/terms",
  "/guides/tx",
  "/es/screen/ask",
  "/zh/questions",
];

// 640 = 200% zoom on a 1280 screen. 320 = 400%, the width WCAG names.
const WIDTHS = [640, 320];

for (const width of WIDTHS) {
  for (const route of ROUTES) {
    test(`${route} reflows at ${width}px with no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(route);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        // A 1px rounding difference is not a reflow failure; anything a person
        // would actually have to pan for is.
        const slack = 2;
        const offenders: string[] = [];
        if (document.body.scrollWidth > doc.clientWidth + slack) {
          // Name the widest offending element, so a failure says WHAT to fix
          // rather than only that something is wrong.
          for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
            const r = el.getBoundingClientRect();
            if (r.right > doc.clientWidth + slack || r.left < -slack) {
              const cls = typeof el.className === "string" ? el.className : "";
              offenders.push(`${el.tagName.toLowerCase()}.${cls.split(" ")[0] || "?"} → ${Math.round(r.right)}px`);
            }
            if (offenders.length >= 5) break;
          }
        }
        return {
          scrollWidth: document.body.scrollWidth,
          clientWidth: doc.clientWidth,
          offenders,
        };
      });

      expect(
        overflow.scrollWidth,
        `overflows by ${overflow.scrollWidth - overflow.clientWidth}px. Widest: ${overflow.offenders.join(", ") || "unknown"}`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 2);
    });
  }
}
