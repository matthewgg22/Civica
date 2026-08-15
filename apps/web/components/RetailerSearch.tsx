"use client";

// "Can I use this at the shop on my corner?"
//
// The national map answers "is it everywhere" — which is worth saying once, and
// then tells nobody where. This is the lookup: a ZIP, and the stores in it.
//
// THIS USED TO HAVE NO BASEMAP, on purpose — a prior version of this comment
// argued that a street map needs a tile provider, a key to rotate, and a
// usage policy, and would only earn its keep if we were plotting a route.
// That held until live feedback on the rendered page: a political choropleth
// that cannot zoom into an actual neighbourhood was the wrong artifact for
// "show me where," and free, keyless tiles (see RetailerLiveMap.tsx) remove
// the cost/rotation objection entirely. This component still does not draw
// the map — it reports its results upward via `onResults` so a parent can
// hand them to one — but the list here is unchanged and stays the accessible,
// authoritative interface either way. Each result still hands off to the
// phone's own maps app for turn-by-turn; a slippy map on this page is for
// orientation, not routing.

import { useState } from "react";
import type { AnswerLang } from "@civica/demeter-engine/packs";
import { PAGE_COPY } from "../lib/i18n/snap-page";
import type { RetailerHit } from "../app/api/snap-retailers/route";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; zip: string; stores: RetailerHit[]; truncated: boolean }
  | { kind: "error" };

export function RetailerSearch({
  lang = "en",
  onResults,
}: {
  lang?: AnswerLang;
  /** Fired with the fetched stores on a successful search, and with `null` on
   *  every other transition (idle, loading, error) — so a parent map clears
   *  its pins rather than showing a stale result set while a new search is
   *  in flight or has failed. */
  onResults?: (stores: RetailerHit[] | null) => void;
}) {
  const c = PAGE_COPY[lang];
  const [zip, setZip] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const search = async () => {
    const q = zip.trim();
    if (!/^\d{5}$/.test(q)) return;
    setState({ kind: "loading" });
    onResults?.(null);
    try {
      const res = await fetch(`/api/snap-retailers?zip=${q}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { stores: RetailerHit[]; truncated?: boolean };
      setState({ kind: "done", zip: q, stores: data.stores, truncated: !!data.truncated });
      onResults?.(data.stores);
    } catch {
      // Distinct from "no stores found" — see the copy. Telling someone there
      // is nowhere to shop near them, when really the lookup failed, would be
      // the worst possible way for this to break.
      setState({ kind: "error" });
      onResults?.(null);
    }
  };

  return (
    <div className="dmret__search">
      <form
        className="dmret__form"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label className="dmret__label" htmlFor="dmret-zip">
          {c.retailSearchLabel}
        </label>
        <div className="dmret__row">
          <input
            id="dmret-zip"
            className="dmret__input"
            // `inputMode` gets the numeric keypad on a phone without the
            // spinners and scroll-to-change of type="number".
            inputMode="numeric"
            autoComplete="postal-code"
            pattern="[0-9]{5}"
            maxLength={5}
            placeholder={c.retailSearchPlaceholder}
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          />
          <button
            type="submit"
            className="dmret__go"
            disabled={!/^\d{5}$/.test(zip) || state.kind === "loading"}
          >
            {c.retailSearchGo}
          </button>
        </div>
      </form>

      {/* Announced, because the results replace themselves in place and a
          screen reader user would otherwise get no signal that anything
          happened. */}
      <div className="dmret__results" aria-live="polite">
        {state.kind === "error" && <p className="dmx__note">{c.retailSearchError}</p>}

        {state.kind === "done" && state.stores.length === 0 && (
          <p className="dmx__note">{c.retailSearchNone.replace("{zip}", state.zip)}</p>
        )}

        {state.kind === "done" && state.stores.length > 0 && (
          <>
            <p className="dmret__count">
              {c.retailSearchCount
                .replace("{n}", String(state.stores.length))
                .replace("{zip}", state.zip)}
            </p>
            <ul className="dmret__list">
              {state.stores.map((s) => (
                <li className="dmret__store" key={`${s.name}-${s.address}`}>
                  <span className="dmret__name">{s.name}</span>
                  <span className="dmret__meta">
                    {s.address} · {s.type}
                  </span>
                  <a
                    className="dmret__maplink"
                    // A plain search string, so it opens in whatever maps app
                    // the device actually uses.
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${s.name} ${s.address} ${s.city} ${s.state} ${s.zip}`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {c.retailSearchOpenMap}&nbsp;↗
                  </a>
                </li>
              ))}
            </ul>
            {state.truncated && (
              <p className="dmx__note">
                {c.retailSearchMore.replace("{n}", String(state.stores.length))}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
