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

/**
 * True when the state actually calls SNAP something else.
 *
 * 44 of 53 packs record the program as "SNAP" or "Supplemental Nutrition
 * Assistance Program (SNAP)". Printing that on every row put the same word 44
 * times down a page whose whole job is to show what differs by state — and it
 * buried the nine that DO have a local name (CalFresh, Basic Food, FoodShare,
 * 3SquaresVT…) in a column of identical text. A field is not worth a line just
 * because the data has one.
 *
 * "SNAP Food Benefits" (TX) and "NJ SNAP" are local branding and count as
 * local: the state chose those words.
 */
export function hasLocalProgramName(program: string): boolean {
  const bare = programDisplayName(program)
    .replace(/\s*\(SNAP\)\s*$/i, "")
    .trim()
    .toLowerCase();
  return bare !== "snap" && bare !== "supplemental nutrition assistance program";
}

/**
 * The department a reader needs, without the org chart under it.
 *
 * Agency strings run to 211 characters — North Carolina's names a department,
 * two divisions, and "administered locally by the 100 County Departments of
 * Social Services (DSS)". Median is 77. That is provenance-grade precision in
 * a field somebody scans to answer "who runs this where I live", and it made
 * every row three lines tall.
 *
 * Cut after the first acronym parenthetical that is followed by a comma or a
 * slash: what precedes it is the department, what follows is its internal
 * structure. Verified against all 53 packs — max length drops to 67 and every
 * result is a name the agency itself uses. An agency with no acronym is left
 * alone; none of those is long.
 *
 * The county-administration detail this drops is not lost: adminModel carries
 * it as data, and the page prints it as a tag.
 *
 * Runs agencyDisplayName FIRST rather than expecting callers to compose the
 * two. Minnesota's annexe ("…(DCYF) — but the Combined Manual is still hosted
 * on the LEGACY DHS domain") is not followed by a comma or a slash, so the cut
 * below does not touch it; a caller who reached for this helper alone would
 * have published the annexe. Composing is idempotent, so
 * primaryAgency(agencyDisplayName(x)) is still correct.
 */
export function primaryAgency(agency: string): string {
  const clean = agencyDisplayName(agency);
  const m = /^(.*?\([A-Za-z0-9./ ]{2,10}\))\s*[,/]/.exec(clean);
  return (m ? m[1] : clean).trim();
}

/**
 * A portal's name split from the note attached to it.
 *
 * Same problem as the program field, in the link labels: "PAIS (Hawaii DHS
 * SNAP/TANF Application Portal)", "ABE (Application for Benefits
 * Eligibility)", "Wyoming DFS SNAP (paper application only — no online portal
 * found)". Some of those parentheticals are the expansion of an acronym and
 * some carry real information, so the note is KEPT and shown rather than
 * dropped — New York's "statewide EXCEPT NYC" and Wyoming's "paper
 * application only" are exactly the things a reader must not miss.
 *
 * Same ANNOTATION_MIN threshold as programDisplayName: short parentheticals
 * ("(HEAplus)", "(benefind.ky.gov)") are part of the name and stay in it.
 * Only a trailing parenthetical qualifies — "ConneCT (connect.ct.gov) / MyDSS"
 * is one name and is left whole.
 */
export function splitPortalName(name: string): { label: string; note: string | null } {
  const m = /^(.*?)\s*\(([^()]*)\)$/.exec(name);
  if (m && m[2].length >= ANNOTATION_MIN) {
    return { label: m[1].trim(), note: m[2].trim() };
  }
  return { label: name, note: null };
}
