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
import { NAP_JURISDICTIONS, napJurisdiction, type PackMeta } from "@civica/demeter-engine/packs";
import { StateFlag } from "./StateFlag";
import { agencyDisplayName, programDisplayName } from "../lib/program-name";
import { stateName } from "../lib/state-names";

export interface StatePickerCopy {
  label: string;
  federal: string;
  federalHint: string;
  search: string;
  verified: string;
  noMatch: string;
  /** Heading for the NAP-territory group — these do not run SNAP. */
  napGroup: string;
  /** Offer for the IP-derived hint. Concrete on purpose — "Use CalFresh" beats
   *  "Use my location", which asks someone to accept a guess they cannot see.
   *
   *  A TEMPLATE STRING with `{state}`, not a function. This copy object crosses
   *  the server/client boundary as a prop (the landing page renders the entry
   *  card on the server), and a function cannot be serialized across it —
   *  Next throws "Functions cannot be passed directly to Client Components".
   *  The other copy functions in this table are fine because DemeterChat
   *  imports the table itself rather than receiving it. */
  useHint: string;
  /** What the confirmation card calls the agency line. */
  scopeAgency: string;
  scopeApply: string;
}

export function DemeterStatePicker({
  states,
  value,
  onChange,
  copy,
  hint = null,
  openSignal = 0,
}: {
  states: PackMeta[];
  value: string | null;
  onChange: (next: string | null) => void;
  copy: StatePickerCopy;
  /** A state code derived from the request IP at the edge. OFFERED, never
   *  applied — see lib/geo-hint.ts. Null when there is no header (local, tests,
   *  outside the US) or the region is not one we answer for. */
  hint?: string | null;
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
  // Only suggest a state we have a verified pack for. Offering an unverified
  // one would promise more than the federal floor it would actually get.
  const hintState = hint ? states.find((s) => s.code === hint) ?? null : null;
  // A NAP territory is not in `states`, so `selected` is null for one — it
  // needs its own lookup or the confirmation card silently never appears for
  // exactly the jurisdictions whose difference most needs stating.
  const napSelected = napJurisdiction(value);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return states;
    // Match on the state's NAME as well as code, program and agency. The name
    // was missing, so typing "Massachusetts" into a state picker found nothing
    // — MA's program is "Supplemental Nutrition Assistance Program" and its
    // agency is "Department of Transitional Assistance", neither of which
    // contains the word. The most obvious thing anyone would type was the one
    // thing that did not work.
    return states.filter((s) =>
      [s.code, stateName(s.code), s.program, s.agency].some((f) =>
        f.toLowerCase().includes(q),
      ),
    );
  }, [states, query]);

  // Searchable on the same terms. "Puerto Rico", "PR" and "PAN" all find it —
  // someone looking for their program by its local name is exactly the person
  // this group exists for.
  const napMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAP_JURISDICTIONS;
    return NAP_JURISDICTIONS.filter((j) =>
      [j.code, j.name, j.program, j.agency].some((f) => f.toLowerCase().includes(q)),
    );
  }, [query]);

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
        {selected ? (
          <StateFlag code={selected.code} />
        ) : napSelected ? (
          <StateFlag code={napSelected.code} />
        ) : (
          // The federal floor is not a place. No flag, and the muted chip makes
          // "All states" never look like a selection someone made.
          <span className="dmst__mark" data-federal="true">US</span>
        )}
        {/* ONE LINE (owner, 2026-08-22). This was a two-row stack — the label
            "Your state" above the value "All states (federal rules)" — which
            spent two lines and an eyebrow on a control with one job. Unset it
            now reads as a placeholder; set, it is the state's own name, so the
            row always answers "which state?" without a caption explaining
            that it is about states.

            The federal-floor caveat is not lost with the old value string: the
            empty state still closes on "until then, answers use the federal
            rules", and the scope line beneath this names the agency. */}
        <span className="dmst__trigger-text">
          <span className="dmst__trigger-value">
            {selected ? stateName(selected.code) : copy.label}
          </span>
        </span>
        {selected ? <span className="dmst__check" aria-hidden>✓</span> : null}
        <span className="dmst__caret" aria-hidden>▾</span>
      </button>

      {/* IMMEDIATE CONFIRMATION. The trigger alone showed only the program
          name, so after choosing you knew Demeter had accepted "CalFresh" but
          not WHICH agency it would answer from or where you would actually
          apply. Both already exist in the pack and were only rendered at the
          bottom of the landing page, hundreds of pixels from the decision.

          Naming the real agency is also what makes an answer feel like it came
          from somewhere rather than from a model — the same reason the picker
          rows carry it. */}
      {/* "Apply at {portal} ↗" used to live here too, stacked under the agency
          line. Moved down next to "How we verify" (DemeterChat's side rail) —
          both are standing, secondary facts about the same scope rather than
          something to act on the moment you pick a state, and the two lines
          here were crowding the confirmation card (real feedback,
          2026-08-15). agency alone is capped at two lines (see
          .dmst__scope-agency) since some states' full agency name is long
          enough to run past that on its own. */}
      {selected && !open && (
        <div className="dmst__scope">
          <span className="dmst__scope-agency">
            {copy.scopeAgency}: {selected.agencyShort}
          </span>
        </div>
      )}
      {napSelected && !open && (
        <div className="dmst__scope dmst__scope--nap">
          <span className="dmst__scope-agency">
            {programDisplayName(napSelected.program)} · {agencyDisplayName(napSelected.agency)}
          </span>
          {napSelected.agencyUrl && (
            <a
              className="dmst__scope-portal"
              href={napSelected.agencyUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {copy.scopeApply} {napSelected.name} ↗
            </a>
          )}
        </div>
      )}

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
          {/* The IP hint, offered once and only while nothing is chosen. Named
              concretely ("Use California") rather than "use my location",
              because accepting a guess you cannot see is not a choice. Hidden
              the moment a state is selected — at that point it is noise, and
              re-offering a guess over a deliberate choice is how someone ends
              up scoped to the wrong state. */}
          {hintState && !value && !query && (
            <button type="button" className="dmst__hint" onClick={() => pick(hintState.code)}>
              <StateFlag code={hintState.code} />
              {/* The STATE's name. This substituted `program`, so the row read
                  "Use Supplemental Nutrition Assistance Program (SNAP) —
                  Massachusetts uses the federal name; …" instead of "Use
                  Massachusetts", which is what the comment above always said it
                  should say. */}
              <span>{copy.useHint.replace("{state}", stateName(hintState.code))}</span>
            </button>
          )}
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
                  {/* Larger here than in the trigger: the dropdown is where you
                      scan for your own state, and recognition is the whole
                      reason the flag is there at all. */}
                  <StateFlag code={s.code} size={34} />
                  <span className="dmst__opt-text">
                    {/* THE STATE LEADS (owner, 2026-08-22). This showed the
                        PROGRAM name, so typing "verm" returned a row headed
                        "3SquaresVT" — Vermont's real name for SNAP, but not a
                        word the person searching typed, and the row never said
                        "Vermont" at all. Nine states brand SNAP differently
                        (CalFresh, 3SquaresVT, SnapEd…), so this was not one
                        odd row. The state answers "did my search work?"; the
                        programme name below answers "what will it be called
                        when I get there?", which is worth knowing but is not
                        the thing being searched for.

                        The agency moves off this row — it is already named on
                        the scope line under the trigger once a state is
                        chosen, and in the answer itself. pack.agency is
                        written for the MODEL and carries a research annexe
                        behind an em-dash, so it ran to four lines here. */}
                    <span className="dmst__opt-name">{stateName(s.code)}</span>
                    <span className="dmst__opt-sub">{s.programShort}</span>
                  </span>
                </button>
              </li>
            ))}
            {/* NAP territories, in their own group and labelled as a different
                program. Not mixed in with the states: Puerto Rico, American
                Samoa and the Northern Mariana Islands do not run SNAP, so
                listing them as though they were states-without-a-pack would
                promise a federal floor that does not exist there. Selecting one
                produces a hand-off to their real agency, not a SNAP answer. */}
            {napMatches.length > 0 && (
              <>
                <li className="dmst__group" role="presentation">
                  {copy.napGroup}
                </li>
                {napMatches.map((j) => (
                  <li key={j.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === j.code}
                      className={`dmst__opt ${value === j.code ? "is-sel" : ""}`}
                      onClick={() => pick(j.code)}
                    >
                      <StateFlag code={j.code} />
                      <span className="dmst__opt-text">
                        <span className="dmst__opt-name">{j.name}</span>
                        <span className="dmst__opt-sub">{programDisplayName(j.program)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </>
            )}
            {matches.length === 0 && napMatches.length === 0 && (
              <li className="dmst__none">{copy.noMatch}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
