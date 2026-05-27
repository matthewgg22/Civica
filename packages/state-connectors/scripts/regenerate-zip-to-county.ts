#!/usr/bin/env tsx
// Regenerate src/fips/data/zip-to-county.json from a HUD ZIP_COUNTY crosswalk CSV.
//
// Usage:
//   pnpm --filter @civica/state-connectors regenerate:zip-to-county -- \
//     --input ./tmp/ZIP_COUNTY_122024.csv \
//     --output src/fips/data/zip-to-county.json \
//     --states 06,25 \
//     --vintage 2024Q4
//
// Downloads ad-hoc: HUD distributes the crosswalk at
//   https://www.huduser.gov/portal/datasets/usps_crosswalk.html
// Pick the ZIP_COUNTY table for the latest quarter; the CSV columns are:
//   ZIP, COUNTY, USPS_ZIP_PREF_CITY, USPS_ZIP_PREF_STATE,
//   RES_RATIO, BUS_RATIO, OTH_RATIO, TOT_RATIO
// where COUNTY is the 5-digit county FIPS and RES_RATIO is the residential
// share of that ZIP in that county. The script picks the dominant county
// per ZIP (max RES_RATIO) and writes the same JSON shape resolver.ts reads.
//
// Strict county-name authority: this script ships with a hand-curated CA + MA
// county-name table (the only states we serve today). If the HUD CSV ever
// references a FIPS code outside that table, we abort rather than guess the
// name — accidental drift in a county name silently breaks downstream
// agency-directory joins.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { argv, cwd, exit, stderr } from "node:process";

// ---------------------------------------------------------------------------
// CA + MA canonical county-FIPS → county-name authority.
// ---------------------------------------------------------------------------

const COUNTY_NAMES: Record<string, string> = {
  // California — all 58 counties.
  "06001": "Alameda County",
  "06003": "Alpine County",
  "06005": "Amador County",
  "06007": "Butte County",
  "06009": "Calaveras County",
  "06011": "Colusa County",
  "06013": "Contra Costa County",
  "06015": "Del Norte County",
  "06017": "El Dorado County",
  "06019": "Fresno County",
  "06021": "Glenn County",
  "06023": "Humboldt County",
  "06025": "Imperial County",
  "06027": "Inyo County",
  "06029": "Kern County",
  "06031": "Kings County",
  "06033": "Lake County",
  "06035": "Lassen County",
  "06037": "Los Angeles County",
  "06039": "Madera County",
  "06041": "Marin County",
  "06043": "Mariposa County",
  "06045": "Mendocino County",
  "06047": "Merced County",
  "06049": "Modoc County",
  "06051": "Mono County",
  "06053": "Monterey County",
  "06055": "Napa County",
  "06057": "Nevada County",
  "06059": "Orange County",
  "06061": "Placer County",
  "06063": "Plumas County",
  "06065": "Riverside County",
  "06067": "Sacramento County",
  "06069": "San Benito County",
  "06071": "San Bernardino County",
  "06073": "San Diego County",
  "06075": "San Francisco County",
  "06077": "San Joaquin County",
  "06079": "San Luis Obispo County",
  "06081": "San Mateo County",
  "06083": "Santa Barbara County",
  "06085": "Santa Clara County",
  "06087": "Santa Cruz County",
  "06089": "Shasta County",
  "06091": "Sierra County",
  "06093": "Siskiyou County",
  "06095": "Solano County",
  "06097": "Sonoma County",
  "06099": "Stanislaus County",
  "06101": "Sutter County",
  "06103": "Tehama County",
  "06105": "Trinity County",
  "06107": "Tulare County",
  "06109": "Tuolumne County",
  "06111": "Ventura County",
  "06113": "Yolo County",
  "06115": "Yuba County",
  // Massachusetts — all 14 counties.
  "25001": "Barnstable County",
  "25003": "Berkshire County",
  "25005": "Bristol County",
  "25007": "Dukes County",
  "25009": "Essex County",
  "25011": "Franklin County",
  "25013": "Hampden County",
  "25015": "Hampshire County",
  "25017": "Middlesex County",
  "25019": "Nantucket County",
  "25021": "Norfolk County",
  "25023": "Plymouth County",
  "25025": "Suffolk County",
  "25027": "Worcester County",
};

