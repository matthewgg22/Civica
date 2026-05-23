import { describe, it, expect } from "vitest";
import { inferEarliestExpiry, findRememberMeCookie } from "../../../src/processors/ebt-ca/login.js";
import type { SessionCookie } from "../../../src/processor.js";

const SECONDS_PER_DAY = 24 * 60 * 60;
const NOW_SECONDS = Math.floor(Date.now() / 1000);

function makeCookie(name: string, expiresIn: number): SessionCookie {
  return {
    name,
    value: "v",
    domain: ".ebt.ca.gov",
    path: "/",
    expires: expiresIn < 0 ? -1 : NOW_SECONDS + expiresIn,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  };
}

describe("inferEarliestExpiry", () => {
  it("returns null when all cookies are session-scoped", () => {
    const cookies: SessionCookie[] = [makeCookie("JSESSIONID", -1)];
    expect(inferEarliestExpiry(cookies)).toBeNull();
  });

  it("returns ISO string of earliest non-session expiry", () => {
    const cookies: SessionCookie[] = [
      makeCookie("JSESSIONID", -1),
      makeCookie("remember_me", SECONDS_PER_DAY * 30),
      makeCookie("preferences", SECONDS_PER_DAY * 365),
    ];
    const iso = inferEarliestExpiry(cookies);
    expect(iso).not.toBeNull();
    const expectedSeconds = NOW_SECONDS + SECONDS_PER_DAY * 30;
    const actualSeconds = Math.floor(new Date(iso!).getTime() / 1000);
    // Allow 60s of clock drift between cookie expiry computation and assertion.
    expect(Math.abs(actualSeconds - expectedSeconds)).toBeLessThan(60);
  });
});

describe("findRememberMeCookie", () => {
  it("returns null when no cookie is long-lived", () => {
    const cookies: SessionCookie[] = [
      makeCookie("JSESSIONID", -1),
      makeCookie("short_token", SECONDS_PER_DAY * 2),
    ];
    expect(findRememberMeCookie(cookies)).toBeNull();
  });

  it("returns the name of a cookie that lasts >7 days", () => {
    const cookies: SessionCookie[] = [
      makeCookie("JSESSIONID", -1),
      makeCookie("remember_me", SECONDS_PER_DAY * 30),
    ];
    expect(findRememberMeCookie(cookies)).toBe("remember_me");
  });

  it("returns the first long-lived cookie when multiple are present", () => {
    const cookies: SessionCookie[] = [
      makeCookie("remember_me", SECONDS_PER_DAY * 30),
      makeCookie("preferences", SECONDS_PER_DAY * 365),
    ];
    expect(findRememberMeCookie(cookies)).toBe("remember_me");
  });
});
