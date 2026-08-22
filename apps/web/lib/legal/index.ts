// The legal package: three documents, one registry.
//
// Pages import from here, the Markdown generator iterates DOCUMENTS, and the
// claims test asserts invariants across all of them at once — so a fourth
// document added to this array is automatically rendered, exported and checked
// without anyone remembering to wire it up in three places.

export * from "./types";
export { PRIVACY_POLICY } from "./privacy";
export { TERMS_OF_SERVICE } from "./terms";
export { SAFETY_NOTICE } from "./safety";

import { PRIVACY_POLICY } from "./privacy";
import { TERMS_OF_SERVICE } from "./terms";
import { SAFETY_NOTICE } from "./safety";
import type { LegalDocument } from "./types";

export const DOCUMENTS: LegalDocument[] = [
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
  SAFETY_NOTICE,
];

/** Footer/nav labels. Short — these sit in a row with four other links. */
export const DOC_NAV: { slug: LegalDocument["slug"]; label: string }[] = [
  { slug: "privacy", label: "Privacy" },
  { slug: "terms", label: "Terms" },
  { slug: "safety", label: "Safety" },
];
