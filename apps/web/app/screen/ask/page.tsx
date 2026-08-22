// /screen/ask — the canonical English entry page, and the page the whole
// product is judged on. Structure:
//
//   orientation  →  hand-off  →  depth  →  JSON-LD
//
// The orientation bar is ~45 words carrying the page's only <h1>: what Demeter
// is, then what SNAP is, in that order. The depth below carries legitimacy and
// GEO weight. The whole page is server-rendered, because content that only
// exists after hydration is content a generative search engine never sees —
// and being quotable BY those engines is an explicit goal here.
//
// THE CHAT IS NOT HERE. It lives entirely on /chat, reached from the nav tab
// and from the hand-off card. This page used to carry a working state picker
// and composer, which meant two places to begin the same conversation, a
// picker whose choice this page then had to forward, and a first-time visitor
// meeting half a chat on a page that is not the chat. Now the page explains and
// hands over — and it no longer ships a client-side picker to do it.
//
// WAS: lede → chat → depth, where the lede was an <h2> about SNAP plus four
// trust rows, and the product went unnamed until the chat card's own <h1> at
// ~15% page depth. An <h2> preceding the <h1> is an inverted heading hierarchy;
// it also meant a first-time visitor read 120 words before learning what this
// is. ~1,300 words of static copy wrapped one chat box.
//
// NOW: ~600 words here. Nothing was deleted — the 17 form-question cards and
// the "why this is hard" section moved to /questions, which is a page about
// them rather than a wall beneath a chat box, and is linked from the depth.
//
// English stays UN-PREFIXED. The localized pages live at /es|/vi|/zh/screen/ask
// (app/[lang]/screen/ask), and every page in the set carries the reciprocal
// hreflang annotations — a one-directional hreflang set is silently ignored.

import type { Metadata } from "next";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import { redirect } from "next/navigation";
import {
  SnapOrientation,
  SnapDetail,
  SnapAskCta,
  SnapFoodNow,
  SnapFears,
} from "../../../components/SnapOverview";
import { DemeterFooter } from "../../../components/DemeterFooter";
import { DemeterNav } from "../../../components/DemeterNav";
import { alternateLanguages, askUrl } from "../../../lib/i18n/routes";
import { publicQuestionCount } from "../../../lib/live-counts";
import { askStructuredData, EN_TITLE, EN_DESCRIPTION } from "./structured-data";

/** The browser frame matches the paper (vercel-guidelines finding 4). */
export const viewport = { themeColor: "#FFFFFF" };

export const metadata: Metadata = {
  title: EN_TITLE,
  description: EN_DESCRIPTION,
  alternates: { canonical: askUrl("en"), languages: alternateLanguages() },
  openGraph: { title: EN_TITLE, description: EN_DESCRIPTION, type: "website", locale: "en" },
};

export default async function ScreenAskPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; q?: string; c?: string; save?: string }>;
}) {
  const { state, q, c, save } = await searchParams;

  // ANYTHING THAT IS ALREADY A CONVERSATION BELONGS ON /chat. Resuming a saved
  // thread (?c=), arriving with a question (?q=), or coming back from sign-in
  // mid-save (?save=pending) are all "the chat is already happening" — this
  // page is the front door, not the room. Redirecting rather than rendering a
  // second chat here is what keeps there being exactly one chat.
  //
  // Old links keep working: /guides/[state] and /verify deep-link with ?state=
  // and ?q=, and they land in the right place.
  if (c || q || save) {
    const params = new URLSearchParams();
    if (state) params.set("state", state);
    if (q) params.set("q", q);
    if (c) params.set("c", c);
    if (save) params.set("save", save);
    redirect(`/chat?${params.toString()}`);
  }

  const initialState =
    state && VERIFIED_STATES.some((s) => s.code === state.toUpperCase())
      ? state.toUpperCase()
      : null;

  // Dormant-until-true: null (unavailable or below floor logic in the
  // component) renders nothing. See lib/live-counts.ts for the history.
  const publicCount = await publicQuestionCount();

  return (
    <main className="dmpage" id="main-content">
      <DemeterNav />
      <div className="dmpage__inner">
        <SnapOrientation publicCount={publicCount} />
        {/* The composer, the state picker and the suggested questions all live
            on /chat now. This page explains and hands over; it does not start
            the conversation and then forward it. First action before the
            urgent-need aside, on direct feedback — most readers are not in a
            food emergency, and the tool this whole page leads to should not
            follow a callout aimed at the ones who are. */}
        <SnapAskCta state={initialState} />
        {/* Still high, and not behind a click: SNAP takes at least seven days
            even when it is urgent. */}
        <SnapFoodNow />
        <SnapDetail states={VERIFIED_STATES} />
        {/* Last: the fears are the final thing between reading and acting. */}
        <SnapFears />
      </div>
      <DemeterFooter />
      <script
        type="application/ld+json"
        // Built from server-side literals — no user input reaches this, so
        // there is no injection surface.
        dangerouslySetInnerHTML={{
          __html: askStructuredData("en", "Demeter AI", EN_DESCRIPTION),
        }}
      />
    </main>
  );
}
