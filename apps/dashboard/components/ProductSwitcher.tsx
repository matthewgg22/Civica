"use client";

import { useState, useRef, useEffect } from "react";

const SURFACES = [
  {
    label: "Staff Dashboard",
    description: "Navigator & caseworker view",
    href: "/dashboard",
  },
  {
    label: "Applicant Portal",
    description: "civica-applicant.vercel.app",
    href: "https://civica-applicant.vercel.app",
  },
  {
    label: "CBO Preview",
    description: "Prospective partner demo",
    href: "/cbo-preview",
  },
] as const;

export default function ProductSwitcher({ currentHref }: { currentHref: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = SURFACES.find((s) => s.href === currentHref) ?? SURFACES[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted hover:text-ink transition-colors focus:outline-none"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {active.label}
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-2 w-52 bg-surface border border-hairline rounded-[4px] shadow-lg z-50 py-1"
        >
          {SURFACES.map((s) => {
            const isCurrent = s.href === currentHref || (s.href === "/dashboard" && currentHref === "/dashboard");
            return (
              <a
                key={s.label}
                href={s.href}
                role="option"
                aria-selected={isCurrent}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2.5 transition-colors ${
                  isCurrent
                    ? "bg-ink/5 text-ink"
                    : "hover:bg-ink/5 text-graphite hover:text-ink"
                }`}
              >
                <p className="text-[13px] font-medium leading-none">
                  {s.label}
                  {isCurrent && (
                    <span className="ml-2 text-[10px] text-muted font-normal uppercase tracking-wider">current</span>
                  )}
                </p>
                <p className="text-[11px] text-muted mt-1">{s.description}</p>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
