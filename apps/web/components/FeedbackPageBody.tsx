// Shared body for the feedback surface, rendered by both /feedback (English)
// and /[lang]/feedback (es/vi/zh) — one implementation, so the two routes
// cannot drift. Mirrors how StateDirectoryPage backs /states and /[lang]/states.

import { BackToChat } from "./BackToChat";
import { DemeterFooter } from "./DemeterFooter";
import { SiteFeedbackForm } from "./SiteFeedbackForm";
import { FEEDBACK_COPY } from "../lib/i18n/feedback-copy";
import { LANG_TAG, type AnswerLang } from "@civica/demeter-engine/packs";

export function FeedbackPageBody({ lang = "en" }: { lang?: AnswerLang }) {
  const c = FEEDBACK_COPY[lang];
  const chatHref = lang === "en" ? "/chat" : `/${lang}/chat`;
  return (
    <>
      {/* lang on the content root so a screen reader announces this page in the
          reader's language — the App Router owns the single <html> (fixed at
          "en") and the nearest ancestor lang wins. Same pattern as the other
          localized surfaces. */}
      <main className="vpage fbpage" lang={LANG_TAG[lang]}>
        <header className="vpage__head">
          {/* INSIDE the container, not before it — outside, it rendered at the
              document edge, adrift of the title it belongs to. */}
          <BackToChat lang={lang} />
          <h1 className="vpage__title">{c.title}</h1>
          <p className="vpage__lede vpage__lede--lead">{c.lede}</p>
        </header>
        {/* ABOVE the form: someone reporting a specific wrong answer is on the
            wrong page, and that is useless underneath a form they already
            filled in. */}
        <p className="fbpage__reroute">
          {c.rerouteLead}
          <a href={chatHref}>{c.rerouteLink}</a>
          {c.rerouteTail}
        </p>
        <SiteFeedbackForm lang={lang} />
      </main>
      <DemeterFooter lang={lang} />
    </>
  );
}
