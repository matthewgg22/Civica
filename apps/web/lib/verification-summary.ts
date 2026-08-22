// What /verify may say about a pack, as opposed to what the pack records.
//
// The verification block is INTERNAL provenance. It names every primary source
// per state, the pipeline that built the pack, and the specific corrections the
// refute gate caught. Rendered in full, fourteen times, that page stopped being
// evidence of care and became a build sheet: the exact sources to pull, in the
// exact order, with the known failure modes annotated.
//
// The claim /verify needs to support is "this was checked, hard, against
// primary sources, and here is when". A count carries that. An enumeration
// hands over the work.
//
// The sources themselves are not secret and are not being hidden: every answer
// still cites the specific rule it used, to the person who asked, for the
// question they asked. That is the piecemeal path — in context, on demand,
// where a citation is something you can check rather than something you can
// harvest.

import type { PackMeta } from "@civica/demeter-engine/packs";

export interface PublicVerification {
  /** How many primary sources the pack was built from — not which. */
  sourceCount: number;
  /** Corrections the refute gate forced before publication, when the pack
   *  records a countable number. Null when it does not — never guessed. */
  corrections: number | null;
  verifiedOn: string;
}

/** "7 must-fix corrections found and applied before publication (…)" → 7.
 *  A number is credibility; the list beside it is a map of where to look. */
const CORRECTIONS = /(\d+)\s+must-fix/i;

export function publicVerification(pack: PackMeta): PublicVerification {
  const v = pack.verification;
  const m = CORRECTIONS.exec(v.gates ?? "");
  return {
    sourceCount: v.sources?.length ?? 0,
    corrections: m ? Number(m[1]) : null,
    verifiedOn: v.verified_on,
  };
}
