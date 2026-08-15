import { test, expect, type Page } from "@playwright/test";

/** The composer, located by what it IS rather than by what it says.
 *
 *  These specs used to match on the placeholder text. That made a copy edit —
 *  "Ask anything about SNAP" → "Happy to answer any questions about SNAP" —
 *  break seven assertions across three files that were not testing copy at all.
 *  A locator should only be sensitive to the thing its test is about. */
function composer(page: Page) {
  return page.locator("textarea.demeter__input");
}

// Demeter public-surface smoke (T12): runs WITHOUT an ANTHROPIC_API_KEY in CI,
// so the chat asserts "a response state arrives" — a real streamed answer when
// a key is present (local), the honest unavailable banner when it isn't (CI).
// Every spec runs on a phone profile (F8 mobile-first acceptance).

test.describe("front door", () => {
  // The front door EXPLAINS and hands over; it no longer takes a question. The
  // composer, the picker and the suggested questions all live on /chat, so
  // there is one place a conversation can start rather than two.
  test("the bare domain lands on the explainer, with a way through to the chat", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/screen\/ask$/);
    await expect(composer(page)).toHaveCount(0);
    const cta = page.getByRole("link", { name: /Ask Demeter about your situation/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(composer(page)).toBeVisible();
  });

  test("root carries query params through, so campaign links keep working", async ({ page }) => {
    await page.goto("/?state=TX&q=Does%20my%20car%20count%3F");
    // Two hops now: / → /screen/ask → /chat. A campaign link carrying a
    // QUESTION is already a conversation, so it belongs in the tool rather than
    // on the front door. The params survive both hops, which is the thing that
    // actually matters for a campaign link.
    await expect(page).toHaveURL(/\/chat\?/);
    // The state selector is a combobox (2026-08-09): one selection, shown on
    // the trigger, rather than a row of radio chips.
    await expect(page.getByRole("button", { name: "Your state", exact: true })).toContainText("TX");
    await expect(composer(page)).toHaveValue(
      "Does my car count?",
    );
  });

  test("the applicant landing is still reachable at its own URL", async ({ page }) => {
    const res = await page.goto("/welcome");
    expect(res?.status()).toBe(200);
  });
});

