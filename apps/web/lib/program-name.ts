// The pack's `program` field is written for the MODEL, not for a headline.
// Retrieval benefits from "Nutrition Assistance (NA) — Arizona's own
// worker-facing term for SNAP; the public-facing name is still 'SNAP'"; a card
// headline does not. Displaying that field raw put a sentence of corpus
// annotation in 24px serif.
//
// The honest fix would be a separate `program_short` on every pack. This does
// it at the display edge instead, so the corpus the model reads stays exactly
// as verified — and a test pins the output for all 14 states, so a pack that
// breaks the rule fails loudly rather than rendering prose.

/** Longest real alternate name is "PAN / NAP" (9). Shortest annotation is "no
 *  state-specific branding" (26). 20 sits in that gap with room on both sides. */
const ANNOTATION_MIN = 20;

/**
 * The program name as a person should see it, with corpus annotation removed.
 *
 * Two cuts, in order:
 *  1. Everything after an em-dash that is OUTSIDE parentheses. Inside them the
 *     dash is part of the annotation, and cutting there would strand an open
 *     bracket ("SNAP (formerly Food Stamps").
 *  2. A trailing parenthetical whose contents are prose rather than a name.
 *     "(SNAP)", "(NA)", "(FAP)" are part of what the program is called;
 *     "(Wisconsin's name for SNAP)" is a note about it.
 */
export function programDisplayName(program: string): string {
  let out = "";
  let depth = 0;
  for (let i = 0; i < program.length; i++) {
    const ch = program[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    // " — " at depth 0 ends the name.
    if (depth === 0 && ch === "—" && program[i - 1] === " ") break;
    out += ch;
  }
  out = out.trim();

  const paren = out.match(/\s*\(([^()]*)\)$/);
  if (paren && paren[1].length >= ANNOTATION_MIN) {
    out = out.slice(0, paren.index).trim();
  }
  return out;
}

/**
 * The agency as a person should hear it, same rule as the program name: cut
 * at the first em-dash outside parentheses, where the corpus annotation
 * starts ("…(DCYF) — but the Combined Manual itself is still hosted on the
 * LEGACY DHS domain"). A depth-0 dash inside a legitimate division name cuts
 * too — shorter but still accurate beats longer with the annexe attached.
 * No trailing-parenthetical rule here: agency parens are always real
 * acronyms, never prose.
 */
export function agencyDisplayName(agency: string): string {
  let out = "";
  let depth = 0;
  for (let i = 0; i < agency.length; i++) {
    const ch = agency[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && ch === "—" && agency[i - 1] === " ") break;
    out += ch;
  }
  return out.trim();
}
