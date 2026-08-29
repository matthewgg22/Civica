// /es/feedback · /vi/feedback · /zh/feedback — the feedback surface in the
// reader's language. Exists so the footer and chat-gear feedback links, which
// prefix by language, reach a page that reads in that language instead of
// dropping the reader onto the English form (launch audit 2026-08-28).
//
// dynamicParams = false, same as the other localized routes: /foo/feedback 404s
// rather than rendering an "unknown language" page.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAnswerLang, type AnswerLang } from "@civica/demeter-engine/packs";
import { FeedbackPageBody } from "../../../components/FeedbackPageBody";
import { FEEDBACK_COPY } from "../../../lib/i18n/feedback-copy";
import { PREFIXED_LANGS } from "../../../lib/i18n/routes";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ lang: string }> {
  return PREFIXED_LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isAnswerLang(lang) || lang === "en") return {};
  const c = FEEDBACK_COPY[lang as AnswerLang];
  // No explicit robots — matches the English /feedback page (default indexable).
  return { title: c.metaTitle, description: c.metaDescription };
}

export default async function LocalizedFeedbackPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isAnswerLang(lang) || lang === "en") notFound();
  return <FeedbackPageBody lang={lang as AnswerLang} />;
}
