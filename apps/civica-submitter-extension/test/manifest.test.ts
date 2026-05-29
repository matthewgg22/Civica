/**
 * Manifest scoping guardrail (V1-6, #315).
 *
 * The content script runs inside the assister's *authenticated* BenefitsCal
 * session and can read the DOM (PII) of any page it's injected into. An overly
 * broad host_permissions / content_scripts.matches (an all-URLs or all-hosts
 * wildcard) would let the extension see arbitrary sites — a PII-exfil vector.
 * These tests lock the manifest to the BenefitsCal CBO origin ONLY, so a future
 * edit that widens the scope fails CI.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(here, "..", "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  manifest_version: number;
  permissions: string[];
  host_permissions: string[];
  content_scripts: Array<{ matches: string[]; js: string[]; run_at?: string }>;
};

/** Any match pattern broad enough to hit non-BenefitsCal pages. */
const BROAD_PATTERNS = [
  "<all_urls>",
  "*://*/*",
  "https://*/*",
  "http://*/*",
  "*://*",
];

function isBenefitscalScoped(pattern: string): boolean {
  // Accept only https BenefitsCal hosts (apex or subdomain). The path may be
  // narrower but must NOT be a bare host wildcard onto the world.
  return /^https:\/\/(\*\.)?benefitscal\.com\//.test(pattern);
}

/** Minimal Chrome match-pattern → does it match this concrete URL? */
function patternMatches(pattern: string, url: string): boolean {
  const rx = new RegExp(
    "^" +
      pattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // escape regex specials
        .replace(/\*/g, ".*") + // match-pattern wildcard
      "$",
  );
  return rx.test(url);
}

// The pages the content script actually fills (live portal walk, SELECTORS.md):
// application form pages live under /ApplyForBenefits/, the dashboard under /CBO/.
// If the manifest doesn't match these, the extension is inert in production —
// which is the exact bug this assertion guards against.
const FILL_URLS = [
  "https://benefitscal.com/ApplyForBenefits/ABNMI",
  "https://benefitscal.com/ApplyForBenefits/begin/ABOVR",
  "https://benefitscal.com/CBO/CBDAS",
];

describe("manifest — BenefitsCal-only scoping", () => {
  it("is MV3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it("host_permissions are BenefitsCal-only (no broad wildcards)", () => {
    expect(manifest.host_permissions.length).toBeGreaterThan(0);
    for (const pattern of manifest.host_permissions) {
      expect(BROAD_PATTERNS).not.toContain(pattern);
      expect(isBenefitscalScoped(pattern), `over-broad host_permission: ${pattern}`).toBe(true);
    }
  });

  it("content_scripts are BenefitsCal-only (no broad wildcards)", () => {
    expect(manifest.content_scripts.length).toBeGreaterThan(0);
    for (const cs of manifest.content_scripts) {
      for (const pattern of cs.matches) {
        expect(BROAD_PATTERNS).not.toContain(pattern);
        expect(isBenefitscalScoped(pattern), `over-broad content_script match: ${pattern}`).toBe(true);
      }
    }
  });

  it("content_scripts actually match the pages the extension fills", () => {
    // Regression guard (#315 follow-up): the original manifest matched only
    // /cbo/*, so the content script never ran on /ApplyForBenefits/ (where it
    // fills) — the extension was inert. Every real fill URL must match at least
    // one content_scripts pattern.
    const allMatches = manifest.content_scripts.flatMap((cs) => cs.matches);
    for (const url of FILL_URLS) {
      const matched = allMatches.some((p) => patternMatches(p, url));
      expect(matched, `no content_script pattern matches fill URL: ${url}`).toBe(true);
    }
  });

  it("requests no host-spanning permissions beyond storage/activeTab", () => {
    // `tabs`, `<all_urls>`-style host perms, `webRequest`, etc. would broaden
    // reach; the extension only needs storage + activeTab.
    expect(new Set(manifest.permissions)).toEqual(new Set(["storage", "activeTab"]));
  });
});
