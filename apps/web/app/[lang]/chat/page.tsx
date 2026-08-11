// /es/chat · /vi/chat · /zh/chat — the chat, in the reader's language.
//
// Exists so switching language never drops someone back into English mid-
// conversation, and so a resumed thread or a deep link keeps its language
// across the redirect from the localized front door.
//
// Not indexed, same as the English /chat: /screen/ask (and its localized
// siblings) are the canonical entries and carry the markup. This is the tool.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VERIFIED_STATES, VERIFIED_STATE_CODES, isAnswerLang, LANG_TAG, type AnswerLang } from "@civica/demeter-engine/packs";
import { geoHint } from "../../../lib/geo-hint";
import { DemeterChat } from "../../../components/DemeterChat";
import { DemeterNav } from "../../../components/DemeterNav";
import { PREFIXED_LANGS } from "../../../lib/i18n/routes";
import { loadConversation } from "../../../lib/demeter-conversations-server";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ lang: string }> {
  return PREFIXED_LANGS.map((lang) => ({ lang }));
}

const TITLES: Record<string, string> = {
  es: "Pregúntale a Demeter — respuestas sobre SNAP con la regla incluida",
  vi: "Hỏi Demeter — câu trả lời về SNAP kèm theo quy định",
  zh: "询问 Demeter — 附上依据的 SNAP 答案",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return { title: TITLES[lang] ?? "Demeter", robots: { index: false, follow: true } };
}

export default async function LocalizedChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ state?: string; q?: string; c?: string; save?: string }>;
}) {
  const { lang } = await params;
  if (!isAnswerLang(lang) || lang === "en") notFound();
  const l = lang as AnswerLang;

  const { state, q, c, save } = await searchParams;
  const resumed = c ? await loadConversation(c) : null;
  const hint = await geoHint(VERIFIED_STATE_CODES);
  const initialState =
    state && VERIFIED_STATES.some((s) => s.code === state.toUpperCase())
      ? state.toUpperCase()
      : null;

  return (
    <div className="dmchat" lang={LANG_TAG[l]}>
      <DemeterNav lang={l} active="ask" path="/chat" />
      <main className="dmchat__body">
        <DemeterChat
          states={VERIFIED_STATES}
          initialState={resumed ? resumed.state_code : initialState}
          initialQuestion={q ?? null}
          initialLang={l}
          initialMessages={resumed?.messages ?? []}
          savedConversationId={resumed?.id ?? null}
          pendingSave={save === "pending"}
          geoHint={hint}
        />
      </main>
    </div>
  );
}
