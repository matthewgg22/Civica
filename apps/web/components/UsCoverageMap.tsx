"use client";

// Which states Demeter has actually verified, as a map you can click.
//
// Replaces a stacked list of agency cards. The list was accurate and unusable:
// fourteen cards of program name, agency name and portal link, read top to
// bottom, to answer one question — "is MY state in here?" A map answers that
// before you read anything, which is the same argument the flags won.
//
// The card lives BESIDE the map rather than replacing it, so choosing a state
// never costs you the overview. On a phone the two stack, card first, because
// there the answer matters more than the picture.
//
// Territories are deliberately absent. geoAlbersUsa projects the 50 states and
// DC only, and three of the five territories do not run SNAP at all — their
// place is the picker's own group and the NAP hand-off, not a map that would
// imply they are covered the same way.

import { useState } from "react";
import type { PackMeta } from "@civica/demeter-engine/packs";
import { US_MAP_VIEWBOX, US_STATE_PATHS } from "../lib/us-map-paths";
import { programDisplayName, agencyDisplayName } from "../lib/program-name";
import { StateFlag } from "./StateFlag";

export interface CoverageMapCopy {
  /** Prompt shown before anything is selected. */
  prompt: string;
  agency: string;
  apply: string;
  federalNote: string;
  verified: string;
}

export function UsCoverageMap({
  states,
  copy,
}: {
  states: PackMeta[];
  copy: CoverageMapCopy;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const byCode = new Map(states.map((s) => [s.code, s]));
  const chosen = selected ? byCode.get(selected) ?? null : null;

  return (
    <div className="dmmap">
      <svg
        className="dmmap__svg"
        viewBox={US_MAP_VIEWBOX}
        role="group"
        aria-label={copy.prompt}
      >
        {Object.entries(US_STATE_PATHS).map(([code, d]) => {
          const pack = byCode.get(code);
          // Unverified states are drawn, not hidden. The federal floor still
          // answers for them, and a map with holes in it would say the opposite.
          if (!pack) {
            return <path key={code} className="dmmap__state" d={d} aria-hidden />;
          }
          return (
            <path
              key={code}
              className="dmmap__state dmmap__state--on"
              data-sel={selected === code ? "true" : undefined}
              d={d}
              role="button"
              tabIndex={0}
              /* Display name, not the raw field: an annotation clause read out
                 on every arrow key is a paragraph where a name belongs. */
              aria-label={`${programDisplayName(pack.program)}, ${agencyDisplayName(pack.agency)}`}
              aria-pressed={selected === code}
              onClick={() => setSelected(code === selected ? null : code)}
              onKeyDown={(e) => {
                // A <path> is not a button; Enter and Space have to be wired by
                // hand or the map is mouse-only.
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(code === selected ? null : code);
                }
              }}
            />
          );
        })}
      </svg>

      <aside className="dmmap__card" aria-live="polite">
        {chosen ? (
          <>
            <StateFlag code={chosen.code} size={40} />
            <p className="dmmap__program">{programDisplayName(chosen.program)}</p>
            <p className="dmmap__agency">
              <span className="dmmap__cardlabel">{copy.agency}</span>
              {/* Cleaned like the program name above — the raw field carries
                  corpus annotation (taste audit finding 1, issue #761). */}
              {agencyDisplayName(chosen.agency)}
            </p>
            {chosen.portal && (
              <a
                className="dmmap__portal"
                href={chosen.portal.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {/* Bound to the last word: alone on a wrapped line the arrow
                    reads as a stray glyph rather than part of the link. */}
                {copy.apply} {programDisplayName(chosen.portal.name)}&nbsp;↗
              </a>
            )}
            <p className="dmmap__verified">
              {copy.verified} {chosen.verification.verified_on}
            </p>
          </>
        ) : (
          <>
            <p className="dmmap__prompt">{copy.prompt}</p>
            <p className="dmmap__federal">{copy.federalNote}</p>
          </>
        )}
      </aside>
    </div>
  );
}
