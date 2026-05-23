// Public county-demo exposure estimates — 3 curated counties for the B2G pitch.
//
// This file is deliberately separate from countyExposure.ts, which owns the
// full 58-county dataset (with sparkline data) used by the internal CDSS
// leaderboard. The county-demo public route (/county-demo/[county]) only
// needs a lightweight slice: curated counties, clean methodology disclosure,
// no sparkline time-series.
//
// Methodology (disclosed in CountyExposurePanel):
//   caseload_share  — CDSS DSS-8202 public report, county % of CA CalFresh caseload.
//   estimated_exposure_dollars — caseload_share × $510M state cumulative FY2026–28
//     penalty exposure. Proxy: assumes county PER tracks state PER proportionally.
//     Real per-county PER requires FNS QC data (FOIA pending — see TODO-22).
//   age_gap_estimate — caseload_share × 325K (midpoint of ACS 5-yr 18–54 proxy
//     for residents newly in §10102 ABAWD scope).
//
// To add a county: extend DEMO_RAW, no other changes needed.
// Do NOT import this from CountyLeaderboard or any internal dashboard component —
// that component owns countyExposure.ts for a reason.

export type CountyDemoData = {
  slug: string;               // URL slug, lowercase hyphenated
  displayName: string;        // e.g. "Los Angeles County"
  fipsCode: string;           // 5-digit FIPS
  caseloadShare: number;      // 0.0–1.0
  caseloadSharePctLabel: string;
  estimatedExposureDollars: number;
  estimatedExposureLabel: string;
  ageGapEstimate: number;
  ageGapLabel: string;
  notableContext: string;     // one-line context for the county header
};

const STATE_PENALTY_EXPOSURE_DOLLARS = 510_000_000;
const STATEWIDE_NEWLY_IN_SCOPE_ESTIMATE = 325_000; // midpoint of 250K–400K range

type RawEntry = Pick<CountyDemoData, "slug" | "displayName" | "fipsCode" | "caseloadShare" | "notableContext">;

const DEMO_RAW: RawEntry[] = [
  {
    slug: "los-angeles",
    displayName: "Los Angeles County",
    fipsCode: "06037",
    caseloadShare: 0.33,
    notableContext:
      "Largest CalFresh caseload in CA (~2M recipients); highest absolute §10102 exposure. Homeless population makes the removed homeless exemption the most acute.",
  },
  {
    slug: "alameda",
    displayName: "Alameda County",
    fipsCode: "06001",
    caseloadShare: 0.03,
    notableContext:
      "Mid-size, progressive but compliance-oriented; historically receptive to tech procurement.",
  },
  {
    slug: "sacramento",
    displayName: "Sacramento County",
    fipsCode: "06067",
    caseloadShare: 0.05,
    notableContext:
      "State capital relationship; CDSS proximity means tool adoption gets visibility at the state level.",
  },
];

function formatDollarsShort(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function formatCountShort(n: number): string {
  if (n >= 1_000) return `~${(n / 1_000).toFixed(0)},000`;
  return `~${n}`;
}

const ENRICHED: Record<string, CountyDemoData> = Object.fromEntries(
  DEMO_RAW.map((c) => {
    const estDollars = Math.round(c.caseloadShare * STATE_PENALTY_EXPOSURE_DOLLARS);
    const ageGap = Math.round(c.caseloadShare * STATEWIDE_NEWLY_IN_SCOPE_ESTIMATE);
    return [
      c.slug,
      {
        ...c,
        caseloadSharePctLabel: `~${Math.round(c.caseloadShare * 100)}%`,
        estimatedExposureDollars: estDollars,
        estimatedExposureLabel: formatDollarsShort(estDollars),
        ageGapEstimate: ageGap,
        ageGapLabel: formatCountShort(ageGap),
      } satisfies CountyDemoData,
    ];
  }),
);

export function getCountyDemoData(slug: string | null | undefined): CountyDemoData | null {
  if (!slug) return null;
  return ENRICHED[slug.trim().toLowerCase()] ?? null;
}

export function listDemoCounties(): CountyDemoData[] {
  return Object.values(ENRICHED);
}

// Statewide context constants — used in CountyExposurePanel methodology block.
export const STATE_PER_PCT = 10.8;
export const STATE_PENALTY_THRESHOLD_PCT = 9.03;
export const STATE_PENALTY_EXPOSURE = STATE_PENALTY_EXPOSURE_DOLLARS;
