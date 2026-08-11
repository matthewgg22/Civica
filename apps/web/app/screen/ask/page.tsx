// /screen/ask — the canonical English entry page, and the page the whole
// product is judged on. Structure:
//
//   orientation  →  chat  →  depth  →  JSON-LD
//
// The orientation bar is ~45 words carrying the page's only <h1>: what Demeter
// is, then what SNAP is, in that order. The chat follows immediately. The depth
// below carries legitimacy and GEO weight. Everything except the chat is
// server-rendered, because content that only exists after hydration is content
// a generative search engine never sees — and being quotable BY those engines
// is an explicit goal here.
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
import { DemeterEntry } from "../../../components/DemeterEntry";
import { T } from "../../../lib/i18n/demeter-chat-copy";
import { SnapOrientation, SnapDetail } from "../../../components/SnapOverview";
import { DemeterFooter } from "../../../components/DemeterFooter";
import { DemeterNav } from "../../../components/DemeterNav";
import { alternateLanguages, askUrl } from "../../../lib/i18n/routes";
import { askStructuredData, EN_TITLE, EN_DESCRIPTION } from "./structured-data";

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

  return (
    <main className="dmpage">
      <DemeterNav />
      <div className="dmpage__inner">
        <SnapOrientation states={VERIFIED_STATES} />
        <div className="dmpage__chat">
          {/* The way IN, not a second chat. See DemeterEntry's header. */}
          <DemeterEntry
            states={VERIFIED_STATES}
            initialState={initialState}
            copy={{
              placeholder: T.en.inputPlaceholder,
              send: T.en.send,
              suggestions: [T.en.empty1, T.en.empty2, T.en.empty3],
              picker: T.en.picker,
              howWeVerify: T.en.howWeVerify,
            }}
          />
        </div>
        <SnapDetail states={VERIFIED_STATES} />
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