// ---------------------------------------------------------------------------
// CLI parsing — minimal, no external dep.
// ---------------------------------------------------------------------------

interface Args {
  input: string;
  output: string;
  states: string[];
  vintage: string;
}

function parseArgs(rawArgs: string[]): Args {
  const args: Partial<Args> = { states: ["06", "25"], vintage: "2024Q4" };
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]!;
    if (arg === "--input" || arg === "-i") args.input = rawArgs[++i];
    else if (arg === "--output" || arg === "-o") args.output = rawArgs[++i];
    else if (arg === "--states") args.states = rawArgs[++i]!.split(",").map((s) => s.trim());
    else if (arg === "--vintage") args.vintage = rawArgs[++i];
    else if (arg === "--help" || arg === "-h") {
      printUsage();
      exit(0);
    }
  }
  if (!args.input) {
    stderr.write("Missing --input <path-to-HUD-CSV>\n");
    printUsage();
    exit(2);
  }
  if (!args.output) {
    stderr.write("Missing --output <path-to-json>\n");
    printUsage();
    exit(2);
  }
  return args as Args;
}

function printUsage(): void {
  stderr.write(
    [
      "regenerate-zip-to-county — rebuild zip-to-county.json from HUD's ZIP_COUNTY crosswalk.",
      "",
      "  --input,   -i  <path>     HUD ZIP_COUNTY CSV (required)",
      "  --output,  -o  <path>     JSON destination (required)",
      "  --states       <fips,…>   2-digit state FIPS filter (default: 06,25)",
      "  --vintage      <label>    Vintage tag written to _meta (default: 2024Q4)",
      "",
    ].join("\n"),
  );
}

// ---------------------------------------------------------------------------
// CSV parser — handles HUD's plain-CSV (no quoted fields with commas in the
// columns we care about) without pulling a parser dep.
// ---------------------------------------------------------------------------

interface HudRow {
  zip: string;
  county_fips: string;
  res_ratio: number;
}

export function parseHudCsv(csv: string): HudRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0]!.toUpperCase().split(",").map((c) => c.replace(/^"|"$/g, "").trim());
  const idxZip = header.indexOf("ZIP");
  const idxCounty = header.indexOf("COUNTY");
  const idxRes = header.indexOf("RES_RATIO");
  if (idxZip < 0 || idxCounty < 0 || idxRes < 0) {
    throw new Error(
      `HUD CSV missing required columns (ZIP, COUNTY, RES_RATIO). Got: ${header.join(",")}`,
    );
  }
  const rows: HudRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
    const zip = cols[idxZip]?.padStart(5, "0");
    const county = cols[idxCounty]?.padStart(5, "0");
    const res = Number(cols[idxRes]);
    if (!zip || zip.length !== 5) continue;
    if (!county || county.length !== 5) continue;
    if (!Number.isFinite(res)) continue;
    rows.push({ zip, county_fips: county, res_ratio: res });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Build the JSON map: filter by state, group by ZIP, keep max-RES_RATIO row.
// ---------------------------------------------------------------------------

export interface ZipEntry {
  fips: string;
  county_name: string;
}

export interface DominantPickResult {
  entries: Record<string, ZipEntry>;
  unknownFips: string[]; // FIPS encountered but not in COUNTY_NAMES (excluded from output)
}

