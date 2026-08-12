// Where the EBT card actually works — a small, static map of SNAP-authorized
// retailers per state.
//
// NOT interactive, and deliberately not a second copy of the coverage map. That
// one is a control: you pick a state and it tells you who runs SNAP there. This
// is an ILLUSTRATION of one sentence — the card works essentially everywhere —
// and the number does most of the work. Making it clickable would invite the
// two maps to be read as the same kind of object when they answer different
// questions.
//
// Server-rendered from a committed artifact (lib/snap-retailers.ts, refreshed
// by scripts/gen-retailer-counts.mjs). No runtime call to USDA: a third-party
// host has no business in the critical path of a page that must be fast and
// crawlable, and it would need a CSP hole besides.

import type { AnswerLang } from "@civica/demeter-engine/packs";
import { PAGE_COPY } from "../lib/i18n/snap-page";
import { US_MAP_VIEWBOX, US_STATE_PATHS } from "../lib/us-map-paths";
import { RETAILERS_BY_STATE, RETAILER_TOTAL, RETAILERS_AS_OF } from "../lib/snap-retailers";

/** Four restrained steps, on a log-ish scale because the raw range is 93 (USVI)
 *  to 30,180 (CA) — a linear ramp would paint 45 states the same colour and
 *  say nothing.
 *
 *  Shading COUNT, and the caption says so. It would be easy to read a pale
 *  state as poorly served; store density is not access, and per-capita would be
 *  a different (and also arguable) claim. The honest job here is "everywhere,
 *  more where there are more people". */
function tint(n: number | undefined): string {
  if (!n) return "#EFEBE4";
  if (n >= 10000) return "#B4542F";
  if (n >= 4000) return "#D08A66";
  if (n >= 1200) return "#E4B49B";
  return "#F0D6C6";
}

export function SnapRetailerMap({ lang = "en" }: { lang?: AnswerLang }) {
  const c = PAGE_COPY[lang];
  // Grouped by the page's language, so 252,894 is not read as a decimal by a
  // reader whose locale separates the other way.
  const total = RETAILER_TOTAL.toLocaleString(lang === "zh" ? "zh-CN" : lang);

  return (
    <div className="dmret">
      <div className="dmret__text">
        <h3 className="dmx__h3">{c.retailersH3}</h3>
        <p className="dmx__body">{c.retailersBody.replace("{n}", total)}</p>
        <p className="dmx__note">{c.retailersNote.replace("{date}", RETAILERS_AS_OF)}</p>
      </div>
      {/* Decorative: every fact it carries is in the sentence beside it, so a
          screen reader gains nothing from 51 unlabelled paths. */}
      <svg className="dmret__svg" viewBox={US_MAP_VIEWBOX} aria-hidden focusable="false">
        {Object.entries(US_STATE_PATHS).map(([code, d]) => (
          <path key={code} d={d} fill={tint(RETAILERS_BY_STATE[code])} stroke="#FBFAF8" strokeWidth={1} />
        ))}
      </svg>
    </div>
  );
}
