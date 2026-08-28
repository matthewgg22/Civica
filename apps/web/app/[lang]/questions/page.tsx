// /es/questions · /vi/questions · /zh/questions — the localized form-question
// pages. Same reasoning as [lang]/screen/ask: a language that only exists as
// React state is a language no crawler ever sees, so each one needs a URL.
//
// This half is the MORE valuable one to localize. The form-question answers are
// fully translated (FORM_QUESTION_I18N), while the ask page's general FAQ is
// deliberately English-only — so a Spanish reader gets more real content here
// than on the page this content came from.
//
// dynamicParams = false, same as the ask route: /foo/questions 404s rather than
// rendering an "unknown language" page.

import type { Metadata } from "next";
import { BackToChat } from "../../../components/BackToChat";
import { notFound } from "next/navigation";
import { isAnswerLang, LANG_TAG, type AnswerLang } from "@civica/demeter-engine/packs";
import { SnapWhyHard, SnapFormQuestions, SnapTimeline, askHref } from "../../../components/SnapOverview";
import { PAGE_COPY } from "../../../lib/i18n/snap-page";
import { DemeterFooter } from "../../../components/DemeterFooter";
import {
  alternateLanguages,
  questionsUrl,
  PREFIXED_LANGS,
} from "../../../lib/i18n/routes";
import { questionsStructuredData } from "../../screen/ask/structured-data";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ lang: string }> {
  return PREFIXED_LANGS.map((lang) => ({ lang }));
}

const META: Record<string, { title: string; description: string }> = {
  es: {
    title: "Qué pregunta realmente una solicitud de SNAP. Cada pregunta y su regla",
    description:
      "Las líneas donde la gente se atasca en una solicitud de SNAP, en lenguaje sencillo: composición del hogar, servicio acelerado, estatus de estudiante, reglas de trabajo ABAWD, preguntas sobre delitos. Cada una con la regulación federal que la decide.",
  },
  vi: {
    title: "Đơn xin SNAP thực sự hỏi điều gì. Từng câu hỏi và điều luật đằng sau",
    description:
      "Những dòng khiến người ta mắc kẹt trên đơn SNAP, giải thích dễ hiểu: thành phần hộ gia đình, xét duyệt khẩn cấp, tình trạng sinh viên, quy định làm việc ABAWD, câu hỏi về tiền án. Mỗi mục kèm quy định liên bang quyết định nó.",
  },
  zh: {
    title: "SNAP 申请表到底在问什么：每一个问题及其依据",
    description:
      "人们在 SNAP 申请表上最容易卡住的那些行，用通俗语言说明：家庭组成、加急办理、学生身份、ABAWD 工作要求、重罪相关问题，每一项都附上决定它的联邦法规。",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const m = META[lang];
  if (!m) return {};
  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: questionsUrl(lang as AnswerLang),
      languages: alternateLanguages(questionsUrl),
    },
    openGraph: {
      title: m.title,
      description: m.description,
      type: "website",
      locale: LANG_TAG[lang as AnswerLang],
    },
  };
}

export default async function LocalizedQuestionsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isAnswerLang(lang) || lang === "en") notFound();
  const l = lang as AnswerLang;
  const c = PAGE_COPY[l];

  return (
    // lang on the content root so a screen reader announces this page in the
    // reader's own language — the root <html> is fixed at "en" (App Router owns
    // the single <html>), and the nearest ancestor lang wins. Matches the
    // pattern already on [lang]/chat and [lang]/screen/ask (launch audit
    // 2026-08-28: those two set it; questions and states did not).
    <main className="dmpage" lang={LANG_TAG[l]}>
      <div className="dmpage__inner">
        {/* INSIDE .dmpage__inner, which carries the width — outside it,
            this sat at the document edge, 130px adrift of the content. */}
        <BackToChat lang={l} />
        <section className="dmo" aria-labelledby="questions-h1">
          <p className="dmo__eyebrow">{c.eyebrow}</p>
          <h1 id="questions-h1" className="dmo__h1">
            {c.faqH2}
          </h1>
          <p className="dmo__lede">{c.questionsIntro}</p>
          <a className="dmo__cta" href={askHref(l)}>
            {c.questionsBack}
          </a>
        </section>

        <SnapTimeline lang={l} />
        <SnapWhyHard lang={l} />
        <SnapFormQuestions lang={l} />
      </div>
      <DemeterFooter lang={l} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: questionsStructuredData(l) }}
      />
    </main>
  );
}
