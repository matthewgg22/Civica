import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
    // TWO BUDGETS, BOTH MEASURED, BOTH PREVIOUSLY JUST INHERITED (#1018).
    //
    // testTimeout: the DemeterChat suites drive the real component through
    // 8-24 sequential round-trips. demeter-chat-message-window does 24 and
    // takes 6.0-10.0s — against vitest's 5000ms default, which is a coin
    // flip, and is the intermittent failure #1018 recorded. #892 hit this
    // exact wall and fixed it PER TEST in demeter-chat-offer-nudges: three
    // annotations in one file, while message-window, state-switch,
    // pi-redesign and worksheet-restore got nothing. A per-test fix misses
    // the next file by construction, so the budget belongs here. The 30s
    // annotations still win where they are set.
    testTimeout: 20_000,
    // asyncUtilTimeout is set in vitest.setup.ts — see there for the gate
    // measurements. WITHOUT THIS LINE THAT FILE IS DEAD CODE, which is
    // exactly how it shipped in #1043: the setup file landed, this wiring
    // did not, and nothing loaded it.
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
