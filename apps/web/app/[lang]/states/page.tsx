// /es/states · /vi/states · /zh/states — the localized directory.
//
// The page this replaced had NO localized route at all, and the footer linked
// to /es/verify from every Spanish page anyway: a 404, on the one link whose
// label promises a reader their own state. Fixed once by pointing the link at
// the English page; fixed properly here, by building the page.
//
// This is a good page to translate. Almost all of it — 53 agency names, 52
// portal names — is proper nouns that stay as they are, so a Spanish reader
// gets essentially the whole page rather than an English one with a translated
// heading.
//
// dynamicParams = false, same as the other [lang] routes: /foo/states 404s
// rather than rendering an "unknown language" page.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAnswerLang, LANG_TAG, type AnswerLang } from "@civica/demeter-engine/packs";
import { StateDirectoryPage } from "../../../components/StateDirectoryPage";
import { PAGE_COPY } from "../../../lib/i18n/snap-page";
import { alternateLanguages, statesUrl, PREFIXED_LANGS } from "../../../lib/i18n/routes";

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
  const c = PAGE_COPY[lang].directory;
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: {
      canonical: statesUrl(lang),
      languages: alternateLanguages(statesUrl),
    },
    openGraph: {
      title: c.metaTitle,
      description: c.metaDescription,
      type: "website",
      locale: LANG_TAG[lang as AnswerLang],
    },
  };
}

export default async function LocalizedStatesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isAnswerLang(lang) || lang === "en") notFound();
  return <StateDirectoryPage lang={lang} />;
}
