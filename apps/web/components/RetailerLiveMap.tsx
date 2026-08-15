"use client";

// A real, pannable, zoomable map — not the static choropleth it replaces.
//
// The old one was an SVG illustration of a single sentence ("the card works
// almost everywhere") with no way to go from "everywhere" to "near me" except
// a text list underneath it. This is one map doing both jobs: it opens showing
// which states are covered, and when a search returns stores, it drops pins
// for them and flies in to show the actual neighbourhood — the "close-up" a
// political map cannot give.
//
// PLAIN LEAFLET, not react-leaflet. React 19 here would be fighting
// react-leaflet's peer range for no real benefit — Leaflet's own imperative
// API is small, and a ref + one effect is less surface than a second
// abstraction layer on top of it.
//
// TILES: CARTO's free "Positron" basemap. No account, no key, no billing —
// the same reasoning that put self-hosted fonts in this repo instead of
// next/font/google: a paid, rotatable-key dependency was rejected for this
// exact feature once already (see the comment this component replaces in
// SnapRetailerMap.tsx's git history). Positron's muted greys also sit closer
// to this page's own restrained palette than Google's or Mapbox's default
// styles would.
//
// MARKERS are a small inline SVG pin in the brand's own terracotta, not
// Leaflet's stock blue teardrop — this product has a considered visual
// language everywhere else and the map should not be the one place that
// looks like a library default.
//
// DECORATIVE. The results list beside it (RetailerSearch, unchanged) remains
// the accessible, authoritative interface — same principle the static map
// stated for itself: a screen reader gains nothing from a canvas of pins it
// cannot tab to, so the map is aria-hidden and the list carries every fact.

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON, LayerGroup } from "leaflet";
import type { RetailerHit } from "../app/api/snap-retailers/route";
import statesGeo from "../lib/us-states-geo.json";
// CSS only — build-time extraction, not a runtime import, so this is safe
// under SSR even though the `leaflet` module itself is dynamically imported
// below and only ever touched inside an effect, after mount.
import "leaflet/dist/leaflet.css";

// ONE TONE, not a four-step ramp by count. The ramp shaded California,
// Texas, New York and Florida darkest — which is just the four most populous
// states, restated as a map, on live feedback that pointed out exactly this:
// a reader sees a map that LOOKS like access varies by state and has no way
// to tell that what actually varies is population. The honest claim this
// section makes is "covered, everywhere" — a single tone for every state in
// the topology says exactly that and nothing more. Real variation in access
// is what the search below is for; it answers a specific place, not a
//50-state guess dressed as data.
const COVERED_FILL = "#E4B49B";

// Contiguous US, roughly — the default view. A raw-GeoJSON map cannot inset
// Alaska and Hawaii the way the old Albers illustration did (that projection
// only exists for a static image); they are real distance away, so the
// opening view frames where almost everyone reading this actually is, and
// panning north-west or into the Pacific reaches them honestly rather than
// pretending they are next to Nevada.
const CONUS_BOUNDS: [[number, number], [number, number]] = [
  [24.4, -125.0],
  [49.5, -66.9],
];

// Above this zoom the coverage tint fades out — see the comment where it is
// used. CONUS's own fitBounds lands around zoom 4; a searched neighbourhood
// lands around 12-14 (flyToBounds below caps at 14). 7 is comfortably past
// "browsing the country," before a single state has filled the whole screen.
const STATE_TINT_MAX_ZOOM = 7;

// SLOW. Was 0.6s and read as a snap rather than a flight — live feedback
// called it "way too fast," and against Leaflet's default easing 0.6s barely
// registers as motion at all before it is over. This is close to the pace
// the rest of the product settled on for anything that carries someone's
// attention across a change (the streaming text reveal, the mode-toggle
// slide): slow enough to watch, not slow enough to wait on.
const FLY_DURATION_S = 1.8;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface RetailerLiveMapProps {
  /** The current search result, or null when nothing has been searched yet /
   *  the last search found nothing. Coordinates are filtered to non-null
   *  before this is called — see RetailerSearch. */
  stores: RetailerHit[] | null;
}

