// Registered prompt catalog.
//
// Every prompt the drafter is allowed to use must appear here. The
// baseline test iterates this registry, loads each entry from disk, and
// asserts the computed checksum equals the value recorded in
// baseline.json. Adding a new prompt = add it here + add its checksum to
// baseline.json (no separate test wiring needed).

import baselineJson from "./baseline.json" with { type: "json" };

export interface RegisteredPrompt {
  readonly name: string;
  readonly version: number;
  /** Short human-readable purpose; surfaces in eval reports. */
  readonly description: string;
}

export const REGISTERED_PROMPTS: readonly RegisteredPrompt[] = [
  {
    name: "extract-eligibility-change",
    version: 1,
    description:
      "Structured-extraction prompt for federal/state SNAP eligibility changes (E1 drafter input).",
  },
  {
    name: "summarize-war-room-event",
    version: 1,
    description:
      "Summarizer for OBBBA-class regulatory events. Output drives war-room counsel fan-out + corpus-revalidation scope, NOT individual rule drafting (see docs/regops/war-room-playbook.md).",
  },
];

export function baselineKey(name: string, version: number): string {
  return `${name}@v${version}`;
}

/**
 * Look up the recorded SHA-256 baseline for a (name, version). Throws if
 * not present — every REGISTERED_PROMPTS entry MUST have a matching
 * baseline.json row.
 */
export function getBaselineChecksum(name: string, version: number): string {
  const key = baselineKey(name, version);
  const baselines = (baselineJson as { prompts: Record<string, string> }).prompts;
  const recorded = baselines[key];
  if (!recorded) {
    throw new Error(
      `No baseline checksum recorded for prompt '${key}'. ` +
        `Add an entry to packages/regops-engine/src/prompts/baseline.json.`,
    );
  }
  return recorded;
}
