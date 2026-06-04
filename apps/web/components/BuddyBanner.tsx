"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEY, LOCALES, type Locale } from "../app/i18n";

// Buddy-system referral: surfaces that the applicant doesn't have to do this
// alone — a Civica navigator or a partner CBO can complete it with them.
const C: Record<Locale, { text: string; cta: string }> = {
  en: { text: "You don't have to do this alone. A navigator or community partner can fill this out with you.", cta: "Get help from a navigator" },
  es: { text: "No tienes que hacer esto solo. Un navigator o socio comunitario puede completarlo contigo.", cta: "Recibe ayuda de un navigator" },
  zh: { text: "你不必独自完成。导航员或社区合作伙伴可以与你一起填写。", cta: "向导航员寻求帮助" },
  vi: { text: "Bạn không phải làm điều này một mình. Nhân viên hỗ trợ hoặc đối tác cộng đồng có thể điền cùng bạn.", cta: "Nhận trợ giúp từ nhân viên hỗ trợ" },
  tl: { text: "Hindi mo kailangang gawin ito nang mag-isa. May navigator o community partner na pwedeng pumunan nito kasama mo.", cta: "Kumuha ng tulong mula sa navigator" },
};

export function BuddyBanner() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && (LOCALES as string[]).includes(saved)) setLocale(saved as Locale);
    } catch { /* ignore */ }
  }, []);
  const c = C[locale];
  return (
    <aside className="buddy-banner" role="complementary">
      <span className="buddy-banner__icon" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="6.5" r="3" /><circle cx="14" cy="7.5" r="2.5" />
          <path d="M2 17c0-2.8 2.2-5 5-5s5 2.2 5 5M12.5 17c0-2 1.2-3.7 3-4.4" strokeLinecap="round" />
        </svg>
      </span>
      <p className="buddy-banner__text">{c.text}</p>
      <a href="/sign-in?next=%2Fapply" className="buddy-banner__cta">{c.cta} →</a>
    </aside>
  );
}
