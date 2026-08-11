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
import gaPack from "./states/ga/pack.json";
import miPack from "./states/mi/pack.json";
import ilPack from "./states/il/pack.json";

export interface PackVerification {
  verified_on: string;
  method: string;
  gates: string;
  sources: string[];
}

export interface PackMeta {
  code: string;
  /** What the state calls the program (e.g. "CalFresh", "Basic Food"). */
  program: string;
  agency: string;
  adminModel: "state" | "county";
  portal?: { name: string; url: string } | undefined;
  verified: true;
  /** Public verification trail (rendered on /verify and the guide pages). */
  verification: PackVerification;
}

const meta = (p: {
  code: string;
  program: string;
  agency: string;
  admin_model: string;
  portal?: { name: string; url: string } | undefined;
  verification: PackVerification;
}): PackMeta => ({
  code: p.code,
  program: p.program,
  agency: p.agency,
  adminModel: p.admin_model === "county" ? "county" : "state",
  portal: p.portal,
  verified: true,
  verification: p.verification,
});

/** Every state with an adversarially verified pack, in display order. */
export const VERIFIED_STATES: PackMeta[] = [caPack, waPack, txPack, nyPack, gaPack, miPack, ilPack].map(meta);

export const VERIFIED_STATE_CODES: string[] = VERIFIED_STATES.map((s) => s.code);

export function isVerifiedState(code: string | null | undefined): boolean {
  return !!code && VERIFIED_STATE_CODES.includes(code.toUpperCase());
}

/** The sentinel the streaming protocol emits when an unverified draft is
 *  discarded and recomposed. Chat UIs replace everything before it. Exported
 *  from the CLIENT-SAFE entry on purpose: both chat components need it, and
 *  importing the root barrel would pull the 1MB corpus into the browser
 *  bundle. Previously hardcoded as a literal in two components — if the
 *  engine's marker ever changed, the recompose UX would silently stop working
 *  in both.
 */
export const RECOMPOSE_MARKER = "\n\n⟲ recomposing with verified sources…\n\n";

// Re-exported through the CLIENT-SAFE entry on purpose: the language picker is
// a client component, and importing these from the root barrel would drag the
// 1MB eCFR corpus into the browser bundle. Same reasoning as RECOMPOSE_MARKER
// above. lang.ts itself imports nothing, so this costs the bundle nothing.
export {
  ANSWER_LANGS,
  isAnswerLang,
  LANG_NATIVE_NAME,
  LANG_TAG,
  type AnswerLang,
} from "./lang";
