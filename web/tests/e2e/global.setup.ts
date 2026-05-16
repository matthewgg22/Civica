/**
 * Global Playwright auth setup.
 *
 * Signs in to Supabase via the REST password API, then saves the resulting
 * browser storage state so all authenticated tests can reuse the session
 * without going through the UI sign-in flow each time.
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   E2E_TEST_EMAIL
 *   E2E_TEST_PASSWORD
 *
 * If creds are absent the setup exits gracefully (tests that depend on auth
 * will be skipped at runtime via `test.skip`).
 */

import { test as setup, expect } from "@playwright/test";
import path from "path";

export const AUTH_STATE_PATH = path.resolve(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!supabaseUrl || !supabaseKey || !email || !password) {
    console.log("⚠️  E2E auth env vars not set — skipping auth setup.");
    // Write an empty state file so the authenticated project still loads
    await page.context().storageState({ path: AUTH_STATE_PATH });
    return;
  }

  // Sign in via Supabase REST API (password grant)
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ email, password }),
  });

  expect(res.ok, `Supabase sign-in failed: ${res.status} ${await res.text()}`).toBeTruthy();
  const session = await res.json();

  // Navigate to the app so we can inject cookies in the right origin
  await page.goto("/en/sign-in");

  // Inject the Supabase session via the browser Supabase client
  await page.evaluate(
    ({ url, key, access, refresh }) => {
      // @supabase/ssr reads from cookies; write a compatible session entry
      // directly via the supabase-js browser client so the SSR cookie sync works.
      const { createClient } = (window as any).__SUPABASE_SSR_CLIENT__ ?? {};
      if (createClient) {
        createClient(url, key).auth.setSession({ access_token: access, refresh_token: refresh });
        return;
      }
      // Fallback: write the raw localStorage key that supabase-js v2 uses as
      // a bridge until the server can pick it up via the auth callback.
      const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
      localStorage.setItem(storageKey, JSON.stringify({ access_token: access, refresh_token: refresh }));
    },
    {
      url: supabaseUrl,
      key: supabaseKey,
      access: session.access_token,
      refresh: session.refresh_token,
    }
  );

  // Reload so the middleware picks up the session and redirects appropriately
  await page.reload();

  // Save storage state (cookies + localStorage) for reuse
  await page.context().storageState({ path: AUTH_STATE_PATH });
  console.log("✅ Auth storage state saved.");
});
