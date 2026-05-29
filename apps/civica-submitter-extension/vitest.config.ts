import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    include: ["test/**/*.test.ts"],
    // Installs the in-memory chrome.storage stub before any test module loads,
    // so content.ts's top-level main() and the continuity helpers have a
    // backend (see test/setup.ts).
    setupFiles: ["./test/setup.ts"],
  },
});