test.describe("chat surface", () => {
  test("renders the chat, the explainer, and the federal default", async ({ page }) => {
    await page.goto("/screen/ask");
    // Playwright's `name` matches a SUBSTRING by default — testing-library's
    // matches the FULL string — which is why these collisions surface only
    // here and the jsdom suite stays green. "Your state" also matches the
    // estimate rail's "Choose your state", so it stays pinned exact.
    //
    // The heading assertion used to look for a heading named "Demeter": the
    // chat card's own <h1>. That <h1> moved to the orientation bar above the
    // card, and the card's title is now a <p> — so this asserts the real thing
    // instead, and that there is EXACTLY ONE <h1>. The old shape had an <h2>
    // before the <h1> in document order, which is what this change fixed.
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText(/get the actual rule/i);
    // The picker moved to /chat with the rest of the chat. What the landing
    // must still prove is that it is server-rendered and quotable.
    await expect(page.getByRole("button", { name: "Your state", exact: true })).toHaveCount(0);
    // The orientation copy is SERVER-rendered — its presence in the DOM is
    // what makes the page quotable by generative search. It is a <p> now, not
    // a heading: the page leads with what Demeter is, and explains SNAP as
    // orientation underneath rather than as the page's own claim.
    await expect(page.getByText(/SNAP is monthly money for groceries/)).toBeVisible();
    await expect(composer(page)).toHaveCount(0);
  });

  test("the chat itself carries the picker and the composer, and no starter chips", async ({
    page,
  }) => {
    await page.goto("/chat");
    const picker = page.getByRole("button", { name: "Your state", exact: true });
    await expect(picker).toContainText("All states");
    await expect(composer(page)).toBeVisible();
    // THE STARTERS ARE GONE, deliberately. There were three, and none was what
    // someone actually opens with; two carried a discouraging premise before a
    // word had been exchanged ("Do I earn too much to qualify?", "Will I have
    // to do an interview?"). Putting those in front of a person who has not yet
    // decided whether they are allowed to ask is a way to lose them at the
    // door. Asserted at zero so they cannot quietly return.
    await expect(page.locator(".demeter__suggest")).toHaveCount(0);
    // Opening the picker reveals every verified pack — under its DISPLAY name.
    // The raw corpus field carries annotation prose ("SNAP (no state-specific
    // branding)"), which is written for retrieval, not for a list you scan.
    await picker.click();
    await expect(page.getByRole("option", { name: /CalFresh/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /no state-specific branding/ })).toHaveCount(0);
  });

  // The content moved off the chat page. A unit test can prove the components
  // render; only this can prove the ROUTE exists and the link between them
  // works, which is the whole safety argument for moving rather than cutting.
  test("the form questions moved to /questions and are linked from the chat page", async ({
    page,
  }) => {
    await page.goto("/screen/ask");
    // .first() because the footer now carries the same link. Two routes to the
    // same page is the intent, not a bug — the depth section hands you there
    // after reading, the footer after scrolling past everything.
    await page
      .getByRole("link", { name: /What the application is actually asking/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/questions$/);

    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText(/What the application is actually asking/i);
    // A representative card and its citation — the pairing is the product.
    await expect(page.getByText(/buy and fix food together/i).first()).toBeVisible();
    await expect(page.getByText("7 CFR 273.1").first()).toBeVisible();
    // And back to the chat.
    await page.getByRole("link", { name: /Ask Demeter about your own situation/i }).click();
    await expect(page).toHaveURL(/\/screen\/ask$/);
  });

  // A ?state= on the front door is scope, not a conversation, so it does not
  // redirect — but it must survive the hand-off, or a /guides/[state] visitor
  // arrives at the chat scoped to nothing.
  test("the hand-off carries a state through to the chat", async ({ page }) => {
    await page.goto("/screen/ask?state=TX");
    await page.getByRole("link", { name: /Ask Demeter about your situation/i }).click();
    await expect(page).toHaveURL(/\/chat\?state=TX/);
    await expect(page.getByRole("button", { name: "Your state", exact: true })).toContainText("TX");
  });

  // Deep links from /guides and /verify carry a question, so they are already a
  // conversation and redirect to the tool rather than the front door.
  test("guide deep-link redirects to /chat with state and question intact", async ({ page }) => {
    await page.goto("/screen/ask?state=TX&q=Does%20my%20car%20count%3F");
    await expect(page).toHaveURL(/\/chat\?/);
    await expect(page.getByRole("button", { name: "Your state", exact: true })).toContainText("TX");
    await expect(composer(page)).toHaveValue(
      "Does my car count?",
    );
  });

  test("send always yields a response state (answer or honest banner)", async ({ page }) => {
    await page.goto("/chat");
    await composer(page).fill("What is SNAP?");
    await page.getByRole("button", { name: /Send|Enviar/ }).click();
    // The user bubble appears immediately…
    await expect(page.locator(".demeter__msg--user")).toHaveText("What is SNAP?");
    // …then either streamed assistant text or an honest error banner. Never
    // silence, never a raw failure.
    await expect
      .poll(
        async () => {
          // Count FIRST. On the no-key path the empty assistant bubble is
          // removed and the honest banner renders instead, so calling
          // .textContent() on the absent bubble would block until timeout and
          // the banner would never be checked.
          const assistants = page.locator(".demeter__msg--assistant");
          const n = await assistants.count();
          const text = n > 0 ? (await assistants.last().textContent()) ?? "" : "";
          const banner = await page.locator(".demeter__error").count();
          return text.trim().length > 0 || banner > 0;
        },
        { timeout: 40_000 },
      )
      .toBe(true);
  });

  // Each language is asserted end-to-end because the point of doing the engine
  // work rather than shipping a selector is that a language offered here is a
  // language the surface actually speaks.
  //
  // The in-chat <select> moved to the NAV as real links. That matters beyond
  // tidiness: when the chat moved to /chat, the landing page lost the switcher
  // entirely, so a Spanish speaker arriving on the English page had no way
  // across. Links also mean a crawler can follow them and switching keeps you
  // on the page you were reading.
  // Asserts on the localized EXPLAINER copy rather than the composer's
  // placeholder, since the composer is no longer on this page.
  for (const [label, path, marker] of [
    ["Español", "/es/screen/ask", /Pregúntale a Demeter sobre tu situación/],
    ["Tiếng Việt", "/vi/screen/ask", /Hỏi Demeter về hoàn cảnh của bạn/],
    ["中文", "/zh/screen/ask", /就您的情况询问 Demeter/],
  ] as Array<[string, string, RegExp]>) {
    test(`the nav switches the surface to ${label}`, async ({ page }) => {
      await page.goto("/screen/ask");
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, "\\/")));
      await expect(page.getByRole("link", { name: marker })).toBeVisible();
    });
  }

  test("the language links keep you on the page you were reading", async ({ page }) => {
    // The old <select> lived in the chat, so switching language could only ever
    // mean "switch the chat". From /questions, Español must go to
    // /es/questions — not back to the chat.
    await page.goto("/questions");
    await page.getByRole("link", { name: "Español", exact: true }).click();
    await expect(page).toHaveURL(/\/es\/questions$/);
  });
});

