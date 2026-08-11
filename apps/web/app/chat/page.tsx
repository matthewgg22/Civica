// /chat — the chat as its own surface, full height.
//
// WHY THIS EXISTS. On /screen/ask the chat is a card inside a scrolling
// marketing page, and that is why it does not read as a chatbot: in its empty
// state it shows a brand header, a state picker and three outlined buttons,
// with the composer below the fold. It looks like a form with three links,
// because in that state it is one.
//
// A card inside a document can only look so much like a chat app. This page
// gives it the whole viewport, so the composer is pinned in view, the
// transcript owns the space, and the thing behaves like the product it is.
//
// WHAT THIS IS NOT: a second chat implementation. It mounts the same
// DemeterChat as the landing page. The landing card stays as a compact entry
// point — ask there and you arrive here with the question already in flight —
// so there is one chat, reachable two ways.
//
// No JSON-LD here on purpose. /screen/ask is the canonical indexed surface and
// carries the WebApplication + FAQ markup; this page is the tool, and a second
// page claiming to be the same application would split the signal.

import type { Metadata } from "next";
import { VERIFIED_STATES, VERIFIED_STATE_CODES } from "@civica/demeter-engine/packs";
import { geoHint } from "../../lib/geo-hint";
import { DemeterChat } from "../../components/DemeterChat";
import { DemeterNav } from "../../components/DemeterNav";
import { loadConversation } from "../../lib/demeter-conversations-server";

export const metadata: Metadata = {
  title: "Ask Demeter — SNAP answers with the rule attached",
  description:
    "Ask anything about SNAP and get an answer grounded in the actual rules, every claim cited.",
  // The tool, not the document. Keeping it out of the index means /screen/ask
  // stays the single canonical entry for search, and nobody lands mid-tool
  // without the orientation that explains what this is.
  robots: { index: false, follow: true },
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; q?: string; c?: string; save?: string }>;
}) {
  const { state, q, c, save } = await searchParams;
  const resumed = c ? await loadConversation(c) : null;

  const hint = await geoHint(VERIFIED_STATE_CODES);
  const initialState =
    state && VERIFIED_STATES.some((s) => s.code === state.toUpperCase())
      ? state.toUpperCase()
      : null;

  return (
    <div className="dmchat">
      <DemeterNav active="ask" />
      <main className="dmchat__body">
        <DemeterChat
          states={VERIFIED_STATES}
          initialState={resumed ? resumed.state_code : initialState}
          initialQuestion={q ?? null}
          initialMessages={resumed?.messages ?? []}
          savedConversationId={resumed?.id ?? null}
          pendingSave={save === "pending"}
          geoHint={hint}
        />
      </main>
    </div>
  );
}
