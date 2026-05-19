"use client";

import { LOCALES, type Locale } from "../app/i18n";

export function LanguageToggle({
  locale,
  onChange,
  ariaLabel,
}: {
  locale: Locale;
  onChange: (next: Locale) => void;
  ariaLabel: string;
}) {
  return (
    <div className="lang-toggle" role="group" aria-label={ariaLabel}>
      {LOCALES.map((l) => (
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
