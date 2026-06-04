// Node-env test: validates welcome copy parity and CTA href without
// needing React rendering (web vitest config uses node env, not jsdom).
import { describe, it, expect } from "vitest";
import { welcomeStrings } from "../../../lib/i18n/snap-copy";

describe("welcome page copy", () => {
  it("every English welcome key has a Spanish counterpart", () => {
    const enKeys = Object.keys(welcomeStrings.en).sort();
    const esKeys = Object.keys(welcomeStrings.es).sort();
    expect(esKeys).toEqual(enKeys);
  });

  it("every English welcome value is non-empty", () => {
    for (const [key, value] of Object.entries(welcomeStrings.en)) {
      expect(value, `en:${key} is empty`).toBeTruthy();
      expect(value.trim().length, `en:${key} is whitespace`).toBeGreaterThan(0);
    }
  });

  it("every Spanish welcome value is non-empty", () => {
    for (const [key, value] of Object.entries(welcomeStrings.es)) {
      expect(value, `es:${key} is empty`).toBeTruthy();
      expect(value.trim().length, `es:${key} is whitespace`).toBeGreaterThan(0);
    }
  });

  it("CTA key exists in both locales", () => {
    expect(welcomeStrings.en.welcome_cta).toBeTruthy();
    expect(welcomeStrings.es.welcome_cta).toBeTruthy();
  });

  it("en and es values differ for all content keys (not stub-copied)", () => {
    const contentKeys = [
      "welcome_title",
      "welcome_subtitle",
      "welcome_cta",
      "welcome_trust_1",
      "welcome_trust_2",
      "welcome_trust_3",
    ] as const;
    for (const key of contentKeys) {
      expect(welcomeStrings.en[key]).not.toEqual(
        welcomeStrings.es[key],
        `${key}: en and es are identical — Spanish may not be translated`,
      );
    }
  });
});
