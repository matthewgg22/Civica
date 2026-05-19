#!/usr/bin/env tsx
/**
 * generate-sample-analytics-data.ts
 *
 * Deterministic generator for the demo / sample analytics dataset that backs
 * `ANALYTICS_USE_SAMPLE_DATA=true`. Emits realistic-shape but FULLY FABRICATED
 * inputs the existing data-ops parsers can consume:
 *
 *   data-ops/sample/per/2024_payment_error_rates.csv
 *   data-ops/sample/per/2023_payment_error_rates.csv
 *   data-ops/sample/obbba-scenarios/obbba_rollup.json
 *
 * Idempotent — re-running produces byte-identical files. RNG is seeded off
 * each state's USPS code so values are stable across runs and machines.
 *
 * Run:
 *   pnpm data:build:sample            # CSV/JSON + Parquet build
 *   tsx scripts/generate-sample-analytics-data.ts   # CSV/JSON only
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

function defaultRoot(): string {
  return process.cwd();
}
function sampleRoot(root: string): string {
  return join(root, "data-ops", "sample");
}

// 50 states + DC + PR + GU = 53 rows.
const JURISDICTIONS: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
  { code: "PR", name: "Puerto Rico" },
  { code: "GU", name: "Guam" },
];

/**
 * Deterministic seeded RNG. Returns a function that yields [0, 1).
 * Seeded off the SHA-256 of an arbitrary string label so we can keep
 * separate streams per state per year without cross-pollution.
 */
function seededRng(label: string): () => number {
  const hash = createHash("sha256").update(label).digest();
  let s0 = hash.readUInt32BE(0) >>> 0;
  let s1 = hash.readUInt32BE(4) >>> 0;
  let s2 = hash.readUInt32BE(8) >>> 0;
  let s3 = hash.readUInt32BE(12) >>> 0;
  // xoshiro128** — high quality, tiny, deterministic.
  return () => {
    const result = ((Math.imul(s1, 5) >>> 0) << 7) | (Math.imul(s1, 5) >>> 25);
    const r = (Math.imul(result, 9) >>> 0) / 0x1_0000_0000;
    const t = (s1 << 9) >>> 0;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = ((s3 << 11) | (s3 >>> 21)) >>> 0;
    return r;
  };
}

interface PerRow {
  state_code: string;
  state_name: string;
  fiscal_year: number;
  per_total: number;
  per_overpayment: number;
  per_underpayment: number;
}

/**
 * Generate one PER row. CA is explicitly pinned (matches the §10105
 * methodology in the design doc); every other jurisdiction draws from a
 * realistic range (4.5% – 12.5%) via the seeded stream.
 *
 * FY-to-FY: the seeded label keys off (code, fy), so values are stable
 * across runs. Per-state FY23→FY24 movement stays bounded by sharing the
 * underpayment/overpayment split heuristic, giving plausible (not random)
 * trends.
 */
