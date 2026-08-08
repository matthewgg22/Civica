// CLIENT-SAFE pack metadata — the `@civica/demeter-engine/packs` entry point.
//
// The root barrel drags in retrieval.ts and its 1MB vendored eCFR corpus; a
// client component importing registeredStates() through it would ship that
// corpus to every phone. This module imports ONLY the small pack.json files
// (program identity, ~1-2KB each) — safe for state selectors, badges, and the
// SSG guide pages. (The benefitscal-cbo subpath-layering lesson, applied.)

import caPack from "./states/ca/pack.json";
import waPack from "./states/wa/pack.json";
import txPack from "./states/tx/pack.json";
import nyPack from "./states/ny/pack.json";

export interface PackMeta {
  code: string;
  /** What the state calls the program (e.g. "CalFresh", "Basic Food"). */
  program: string;
  agency: string;
  adminModel: "state" | "county";
  portal?: { name: string; url: string } | undefined;
  verified: true;
}

const meta = (p: {
  code: string;
  program: string;
  agency: string;
  admin_model: string;
  portal?: { name: string; url: string } | undefined;
}): PackMeta => ({
  code: p.code,
  program: p.program,
  agency: p.agency,
  adminModel: p.admin_model === "county" ? "county" : "state",
  portal: p.portal,
  verified: true,
});

/** Every state with an adversarially verified pack, in display order. */
export const VERIFIED_STATES: PackMeta[] = [caPack, waPack, txPack, nyPack].map(meta);

export const VERIFIED_STATE_CODES: string[] = VERIFIED_STATES.map((s) => s.code);

export function isVerifiedState(code: string | null | undefined): boolean {
  return !!code && VERIFIED_STATE_CODES.includes(code.toUpperCase());
}
