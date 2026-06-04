"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { STORAGE_KEY, type Locale } from "../../i18n";
import { snapT } from "../../../lib/i18n/snap-copy";

// useSearchParams() bails out of static rendering — without a Suspense
// boundary, Next 16 fails the static-page generation pass. Wrapping the
// inner component lets the shell pre-render while the search-param read
// happens client-side after hydration.
export default function NextStepsPage() {
  return (
    <Suspense fallback={<div className="next-steps">…</div>}>
      <NextStepsContent />
    </Suspense>
  );
}

// Local copy for the "ready to send" state (kept out of the shared catalog).
const READY: Record<string, { title: string; body: string; cta: string; back: string }> = {
  en: { title: "Your application is ready", body: "You've answered everything we need. Sign in with your phone to send it to a Civica navigator, who reviews it before it goes to the county. Your answers are saved.", cta: "Sign in to send", back: "Keep editing" },
  es: { title: "Tu solicitud está lista", body: "Respondiste todo lo necesario. Inicia sesión con tu teléfono para enviarla a un navigator de Civica, que la revisa antes de enviarla al condado. Tus respuestas están guardadas.", cta: "Inicia sesión para enviar", back: "Seguir editando" },
  zh: { title: "你的申请已准备就绪", body: "你已回答了所需的所有问题。用手机登录,将其发送给 Civica 导航员,导航员会在提交给县政府之前进行审核。你的答案已保存。", cta: "登录以发送", back: "继续编辑" },
  vi: { title: "Đơn của bạn đã sẵn sàng", body: "Bạn đã trả lời mọi thứ chúng tôi cần. Đăng nhập bằng điện thoại để gửi đến nhân viên hỗ trợ của Civica, người sẽ xem xét trước khi gửi đến quận. Câu trả lời của bạn đã được lưu.", cta: "Đăng nhập để gửi", back: "Tiếp tục chỉnh sửa" },
  tl: { title: "Handa na ang iyong aplikasyon", body: "Nasagot mo na ang lahat ng kailangan namin. Mag-sign in gamit ang iyong telepono para ipadala ito sa isang Civica navigator, na susuri nito bago mapunta sa county. Naka-save ang iyong mga sagot.", cta: "Mag-sign in para ipadala", back: "Magpatuloy sa pag-edit" },
};

function NextStepsContent() {
  const search = useSearchParams();
  const packetId = search.get("packet") ?? "";
  const ready = search.get("ready") === "1";
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && ["en", "es", "zh", "vi", "tl"].includes(saved)) setLocale(saved as Locale);
    } catch { /* ignore */ }
  }, []);

  // "Ready to send" — application complete but not submitted (no session yet).
  if (ready && !packetId) {
    const r = READY[locale] ?? READY.en;
    return (
      <div className="next-steps">
        <h1 className="next-steps__title">{r.title}</h1>
        <p className="next-steps__body">{r.body}</p>
        <div className="next-steps__ctas">
          <a href="/sign-in?next=%2Fstatus" className="wizard__continue">{r.cta}</a>
          <Link href="/apply/review" className="wizard__back">{r.back}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="next-steps">
      <h1 className="next-steps__title">{snapT(locale, "next_steps_title")}</h1>
      <p className="next-steps__body">{snapT(locale, "next_steps_body")}</p>
      {packetId && (
        <p className="next-steps__packet-id">
          {snapT(locale, "confirmation_packet_id")}: <code>{packetId}</code>
        </p>
      )}
      <div className="next-steps__ctas">
        {packetId && (
          <Link href={`/documents/${encodeURIComponent(packetId)}`} className="wizard__continue">
            {snapT(locale, "upload_title")}
          </Link>
        )}
        <Link href="/status" className="wizard__back">
          {snapT(locale, "confirmation_view_status")}
        </Link>
      </div>
    </div>
  );
}
