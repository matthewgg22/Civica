// The launch audit's P1 security batch (2026-08-28), pinned.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (...p: string[]) => readFileSync(join(__dirname, "..", ...p), "utf8");

describe("security headers exist", () => {
  // Verified live before the fix: nothing but Vercel's HSTS. On a product
  // whose auth cookies are httpOnly:false by SDK design, headers are the
  // cheap half of the backstop.
  const cfg = read("next.config.ts");
  it("declares a headers() block with the four that matter", () => {
    expect(cfg).toContain("async headers()");
    expect(cfg).toContain("frame-ancestors 'none'");
    expect(cfg).toContain("X-Content-Type-Options");
    expect(cfg).toContain("Referrer-Policy");
    expect(cfg).toContain("Permissions-Policy");
  });
  it("applies them to every path", () => {
    expect(cfg).toMatch(/source:\s*"\/:path\*"/);
  });
});

describe("the PDF route is bounded", () => {
  const route = read("app", "api", "demeter", "outline-pdf", "route.tsx");
  it("rate-limits by IP with the durable limiter, not an in-memory map", () => {
    expect(route).toContain('durableRateLimit("pdf"');
    expect(route).toMatch(/status: 429/);
  });
  it("caps the fact arrays before the renderer maps over them", () => {
    // Strings were capped; array LENGTHS were not — the actual DoS shape.
    expect(route).toContain("MAX_HOUSEHOLD");
    expect(route).toContain("MAX_INCOME_LINES");
    expect(route).toMatch(/household\.slice\(0, MAX_HOUSEHOLD\)/);
    expect(route).toMatch(/income\.slice\(0, MAX_INCOME_LINES\)/);
  });
});

describe("OTP verification is brute-force bounded", () => {
  const route = read("app", "api", "auth", "verify", "route.ts");
  it("limits per IP and per phone, before calling upstream", () => {
    expect(route).toContain('durableRateLimit("otpv-ip"');
    expect(route).toContain('durableRateLimit("otpv-ph"');
    // The limit must precede verifyOtp or it bounds nothing.
    expect(route.indexOf("durableRateLimit"), "limit runs after the guess").toBeLessThan(
      route.indexOf("verifyOtp"),
    );
  });
});

describe("the sink alarms actually ring", () => {
  // #1050's commit claimed console.error "reaches Sentry". It did not:
  // nothing captures console output, and the catch swallows the exception,
  // so the unhandled-error hook never fires either. captureException is the
  // only call that rings.
  it("audit sink captures to Sentry inside the catch", () => {
    const sink = read("lib", "demeter-audit-sink.ts");
    expect(sink).toContain("Sentry.captureException");
    expect(sink).toMatch(/tags: \{ sink: "mae_query_log" \}/);
  });
  it("events sink captures to Sentry inside the catch", () => {
    const sink = read("lib", "demeter-events.ts");
    expect(sink).toContain("Sentry.captureException");
    expect(sink).toMatch(/tags: \{ sink: "demeter_events"/);
  });
});

describe("the pilot_leads lockdown ships as a migration", () => {
  const sql = readFileSync(
    join(__dirname, "..", "..", "..", "supabase", "migrations", "20260829_pilot_leads_lockdown.sql"),
    "utf8",
  );
  it("recreates the policy scoped to service_role and revokes the web roles", () => {
    expect(sql).toMatch(/drop policy if exists "service_role_all"/);
    expect(sql).toMatch(/create policy "service_role_all"[\s\S]*to service_role/);
    expect(sql).toMatch(/revoke all on public\.pilot_leads from anon, authenticated/);
  });
  it("closes the one RLS-off table while in there", () => {
    expect(sql).toMatch(/recert_outreach_optouts enable row level security/);
  });
});
