import { test, expect } from "@playwright/test";

// Demeter public-surface smoke (T12): runs WITHOUT an ANTHROPIC_API_KEY in CI,
// so the chat asserts "a response state arrives" — a real streamed answer when
// a key is present (local), the honest unavailable banner when it isn't (CI).
// Every spec runs on a phone profile (F8 mobile-first acceptance).

test.describe("front door", () => {
  test("the bare domain lands on the chat, ready to take a question", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/screen\/ask$/);
    await expect(page.getByPlaceholder(/Ask anything about SNAP/)).toBeVisible();
  });

  test("root carries query params through, so campaign links keep working", async ({ page }) => {
    await page.goto("/?state=TX&q=Does%20my%20car%20count%3F");
    await expect(page).toHaveURL(/\/screen\/ask\?/);
    // The state selector is a combobox (2026-08-09): one selection, shown on
    // the trigger, rather than a row of radio chips.
    await expect(page.getByRole("button", { name: "Your state", exact: true })).toContainText("TX");
    await expect(page.getByPlaceholder(/Ask anything about SNAP/)).toHaveValue(
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
    const picker = page.getByRole("button", { name: "Your state", exact: true });
    await expect(picker).toContainText("All states");
    // The orientation copy is SERVER-rendered — its presence in the DOM is
    // what makes the page quotable by generative search. It is a <p> now, not
    // a heading: the page leads with what Demeter is, and explains SNAP as
    // orientation underneath rather than as the page's own claim.
    await expect(page.getByText(/SNAP is monthly money for groceries/)).toBeVisible();
    await expect(page.getByPlaceholder(/Ask anything about SNAP/)).toBeVisible();
    // Opening the picker reveals every verified pack.
    await picker.click();
    await expect(page.getByRole("option", { name: /CalFresh/ })).toBeVisible();
  });

  // The content moved off the chat page. A unit test can prove the components
  // render; only this can prove the ROUTE exists and the link between them
  // works, which is the whole safety argument for moving rather than cutting.
  test("the form questions moved to /questions and are linked from the chat page", async ({
    page,
  }) => {
    await page.goto("/screen/ask");
    await page.getByRole("link", { name: /What the application is actually asking/i }).click();
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

  test("guide deep-link preselects state and question", async ({ page }) => {
    await page.goto("/screen/ask?state=TX&q=Does%20my%20car%20count%3F");
    await expect(page.getByRole("button", { name: "Your state", exact: true })).toContainText("TX");
    await expect(page.getByPlaceholder(/Ask anything about SNAP/)).toHaveValue(
      "Does my car count?",
    );
  });

  test("send always yields a response state (answer or honest banner)", async ({ page }) => {
    await page.goto("/screen/ask");
    await page.getByPlaceholder(/Ask anything about SNAP/).fill("What is SNAP?");
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

  // The EN/ES toggle became a four-language picker (2026-08-09) once the engine
  // gained real VI/ZH support. Each language is asserted end-to-end because the
  // point of doing the engine work rather than shipping a selector is that a
  // language offered here is a language the surface actually speaks.
  for (const [label, placeholder] of [
    ["Español", /Pregunta lo que sea sobre SNAP/],
    ["Tiếng Việt", /Hỏi bất cứ điều gì về SNAP/],
    ["中文", /关于 SNAP/],
  ] as Array<[string, RegExp]>) {
    test(`language picker switches the surface to ${label}`, async ({ page }) => {
      await page.goto("/screen/ask");
      await page.getByLabel("Language").selectOption({ label });
      await expect(page.getByPlaceholder(placeholder)).toBeVisible();
    });
  }
});

test.describe("growth surfaces", () => {
  test("/verify renders verification cards with real gate numbers", async ({ page }) => {
    await page.goto("/verify");
    await expect(page.getByRole("heading", { name: "How we verify" })).toBeVisible();
    // At least the four launch states' cards, each linking into the chat.
    for (const code of ["CA", "WA", "TX", "NY"]) {
      await expect(page.getByRole("link", { name: new RegExp(`Ask about ${code}`) })).toBeVisible();
    }
  });

  test("/guides/tx is statically served and deep-links into the chat", async ({ page }) => {
    await page.goto("/guides/tx");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/SNAP in TX/);
    const first = page.locator('a[href^="/screen/ask?state=TX"]').first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page).toHaveURL(/\/screen\/ask\?state=TX/);
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