function perRowFor(jur: { code: string; name: string }, fy: number): PerRow {
  const pinned: Record<string, Record<number, number>> = {
    CA: { 2023: 9.85, 2024: 10.98 },
  };
  let perTotal: number;
  if (pinned[jur.code]?.[fy] !== undefined) {
    perTotal = pinned[jur.code][fy]!;
  } else {
    const rng = seededRng(`per::${jur.code}::${fy}`);
    // 4.5% – 12.5% realistic spread.
    perTotal = round2(4.5 + rng() * 8.0);
  }
  // Overpayment is 60–80% of the total; remainder is underpayment.
  const splitRng = seededRng(`per-split::${jur.code}::${fy}`);
  const overShare = 0.6 + splitRng() * 0.2;
  const perOver = round2(perTotal * overShare);
  const perUnder = round2(perTotal - perOver);
  return {
    state_code: jur.code,
    state_name: jur.name,
    fiscal_year: fy,
    per_total: perTotal,
    per_overpayment: perOver,
    per_underpayment: perUnder,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toCsv(rows: PerRow[]): string {
  const header =
    "state_code,state_name,fiscal_year,per_total,per_overpayment,per_underpayment\n";
  const body = rows
    .map(
      (r) =>
        `${r.state_code},${r.state_name},${r.fiscal_year},` +
        `${r.per_total.toFixed(2)},${r.per_overpayment.toFixed(2)},` +
        `${r.per_underpayment.toFixed(2)}`,
    )
    .join("\n");
  return `${header}${body}\n`;
}

// ---------------------------------------------------------------------------
// OBBBA scenario rollup
// ---------------------------------------------------------------------------

interface ScenarioPoint {
  scenario:
    | "current_law"
    | "obbba_full"
    | "obbba_with_bbce_removal"
    | "obbba_with_bbce_removal_and_lpie";
  metric: string;
  value: number;
  narrative?: string;
}

/**
 * 4 scenarios × 5 metrics = 20 rows.
 *
 * `current_law` is the no-OBBBA-yet baseline (zero CA liability). The three
 * OBBBA flavors escalate progressively:
 *   - obbba_full: statutory baseline OBBBA implementation
 *   - obbba_with_bbce_removal: additionally removes broad-based categorical
 *     eligibility, lifting PER + admin-cost shift
 *   - obbba_with_bbce_removal_and_lpie: above + low-PER index exception
 *     applied, which actually softens the state liability a touch
 *
 * Numbers are plausible-but-fabricated. The "real" model lives off-repo.
 */
function obbbaRollup(): ScenarioPoint[] {
  const metrics: ScenarioPoint[] = [];

  // Metric 1: CA FY28 state liability (USD, not billions — raw dollars).
  metrics.push(
    { scenario: "current_law", metric: "ca_fy28_state_liability_usd", value: 0 },
    {
      scenario: "obbba_full",
      metric: "ca_fy28_state_liability_usd",
      value: 1_720_000_000,
      narrative: "OBBBA §10105 cost-share triggered by CA's FY24 PER of 10.98%.",
    },
    {
      scenario: "obbba_with_bbce_removal",
      metric: "ca_fy28_state_liability_usd",
      value: 2_140_000_000,
      narrative: "BBCE removal lifts caseload churn → PER drift → larger liability.",
    },
    {
      scenario: "obbba_with_bbce_removal_and_lpie",
      metric: "ca_fy28_state_liability_usd",
      value: 1_980_000_000,
      narrative: "LPIE softens the BBCE-removal liability lift by ~$160M.",
    },
  );

  // Metric 2: CA FY28 estimated PER (percent).
  metrics.push(
    { scenario: "current_law", metric: "ca_fy28_estimated_per_pct", value: 9.85 },
    { scenario: "obbba_full", metric: "ca_fy28_estimated_per_pct", value: 10.98 },
    {
      scenario: "obbba_with_bbce_removal",
      metric: "ca_fy28_estimated_per_pct",
      value: 12.4,
    },
    {
      scenario: "obbba_with_bbce_removal_and_lpie",
      metric: "ca_fy28_estimated_per_pct",
      value: 11.6,
    },
  );

  // Metric 3: National FY28 admin cost shift (USD).
  metrics.push(
    {
      scenario: "current_law",
      metric: "national_fy28_admin_cost_shift_usd",
      value: 0,
    },
    {
      scenario: "obbba_full",
      metric: "national_fy28_admin_cost_shift_usd",
      value: 4_850_000_000,
    },
    {
      scenario: "obbba_with_bbce_removal",
      metric: "national_fy28_admin_cost_shift_usd",
      value: 6_120_000_000,
    },
    {
      scenario: "obbba_with_bbce_removal_and_lpie",
      metric: "national_fy28_admin_cost_shift_usd",
      value: 5_790_000_000,
    },
  );

  // Metric 4: CA FY28 admin cost shift (USD).
  metrics.push(
    { scenario: "current_law", metric: "ca_fy28_admin_cost_shift_usd", value: 0 },
    {
      scenario: "obbba_full",
      metric: "ca_fy28_admin_cost_shift_usd",
      value: 580_000_000,
    },
    {
      scenario: "obbba_with_bbce_removal",
      metric: "ca_fy28_admin_cost_shift_usd",
      value: 740_000_000,
    },
    {
      scenario: "obbba_with_bbce_removal_and_lpie",
      metric: "ca_fy28_admin_cost_shift_usd",
      value: 690_000_000,
    },
  );

  // Metric 5: CA PER change vs baseline (percentage points).
  metrics.push(
    { scenario: "current_law", metric: "ca_per_change_pct_vs_baseline", value: 0 },
    { scenario: "obbba_full", metric: "ca_per_change_pct_vs_baseline", value: 1.13 },
    {
      scenario: "obbba_with_bbce_removal",
      metric: "ca_per_change_pct_vs_baseline",
      value: 2.55,
    },
    {
      scenario: "obbba_with_bbce_removal_and_lpie",
      metric: "ca_per_change_pct_vs_baseline",
      value: 1.75,
    },
  );

  return metrics;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function writeStable(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function main(opts: { root?: string } = {}): Promise<void> {
  const root = opts.root ?? defaultRoot();
  const SAMPLE_ROOT = sampleRoot(root);

  // PER FY24 + FY23.
  for (const fy of [2024, 2023]) {
    const rows = JURISDICTIONS.map((j) => perRowFor(j, fy));
    const csv = toCsv(rows);
    const outPath = join(SAMPLE_ROOT, "per", `${fy}_payment_error_rates.csv`);
    await writeStable(outPath, csv);
    console.log(`wrote ${outPath} (${rows.length} rows)`);
  }

  // OBBBA scenarios.
  const obbba = {
    model_version: "sample-fixtures-1.0",
    publication_date: "2026-05-19",
    scenarios: obbbaRollup(),
  };
  const obbbaPath = join(SAMPLE_ROOT, "obbba-scenarios", "obbba_rollup.json");
  await writeStable(obbbaPath, `${JSON.stringify(obbba, null, 2)}\n`);
  console.log(`wrote ${obbbaPath} (${obbba.scenarios.length} rows)`);
}

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1] ?? "");
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { JURISDICTIONS, perRowFor, obbbaRollup, toCsv, main as runSampleGenerator };
