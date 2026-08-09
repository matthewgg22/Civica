"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEY, LOCALES, type Locale } from "../app/i18n";

// Mae — Civica's AI helper. The conversational model isn't wired to the web
// yet (it lives in the iOS app), so this is the entry point: it opens a panel
// that orients the applicant and routes them to a human navigator. When the
// web Mae backend lands, the panel body becomes the chat surface.
const C: Record<Locale, {
  open: string; title: string; intro: string; soon: string; human: string; close: string;
}> = {
  en: { open: "Ask Demeter", title: "Hi, I'm Demeter", intro: "I help you through the SNAP application. Ask me what a question means or what to put.", soon: "Live chat is coming to the web soon. For now, a navigator can help you in person or by phone.", human: "Talk to a navigator", close: "Close" },
  es: { open: "Pregúntale a Demeter", title: "Hola, soy Demeter", intro: "Te ayudo con la solicitud de SNAP. Pregúntame qué significa una pregunta o qué poner.", soon: "El chat en vivo llegará pronto a la web. Por ahora, un navigator puede ayudarte en persona o por teléfono.", human: "Habla con un navigator", close: "Cerrar" },
  zh: { open: "询问 Demeter", title: "你好,我是 Demeter", intro: "我帮助你完成 SNAP 申请。问我某个问题的含义或该填什么。", soon: "网页版实时聊天即将推出。目前,导航员可以当面或电话为你提供帮助。", human: "联系导航员", close: "关闭" },
  vi: { open: "Hỏi Demeter", title: "Chào, tôi là Demeter", intro: "Tôi giúp bạn hoàn thành đơn SNAP. Hỏi tôi ý nghĩa của câu hỏi hoặc nên điền gì.", soon: "Trò chuyện trực tiếp sẽ sớm có trên web. Hiện tại, nhân viên hỗ trợ có thể giúp bạn trực tiếp hoặc qua điện thoại.", human: "Nói chuyện với nhân viên hỗ trợ", close: "Đóng" },
  tl: { open: "Tanungin si Demeter", title: "Kumusta, ako si Demeter", intro: "Tinutulungan kita sa aplikasyon ng SNAP. Tanungin mo ako kung ano ang ibig sabihin ng tanong o ano ang ilalagay.", soon: "Malapit nang dumating ang live chat sa web. Sa ngayon, may navigator na pwedeng tumulong sa iyo nang personal o sa telepono.", human: "Makipag-usap sa navigator", close: "Isara" },
};

export function MaeHelpButton() {
  const [locale, setLocale] = useState<Locale>("en");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && (LOCALES as string[]).includes(saved)) setLocale(saved as Locale);
    } catch { /* ignore */ }
  }, []);

  const c = C[locale];

  return (
    <>
      {open && (
        <div className="mae-panel" role="dialog" aria-label={c.title}>
          <div className="mae-panel__head">
            <span className="mae-panel__avatar" aria-hidden>D</span>
            <p className="mae-panel__title">{c.title}</p>
            <button className="mae-panel__close" aria-label={c.close} onClick={() => setOpen(false)}>✕</button>
          </div>
          <p className="mae-panel__intro">{c.intro}</p>
          <p className="mae-panel__soon">{c.soon}</p>
          <a href="/sign-in?next=%2Fapply" className="mae-panel__human">{c.human} →</a>
        </div>
      )}
      <button
        type="button"
        className="mae-fab"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mae-fab__avatar" aria-hidden>D</span>
        {c.open}
      </button>
    </>
  );
}
