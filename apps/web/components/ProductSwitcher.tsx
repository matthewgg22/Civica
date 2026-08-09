"use client";

import { useState, useRef, useEffect } from "react";

// 2026-08-09: was three Civica product surfaces (this one, Staff Dashboard,
// CBO Preview), mirroring the dashboard-app's own ProductSwitcher. Per the
// sharpened pivot, Civica is now the parent company and Demeter AI's public
// pages shouldn't link out to the parked internal tooling — cut the two
// dashboard/CBO links rather than leave a live, public bridge into surfaces
// that are otherwise fully hands-off. The dropdown collapses to a single
// entry for now rather than being removed outright: AppNav's callers still
// pass a `current` prop and this keeps that contract intact without forcing
// a second, unrelated change to every page that renders it.
const SURFACES = [
  {
    label: "Applicant Portal",
    description: "What the applicant sees",
    href: "/welcome",
  },
] as const;

export default function ProductSwitcher({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = SURFACES.find((s) => s.label === current) ?? SURFACES[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="product-switcher" ref={ref}>
      <button
        type="button"
        className="product-switcher__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {active.label}
        <svg className={`product-switcher__chevron ${open ? "product-switcher__chevron--open" : ""}`} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="product-switcher__menu" role="listbox">
          {SURFACES.map((s) => {
            const isCurrent = s.label === current;
            return (
              <a
                key={s.label}
                href={s.href}
                role="option"
                aria-selected={isCurrent}
                className={`product-switcher__option ${isCurrent ? "product-switcher__option--current" : ""}`}
                onClick={() => setOpen(false)}
              >
                <span className="product-switcher__option-label">
                  {s.label}
                  {isCurrent && <span className="product-switcher__option-current">current</span>}
                </span>
                <span className="product-switcher__option-desc">{s.description}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
