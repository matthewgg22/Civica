// Where a citation can actually be read.
//
// THE COMPLAINT THIS EXISTS FOR (owner, 2026-08-26): the certainty banner
// promises "check it yourself below", and what followed was the string
// "7 CFR 273.5" — no link, nothing to click. A product whose entire claim is
// "every answer quotes the rule it came from, so you can check it" was asking
// the reader to go find the rule themselves.
//
// eCFR's short section form redirects to the full subtitle/chapter path, so we
// do not have to model the CFR's hierarchy to build a working URL. Verified
// 2026-08-26 against 7 CFR 271.2, 273.5, 273.9, 273.10 and 273.24 — all 200.
//
// RETURNS NULL RATHER THAN GUESSING. State policy instruments (CA's ACL/ACIN,
// MPP), U.S.C. statutes and anything else this does not recognize get no link
// at all. A citation rendered as plain text is a small loss; a citation
// rendered as a link to the wrong rule is the failure mode this whole
// verifier exists to prevent.

/** "7 CFR 273.9(d)(2)" -> the eCFR page for § 273.9. Subsection suffixes are
 *  dropped: eCFR anchors sections, not paragraphs, and a URL carrying
 *  "(d)(2)" resolves to nothing. */
export function citationUrl(citation: string): string | null {
  const m = /^(\d+)\s*CFR\s*(\d+)\.(\d+)/i.exec(citation.trim());
  if (!m) return null;
  const [, title, part, section] = m;
  return `https://www.ecfr.gov/current/title-${title}/part-${part}/section-${part}.${section}`;
}

/** The citation as markdown: a link where we have one, the bare text where we
 *  do not. Kept separate from citationUrl so the trailer can stay a string
 *  formatter and the URL rule has one home. */
export function citationMarkdown(citation: string): string {
  const url = citationUrl(citation);
  return url ? `[${citation}](${url})` : citation;
}
