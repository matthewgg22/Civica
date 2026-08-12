"use client";

// "Can I use this at the shop on my corner?"
//
// The national map answers "is it everywhere" — which is worth saying once, and
// then tells nobody where. This is the lookup: a ZIP, and the stores in it.
//
// NO BASEMAP, on purpose. A street map needs a tile provider — a third-party
// host in the page's CSP, a key to rotate, and a usage policy to stay inside —
// and it would earn its keep only if we were plotting a route. What someone
// needs here is the NAME of a shop they recognise and its address; the phone
// they are reading this on already has a maps app that does the rest better
// than we would. So each result hands off to it.
//
// Plotting pins on a blank rectangle was the other option and is worse than
// either: it looks like a map and locates nothing.

import { useState } from "react";
import type { AnswerLang } from "@civica/demeter-engine/packs";
import { PAGE_COPY } from "../lib/i18n/snap-page";
import type { RetailerHit } from "../app/api/snap-retailers/route";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; zip: string; stores: RetailerHit[]; truncated: boolean }
  | { kind: "error" };

export function RetailerSearch({ lang = "en" }: { lang?: AnswerLang }) {
  const c = PAGE_COPY[lang];
  const [zip, setZip] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const search = async () => {
    const q = zip.trim();
    if (!/^\d{5}$/.test(q)) return;
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/snap-retailers?zip=${q}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { stores: RetailerHit[]; truncated?: boolean };
      setState({ kind: "done", zip: q, stores: data.stores, truncated: !!data.truncated });
    } catch {
      // Distinct from "no stores found" — see the copy. Telling someone there
      // is nowhere to shop near them, when really the lookup failed, would be
      // the worst possible way for this to break.
      setState({ kind: "error" });
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
