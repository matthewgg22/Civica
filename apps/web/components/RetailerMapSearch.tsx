"use client";

// The bridge between the search box and the live map: one piece of shared
// state (the current result set), because the map and the results list are
// now two views of the same search rather than a static illustration sitting
// next to an unrelated lookup.
//
// `children` is the static heading/body/citation from SnapRetailerMap.tsx — a
// SERVER component. Passing it through as children rather than duplicating it
// here keeps that text server-rendered and crawlable; only the interactive
// pieces (the map, the form, the results) actually need the client boundary.
// The DOM shape this produces is deliberately identical to what was here
// before (.dmret > .dmret__text with the search inside it, plus one element
// in the second grid column) so none of .dmret's existing grid CSS needed to
// change — only what fills the second column did.
//
// THE MAP COLUMN CARRIES TWO THINGS NOW, not one: the map itself, and a small
// "another way to check" panel underneath it, both wrapped in `.dmret__mapcol`
// so they stick together as one unit (see globals.css). On live feedback, a
// long results list left a tall block of plain background sitting under the
// map once it had stuck near the top — the map is a fixed 360px and the list
// beside it routinely isn't. Rather than stretch the map to chase a height
// that changes with every search, that space now holds something genuinely
// useful: a link to USDA's own locator, for a store this search didn't find.

import { useState } from "react";
import type { ReactNode } from "react";
import type { AnswerLang } from "@civica/demeter-engine/packs";
import type { RetailerHit } from "../app/api/snap-retailers/route";
import { PAGE_COPY } from "../lib/i18n/snap-page";
import { RetailerLiveMap } from "./RetailerLiveMap";
import { RetailerSearch } from "./RetailerSearch";

export function RetailerMapSearch({
  lang = "en",
  children,
}: {
  lang?: AnswerLang;
  children: ReactNode;
}) {
  const c = PAGE_COPY[lang];
  const [stores, setStores] = useState<RetailerHit[] | null>(null);
  return (
    <div className="dmret">
      <div className="dmret__text">
        {children}
        <RetailerSearch lang={lang} onResults={setStores} />
      </div>
      <div className="dmret__mapcol">
        <RetailerLiveMap stores={stores} />
        <p className="dmret__more">
          {c.retailMoreLabel}{" "}
          <a
            href="https://www.fns.usda.gov/snap/retailer-locator"
            target="_blank"
            rel="noopener noreferrer"
          >
            {c.retailMoreLink} ↗
          </a>
        </p>
      </div>
    </div>
  );
}