export function pickDominantCounty(
  rows: HudRow[],
  stateFips: string[],
): DominantPickResult {
  const states = new Set(stateFips);
  const winnersByZip = new Map<string, HudRow>();
  for (const row of rows) {
    if (!states.has(row.county_fips.slice(0, 2))) continue;
    const cur = winnersByZip.get(row.zip);
    if (!cur || row.res_ratio > cur.res_ratio) {
      winnersByZip.set(row.zip, row);
    }
  }

  const entries: Record<string, ZipEntry> = {};
  const unknownFips = new Set<string>();
  // Insert in sorted-ZIP order for stable JSON diffs.
  const zips = [...winnersByZip.keys()].sort();
  for (const zip of zips) {
    const winner = winnersByZip.get(zip)!;
    const name = COUNTY_NAMES[winner.county_fips];
    if (!name) {
      unknownFips.add(winner.county_fips);
      continue;
    }
    entries[zip] = { fips: winner.county_fips, county_name: name };
  }

  return { entries, unknownFips: [...unknownFips].sort() };
}

// ---------------------------------------------------------------------------
// Output assembly — preserves the resolver-readable shape.
// ---------------------------------------------------------------------------

export interface BuildOutputInput {
  entries: Record<string, ZipEntry>;
  states: string[];
  vintage: string;
}

export function buildOutputJson({ entries, states, vintage }: BuildOutputInput): string {
  const meta = {
    note:
      "Full HUD ZIP_COUNTY crosswalk filtered to launch-state FIPS. " +
      "Regenerate via scripts/regenerate-zip-to-county.ts — see SOURCES.md.",
    vintage,
    states: stateFipsToCodes(states),
    coverage_model: "full-hud-crosswalk",
    ca_counties_covered: countCountiesInState(entries, "06"),
    ma_counties_covered: countCountiesInState(entries, "25"),
    zip_count: Object.keys(entries).length,
  };

  // Hand-format so sorted-ZIP order survives. JSON.stringify would otherwise
  // float integer-indexed keys ("90015") above leading-zero keys ("02115")
  // because V8 treats the former as array indices in iteration order. The
  // resolver doesn't care (it does key lookups, not iteration), but file
  // diffs do.
  const sortedZips = Object.keys(entries).sort();
  const metaJson = JSON.stringify(meta, null, 2)
    .split("\n")
    .map((line, i) => (i === 0 ? line : `  ${line}`))
    .join("\n");
  const entryLines = sortedZips.map(
    (zip) => `  "${zip}": ${JSON.stringify(entries[zip])}`,
  );
  return `{\n  "_meta": ${metaJson},\n\n${entryLines.join(",\n")}\n}\n`;
}

function stateFipsToCodes(fipsList: string[]): string[] {
  const map: Record<string, string> = { "06": "CA", "25": "MA" };
  return fipsList.map((f) => map[f] ?? f);
}

function countCountiesInState(entries: Record<string, ZipEntry>, stateFips: string): number {
  const counties = new Set<string>();
  for (const e of Object.values(entries)) {
    if (e.fips.startsWith(stateFips)) counties.add(e.fips);
  }
  return counties.size;
}

// ---------------------------------------------------------------------------
// Main — only runs when invoked as a script.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(argv.slice(2));
  const inputPath = resolve(cwd(), args.input);
  const outputPath = resolve(cwd(), args.output);

  const csv = await readFile(inputPath, "utf8");
  const rows = parseHudCsv(csv);
  const { entries, unknownFips } = pickDominantCounty(rows, args.states);

  if (unknownFips.length > 0) {
    stderr.write(
      `Warning: ${unknownFips.length} county FIPS codes encountered without a name mapping ` +
        `(excluded from output): ${unknownFips.join(", ")}\n` +
        "Add them to COUNTY_NAMES in this script before they reach production.\n",
    );
  }

  const json = buildOutputJson({
    entries,
    states: args.states,
    vintage: args.vintage,
  });
  await writeFile(outputPath, json, "utf8");
  stderr.write(
    `Wrote ${Object.keys(entries).length} ZIP entries (states=${args.states.join(",")}, ` +
      `vintage=${args.vintage}) → ${outputPath}\n`,
  );
}

// import.meta.url-based entry guard so the file is importable from tests
// without triggering main().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isMainModule = import.meta.url === `file://${(globalThis as any).process?.argv?.[1]}`;
if (isMainModule) {
  main().catch((err: unknown) => {
    stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    exit(1);
  });
}
