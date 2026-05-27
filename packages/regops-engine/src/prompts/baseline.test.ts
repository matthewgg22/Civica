// CI gate: every registered prompt's on-disk checksum must equal the
// recorded baseline. A failure here means a template was edited without
// a deliberate version bump or rebaseline — which would silently
// invalidate downstream eval baselines tied to the prior prompt version.
//
// Per docs/regops/runbook.md "Drafter precision regression": this gate
// must not be auto-resolved. Updating baseline.json is a human-in-loop
// decision logged in git history.

import { describe, expect, it } from "vitest";

import { loadPrompt } from "./loader.js";
import { REGISTERED_PROMPTS, baselineKey, getBaselineChecksum } from "./registry.js";

describe("prompt baseline checksum gate", () => {
  it("has at least one registered prompt", () => {
    expect(REGISTERED_PROMPTS.length).toBeGreaterThan(0);
  });

  it.each(REGISTERED_PROMPTS.map((p) => [baselineKey(p.name, p.version), p] as const))(
    "%s: on-disk checksum matches recorded baseline",
    (_key, prompt) => {
      const loaded = loadPrompt(prompt.name, prompt.version);
      const recorded = getBaselineChecksum(prompt.name, prompt.version);
      expect(loaded.checksum).toBe(recorded);
    },
  );

  it("every registered prompt has a baseline entry", () => {
    for (const p of REGISTERED_PROMPTS) {
      expect(() => getBaselineChecksum(p.name, p.version)).not.toThrow();
    }
  });
});