export function RetailerLiveMap({ stores }: RetailerLiveMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const stateLayerRef = useRef<LeafletGeoJSON | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);

  // MOUNT ONCE. Leaflet owns the DOM node it is given and re-creating the map
  // on every re-render would tear down and rebuild tiles for no reason — only
  // the marker layer below needs to react to prop changes.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled || !elRef.current || mapRef.current) return;

      const map = L.map(elRef.current, {
        attributionControl: true,
        // Scroll-to-zoom on a page you are reading would hijack the page's
        // own scroll the moment a cursor drifts over the map. Click-drag pan
        // and the +/- control are enough for "zoom in on my area."
        scrollWheelZoom: false,
      });
      map.fitBounds(CONUS_BOUNDS);
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      const stateLayer = L.geoJSON(statesGeo as GeoJSON.FeatureCollection, {
        style: { fillColor: COVERED_FILL, fillOpacity: 0.85, color: "#FBFAF8", weight: 1 },
      }).addTo(map);
      stateLayerRef.current = stateLayer;

      // FADES OUT ONCE ZOOMED IN, SMOOTHLY. Only found by rendering it: a
      // "close-up" fitBounds after a search sits entirely INSIDE one state's
      // polygon, so that polygon's fill covers the whole viewport — hiding
      // every street, every tile, and every pin under a flat tint. The
      // coverage read is a national-scale fact; past a city-scale zoom it has
      // nothing left to say and was only in the way. The FADE itself is a
      // plain CSS transition on the SVG path (see globals.css) — the earlier
      // version toggled the value instantly, which read as the map cutting
      // from a colour illustration to a plain one rather than revealing it.
      const setStateLayerForZoom = () => {
        const visible = map.getZoom() <= STATE_TINT_MAX_ZOOM;
        stateLayer.setStyle({ fillOpacity: visible ? 0.85 : 0, opacity: visible ? 1 : 0 });
      };
      setStateLayerForZoom();
      map.on("zoomend", setStateLayerForZoom);

      markerLayerRef.current = L.layerGroup().addTo(map);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // MARKERS follow the search. Runs whenever `stores` changes; harmless if the
  // map has not finished mounting yet (the effect above will not have set
  // markerLayerRef, so this simply does nothing until it has).
  useEffect(() => {
    if (!markerLayerRef.current || !mapRef.current) return;
    const layer = markerLayerRef.current;
    const map = mapRef.current;
    layer.clearLayers();
    if (!stores || stores.length === 0) return;

    void import("leaflet").then((L) => {
      // The settle-in animation lives on the INNER `.dmret__pin-in` div, not
      // on this element — see the comment in globals.css. Leaflet positions
      // `.dmret__pin` itself with its own transform on every pan/zoom, and a
      // CSS animation touching `transform` on that same element would fight
      // it for the marker's actual screen position.
      const pin = L.divIcon({
        className: "dmret__pin",
        html: `<div class="dmret__pin-in"><svg width="22" height="28" viewBox="0 0 22 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 27C11 27 20 17.5 20 11C20 5.5 16 1 11 1C6 1 2 5.5 2 11C2 17.5 11 27 11 27Z"
            fill="#8E3A26" stroke="#FBFAF8" stroke-width="1.5"/>
          <circle cx="11" cy="11" r="3.5" fill="#FBFAF8"/>
        </svg></div>`,
        iconSize: [22, 28],
        iconAnchor: [11, 27],
      });

      const points: [number, number][] = [];
      let index = 0;
      for (const s of stores) {
        if (s.lat == null || s.lon == null) continue;
        points.push([s.lat, s.lon]);
        const marker = L.marker([s.lat, s.lon], { icon: pin, keyboard: false })
          .bindPopup(`<strong>${escapeHtml(s.name)}</strong><br>${escapeHtml(s.address)}`)
          .addTo(layer);
        // STAGGERED, not all forty at once. `getElement()` only resolves once
        // Leaflet has actually inserted the marker's node, which `.addTo()`
        // above guarantees synchronously for a fresh (non-clustered) marker.
        // Capped so a full 40-result search still finishes settling in under
        // half a second rather than visibly crawling in one at a time.
        const el = marker.getElement();
        if (el && !prefersReducedMotion()) {
          el.style.setProperty("--dmret-pin-delay", `${Math.min(index * 16, 380)}ms`);
        }
        index += 1;
      }
      if (points.length > 0) {
        const reduced = prefersReducedMotion();
        map.flyToBounds(points as unknown as L.LatLngBoundsExpression, {
          padding: [32, 32],
          maxZoom: 14,
          duration: reduced ? 0 : FLY_DURATION_S,
          animate: !reduced,
        });
      }
    });
  }, [stores]);

  return <div ref={elRef} className="dmret__livemap" aria-hidden />;
}

// Popup content is built from OUR OWN API response (USDA-sourced retailer
// names/addresses passed through our route), not user input — but it is text
// going into innerHTML via Leaflet's bindPopup, so it is escaped anyway rather
// than trusted because the current source happens to be safe.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
