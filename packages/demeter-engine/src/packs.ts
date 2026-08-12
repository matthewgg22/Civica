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
import flPack from "./states/fl/pack.json";
import maPack from "./states/ma/pack.json";
import nvPack from "./states/nv/pack.json";
import azPack from "./states/az/pack.json";
import orPack from "./states/or/pack.json";
import wiPack from "./states/wi/pack.json";
import mnPack from "./states/mn/pack.json";
import paPack from "./states/pa/pack.json";
import ohPack from "./states/oh/pack.json";
import ncPack from "./states/nc/pack.json";
import njPack from "./states/nj/pack.json";
import vaPack from "./states/va/pack.json";
import tnPack from "./states/tn/pack.json";
import inPack from "./states/in/pack.json";
import moPack from "./states/mo/pack.json";
import mdPack from "./states/md/pack.json";
import coPack from "./states/co/pack.json";

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
export const VERIFIED_STATES: PackMeta[] = [
  caPack,
  waPack,
  txPack,
  nyPack,
  gaPack,
  miPack,
  ilPack,
  flPack,
  maPack,
  nvPack,
  azPack,
  orPack,
  wiPack,
  mnPack,
  paPack,
  ohPack,
  ncPack,
  njPack,
  vaPack,
  tnPack,
  inPack,
  moPack,
  mdPack,
  coPack,
].map(meta);

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

/** Opens the line of suggested follow-up questions the model appends to an
 *  answer, pipe-separated. Parsed out of the visible text and rendered as
 *  buttons, so the reader never sees the marker.
 *
 *  A distinct glyph rather than a word, for the same reason RECOMPOSE_MARKER is
 *  one: it cannot collide with anything in a SNAP answer or a citation. */
export const FOLLOWUP_MARKER = "⟶";

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

// ═══ NAP JURISDICTIONS ═══════════════════════════════════════════════════════
//
// Three US territories do NOT run SNAP. They run the Nutrition Assistance
// Program, a block grant, and USDA's own wording is unambiguous:
//
//   "IN LIEU OF the Supplemental Nutrition Assistance Program (SNAP), the
//    Nutrition Assistance Program (NAP) block grants provide food assistance to
//    low-income households in the U.S. territories of the Commonwealth of
//    Puerto Rico, American Samoa, and the Commonwealth of the Northern Mariana
//    Islands."
//    — fna.usda.gov/nap/nutrition-assistance-program-block-grants
//
// And, decisively for this product: "the U.S. territories establish eligibility
// and benefit levels for their nutrition assistance programs." Federal SNAP
// rules are not a floor there. They do not apply at all.
//
// WHY THIS EXISTS AS DATA rather than as an unverified-state fallback: for every
// state without a pack, the federal floor is a correct and useful answer. For
// these three it is a confidently WRONG answer about a program that does not
// exist where the reader lives — income limits, deductions, allotments, the
// ABAWD rules, all of it. Silence would be better; a hand-off is better still.
//
// Guam and the US Virgin Islands DO run SNAP, so they are deliberately absent:
// the federal floor is right for them, exactly as it is for an unverified
// state. Adding them here would be inventing a distinction USDA does not make.
export interface NapJurisdiction {
  code: string;
  name: string;
  /** What the territory calls its program. */
  program: string;
  agency: string;
  agencyUrl?: string;
}

export const NAP_JURISDICTIONS: NapJurisdiction[] = [
  {
    code: "PR",
    name: "Puerto Rico",
    program: "Programa de Asistencia Nutricional (PAN / NAP)",
    agency: "Departamento de la Familia — ADSEF",
    agencyUrl: "https://www.adsef.pr.gov/",
  },
  {
    code: "AS",
    name: "American Samoa",
    program: "Nutrition Assistance Program (NAP)",
    agency: "American Samoa Department of Human and Social Services",
  },
  {
    code: "MP",
    name: "Northern Mariana Islands",
    program: "Nutrition Assistance Program (NAP)",
    agency: "CNMI Nutrition Assistance Program",
  },
];

export const NAP_CODES: string[] = NAP_JURISDICTIONS.map((j) => j.code);

/** True when SNAP rules — federal OR state — do not govern this jurisdiction. */
export function isNapJurisdiction(code: string | null | undefined): boolean {
  return !!code && NAP_CODES.includes(code.toUpperCase());
}

export function napJurisdiction(code: string | null | undefined): NapJurisdiction | null {
  if (!code) return null;
  return NAP_JURISDICTIONS.find((j) => j.code === code.toUpperCase()) ?? null;
}
