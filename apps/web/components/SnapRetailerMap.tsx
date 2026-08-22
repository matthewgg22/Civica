// Where the EBT card actually works — a real, zoomable map of SNAP-authorized
// retailers, tied to the ZIP search beside it.
//
// WAS a static SVG choropleth: an illustration of one sentence ("the card
// works essentially everywhere") that could not answer the next question a
// reader actually has, which is "near ME." Replaced on direct feedback after
// looking at the rendered page — see RetailerLiveMap.tsx and
// RetailerSearch.tsx for the two halves of what changed and why.
//
// Server-rendered STILL applies to everything that can be: the heading, the
// count, and the citation below are plain text here, in this file, not inside
// the client boundary — only the interactive map and the search form need
// one. See RetailerMapSearch.tsx for how the split works.

import type { AnswerLang } from "@civica/demeter-engine/packs";
import { PAGE_COPY } from "../lib/i18n/snap-page";
import { RETAILER_TOTAL, RETAILERS_AS_OF } from "../lib/snap-retailers";
import { RetailerMapSearch } from "./RetailerMapSearch";

export function SnapRetailerMap({ lang = "en" }: { lang?: AnswerLang }) {
  const c = PAGE_COPY[lang];
  // Grouped by the page's language, so 252,894 is not read as a decimal by a
  // reader whose locale separates the other way.
  const total = RETAILER_TOTAL.toLocaleString(lang === "zh" ? "zh-CN" : lang);

  return (
    <RetailerMapSearch lang={lang}>
      <h3 className="dmx__h3">{c.retailersH3}</h3>
      <p className="dmx__body">{c.retailersBody.replace("{n}", total)}</p>
      <p className="dmx__note">{c.retailersNote.replace("{date}", RETAILERS_AS_OF)}</p>
    </RetailerMapSearch>
  );
}
