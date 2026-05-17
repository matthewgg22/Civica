import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: process.env.CI
    ? [["github"], ["list"]]
    : [["list"]],

  use: {
    // No browser — all tests make HTTP requests directly via fetch.
    // extraHTTPHeaders can be set per-request inside each test.
    trace: "on-first-retry",
  },
});
