// Generates lib/us-states-geo.json — real US state boundaries in WGS84
// (plain lng/lat), for the live Leaflet map. A SIBLING artifact to
// gen-us-map.mjs, not a replacement: that script projects the same source
// topology through geoAlbersUsa into flat SVG path data for the static
// illustration used elsewhere. Leaflet needs the opposite — unprojected
// lng/lat rings, so it can apply its own web-mercator projection itself as
// someone pans and zooms. The two outputs cannot share a file.
//
// Run when the boundaries need regenerating, NOT on every build:
//   pnpm --filter civica-web add -D us-atlas topojson-client
//   node scripts/gen-us-states-geo.mjs
//   pnpm --filter civica-web remove us-atlas topojson-client
//
// Same pattern as the self-hosted fonts and the Albers path data: the tooling
// produces a committed artifact and is then removed, so the running app needs
// nothing but the repo and the browser ships no topology-conversion library.

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const topo = require("us-atlas/states-10m.json");

// Same FIPS→USPS table as gen-us-map.mjs, deliberately duplicated rather than
// imported: this script's whole job is to be run once, by hand, then have its
// only dependencies removed — importing from a file that survives would
// couple two artifacts that are allowed to regenerate on different days.
const CODE_BY_NAME = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL",
  Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA",
  Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI",
  Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT",
  Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
  "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR",
  Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};

const states = feature(topo, topo.objects.states);

// Round to 3 decimal places (~110m at this latitude) — plenty for a state
// choropleth someone can zoom into a city, and it roughly halves the file
// against the topology's native precision. No projection step, unlike
// gen-us-map.mjs: these coordinates are used exactly as the Census Bureau
// published them.
function round(coords) {
  if (typeof coords[0] === "number") return coords.map((n) => Math.round(n * 1000) / 1000);
  return coords.map(round);
}

const features = [];
const skipped = [];
for (const f of states.features) {
  const code = CODE_BY_NAME[f.properties.name];
  if (!code) {
    // Territories are in the topology; the live map does not attempt them —
    // same boundary as the static illustration, and for the same reason: they
    // have their own place in the picker and the NAP hand-off.
    skipped.push(f.properties.name);
    continue;
  }
  features.push({
    type: "Feature",
    properties: { code, name: f.properties.name },
    geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
  });
}

const geojson = { type: "FeatureCollection", features };
writeFileSync(
  new URL("../lib/us-states-geo.json", import.meta.url),
  JSON.stringify(geojson),
);
console.log(`wrote ${features.length} state boundaries; skipped: ${skipped.join(", ") || "none"}`);
