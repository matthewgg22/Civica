/**
 * Unit tests for the device-flow crypto primitives (issue #317). These are the
 * security foundation — code/token generation, hashing, normalization — so we
 * cover them directly, independent of the routes.
 */

import { describe, it, expect } from "vitest";
import {
  generateDeviceCode,
  generateUserCode,
  generateTokenSecret,
  normalizeUserCode,
  hashUserCode,
  sha256Hex,
} from "./device-token.js";

describe("generateDeviceCode", () => {
  it("produces a high-entropy URL-safe string (>=32 bytes)", () => {
    const code = generateDeviceCode();
    // 32 bytes base64url (no padding) ≈ 43 chars.
    expect(code.length).toBeGreaterThanOrEqual(42);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is unique across many calls (CSPRNG, no collisions)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateDeviceCode());
    expect(set.size).toBe(1000);
  });
});

describe("generateUserCode", () => {
  it("formats XXXX-XXXX over an unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateUserCode();
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      // Ambiguous chars must never appear (0/O/1/I/L excluded by design).
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it("is effectively unique across calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 500; i++) set.add(generateUserCode());
    // Allow a tiny collision margin but expect near-perfect uniqueness.
    expect(set.size).toBeGreaterThan(495);
  });
});

describe("generateTokenSecret", () => {
  it("produces distinct high-entropy secrets", () => {
    const a = generateTokenSecret();
    const b = generateTokenSecret();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(42);
  });
});

describe("normalizeUserCode", () => {
  it("uppercases and strips dashes/whitespace", () => {
    expect(normalizeUserCode("abcd-2345")).toBe("ABCD2345");
    expect(normalizeUserCode("  ABCD 2345 ")).toBe("ABCD2345");
    expect(normalizeUserCode("aBcD-2345")).toBe("ABCD2345");
  });
});

describe("sha256Hex / hashUserCode", () => {
  it("returns a 64-char lowercase hex digest", async () => {
    const h = await sha256Hex("hello");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    // Known SHA-256 of "hello".
    expect(h).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("hashUserCode is normalization-invariant", async () => {
    const a = await hashUserCode("ABCD-2345");
    const b = await hashUserCode("abcd2345");
    const c = await hashUserCode(" abcd 2345 ");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("different inputs hash differently", async () => {
    expect(await sha256Hex("token-a")).not.toBe(await sha256Hex("token-b"));
  });
});
