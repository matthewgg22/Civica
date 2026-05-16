import { defineConfig, devices } from "@playwright/test";
import path from "path";

const AUTH_STATE_PATH = path.resolve(__dirname, "tests/e2e/.auth/user.json");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    // Default to mobile viewport — primary use case
    viewport: { width: 390, height: 844 },
  },
  projects: [
    // ── Auth setup runs first, once ───────────────────────────────────────
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },

    // ── Authenticated suites depend on setup ──────────────────────────────
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        storageState: AUTH_STATE_PATH,
      },
      dependencies: ["setup"],
    },
    {
      name: "mobile-safari",
      use: {
        ...devices["iPhone 12"],
        storageState: AUTH_STATE_PATH,
      },
      dependencies: ["setup"],
    },
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_STATE_PATH,
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
