"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALES, LANGUAGE_LABELS, type Locale } from "../app/i18n";

// Language picker for the applicant portal — offers all five supported
// languages (English, Español, 中文, Tiếng Việt, Tagalog). Replaces the old
// binary en/es toggle now that the home is fully translated.
export function LanguagePicker({
  locale,
  onChange,
  ariaLabel,
}: {
  locale: Locale;
  onChange: (next: Locale) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div className="lang-picker" ref={ref}>
      <button
        type="button"
        className="lang-picker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden className="lang-picker__globe">🌐</span>
        {LANGUAGE_LABELS[locale]}
        <svg className={`lang-picker__chevron ${open ? "lang-picker__chevron--open" : ""}`} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="lang-picker__menu" role="listbox" aria-label={ariaLabel}>
          {LOCALES.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={l === locale}
                className={`lang-picker__option ${l === locale ? "lang-picker__option--current" : ""}`}
                onClick={() => { onChange(l); setOpen(false); }}
              >
                {LANGUAGE_LABELS[l]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
