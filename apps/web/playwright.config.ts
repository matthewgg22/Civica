import { defineConfig, devices } from "@playwright/test";

// Demeter smoke suite — mobile-first (F8): everything runs on a chromium
// phone profile. In CI the config boots the production server itself (the
// workflow builds first); locally set PLAYWRIGHT_BASE_URL to reuse a running
// dev server instead.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3120";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        // `pnpm start -- --port 3120` mangles the forwarded args — next parsed
        // "--port" as the project directory and died. Invoke the binary
        // directly so there is no forwarding layer to get it wrong.
        command: "pnpm exec next start --port 3120",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
