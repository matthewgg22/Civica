// /es/screen/ask · /vi/screen/ask · /zh/screen/ask — the localized entry pages.
//
// These exist for discovery, not for the language toggle. The in-page picker
// already switched the whole surface client-side, but that is React state: a
// crawler (and every generative engine) only ever saw the English page, so the
// Spanish, Vietnamese and Chinese content was unreachable to them. A URL per
// language is the only thing that fixes that.
//
// dynamicParams = false + generateStaticParams over the three prefixed
// languages means `/foo/screen/ask` 404s rather than rendering an "unknown
// language" page — the [lang] segment cannot become a catch-all.
//
// English deliberately does NOT live here. It stays at the un-prefixed
// /screen/ask, which is the already-indexed URL.

import type { Metadata } from "next";
import { LanguageLinks } from "../../../../components/LanguageLinks";
import { LandingWelcome } from "../../../../components/LandingWelcome";
import { notFound, redirect } from "next/navigation";
import { VERIFIED_STATES, VERIFIED_STATE_CODES, isAnswerLang, LANG_TAG, type AnswerLang } from "@civica/demeter-engine/packs";
import { geoHint } from "../../../../lib/geo-hint";
import { DemeterFooter } from "../../../../components/DemeterFooter";
import {
  SnapOrientation,
  SnapDetail,
  SnapAskCta,
  SnapFoodNow,
  SnapFears,
} from "../../../../components/SnapOverview";
import { PAGE_COPY } from "../../../../lib/i18n/snap-page";
import { alternateLanguages, askUrl, PREFIXED_LANGS } from "../../../../lib/i18n/routes";
import { publicQuestionCount } from "../../../../lib/live-counts";
import { askStructuredData } from "../../../screen/ask/structured-data";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ lang: string }> {
  return PREFIXED_LANGS.map((lang) => ({ lang }));
}

const META: Record<string, { title: string; description: string }> = {
  es: {
    title: "Demeter AI. Respuestas verificadas sobre SNAP, con la regla incluida",
    description:
      "Pregunta lo que sea sobre SNAP (cupones de alimentos) y recibe una respuesta basada en las reglas reales. La regulación federal más la política estatal verificada, cada afirmación citada, y marcada como segura o no confirmada.",
  },
  vi: {
    title: "Demeter AI. Câu trả lời đã xác minh về SNAP, kèm theo quy định",
    description:
      "Hỏi bất cứ điều gì về SNAP (phiếu thực phẩm) và nhận câu trả lời dựa trên quy định thật. Quy định liên bang cùng chính sách tiểu bang đã được xác minh, mọi khẳng định đều có trích dẫn, và được đánh dấu chắc chắn hay chưa chắc.",
  },
  zh: {
    title: "Demeter AI: 经过核实的 SNAP 答案，并附上依据",
    description:
      "关于 SNAP（食品券）想问什么都可以，得到的答案以真实法规为依据，联邦法规加上经过核实的州级政策，每条结论都有出处，并标注为确定或不确定。",
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
    // Reciprocal across all four languages, plus x-default → English.
    alternates: { canonical: askUrl(lang as AnswerLang), languages: alternateLanguages() },
    openGraph: { title: m.title, description: m.description, type: "website", locale: LANG_TAG[lang as AnswerLang] },
  };
}

export default async function LocalizedAskPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ state?: string; q?: string; c?: string; save?: string }>;
}) {
  const { lang } = await params;
  // dynamicParams=false already restricts this, but a bad value must never
  // reach PAGE_COPY[lang] and render `undefined` at someone.
  if (!isAnswerLang(lang) || lang === "en") notFound();
  const l = lang as AnswerLang;

  const { state, q, c, save } = await searchParams;
  // Same rule as the English page: anything that is already a conversation
  // belongs on the chat route, not the front door. Keeps the reader in their
  // own language across the redirect.
  if (c || q || save) {
    const params = new URLSearchParams();
    if (state) params.set("state", state);
    if (q) params.set("q", q);
    if (c) params.set("c", c);
    if (save) params.set("save", save);
    redirect(`/${l}/chat?${params.toString()}`);
  }
  const initialState =
    state && VERIFIED_STATES.some((s) => s.code === state.toUpperCase())
      ? state.toUpperCase()
      : null;

  // Same dormant-until-true tally and geo-hinted mini chat as the English page.
  const publicCount = await publicQuestionCount();
  const hint = await geoHint(VERIFIED_STATE_CODES);

  return (
    <main className="dmpage" lang={LANG_TAG[l]}>
      {/* Same card, same seen-key, in this reader's language. */}
      <LandingWelcome lang={l} />
      <LanguageLinks lang={l} />
      
      <div className="dmpage__inner">
        <SnapOrientation
          lang={l}
          publicCount={publicCount}
          states={VERIFIED_STATES}
          initialState={initialState ?? hint}
        />
        {/* Composer, picker and suggestions all live on /chat now — same
            as the English page. This one explains and hands over. Ahead of
            the urgent-need aside — same reasoning as the English page. */}
        <SnapAskCta lang={l} state={initialState} />
        <SnapFoodNow lang={l} />
        <SnapDetail states={VERIFIED_STATES} lang={l} />
        <SnapFears lang={l} />
      </div>
      <DemeterFooter lang={l} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: askStructuredData(l, PAGE_COPY[l].h2, META[l]!.description),
        }}
      />
    </main>
  );
}
