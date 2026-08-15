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

import { useState } from "react";
import type { ReactNode } from "react";
import type { AnswerLang } from "@civica/demeter-engine/packs";
import type { RetailerHit } from "../app/api/snap-retailers/route";
import { RetailerLiveMap } from "./RetailerLiveMap";
import { RetailerSearch } from "./RetailerSearch";

export function RetailerMapSearch({
  lang = "en",
  children,
}: {
  lang?: AnswerLang;
  children: ReactNode;
}) {
  const [stores, setStores] = useState<RetailerHit[] | null>(null);
  return (
    <div className="dmret">
      <div className="dmret__text">
        {children}
        <RetailerSearch lang={lang} onResults={setStores} />
      </div>
      <RetailerLiveMap stores={stores} />
    </div>
  );
}
