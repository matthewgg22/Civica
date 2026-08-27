// /states — SNAP, jurisdiction by jurisdiction. Who runs it where you live,
// what it is called there, where you actually apply, and a way to ask about it.
//
// THIS WAS /verify, AND IT WAS A BUILD SHEET. It opened with three paragraphs
// about our own pipeline and a live grounded-rate readout, then rendered 53
// state cards, each carrying a "Verified" badge, a source count, a corrections
// count and a verification date. That is internal provenance wearing a public
// page — and it made the one thing a reader came for, "what happens in MY
// state", the hardest thing to find.
//
// The URL moved with the content: /verify named the old page's subject, and
// kept surprising people who followed a link labelled with their state. The
// old path redirects (next.config.ts) rather than 404ing.

import type { Metadata } from "next";
import { StateDirectoryPage } from "../../components/StateDirectoryPage";
import { PAGE_COPY } from "../../lib/i18n/snap-page";
import { alternateLanguages, statesUrl } from "../../lib/i18n/routes";

const C = PAGE_COPY.en.directory;

export const metadata: Metadata = {
  title: C.metaTitle,
  description: C.metaDescription,
  alternates: {
    canonical: statesUrl("en"),
    languages: alternateLanguages(statesUrl),
  },
  openGraph: {
    title: C.metaTitle,
    description: C.metaDescription,
    type: "website",
    locale: "en",
  },
};

export default function StatesPage() {
  return <StateDirectoryPage lang="en" />;
}
