"use client";

// State picker — a searchable combobox, not a row of chips.
//
// The chip row it replaces spent a full row of the page on five buttons and
// still clipped "How we verify" off the right edge at 1280px. It also does not
// survive the roster growing: the state-pack framework's roster is 15+ states
// (docs/plans/mae-state-corpus-framework.md), and a chip row is already at its
// limit with five.
//
// A selected state is the ONE thing shown — with its real agency name, because
// naming the actual agency ("California Department of Social Services") is what
// makes the answer feel like it came from somewhere rather than from a model.
//
// Pattern: button + listbox (WAI-ARIA combobox), keyboard-driven, closes on
// Escape/outside-click. Deliberately not a native <select>: the roster needs a
// filter as it grows, and a native select can't show agency + program per row.

import { useEffect, useMemo, useRef, useState } from "react";
import type { PackMeta } from "@civica/demeter-engine/packs";

export interface StatePickerCopy {
  label: string;
  federal: string;
  federalHint: string;
  search: string;
  verified: string;
  noMatch: string;
}

export function DemeterStatePicker({
  states,
  value,
  onChange,
  copy,
  openSignal = 0,
}: {
  states: PackMeta[];
  value: string | null;
  onChange: (next: string | null) => void;
  copy: StatePickerCopy;
  /** Increment to open the picker from elsewhere on the page. The estimate
   *  rail uses this: without a state there is no benefit calculation, so
   *  "pick your state" needs to be one click rather than an instruction the
   *  reader has to go act on themselves. A counter rather than a boolean so
   *  repeated asks re-open it after a dismissal. */
  openSignal?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = value ? states.find((s) => s.code === value) ?? null : null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return states;
    // Match on code, program, and agency — someone types "CalFresh" or
    // "Texas" or "ODJFS" and any of the three should find the row.
    return states.filter((s) =>
      [s.code, s.program, s.agency].some((f) => f.toLowerCase().includes(q)),
    );
  }, [states, query]);

  // Opened from the estimate rail. Skips the initial 0 so the picker is not
  // open on first paint.
  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (next: string | null) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="dmst" ref={rootRef}>
      <button
        type="button"
        className="dmst__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={copy.label}
        onClick={() => setOpen((o) => !o)}
      >
        {/* The state as a MONOGRAM, far left — the thing the eye lands on.
            Which state is selected changes every figure in the answer, so it
            deserves to be readable at a glance rather than parsed out of a
            sentence. A real state flag was the other option and was rejected:
            most are a seal on a blue field and turn to mush below ~32px, which
            is worse than the text it would replace. Two letters in the display
            serif stay legible at any size and work for all 50 states on day
            one, not just the verified ones. */}
        <span className="dmst__mark" data-federal={selected ? undefined : "true"}>
          {selected ? selected.code : "US"}
        </span>
        <span className="dmst__trigger-text">
          <span className="dmst__trigger-label">{copy.label}</span>
          <span className="dmst__trigger-value">
            {selected ? selected.program : copy.federal}
          </span>
        </span>
        {selected ? <span className="dmst__check" aria-hidden>✓</span> : null}
        <span className="dmst__caret" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="dmst__panel">
          <input
            ref={searchRef}
            type="search"
            className="dmst__search"
            placeholder={copy.search}
            aria-label={copy.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="dmst__list" role="listbox" aria-label={copy.label}>
            <li>
              <button
                type="button"
                role="option"
                aria-selected={value === null}
                className={`dmst__opt ${value === null ? "is-sel" : ""}`}
                onClick={() => pick(null)}
              >
                <span className="dmst__mark" data-federal="true">US</span>
                <span className="dmst__opt-text">
                  <span className="dmst__opt-name">{copy.federal}</span>
                  <span className="dmst__opt-sub">{copy.federalHint}</span>
                </span>
              </button>
            </li>
            {matches.map((s) => (
              <li key={s.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === s.code}
                  className={`dmst__opt ${value === s.code ? "is-sel" : ""}`}
                  onClick={() => pick(s.code)}
                >
                  <span className="dmst__mark">{s.code}</span>
                  <span className="dmst__opt-text">
                    <span className="dmst__opt-name">
                      {s.program}
                      <span className="dmst__opt-badge">{copy.verified}</span>
                    </span>
                    <span className="dmst__opt-sub">{s.agency}</span>
                  </span>
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="dmst__none">{copy.noMatch}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
