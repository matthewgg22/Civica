// Regression: next-steps "Sign in to send" CTA must redirect back to
// /apply/review, not /status. If the user completes the wizard unauthed,
// signs in, and lands on /status, the draft is never submitted.
//
// Bug: the href was /sign-in?next=%2Fstatus. Fix: /sign-in?next=%2Fapply%2Freview.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE = readFileSync(
  resolve(__dirname, "../next-steps/page.tsx"),
  "utf-8",
);

describe("next-steps page — submit redirect", () => {
  it("'Sign in to send' CTA points to /apply/review, not /status", () => {
    expect(SOURCE).toContain("next=%2Fapply%2Freview");
  });

  it("does not contain the wrong /status redirect", () => {
    // Guard against re-introducing the bug.
    const statusRedirect = 'next=%2Fstatus"';
    expect(SOURCE).not.toContain(statusRedirect);
  });
});
