// State-level SNAP policy config. Encodes the policy axes that vary by
// state: BBCE threshold + FPL basis, asset waiver, SUA tier values,
// RMP operation, drug-felony state option, ABAWD waiver availability,
// max-allotment tier (48 contiguous vs AK).
//
// Sources (per-state, by policy axis — kept distinct because BBCE and SUA
// are issued in separate documents):
//
//   CA:
//     BBCE  — CDSS ACIN I-46-25 (FFY 2026 income limits); Santa Clara
//             County DEBS chart book.
//     SUA   — CDSS ACL 25-68 (FY26 SUA chart). NOTE: ACINs are
//             informational; ACLs are policy-binding. SUA values MUST
//             cite the ACL, not the ACIN.
//     RMP   — county-elected, not statewide. Currently operates in LA,
//             San Diego, Riverside, San Mateo, Santa Clara, San Francisco,
//             Orange, Sacramento (et al.). `rmp_operated: true` here is
//             coarse; per-county gating is a TODO.
//     ABAWD — FNS-approved area waiver list pending load. Verdicts in
//             ABAWD-affected counties are unsafe until loaded.
//     Mirror: Civica/Features/SNAP/SNAPRules/snap_eligibility_ca.json
//             (production iOS profile; source_citations block).
//
//   MA:
//     BBCE  — DTA 106 CMR 364.976 (calendar-2026 HHS FPL basis,
//             effective 2026-02-01).
//     SUA   — DTA 106 CMR 364.945 (FY26 SUA chart). Bay State CAP
//             recipients use the heating_cooling tier (handled by
//             upstream fixture authoring; not yet enforced here).
//     RMP   — Massachusetts does not operate a Restaurant Meals Program.
//     ABAWD — FNS-approved area waiver list pending load (TODO before MA
//             pilot ships ABAWD-affected verdicts).
//     Mirror: Civica/Features/SNAP/SNAPRules/snap_eligibility_ma.json
//             (production iOS profile; source_citations block).
//
//   Federal (referenced by both states, defined in federal-tables.ts):
//     FY26 COLA values — USDA FNS COLA, Aug 2025 publication.
//     FPL tables       — HHS Federal Register, Jan 2025.
//     OBBBA            — P.L. 119-21 (§10102, §10103, §10104, §10108).
//
// Signoff status: docs/SNAP-source-citation-signoff.md is the canonical
// engineering deliverable. CA rows 13-18 + MA rows 1-4 are pending
// reviewer signoff. Engine ships with citations engineering picked;
// they are NOT yet legal-policy-reviewed.
//
// Other states (TX/KS/AK) are policy archetypes used by the fixture; their
// SUA values are illustrative until the FNS-published values are loaded.

import { Decimal } from "../decimal.ts";

export type BBCEFPLBasis = "federal_fiscal_year" | "calendar_year" | null;
export type AllotmentTier = "48" | "AK";

export interface StatePolicy {
  state_code: string;
  label: string;
  bbce: boolean;
  bbce_threshold_pct?: number;
  bbce_fpl_basis: BBCEFPLBasis;
  asset_waiver: boolean;
  /** Per-tier SUA values; null = not authored, callers MUST NOT trust. */
  sua_by_tier: { HCSUA: Decimal; LUA: Decimal; phone: Decimal; none: Decimal } | null;
  allotment_tier: AllotmentTier;
  drug_felony_ban: boolean;
  abawd_waiver_avail: boolean;
  rmp_operated: boolean;
}

const STATES: Record<string, StatePolicy> = {
  CA: {
    state_code: "CA",
    label: "California / LA County",
    bbce: true,
    bbce_threshold_pct: 200,
    bbce_fpl_basis: "federal_fiscal_year",
    asset_waiver: true,
    sua_by_tier: {
      HCSUA: new Decimal("663"),
      LUA: new Decimal("170"),
      phone: new Decimal("20"),
      none: new Decimal("0"),
    },
    allotment_tier: "48",
    drug_felony_ban: false,
    abawd_waiver_avail: true,
    rmp_operated: true,
  },
  MA: {
    state_code: "MA",
    label: "Massachusetts / DTA",
    bbce: true,
    bbce_threshold_pct: 200,
    bbce_fpl_basis: "calendar_year",
    asset_waiver: true,
    sua_by_tier: {
      HCSUA: new Decimal("914"),
      LUA: new Decimal("556"),
      phone: new Decimal("64"),
      none: new Decimal("0"),
    },
    allotment_tier: "48",
    drug_felony_ban: false,
    abawd_waiver_avail: true,
    rmp_operated: false,
  },
  TX: {
    state_code: "TX",
    label: "BBCE-165 archetype (e.g. TX)",
    bbce: true,
    bbce_threshold_pct: 165,
    bbce_fpl_basis: "federal_fiscal_year",
    asset_waiver: true,
    sua_by_tier: null,
    allotment_tier: "48",
    drug_felony_ban: true,
    abawd_waiver_avail: false,
    rmp_operated: false,
  },
  KS: {
    state_code: "KS",
    label: "Non-BBCE archetype (e.g. KS)",
    bbce: false,
    bbce_fpl_basis: null,
    asset_waiver: false,
    sua_by_tier: null,
    allotment_tier: "48",
    drug_felony_ban: false,
    abawd_waiver_avail: false,
    rmp_operated: false,
  },
  AK: {
    state_code: "AK",
    label: "Alaska (non-BBCE, higher allotments)",
    bbce: false,
    bbce_fpl_basis: null,
    asset_waiver: false,
    sua_by_tier: null,
    allotment_tier: "AK",
    drug_felony_ban: false,
    abawd_waiver_avail: true,
    rmp_operated: false,
  },
};

export class UnknownStateError extends Error {
  constructor(state: string) {
    super(`No StatePolicy loaded for state ${state}. Add it before running determinations.`);
  }
}

export function statePolicyFor(state: string): StatePolicy {
  const p = STATES[state];
  if (!p) throw new UnknownStateError(state);
  return p;
}