test.describe("growth surfaces", () => {
  test("/verify renders verification cards with real gate numbers", async ({ page }) => {
    await page.goto("/verify");
    await expect(page.getByRole("heading", { name: "How we verify" })).toBeVisible();

    // Each card links into the CHAT, scoped to its state. It used to link to
    // the landing page, so a reader who had just decided to ask about this
    // state was returned to the start.
    //
    // Matched on the ACCESSIBLE name, which carries the state, not on the
    // visible label, which deliberately does not: thirty cards reading "Ask
    // Demeter about Rhode Island" is a wall, and thirty links all announcing
    // "Ask Demeter" to a screen reader is thirty indistinguishable
    // destinations. The two jobs need different strings.
    for (const [code, name] of [
      ["CA", "California"],
      ["WA", "Washington"],
      ["TX", "Texas"],
      ["NY", "New York"],
    ]) {
      const link = page.getByRole("link", { name: `Ask Demeter about ${name}` });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", `/chat?state=${code}`);
    }

    // The page is part of the product, not a document someone linked to.
    await expect(page.locator(".dmnav")).toBeVisible();
    await expect(page.locator(".dmft")).toBeVisible();
    // And the line that was true of every card, and therefore told you nothing
    // about any of them, is gone.
    await expect(page.getByText("Passed an adversarial refute gate")).toHaveCount(0);
  });

  test("/guides/tx is statically served and deep-links into the chat", async ({ page }) => {
    await page.goto("/guides/tx");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/SNAP in TX/);
    const first = page.locator('a[href^="/screen/ask?state=TX"]').first();
    await expect(first).toBeVisible();
    await first.click();
    // The guide links carry a QUESTION as well as a state, so they land in the
    // tool. The guide pages themselves are unchanged — the redirect is what
    // keeps every existing deep link working without editing 9 state packs.
    await expect(page).toHaveURL(/\/chat\?/);
    await expect(page).toHaveURL(/state=TX/);
    await expect(page.getByRole("button", { name: "Your state", exact: true })).toContainText("TX");
  });

  test("unknown guide slugs 404 (dynamicParams=false)", async ({ page }) => {
    const res = await page.goto("/guides/zz");
    expect(res?.status()).toBe(404);
  });

  test("/supporters renders the wall, definition, and sign-on form", async ({ page }) => {
    await page.goto("/supporters");
    await expect(page.getByRole("heading", { name: "Demeter Supporters" })).toBeVisible();
    await expect(page.getByText(/endorses free, accurate SNAP guidance/)).toBeVisible();
    // Binding reimbursement wording — the counsel-safe conditional form.
    await expect(page.getByText(/may qualify as an allowable outreach cost/)).toBeVisible();
    await expect(page.getByLabel(/Organization name/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign on" })).toBeVisible();
  });
});

// The live retailer map (replaced a static SVG choropleth on direct feedback
// after looking at the rendered page — see the component's own comments).
// Leaflet needs a real browser: jsdom has no layout engine, so a zoomend
// listener toggling a GeoJSON layer's fillOpacity cannot be exercised in
// vitest at all. This is the one place that behaviour can be pinned.
//
// The USDA search itself is MOCKED, not live — a live third-party API call in
// a CI smoke test is a flaky test waiting to happen, and the point of this
// suite is the map's own logic, not USDA's uptime.
test.describe("the live retailer map", () => {
  const MOCK_STORES = Array.from({ length: 6 }, (_, i) => ({
    name: `Test Store ${i + 1}`,
    address: `${100 + i} Main St`,
    city: "Los Angeles",
    state: "CA",
    zip: "90001",
    type: "Supermarket",
    lat: 33.97 + i * 0.001,
    lon: -118.25 + i * 0.001,
  }));

  test("renders real tiles and a tinted state layer by default", async ({ page }) => {
    await page.goto("/screen/ask");
    const map = page.locator(".dmret__livemap");
    await map.scrollIntoViewIfNeeded();
    // 51 = every state + DC, same coverage as the static map it replaced.
    await expect(page.locator(".dmret__livemap path.leaflet-interactive")).toHaveCount(51);
    await expect(page.locator(".dmret__livemap .leaflet-tile").first()).toBeVisible();
  });

  test("a search drops pins and flies in — and the state tint fades once zoomed past it", async ({
    page,
  }) => {
    // THE BUG THIS PINS: the state's own fill polygon sat opaque over the
    // whole viewport once zoomed in past city scale, because a close-up view
    // sits entirely inside one state's shape — hiding the tiles, the streets,
    // and the pins it was supposed to be showing off. Only visible by
    // rendering a real search and looking at the result.
    await page.route("**/api/snap-retailers*", (route) =>
      route.fulfill({ json: { stores: MOCK_STORES, truncated: false } }),
    );
    await page.goto("/screen/ask");
    await page.locator(".dmret__livemap").scrollIntoViewIfNeeded();

    await page.locator("#dmret-zip").fill("90001");
    await page.getByRole("button", { name: /find stores/i }).click();
    await expect(page.locator(".dmret__pin")).toHaveCount(MOCK_STORES.length);

    // POLLED, not a one-shot read: flyToBounds animates the zoom over
    // FLY_DURATION_S (1.8s — slowed from 0.6s on live feedback that the
    // original flight "read as a snap"), and the fade only fires on the
    // animation's own 'zoomend' event once it actually completes, followed by
    // the fade's own 500ms CSS transition. A single evaluate() right after the
    // pins appear reads the state from before that animation has finished and
    // reports the old, still-tinted value. Timeout budgeted for flight +
    // transition + CI slack, not just the flight alone.
    await expect
      .poll(
        () =>
          page
            .locator(".dmret__livemap path.leaflet-interactive")
            .first()
            .evaluate((el) => getComputedStyle(el).fillOpacity),
        { timeout: 5000 },
      )
      .toBe("0");
  });

  test("pins land at their own position on the map, not stacked at one corner", async ({ page }) => {
    // THE BUG THIS PINS: the settle-in animation's `transform` keyframes were
    // declared on `.dmret__pin` itself — the exact element Leaflet repositions
    // with its own inline `transform: translate3d(...)` on every pan and zoom.
    // A CSS animation touching `transform` on that element wins over Leaflet's
    // inline style for as long as it runs, and this one ended on
    // `transform: none` — permanently erasing Leaflet's positioning once the
    // animation finished. Every pin rendered at the container's origin,
    // exactly on top of every other pin, instead of at its own store. The pin
    // COUNT assertion above still passed throughout — this only showed up by
    // reading each pin's actual screen position off a rendered page.
    await page.route("**/api/snap-retailers*", (route) =>
      route.fulfill({ json: { stores: MOCK_STORES, truncated: false } }),
    );
    await page.goto("/screen/ask");
    await page.locator(".dmret__livemap").scrollIntoViewIfNeeded();

    await page.locator("#dmret-zip").fill("90001");
    await page.getByRole("button", { name: /find stores/i }).click();
    await expect(page.locator(".dmret__pin")).toHaveCount(MOCK_STORES.length);
    // Past the fly animation and the settle-in animation both.
    await page.waitForTimeout(2500);

    const rects = await page
      .locator(".dmret__pin")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
    const mapRect = await page.locator(".dmret__livemap").evaluate((el) => el.getBoundingClientRect());

    // Every pin sits inside the map's own box…
    for (const r of rects) {
      expect(r.left).toBeGreaterThanOrEqual(mapRect.left - 1);
      expect(r.top).toBeGreaterThanOrEqual(mapRect.top - 1);
      expect(r.right).toBeLessThanOrEqual(mapRect.right + 1);
      expect(r.bottom).toBeLessThanOrEqual(mapRect.bottom + 1);
    }
    // …and at DISTINCT positions from one another — the stacked-at-the-origin
    // bug put all six at the identical rect.
    const uniquePositions = new Set(rects.map((r) => `${Math.round(r.left)},${Math.round(r.top)}`));
    expect(uniquePositions.size).toBe(MOCK_STORES.length);
  });
});
