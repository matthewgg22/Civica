// CA county-level CF-18 procedural churn (FY2024-25) joined with USDA SNAP-
// authorized retailer counts — powers the /findings/retention choropleth.
// Derived from data-ops/sample/cdss-cf18/cf18_churn_by_county.json (recert/SAR-7
// benefit-loss rates) + the vendored USDA SNAP Retailer Locator CA slice
// (data-ops/sample/usda-snap-retailers-ca, 30,357 rows, grouped by County).
// Counties below the CF-18 volume threshold (≥6,000 scheduled recerts) are
// omitted and render gray on the map. retailers = raw store COUNT (footprint),
// not per-capita density — a food-access layer needs county population (TODO).

export type CountyChurn = {
  /** Title-case county name; joins to the us-atlas topojson `properties.name`. */
  county: string;
  /** Recertification benefit-loss rate, % (the choropleth metric). */
  rrr: number;
  /** Semi-annual-report benefit-loss rate, %. */
  sar7: number;
  /** SNAP-authorized retailer count in the county (USDA). */
  retailers: number;
};

export const CF18_COUNTY_MAP: {
  fiscalYear: string;
  findingId: string;
  worst: { county: string; rrr: number };
  best: { county: string; rrr: number };
  byCounty: CountyChurn[];
} = {
  fiscalYear: "FY2024-25",
  findingId: "2026-05-29-cdss-cf18-churn",
  worst: { county: "Yuba", rrr: 10.6 },
  best: { county: "Riverside", rrr: 1.3 },
  byCounty: [
    { county: "Alameda", rrr: 3.2, sar7: 7.4, retailers: 1057 },
    { county: "Butte", rrr: 4.7, sar7: 10.0, retailers: 206 },
    { county: "Contra Costa", rrr: 2.4, sar7: 5.4, retailers: 717 },
    { county: "Fresno", rrr: 5.1, sar7: 8.9, retailers: 1000 },
    { county: "Humboldt", rrr: 3.0, sar7: 2.9, retailers: 162 },
    { county: "Imperial", rrr: 4.8, sar7: 7.2, retailers: 162 },
    { county: "Kern", rrr: 5.3, sar7: 9.7, retailers: 918 },
    { county: "Kings", rrr: 1.4, sar7: 7.0, retailers: 129 },
    { county: "Lake", rrr: 6.4, sar7: 6.4, retailers: 73 },
    { county: "Los Angeles", rrr: 5.9, sar7: 10.8, retailers: 8192 },
    { county: "Madera", rrr: 2.1, sar7: 5.0, retailers: 181 },
    { county: "Marin", rrr: 2.9, sar7: 7.0, retailers: 126 },
    { county: "Mendocino", rrr: 4.1, sar7: 7.4, retailers: 107 },
    { county: "Merced", rrr: 5.2, sar7: 7.5, retailers: 291 },
    { county: "Monterey", rrr: 2.3, sar7: 6.7, retailers: 332 },
    { county: "Orange", rrr: 5.9, sar7: 8.7, retailers: 2087 },
    { county: "Placer", rrr: 5.2, sar7: 7.5, retailers: 250 },
    { county: "Riverside", rrr: 1.3, sar7: 4.5, retailers: 1823 },
    { county: "Sacramento", rrr: 4.4, sar7: 8.9, retailers: 1310 },
    { county: "San Bernardino", rrr: 6.9, sar7: 7.3, retailers: 1984 },
    { county: "San Diego", rrr: 4.3, sar7: 7.9, retailers: 2286 },
    { county: "San Francisco", rrr: 9.9, sar7: 7.9, retailers: 584 },
    { county: "San Joaquin", rrr: 7.7, sar7: 10.2, retailers: 695 },
    { county: "San Luis Obispo", rrr: 6.6, sar7: 10.5, retailers: 205 },
    { county: "San Mateo", rrr: 3.2, sar7: 10.8, retailers: 336 },
    { county: "Santa Barbara", rrr: 4.1, sar7: 5.3, retailers: 320 },
    { county: "Santa Clara", rrr: 1.5, sar7: 1.9, retailers: 919 },
    { county: "Santa Cruz", rrr: 7.3, sar7: 10.7, retailers: 179 },
    { county: "Shasta", rrr: 5.6, sar7: 15.8, retailers: 195 },
    { county: "Solano", rrr: 2.5, sar7: 3.5, retailers: 309 },
    { county: "Sonoma", rrr: 5.5, sar7: 7.7, retailers: 383 },
    { county: "Stanislaus", rrr: 7.7, sar7: 8.3, retailers: 590 },
    { county: "Tulare", rrr: 7.7, sar7: 8.2, retailers: 474 },
    { county: "Ventura", rrr: 8.2, sar7: 12.2, retailers: 607 },
    { county: "Yolo", rrr: 6.8, sar7: 9.4, retailers: 172 },
    { county: "Yuba", rrr: 10.6, sar7: 11.5, retailers: 89 },
  ],
};
