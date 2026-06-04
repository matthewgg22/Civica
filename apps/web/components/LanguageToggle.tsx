"use client";

import type { Locale } from "../app/i18n";

// Landing-marketing toggle — stays binary (en/es) because the landing page
// only ships en/es copy. The applicant portal (home/status) uses the full
// 5-language LanguagePicker instead.
export function LanguageToggle({
  locale,
  onChange,
  ariaLabel,
  locales = ["en", "es"],
}: {
  locale: Locale;
  onChange: (next: Locale) => void;
  ariaLabel: string;
  locales?: Locale[];
}) {
  return (
    <div className="lang-toggle" role="group" aria-label={ariaLabel}>
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          className="lang-toggle__btn"
          aria-pressed={l === locale}
          onClick={() => onChange(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
