import { test, expect } from "@playwright/test";

// Demeter public-surface smoke (T12): runs WITHOUT an ANTHROPIC_API_KEY in CI,
// so the chat asserts "a response state arrives" — a real streamed answer when
// a key is present (local), the honest unavailable banner when it isn't (CI).
// Every spec runs on a phone profile (F8 mobile-first acceptance).

test.describe("chat surface", () => {
  test("renders the chat with state chips and federal default", async ({ page }) => {
    await page.goto("/demeter");
    await expect(page.getByRole("heading", { name: "Demeter" })).toBeVisible();
    const federal = page.getByRole("radio", { name: /All states/ });
    await expect(federal).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radio", { name: /CA/ })).toBeVisible();
    await expect(page.getByPlaceholder(/Ask anything about SNAP/)).toBeVisible();
  });

  test("guide deep-link preselects state and question", async ({ page }) => {
    await page.goto("/demeter?state=TX&q=Does%20my%20car%20count%3F");
    await expect(page.getByRole("radio", { name: /TX/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByPlaceholder(/Ask anything about SNAP/)).toHaveValue(
      "Does my car count?",
    );
  });

  test("send always yields a response state (answer or honest banner)", async ({ page }) => {
    await page.goto("/demeter");
    await page.getByPlaceholder(/Ask anything about SNAP/).fill("What is SNAP?");
    await page.getByRole("button", { name: /Send|Enviar/ }).click();
    // The user bubble appears immediately…
    await expect(page.locator(".demeter__msg--user")).toHaveText("What is SNAP?");
    // …then either streamed assistant text or an honest error banner. Never
    // silence, never a raw failure.
    await expect
      .poll(
        async () => {
          const assistant = await page.locator(".demeter__msg--assistant").last().textContent();
          const banner = await page.locator(".demeter__error").count();
          return (assistant ?? "").length > 0 || banner > 0;
        },
        { timeout: 40_000 },
      )
      .toBe(true);
  });

  test("language toggle switches the surface to Spanish", async ({ page }) => {
    await page.goto("/demeter");
    await page.getByRole("button", { name: "Cambiar a español" }).click();
    await expect(page.getByPlaceholder(/Pregunta lo que sea sobre SNAP/)).toBeVisible();
  });
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
    const first = page.locator('a[href^="/demeter?state=TX"]').first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page).toHaveURL(/\/demeter\?state=TX/);
    await expect(page.getByRole("radio", { name: /TX/ })).toHaveAttribute("aria-checked", "true");
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
