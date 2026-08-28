// Email sign-in is off until SMTP is wired (#699, owner 2026-08-29).
//
// The magic-link route works but no mail provider is configured, so every
// send silently fails — a "Email me a sign-in link" button that does nothing
// is a launch defect. Both sign-in surfaces hide the email half behind
// EMAIL_SIGNIN_ENABLED and offer Google only, which is verified working.
// These pin the flag OFF and both surfaces honoring it, so the day someone
// flips it back on is a deliberate one.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMAIL_SIGNIN_ENABLED } from "../lib/magic-link";

const read = (...p: string[]) => readFileSync(join(__dirname, "..", ...p), "utf8");

describe("email sign-in is disabled at launch", () => {
  it("the flag is off", () => {
    // Flipping this true without wiring SMTP re-ships the silent-failure
    // button. Change it deliberately, with the mail provider in place.
    expect(EMAIL_SIGNIN_ENABLED).toBe(false);
  });

  it("both surfaces gate the email form behind the flag", () => {
    for (const [name, src] of [
      ["page", read("app", "sign-in", "signin-form.tsx")],
      ["modal", read("components", "DemeterSignInModal.tsx")],
    ] as const) {
      expect(src, `${name} does not import the flag`).toContain("EMAIL_SIGNIN_ENABLED");
      // The email form and its divider must be INSIDE the gate. Checked by
      // proximity: the flag guard appears before the divider markup.
      const gate = src.indexOf("EMAIL_SIGNIN_ENABLED &&");
      const divider = src.indexOf("signin-divider");
      const form = src.indexOf("<form");
      expect(gate, `${name} has no flag guard`).toBeGreaterThan(-1);
      expect(gate, `${name}: divider not behind the flag`).toBeLessThan(divider);
      expect(gate, `${name}: form not behind the flag`).toBeLessThan(form);
    }
  });

  it("keeps Google — the surviving path — outside the flag", () => {
    for (const [name, src] of [
      ["page", read("app", "sign-in", "signin-form.tsx")],
      ["modal", read("components", "DemeterSignInModal.tsx")],
    ] as const) {
      const google = src.indexOf("signin-google");
      const gate = src.indexOf("EMAIL_SIGNIN_ENABLED &&");
      expect(google, `${name}: Google button is gone`).toBeGreaterThan(-1);
      expect(google, `${name}: Google is behind the email flag`).toBeLessThan(gate);
    }
  });

  it("leaves the Terms/Privacy assent on the page, not gated with email", () => {
    // Browsewrap: account creation via Google still needs the assent adjacent.
    const page = read("app", "sign-in", "signin-form.tsx");
    expect(page).toContain('href="/terms"');
    expect(page).toContain('href="/privacy"');
    // The assent block is gated on forConversation, never on the email flag.
    const assent = page.indexOf('href="/terms"');
    // The assent sits inside its own forConversation block, not the email gate.
    expect(page.slice(0, assent)).toContain("forConversation && (");
  });
});
