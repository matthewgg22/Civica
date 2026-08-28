// The sign-in emails (#699 follow-through).
//
// The default Supabase template — "Magic Link / Follow this link to login",
// sender "Supabase Auth", a "powered by Supabase" footer — reads phishy for a
// benefits service whose whole posture is "know exactly who is talking to
// you". These pin the repo copies that the dashboard paste comes from.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const T = (f: string) =>
  readFileSync(join(__dirname, "..", "..", "..", "supabase", "templates", f), "utf8");
const CONFIG = readFileSync(join(__dirname, "..", "..", "..", "supabase", "config.toml"), "utf8");
const BOTH = ["magic-link.html", "confirm-signup.html"];

describe("the sign-in emails", () => {
  it("exist and are wired in config.toml with subjects", () => {
    expect(CONFIG).toContain("[auth.email.template.magic_link]");
    expect(CONFIG).toContain("[auth.email.template.confirmation]");
    expect(CONFIG).toContain('subject = "Your Demeter sign-in link"');
    expect(CONFIG).toContain("./supabase/templates/magic-link.html");
    expect(CONFIG).toContain("./supabase/templates/confirm-signup.html");
  });

  it("use ONLY the confirmation URL — no OTP token, ever", () => {
    // The product has no email-OTP entry screen. And Go's template engine
    // renders HTML comments too, so even a braces-wrapped EXAMPLE of the
    // token variable would interpolate the live value into the email source
    // — this test exists because exactly that shipped in the first draft.
    for (const f of BOTH) {
      const vars = [...T(f).matchAll(/\{\{\s*\.(\w+)\s*\}\}/g)].map((m) => m[1]);
      expect([...new Set(vars)], f).toEqual(["ConfirmationURL"]);
    }
  });

  it("say who it is, why it came, and that ignoring it is safe", () => {
    for (const f of BOTH) {
      const t = T(f);
      expect(t, f).toContain("Demeter AI");
      expect(t, f).toMatch(/You asked to/);
      expect(t, f).toMatch(/you can ignore this email/i);
      expect(t, f).toMatch(/never ask you to reply with personal information/i);
      expect(t, f).toContain("Demeter is not the government");
    }
  });

  it("carries a recognition line for each non-English language", () => {
    // One template per project is a Supabase limit, so it cannot be
    // per-language — but an es/vi/zh reader must recognize what this is
    // BEFORE clicking a link in an unexpected English email.
    for (const f of BOTH) {
      const t = T(f);
      expect(t, `${f} es`).toMatch(/enlace/);
      expect(t, `${f} vi`).toMatch(/Liên kết/);
      expect(t, `${f} zh`).toMatch(/Demeter。/);
    }
  });

  it("holds email-client constraints: no images, no webfonts, no scripts, no tracking", () => {
    for (const f of BOTH) {
      const t = T(f);
      expect(t, f).not.toMatch(/<img|<script|@import|fonts\.googleapis|http:\/\//i);
      // Inline styles only; a <style> block is stripped by half the clients.
      expect(t, f).not.toContain("<style");
    }
  });
});
