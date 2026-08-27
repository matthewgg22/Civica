// A PackMeta for tests, built from defaults.
//
// Six test files each hand-wrote this object literal, so adding
// programShort/agencyShort to PackMeta broke all six at once — which is the
// signal that the literal wanted to be a factory. Anything a test does not
// care about comes from here; anything it does care about it passes in.
//
// Not named *.test.ts, so vitest's include glob does not collect it.

import type { PackMeta } from "@civica/demeter-engine/packs";

const VERIFICATION = {
  verified_on: "2026-08-05",
  method: "test fixture",
  gates: "n/a",
  sources: [],
};

/** `program`/`agency` default to the same text as their short forms: a test
 *  that cares about the model-facing/reader-facing split should say so by
 *  passing both, rather than inheriting a difference it did not ask for. */
export function makePack(over: Partial<PackMeta> & { code: string }): PackMeta {
  const program = over.program ?? over.programShort ?? "SNAP";
  const agency = over.agency ?? over.agencyShort ?? `${over.code} Department of Human Services`;
  return {
    program,
    programShort: over.programShort ?? program,
    agency,
    agencyShort: over.agencyShort ?? agency,
    adminModel: "state",
    portal: undefined,
    verified: true,
    verification: VERIFICATION,
    ...over,
  };
}

/** A portal with its display fields filled in, for the same reason. */
export function makePortal(over: { name: string; url: string; short?: string; note?: string }) {
  return { short: over.short ?? over.name, ...over };
}
