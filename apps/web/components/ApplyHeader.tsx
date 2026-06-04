"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEY, LOCALES, type Locale } from "../app/i18n";

// Self-contained copy for the apply-shell chrome (kept local to avoid
// colliding with the shared snap-copy catalog). All five portal languages.
const C: Record<Locale, {
  savedDevice: string; savedTo: string; saveAccount: string; getHelp: string; saveHint: string;
}> = {
  en: { savedDevice: "Saved on this device", savedTo: "Saving to", saveAccount: "Save to your account", getHelp: "Get help", saveHint: "Your progress is saved automatically." },
  es: { savedDevice: "Guardado en este dispositivo", savedTo: "Guardando en", saveAccount: "Guardar en tu cuenta", getHelp: "Obtener ayuda", saveHint: "Tu progreso se guarda automáticamente." },
  zh: { savedDevice: "已保存在此设备", savedTo: "正在保存到", saveAccount: "保存到你的账户", getHelp: "获取帮助", saveHint: "你的进度会自动保存。" },
  vi: { savedDevice: "Đã lưu trên thiết bị này", savedTo: "Đang lưu vào", saveAccount: "Lưu vào tài khoản của bạn", getHelp: "Nhận trợ giúp", saveHint: "Tiến trình của bạn được lưu tự động." },
  tl: { savedDevice: "Naka-save sa device na ito", savedTo: "Sini-save sa", saveAccount: "I-save sa iyong account", getHelp: "Kumuha ng tulong", saveHint: "Awtomatikong nase-save ang iyong progreso." },
};

type Me = { phone?: string | null; email?: string | null } | null;

// In-flow header for the apply wizard. Shows the brand, where the
// application is being saved (account identity if signed in, otherwise
// "on this device"), and a referral to navigator/CBO help (buddy system).
export function ApplyHeader() {
  const [locale, setLocale] = useState<Locale>("en");
  const [me, setMe] = useState<Me>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && (LOCALES as string[]).includes(saved)) setLocale(saved as Locale);
    } catch { /* ignore */ }
    (async () => {
      try {
        const res = await fetch("/api/enrollment/me", { cache: "no-store" });
        if (res.ok) {
          const b = await res.json();
          setMe({ phone: b?.user?.phone ?? b?.phone ?? null, email: b?.user?.email ?? b?.email ?? null });
        }
      } catch { /* unauthed / offline */ }
    })();
  }, []);

  const c = C[locale];
  const identity = me?.phone || me?.email;

  return (
    <header className="apply-header">
      <a href="/welcome" className="apply-header__brand" aria-label="Civica home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/civica-wheat-mark.png" alt="Civica" width={38} height={38} className="apply-header__logo" />
        <span className="apply-header__name">Civica</span>
      </a>

      <div className="apply-header__right">
        <span className="apply-header__save" title={c.saveHint}>
          <span className="apply-header__save-dot" aria-hidden />
          {identity ? (
            <>{c.savedTo} <strong>{identity}</strong></>
          ) : (
            <>{c.savedDevice} · <a href="/sign-in?next=%2Fapply" className="apply-header__save-link">{c.saveAccount}</a></>
          )}
        </span>
        <a href="/sign-in?next=%2Fapply" className="apply-header__help">{c.getHelp}</a>
      </div>
    </header>
  );
}
