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
import { DemeterChat } from "../../../components/DemeterChat";
import { SnapOrientation, SnapDetail } from "../../../components/SnapOverview";
import { alternateLanguages, askUrl } from "../../../lib/i18n/routes";
import { loadConversation } from "../../../lib/demeter-conversations-server";
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

  // ?c=<id> resumes a saved conversation. Only touched when the param is
  // present, so the ordinary page — the one that has to be fast and indexable —
  // never reads a cookie or the database to render.
  const resumed = c ? await loadConversation(c) : null;

  const initialState =
    state && VERIFIED_STATES.some((s) => s.code === state.toUpperCase())
      ? state.toUpperCase()
      : null;

  return (
    <main className="dmpage">
      <div className="dmpage__inner">
        <SnapOrientation />
        <div className="dmpage__chat">
          <DemeterChat
            states={VERIFIED_STATES}
            // A resumed conversation carries its own scope; ?state= only
            // decides where a NEW conversation starts.
            initialState={resumed ? resumed.state_code : initialState}
            initialQuestion={q ?? null}
            initialMessages={resumed?.messages ?? []}
            savedConversationId={resumed?.id ?? null}
            pendingSave={save === "pending"}
          />
        </div>
        <SnapDetail states={VERIFIED_STATES} />
      </div>
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
