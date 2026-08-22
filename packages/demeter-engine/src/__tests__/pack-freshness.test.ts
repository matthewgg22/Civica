import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Coverage decays. Every state pack pins dollar figures and policy windows that
// expire — the October COLA resets allotments/SUAs, ABAWD waivers lapse on
// fixed dates, and temporary rules sunset. Each pack already records these as
// machine-readable freshness entries; nothing was reading them.
//
// This is the reader. It fails the build when a pack's own expiry has passed,
// so a state cannot silently go stale while /verify still shows it as
// "Verified from primary sources". See
// docs/plans/state-coverage-framework-2026-08.md §7.
//
// A failure here is NOT a code bug — it means a human must re-verify that
// state's figures against the published source and move the date forward.

const STATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "states");

interface FreshnessEntry {
  key: string;
  kind: string;
  date?: string;
  warning?: string;
}

const packs = readdirSync(STATES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

function entries(code: string): FreshnessEntry[] {
  const raw = readFileSync(join(STATES_DIR, code, "freshness.json"), "utf8");
  return (JSON.parse(raw) as { entries: FreshnessEntry[] }).entries;
}

describe("state pack freshness", () => {
  it("discovers every shipped pack", () => {
    expect(packs.length).toBeGreaterThanOrEqual(5);
  });

  it.each(packs)("%s: no freshness entry has expired", (code) => {
    const today = new Date().toISOString().slice(0, 10);
    const expired = entries(code).filter(
      (e) => e.kind === "expires" && e.date && e.date < today,
    );
    expect(
      expired,
      expired.length
        ? `\n${code.toUpperCase()} has EXPIRED source dates — re-verify against the published ` +
          `source, update the pack, then move the date forward:\n` +
          expired.map((e) => `  • ${e.key} (expired ${e.date})\n    ${e.warning ?? ""}`).join("\n")
        : "",
    ).toEqual([]);
  });

  it.each(packs)("%s: every entry is dated and carries a warning a human can act on", (code) => {
    for (const e of entries(code)) {
      expect(e.date, `${code}/${e.key} needs a date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect((e.warning ?? "").length, `${code}/${e.key} needs a warning`).toBeGreaterThan(20);
    }
  });

  it.each(packs)("%s: a pack that QUOTES dollar figures pins an expiry for them", (code) => {
    // Not every pack quotes money — CA's figures come from the live engine via
    // getEngineParams, so its only expiry is an ABAWD waiver window. But a pack
    // whose supplement text hands a user a dollar amount owns that number, and
    // must carry a date on which someone re-checks it.
    const supplements = readFileSync(join(STATES_DIR, code, "supplements.json"), "utf8");
    const quotesMoney = /\$\d/.test(supplements);
    if (!quotesMoney) return;
    const expiries = entries(code).filter((e) => e.kind === "expires" && e.date);
    expect(
      expiries.length,
      `${code} quotes dollar figures to users but pins no expiry — those numbers ` +
        `can outlive the fiscal year with nothing to catch them`,
    ).toBeGreaterThan(0);
  });
});
