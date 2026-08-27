import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
    // TWO BUDGETS, BOTH PREVIOUSLY INHERITED, AND #1043 ONLY SHIPPED HALF.
    //
    // vitest.setup.ts landed with the analysis behind it — waitFor's 1000ms
    // default against DemeterChat gates measured at up to 795ms on an IDLE
    // machine — but nothing referenced it, so configure() never ran and the
    // gate stayed at 1000ms. An orphaned setup file is worse than none: the
    // reasoning is in the tree and the behaviour is not.
    setupFiles: ["./vitest.setup.ts"],
    // The other half. demeter-chat-message-window drives 12 sequential
    // streamed exchanges and takes 4-6s against vitest's 5000ms default,
    // which is a coin flip — measured here failing consistently under load
    // and passing at 30s. 20s is several times the slowest real run and
    // still fails a genuine hang quickly.
    //
    // NOT A FIX FOR SLOWNESS: these suites are slow because they do ~20 real
    // round-trips. This stops the slowness from being FLAKY, which is the
    // part that costs people time. Seeded transcripts or fake timers are the
    // actual cure and are #1018's other half.
    testTimeout: 20_000,
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
