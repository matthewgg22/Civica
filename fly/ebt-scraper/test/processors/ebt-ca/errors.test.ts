import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { detectEbtCaErrors, assertBalancePageMarkers } from "../../../src/processors/ebt-ca/errors.js";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../../../src/processors/ebt-ca/fixtures");
const fx = (name: string): string => readFileSync(join(fixtureDir, name), "utf8");

describe("detectEbtCaErrors", () => {
  it("returns null on a successful balance page", () => {
    expect(detectEbtCaErrors(fx("balance-page.html"))).toBeNull();
  });

  it("returns null on a successful login landing page", () => {
    expect(detectEbtCaErrors(fx("login-success.html"))).toBeNull();
  });

  it("detects captcha", () => {
    const err = detectEbtCaErrors(fx("captcha.html"));
    expect(err).not.toBeNull();
    expect(err!.code).toBe("captcha");
  });

  it("detects session expired (login form redirect)", () => {
    const err = detectEbtCaErrors(fx("login-expired.html"));
    expect(err).not.toBeNull();
    expect(err!.code).toBe("sessionExpired");
  });

  it("detects portal down", () => {
    const html = `<!DOCTYPE html><html><body><h1>503 Service Unavailable</h1></body></html>`;
    const err = detectEbtCaErrors(html);
    expect(err).not.toBeNull();
    expect(err!.code).toBe("portalDown");
  });

  it("detects PIN locked", () => {
    const html = `<!DOCTYPE html><html><body><p>Your PIN is locked due to too many incorrect attempts.</p></body></html>`;
    const err = detectEbtCaErrors(html);
    expect(err).not.toBeNull();
    expect(err!.code).toBe("pinLocked");
  });

  it("detects card closed", () => {
    const html = `<!DOCTYPE html><html><body><p>This card has been closed.</p></body></html>`;
    const err = detectEbtCaErrors(html);
    expect(err).not.toBeNull();
    expect(err!.code).toBe("cardClosed");
  });

  it("prioritizes captcha over sessionExpired", () => {
    // Both signals present — captcha wins (we never even tried the auth).
    const html = `<html><body>verify you are human<form id="loginForm"></form></body></html>`;
    const err = detectEbtCaErrors(html);
    expect(err!.code).toBe("captcha");
  });

  it("prioritizes portalDown over sessionExpired", () => {
    // Both present — portal-wide outage takes precedence over per-user state.
    const html = `<html><body>503 Service Unavailable<form id="loginForm"></form></body></html>`;
    const err = detectEbtCaErrors(html);
    expect(err!.code).toBe("portalDown");
  });
});

describe("assertBalancePageMarkers", () => {
  it("returns null when expected balance-page text is present", () => {
    expect(assertBalancePageMarkers(fx("balance-page.html"))).toBeNull();
  });

  it("returns parseError when none of the markers are present", () => {
    const err = assertBalancePageMarkers("<html><body>nothing useful here</body></html>");
    expect(err).not.toBeNull();
    expect(err!.code).toBe("parseError");
  });
});
