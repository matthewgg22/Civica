"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEY, LOCALES, type Locale } from "../app/i18n";
import { Button as StatefulButton } from "@/components/ui/stateful-button";

const C: Record<Locale, {
  text: string;
  cta: string;
  invitePrompt: string;
  copyLabel: string;
  copied: string;
  limitReached: string;
}> = {
  en: {
    text: "You don't have to do this alone. A navigator or community partner can fill this out with you.",
    cta: "Get help from a navigator",
    invitePrompt: "Share this link with your helper:",
    copyLabel: "Copy link",
    copied: "Copied!",
    limitReached: "You already have 3 active helpers. Remove one to invite someone new.",
  },
  es: {
    text: "No tienes que hacer esto solo. Un navigator o socio comunitario puede completarlo contigo.",
    cta: "Recibe ayuda de un navigator",
    invitePrompt: "Comparte este enlace con tu ayudante:",
    copyLabel: "Copiar enlace",
    copied: "¡Copiado!",
    limitReached: "Ya tienes 3 ayudantes activos. Elimina uno para invitar a alguien nuevo.",
  },
  zh: {
    text: "你不必独自完成。导航员或社区合作伙伴可以与你一起填写。",
    cta: "向导航员寻求帮助",
    invitePrompt: "将此链接分享给你的助手：",
    copyLabel: "复制链接",
    copied: "已复制！",
    limitReached: "你已有 3 名活跃助手。请先移除一名再邀请新成员。",
  },
  vi: {
    text: "Bạn không phải làm điều này một mình. Nhân viên hỗ trợ hoặc đối tác cộng đồng có thể điền cùng bạn.",
    cta: "Nhận trợ giúp từ nhân viên hỗ trợ",
    invitePrompt: "Chia sẻ liên kết này với người hỗ trợ của bạn:",
    copyLabel: "Sao chép liên kết",
    copied: "Đã sao chép!",
    limitReached: "Bạn đã có 3 người hỗ trợ. Xóa một người để mời người mới.",
  },
  tl: {
    text: "Hindi mo kailangang gawin ito nang mag-isa. May navigator o community partner na pwedeng pumunan nito kasama mo.",
    cta: "Kumuha ng tulong mula sa navigator",
    invitePrompt: "Ibahagi ang link na ito sa iyong katulong:",
    copyLabel: "Kopyahin ang link",
    copied: "Nakopya na!",
    limitReached: "Mayroon ka nang 3 aktibong katulong. Alisin ang isa para mag-imbita ng bago.",
  },
};

export function BuddyBanner() {
  const [locale, setLocale] = useState<Locale>("en");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState<string | null>(null);
  const [limitError, setLimitError] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && (LOCALES as string[]).includes(saved)) setLocale(saved as Locale);
    } catch { /* ignore */ }
  }, []);

  const c = C[locale];

  async function handleGetHelp() {
    setLimitError(false);
    const res = await fetch("/api/enrollment/buddy", { method: "POST" });
    if (res.status === 401) {
      window.location.href = "/sign-in?next=%2Fapply";
      return;
    }
    if (res.status === 422) {
      const data = await res.json() as { code?: string };
      if (data.code === "BUDDY_LIMIT_REACHED") {
        setLimitError(true);
        return;
      }
    }
    if (!res.ok) {
      window.location.href = "/sign-in?next=%2Fapply";
      return;
    }
    const data = await res.json() as { invite_url: string };
    setInviteLink(data.invite_url);
    setCopyLabel(c.copyLabel);
  }

  async function handleCopy() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopyLabel(c.copied);
    setTimeout(() => setCopyLabel(c.copyLabel), 2000);
  }

  return (
    <aside className="buddy-banner" role="complementary">
      <span className="buddy-banner__icon" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="6.5" r="3" /><circle cx="14" cy="7.5" r="2.5" />
          <path d="M2 17c0-2.8 2.2-5 5-5s5 2.2 5 5M12.5 17c0-2 1.2-3.7 3-4.4" strokeLinecap="round" />
        </svg>
      </span>
      <p className="buddy-banner__text">{c.text}</p>

      {inviteLink ? (
        <div className="buddy-banner__invite">
          <p className="buddy-banner__invite-prompt">{c.invitePrompt}</p>
          <div className="buddy-banner__invite-row">
            <span className="buddy-banner__invite-link">{inviteLink}</span>
            <button type="button" className="buddy-banner__copy" onClick={handleCopy}>
              {copyLabel ?? c.copyLabel}
            </button>
          </div>
        </div>
      ) : limitError ? (
        <p className="buddy-banner__error">{c.limitReached}</p>
      ) : (
        <StatefulButton onClick={handleGetHelp} className="buddy-banner__cta">
          {c.cta} →
        </StatefulButton>
      )}
    </aside>
  );
}
