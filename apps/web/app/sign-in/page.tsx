"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { STORAGE_KEY, type Locale } from "../i18n";
import { snapT } from "../../lib/i18n/snap-copy";

type Mode = { kind: "phone" } | { kind: "otp"; phone: string };

export default function SignInPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/apply";

  const [locale, setLocale] = useState<Locale>("en");
  const [mode, setMode] = useState<Mode>({ kind: "phone" });
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "es") setLocale(saved);
    } catch {
      // localStorage disabled
    }
  }, []);

  async function requestCode() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (body.error === "invalid_phone") {
          setError(snapT(locale, "signin_error_invalid_phone"));
        } else {
          setError(snapT(locale, "signin_error_generic"));
        }
        return;
      }
      const body = (await res.json()) as { phone: string };
      setMode({ kind: "otp", phone: body.phone });
      setCode("");
    } catch {
      setError(snapT(locale, "signin_error_generic"));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (mode.kind !== "otp") return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: mode.phone, token: code }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          body.error === "invalid_code"
            ? snapT(locale, "signin_error_invalid_code")
            : snapT(locale, "signin_error_generic"),
        );
        return;
      }
      router.replace(next);
    } catch {
      setError(snapT(locale, "signin_error_generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="signin-page">
      <header className="signin-header">
        <a className="brand" href="/">Civica</a>
        <button
          type="button"
          className="locale-toggle"
          onClick={() => {
            const next: Locale = locale === "en" ? "es" : "en";
            setLocale(next);
            try { window.localStorage.setItem(STORAGE_KEY, next); } catch {}
          }}
          aria-label={locale === "en" ? "Cambiar a español" : "Switch to English"}
        >
          {locale === "en" ? "Español" : "English"}
        </button>
      </header>

      <main className="signin-main">
        <div className="signin-card">
          <h1 className="signin-title">{snapT(locale, "signin_title")}</h1>
          <p className="signin-subtitle">{snapT(locale, "signin_subtitle")}</p>

          {mode.kind === "phone" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (phone.trim()) void requestCode();
              }}
            >
              <label className="signin-field">
                <span className="signin-label">{snapT(locale, "signin_phone_label")}</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={snapT(locale, "signin_phone_placeholder")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="signin-input"
                  required
                  disabled={loading}
                />
              </label>

              <button
                type="submit"
                className="signin-cta"
                disabled={loading || !phone.trim()}
              >
                {snapT(locale, "signin_send_code")}
              </button>

              <p className="signin-disclosure">{snapT(locale, "signin_disclosure")}</p>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length >= 6) void verifyCode();
              }}
            >
              <p className="signin-otp-sent">
                {snapT(locale, "signin_otp_sent_to")} <strong>{mode.phone}</strong>
              </p>

              <label className="signin-field">
                <span className="signin-label">{snapT(locale, "signin_otp_label")}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={snapT(locale, "signin_otp_placeholder")}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="signin-input"
                  required
                  disabled={loading}
                />
              </label>

              <button
                type="submit"
                className="signin-cta"
                disabled={loading || code.length < 6}
              >
                {snapT(locale, "signin_verify")}
              </button>

              <button
                type="button"
                className="signin-resend"
                onClick={() => void requestCode()}
                disabled={loading}
              >
                {snapT(locale, "signin_resend")}
              </button>
            </form>
          )}

          {error && (
            <div className="signin-error" role="alert">
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
