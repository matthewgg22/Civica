// /questions — what the SNAP application is actually asking, line by line.
//
// This content used to be the bottom two-thirds of /screen/ask: the 17
// form-question cards (~635 words, the single largest block on that page) plus
// "why a straight answer is hard to find", which is their natural introduction
// and used to sit three sections away from them.
//
// MOVED, NOT CUT. Every word is still server-rendered and indexable; it now
// lives on a page that is ABOUT it. That is better for search, not worse: 17
// cards buried under a chat box compete with each other for one URL, while a
// focused page can rank for the literal thing people type ("what does purchase
// and prepare separately mean on a SNAP application"). The FAQPage JSON-LD
// moved with them, because structured data has to describe the page it is on.
//
// Deliberately ONE page rather than 17. Each card is a heading plus ~40 words;
// seventeen pages of 40 words each is thin content, which search engines
// penalize rather than reward.
//
// English stays un-prefixed, same rule as /screen/ask; /es|/vi|/zh/questions
// carry the reciprocal hreflang set.

import type { Metadata } from "next";
import {
  SnapWhyHard,
  SnapTimeline,
  SnapFormQuestions,
  askHref,
} from "../../components/SnapOverview";
import { PAGE_COPY } from "../../lib/i18n/snap-page";
import { DemeterNav } from "../../components/DemeterNav";
import { DemeterFooter } from "../../components/DemeterFooter";
import { alternateLanguages, questionsUrl } from "../../lib/i18n/routes";
import { questionsStructuredData } from "../screen/ask/structured-data";

const TITLE = "What a SNAP application is actually asking. Every question, and the rule behind it";
const DESCRIPTION =
  "The lines people get stuck on in a SNAP application, in plain language: household composition, expedited service, student status, ABAWD work rules, felony questions, and more. Each with the federal regulation that decides it.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: questionsUrl("en"),
    languages: alternateLanguages(questionsUrl),
  },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "en" },
};

export default function QuestionsPage() {
  const c = PAGE_COPY.en;
  return (
    <main className="dmpage">
      <DemeterNav active="questions" path="/questions" />
      <div className="dmpage__inner">
        <section className="dmo" aria-labelledby="questions-h1">
          <p className="dmo__eyebrow">{c.eyebrow}</p>
          <h1 id="questions-h1" className="dmo__h1">
            {c.faqH2}
          </h1>
          <p className="dmo__lede">{c.questionsIntro}</p>
          <a className="dmo__cta" href={askHref("en")}>
            {c.questionsBack}
          </a>
        </section>

        <SnapTimeline />
        <SnapWhyHard />
        <SnapFormQuestions />
      </div>
      <DemeterFooter />
      <script
        type="application/ld+json"
        // Built from server-side literals — no user input reaches this, so
        // there is no injection surface.
        dangerouslySetInnerHTML={{ __html: questionsStructuredData("en") }}
      />
    </main>
  );
}
