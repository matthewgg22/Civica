// /screen/saved — the conversations you kept.
//
// The one signed-in page on an otherwise anonymous surface, and the reason an
// account exists at all. Gated in middleware.ts by exact path so that /screen
// and /screen/ask — the free chat — stay public; a prefix match on /screen
// would put a login in front of the product.
//
// noindex: it is per-user and behind a session. Crawling it would only ever
// reach the sign-in redirect.
//
// ?lang= carries the language over from the chat, because someone who saved a
// conversation from /vi/screen/ask should not be handed an English list as the
// reward for making an account.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAnswerLang, LANG_TAG, type AnswerLang } from "@civica/demeter-engine/packs";
import { SavedConversations } from "../../../components/SavedConversations";
import { listConversations } from "../../../lib/demeter-conversations-server";
import { askPath } from "../../../lib/i18n/routes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your saved conversations — Demeter AI",
  robots: { index: false, follow: false },
};

const T = {
  en: {
    heading: "Your conversations",
    intro: "Saved from your chats with Demeter. Only you can see these, and you can delete any of them.",
    empty: "Nothing saved yet.",
    emptyBody: "When you are in a conversation you want to come back to, choose “Save this conversation” above the chat.",
    emptyCta: "Ask a question",
    open: "Open",
    remove: "Delete",
    removing: "Deleting…",
    confirm: "Delete this conversation? This cannot be undone.",
    removeError: "Couldn't delete that. Please try again.",
    federal: "All states",
    updated: (when: string) => `Updated ${when}`,
  },
  es: {
    heading: "Tus conversaciones",
    intro: "Guardadas de tus chats con Demeter. Solo tú puedes verlas, y puedes borrar cualquiera.",
    empty: "Aún no has guardado nada.",
    emptyBody: "Cuando estés en una conversación a la que quieras volver, elige “Guardar esta conversación” arriba del chat.",
    emptyCta: "Haz una pregunta",
    open: "Abrir",
    remove: "Borrar",
    removing: "Borrando…",
    confirm: "¿Borrar esta conversación? No se puede deshacer.",
    removeError: "No se pudo borrar. Intenta de nuevo.",
    federal: "Todos los estados",
    updated: (when: string) => `Actualizada el ${when}`,
  },
  vi: {
    heading: "Cuộc trò chuyện của bạn",
    intro: "Được lưu từ các cuộc trò chuyện với Demeter. Chỉ mình bạn xem được, và bạn có thể xóa bất kỳ cuộc nào.",
    empty: "Chưa lưu gì cả.",
    emptyBody: "Khi đang trong một cuộc trò chuyện mà bạn muốn quay lại, hãy chọn “Lưu cuộc trò chuyện này” ở phía trên khung chat.",
    emptyCta: "Đặt một câu hỏi",
    open: "Mở",
    remove: "Xóa",
    removing: "Đang xóa…",
    confirm: "Xóa cuộc trò chuyện này? Không thể hoàn tác.",
    removeError: "Không xóa được. Vui lòng thử lại.",
    federal: "Tất cả tiểu bang",
    updated: (when: string) => `Cập nhật ${when}`,
  },
  zh: {
    heading: "你的对话",
    intro: "从你与 Demeter 的对话中保存。只有你能看到，也可以随时删除任意一条。",
    empty: "还没有保存任何对话。",
    emptyBody: "当你想以后再回来看某次对话时，请在聊天上方选择“保存这次对话”。",
    emptyCta: "提一个问题",
    open: "打开",
    remove: "删除",
    removing: "正在删除…",
    confirm: "删除这次对话？此操作无法撤销。",
    removeError: "删除失败，请再试一次。",
    federal: "所有州",
    updated: (when: string) => `更新于 ${when}`,
  },
} as const;

export default async function SavedConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang: rawLang } = await searchParams;
  const lang: AnswerLang = rawLang && isAnswerLang(rawLang) ? rawLang : "en";
  const t = T[lang];

  const rows = await listConversations();
  // Middleware already redirects an unauthenticated visitor here, so this is
  // the belt to its braces — and it is the branch that runs if the middleware
  // matcher is ever narrowed and this page stops being covered.
  if (rows === null) redirect(`/sign-in?next=${encodeURIComponent("/screen/saved")}`);

  return (
    <main className="saved" lang={LANG_TAG[lang]}>
      <div className="saved__inner">
        <h1 className="saved__heading">{t.heading}</h1>
        <p className="saved__intro">{t.intro}</p>

        {rows.length === 0 ? (
          <div className="saved__empty">
            <p className="saved__empty-title">{t.empty}</p>
            <p className="saved__empty-body">{t.emptyBody}</p>
            <a className="saved__empty-cta" href={askPath(lang)}>{t.emptyCta}</a>
          </div>
        ) : (
          <SavedConversations
            rows={rows}
            lang={lang}
            langTag={LANG_TAG[lang]}
            copy={t}
          />
        )}
      </div>
    </main>
  );
}
