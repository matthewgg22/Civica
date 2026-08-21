// Shielding citations from machine translation (Vercel-guidelines finding 1).
//
// Chrome's auto-translate on the localized pages is free to rewrite anything
// it can read — including "7 CFR 273.9(d)(2)", which stops being a citation
// the moment a translator touches it. On the product whose whole promise is
// the rule attached verbatim, citation tokens are not text; they are
// identifiers. `translate="no"` is the HTML contract for exactly this.
//
// Pure and server-safe: used by the client answer renderer AND the
// server-rendered marketing sections.

import type { ReactNode } from "react";

/** The citation families the verifier itself recognizes, in display form.
 *  Deliberately narrower than the verifier's extractor: this only needs to
 *  catch tokens as they APPEAR in rendered copy. */
export const CITATION_TOKEN_RE =
  /((?:7|8|45)\s?CFR\s?[\d.]+(?:\([a-z0-9]+\))*|Pub\.\s?L\.(?:\s?No\.)?\s?[\d–-]+|ACL\s?[\d-]+|ACIN\s?[\dI-]+|MPP\s?[\d.-]+|FNS\s?Handbook\s?\d+)/g;

/** Split a plain string into text and shielded citation spans. */
export function shieldCitations(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(CITATION_TOKEN_RE);
  if (parts.length === 1) return [text];
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <span key={`${keyBase}nt${i}`} translate="no">
        {p}
      </span>
    ) : (
      p
    ),
  );
}
