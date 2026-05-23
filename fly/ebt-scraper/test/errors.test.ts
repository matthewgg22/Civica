import { describe, it, expect } from "vitest";
import { ScrapeErrorException, isScrapeErrorCode, SCRAPE_ERROR_CODES } from "../src/errors.js";

describe("ScrapeErrorException", () => {
  it("preserves code + message + context", () => {
    const e = new ScrapeErrorException("captcha", "Portal challenge", { status: 403 });
    expect(e.code).toBe("captcha");
    expect(e.message).toBe("Portal challenge");
    expect(e.context).toEqual({ status: 403 });
    expect(e).toBeInstanceOf(Error);
  });

  it("omits context from toJSON when undefined", () => {
    const e = new ScrapeErrorException("parseError", "boom");
    expect(e.toJSON()).toEqual({ code: "parseError", message: "boom" });
  });

  it("includes context in toJSON when defined", () => {
    const e = new ScrapeErrorException("portalDown", "x", { retryAfter: 60 });
    expect(e.toJSON()).toEqual({ code: "portalDown", message: "x", context: { retryAfter: 60 } });
  });
});

describe("isScrapeErrorCode", () => {
  it("returns true for known codes", () => {
    for (const code of SCRAPE_ERROR_CODES) {
      expect(isScrapeErrorCode(code)).toBe(true);
    }
  });

  it("returns false for unknown strings + non-strings", () => {
    expect(isScrapeErrorCode("totallyMadeUp")).toBe(false);
    expect(isScrapeErrorCode(42)).toBe(false);
    expect(isScrapeErrorCode(null)).toBe(false);
    expect(isScrapeErrorCode(undefined)).toBe(false);
  });
});

describe("SCRAPE_ERROR_CODES iOS parity contract", () => {
  // This contract is load-bearing per plan §16.2 — when a new variant is added
  // here, the iOS `EBTScrapeError.swift` enum + gateway emitter MUST also
  // gain a case. Update this test along with the others.
  it("matches the documented variant set exactly", () => {
    expect([...SCRAPE_ERROR_CODES].sort()).toEqual(
      [
        "captcha",
        "cardClosed",
        "networkTimeout",
        "parseError",
        "pinLocked",
        "portalDown",
        "sessionExpired",
      ].sort(),
    );
  });
});
