// The way back to the chatbot.
//
// Every surface that is not the chat carries one of these and no site nav.
// The chat is the product; the state directory, the legal documents, the
// application questions and the feedback form are all places you go FROM it
// and return to. A nav bar offering four destinations on each of them was
// describing a site map nobody needed while they were reading one page.
//
// Also the first focusable element wherever it is used, which is what lets
// those pages go without a skip link: there is nothing above it to skip.

import Link from "next/link";
import type { AnswerLang } from "@civica/demeter-engine/packs";
import { PAGE_COPY } from "../lib/i18n/snap-page";

export function BackToChat({ lang = "en" }: { lang?: AnswerLang }) {
  return (
    <Link className="vback" href={lang === "en" ? "/chat" : `/${lang}/chat`}>
      <span className="vback__arrow" aria-hidden>
        ←
      </span>
      <span className="vback__label">{PAGE_COPY[lang].directory.back}</span>
    </Link>
  );
}
