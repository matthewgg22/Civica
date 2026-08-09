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
//             County DEBS chart book. Verified live 2026-06-02 at
//             cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACINs/2025/I-46_25.pdf
//     SUA   — CDSS ACL 25-68 (FY26 SUA chart). NOTE: ACINs are
//             informational; ACLs are policy-binding. SUA values MUST
//             cite the ACL, not the ACIN. Verified live 2026-06-02 at
//             cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACLs/2025/25-68.pdf
//     RMP   — STATEWIDE per AB 942 (eff. 2019-10-12). Every CA county
//             must operate RMP; restaurant *availability* still varies
//             but county *participation* is mandatory. `rmp_operated:
//             true` is correct as a state-level boolean.
//             Source: cdss.ca.gov/rmp
//     ABAWD — !!! STALE/INCORRECT as a state-level flag !!!
//             Statewide CA time limits RESUME 2026-06-01 per ACL 25-93.
//             Active waivers (Nov 1 2025 — Oct 31 2026) cover only:
//             Colusa, Imperial, Tulare, Alpine, Merced, Monterey,
//             Plumas (7 of 58 counties). The other 51 are time-limited.
//             `abawd_waiver_avail: true` is the wrong shape — needs a
//             per-county effective-dated waiver list loader before
//             ABAWD verdicts in any non-waived CA county are safe.
//             Sources: ACL 25-79 (waivers), ACL 25-93 (resumption),
//             ACL 26-15 (current extension); calfresh.guide tracker.
//     Mirror: Civica/Features/SNAP/SNAPRules/snap_eligibility_ca.json
//             (production iOS profile; source_citations block).
//
//   MA:
//     BBCE  — DTA 106 CMR 364.976 (calendar-2026 HHS FPL basis,
//             effective 2026-02-01). NOTE: HHS published CY2026 FPL on
//             2026-01-15 (FR Doc 2026-00755) — engine must adopt
//             CY2026 values before MA pilot reads BBCE thresholds
//             after 2026-02-01.
//     SUA   — !!! PENDING DTA PRIMARY-SOURCE VERIFICATION !!!
//             Engine currently encodes HCSUA $914, LUA $556, phone $64
//             with citation DTA 106 CMR 364.945. These were confirmed
//             via Mass Legal Help cross-reference + Justia/LII regulation
//             mirrors in the 2026-06-02 triple-check (mass.gov returned
//             HTTP 403 to direct WebFetch), but the 2026-06-02 audit
//             pass flagged two open questions:
//               1. MA LUA $556 — could not independently confirm vs
//                  DTA's own FY26 SUA/LUA chart. (Note: MA HCSUA $914
//                  is plausible for heating; LUA at $556 means ~60% of
//                  HCSUA, higher than other states' ratios.)
//               2. CMR section: the audit suggests SUA may live at
//                  106 CMR 366.910 (Bay State CAP SUA, which CAP
//                  recipients use) with the broader shelter/utility
//                  framework at 106 CMR 364.400-series. 364.945 may be
//                  the wrong subsection.
//             ACTION: any A02-style MA elderly+SSI benefit math is
//             illustrative until the operator verifies (a) values
//             against DTA's published FY26 chart, and (b) the correct
//             CMR citation against live 106 CMR text. The qualitative
//             lesson "MA utility allowances ≫ CA" is sound; exact $
//             and CMR section are not yet primary-sourced.
//             VERIFICATION ATTEMPTS LOGGED:
//               - 2026-06-02 triple-check: mass.gov 403, Mass Legal
//                 Help cross-reference accepted (value $914/$556/$64)
//               - 2026-06-03 integrity audit Fix #6: re-attempted
//                 mass.gov (403), masslegalhelp.org (403), Cornell
//                 LII 106 CMR (directory only, no section text). All
//                 three primary fetches blocked. PENDING continues.
//             This needs an operator pull from a logged-in DTA
//             portal session or via a browser that defeats the bot
//             detection. Agent fetches will not unblock it.
//             Bay State CAP recipients use a CAP-SPECIFIC SUA per
//             106 CMR 366.910 (separate from the per-state SUA above);
//             engine silently substitutes HCSUA for CAP recipients —
//             miscompute for ~70K MA elderly+SSI cases. Either add a
//             CAP detection branch or route CAP cases to a not-
//             implemented surface.
//     RMP   — Massachusetts does not operate a Restaurant Meals Program.
//     ABAWD — !!! STALE/INCORRECT as a state-level flag !!!
//             MA statewide waiver EXPIRED 2025-06-30 per DTA
//             OLGTM-2025-31. No active geographic waivers in MA as of
//             FY26 (FNS reinstatement litigation ongoing). Engine's
//             `abawd_waiver_avail: true` is wrong for the entire state.
//             Sources: mass.gov/info-details/abawd-waived-areas;
//             MLRI 2025 ABAWD Guide.
//     Mirror: Civica/Features/SNAP/SNAPRules/snap_eligibility_ma.json
//             (production iOS profile; source_citations block).
//
//   Federal (referenced by both states, defined in federal-tables.ts):
//     FY26 COLA values — USDA FNS COLA memo, Aug 2025 (effective
//                        2025-10-01 → 2026-09-30). Verified live at
//                        fns.usda.gov/snap/allotment/cola/fy26.
//     FY27 watch       — FNS typically posts mid-Aug 2026; not posted
//                        as of 2026-06-02.
//     FPL CY2025       — HHS Federal Register Doc 2025-01377
//                        (published 2025-01-17). Basis for FY26 income
//                        limits.
//     FPL CY2026       — HHS FR Doc 2026-00755 (published 2026-01-15,
//                        effective 2026-01-13). Required for MA BBCE
//                        after 2026-02-01 (calendar-year basis).
//     OBBBA            — Pub. L. No. 119-21, enacted 2025-07-04 (139
//                        Stat. 72). Sections referenced by engine:
//                        §10101 (TFP, not yet wired), §10102 (ABAWD
//                        exemption changes — age band 18-64, IHCIA
//                        exemption added, homeless/vet/foster removed),
//                        §10103 (LIHEAP→SUA), §10104 (internet
//                        exclusion — engine cutoff 2025-10-01 per
//                        FY26 effective date; confirmed via
//                        govinfo.gov PLAW-119publ21 + FNS umbrella
//                        memo 2025-09-04; fixed PR #468),
//                        §10105 (PER state match,
//                        used by error-rate engine), §10108 (alien
//                        eligibility).
//     OBBBA memos      — Umbrella memo (2025-09-04); ABAWD exceptions
//                        (2025-10-03); alien eligibility (2025-10-31).
//                        Index: fns.usda.gov/snap/obbb-implementation.
//
// Signoff status: docs/SNAP-source-citation-signoff.md is the canonical
// engineering deliverable. 27 rows (19 original + 8 surfaced 2026-06-02);
// zero reviewer signatures. Engine ships with citations engineering
// picked; they are NOT yet legal-policy-reviewed. Triple-check finding:
// docs/findings/2026-06-02-snap-source-citation-triple-check.md.
//
// Other states (TX/KS/AK) are policy archetypes used by the fixture; their
// SUA values are illustrative until the FNS-published values are loaded.

import { Decimal } from "../decimal";

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
    // DELIBERATELY `true`, and deliberately imprecise. California DOES hold
    // waivers — but only in 7 of 58 counties (Colusa, Imperial, Tulare,
    // Alpine, Merced, Monterey, Plumas; ACL 25-79 + 26-15, through
    // 2026-10-31). Statewide time limits otherwise resumed 2026-06-01
    // (ACL 25-93).
    //
    // A state-level boolean cannot express "7 of 58", so both values are
    // wrong — the question is which way. `true` over-approves the 51
    // time-limited counties; `false` would DENY the 7 genuinely waived ones.
    // Wrongly denying food is the worse error, so we keep the permissive
    // value until Facts carries county_fips and the county waiver list
    // (CA_WAIVER_COUNTY_FIPS, already used by enrollment-api) can be read
    // here. Do not "fix" this to false without that layer.
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
    // MA holds NO geographic ABAWD waiver: the statewide waiver expired
    // 2025-06-30 (DTA OLGTM-2025-31) and none was reinstated for FY26. With
    // the waiver-availability rule now live (#608), this correctly stops an
    // area-based exemption from being honored anywhere in Massachusetts.
    abawd_waiver_avail: false,
    rmp_operated: false,
  },
  TX: {
    state_code: "TX",
    label: "BBCE-165 archetype (e.g. TX)",
    bbce: true,
    bbce_threshold_pct: 165,
    bbce_fpl_basis: "federal_fiscal_year",
    asset_waiver: true,
    // Texas FY26 utility standards — TWH A-1429; 1 TAC §372.410.
    //
    // Texas names its middle tier the BASIC Utility Allowance (BUA), not the
    // federal "Limited" (LUA), but the role is identical: utility costs that
    // don't qualify for the heating/cooling standard. determineSUATier's
    // FULL/LIMITED/TELEPHONE/NONE ladder is state-neutral, so the mapping is
    // SUA→HCSUA, BUA→LUA, telephone→phone.
    //
    // These standards are MANDATORY in Texas — 1 TAC §372.410(6) bars a
    // deduction for actual utility expenses, so a household cannot elect its
    // real bills the way it can in some states.
    //
    // Source: the adversarially verified TX state pack
    // (packages/demeter-engine/src/states/tx/) — refute gate 72 claims, 61
    // confirmed / 11 corrected / 0 fabricated, with live re-fetch preferred
    // over curated extracts. Values are pinned by a cross-check test so the
    // pack and the engine cannot drift apart.
    //
    // EXPIRES 2026-09-30 (October COLA): re-verify A-1429 and C-121 before
    // quoting any Texas dollar amount for FY27.
    sua_by_tier: {
      HCSUA: new Decimal("445"),
      LUA: new Decimal("400"),
      phone: new Decimal("62"),
      none: new Decimal("0"),
    },
    allotment_tier: "48",
    drug_felony_ban: true,
    abawd_waiver_avail: false,
    rmp_operated: false,
  },
  // Washington — Basic Food. State-administered, BBCE 200%, no Standard
  // Medical Deduction, 12-month certifications only, WASHCAP for SSI
  // households.
  //
  // Utility standards: WAC 388-450-0195 as amended by WSR 26-02-071.
  // MANDATORY — "The department uses utility allowances instead of the actual
  // utility costs" the AU pays, so a household cannot elect real bills.
  // NOTE the effective date: Washington codified these in FEBRUARY 2026, NOT
  // on the usual Oct 1 COLA cycle, so the refresh clock differs from every
  // other state in the roster.
  //
  // Source: the adversarially verified WA state pack
  // (packages/demeter-engine/src/states/wa/). Pinned by a parity test.
  WA: {
    state_code: "WA",
    label: "Washington / DSHS — Basic Food",
    bbce: true,
    bbce_threshold_pct: 200,
    bbce_fpl_basis: "federal_fiscal_year",
    asset_waiver: true,
    sua_by_tier: {
      HCSUA: new Decimal("515"),
      LUA: new Decimal("406"),
      phone: new Decimal("58"),
      none: new Decimal("0"),
    },
    allotment_tier: "48",
    drug_felony_ban: false,
    abawd_waiver_avail: true,
    rmp_operated: true,
  },
  // Georgia — the "BBCE is not income relief" case: TCOS categorical
  // eligibility keeps the gross screen at the FEDERAL 130% for regular
  // households (§3210), with a 200% screen only where every adult member is
  // elderly/disabled. bbce_threshold_pct records the screen that binds for a
  // regular household; the all-adult-E/D sub-screen is not yet modelled
  // (coverage framework §5.1).
  //
  // Utility standards: SNAP Manual §3617 (June 2026) — H/C SUA $405,
  // Limited SUA $358, telephone $47. Georgia's LSUA covers cooking fuel,
  // non-heating electricity, one telephone, well/septic and trash.
  //
  // Source: the adversarially verified GA state pack (refute gate: 84 claims,
  // 79 confirmed / 5 corrected / 0 fabricated). Pinned by a parity test.
  GA: {
    state_code: "GA",
    label: "Georgia / DFCS",
    bbce: true,
    bbce_threshold_pct: 130,
    bbce_fpl_basis: "federal_fiscal_year",
    asset_waiver: false,
    sua_by_tier: {
      HCSUA: new Decimal("405"),
      LUA: new Decimal("358"),
      phone: new Decimal("47"),
      none: new Decimal("0"),
    },
    allotment_tier: "48",
    drug_felony_ban: false,
    abawd_waiver_avail: false,
    rmp_operated: false,
  },
  // ── Tranche 1 (docs/plans/state-coverage-framework-2026-08.md) ──────────
  // FL, IL, PA and OH are the four states that, with CA/TX/NY/GA, put >50% of
  // national SNAP issuance behind the engine.
  //
  // SOURCED: bbce / bbce_threshold_pct / asset_waiver come from the FNS
  // Broad-Based Categorical Eligibility States Chart, June 2026
  // (fns.usda.gov/snap/broad-based-categorical-eligibility →
  // BBCE-States-Chart-June2026.pdf), read 2026-08-09. allotment_tier is "48"
  // for all four (contiguous states share the federal table).
  //
  // NOT SOURCED YET — and deliberately left at the permissive value rather
  // than guessed (see #619):
  //   • sua_by_tier: null. Each state publishes utility standards in its own
  //     annual table, NOT in the rule text — Ohio's OAC 5101:4-4-23 defines
  //     the SUA framework and contains no dollar amounts at all. A wrong SUA
  //     miscomputes every shelter deduction, so these stay null and
  //     computeBenefit fails loudly (the #436 invariant) rather than quietly.
  //   • abawd_waiver_avail: true and drug_felony_ban: false are FAIL-OPEN
  //     defaults, not findings. Both err toward eligibility, per the
  //     direction-of-error rule in #608/#614: never deny on unverified data.
  //
  // CAVEAT on the FNS chart: it is corroboration, not the last word — it
  // under-describes Georgia (prints a single 130% row, missing §3210's 200%
  // all-adult elderly/disabled screen). Treat these thresholds as good enough
  // to gate income tests, and confirm against each state's own manual before
  // quoting a figure to a user.
  FL: {
    state_code: "FL",
    label: "Florida / DCF",
    bbce: true,
    bbce_threshold_pct: 200,
    bbce_fpl_basis: "federal_fiscal_year",
    asset_waiver: true,
    sua_by_tier: null,
    allotment_tier: "48",
    drug_felony_ban: false,
    abawd_waiver_avail: true,
    rmp_operated: false,
  },
  // Illinois is BBCE at 165% — the same "BBCE is not a boolean" case as TX.
  IL: {
    state_code: "IL",
    label: "Illinois / IDHS",
    bbce: true,
    bbce_threshold_pct: 165,
    bbce_fpl_basis: "federal_fiscal_year",
    asset_waiver: true,
    sua_by_tier: null,
    allotment_tier: "48",
    drug_felony_ban: false,
    // RMP runs in Cook and Franklin counties ONLY — a state-level boolean
    // cannot say that, so it stays false until county granularity exists
    // (#614). False under-claims a real program rather than over-claiming it
    // statewide.
    abawd_waiver_avail: true,
    rmp_operated: false,
  },
  PA: {
    state_code: "PA",
    label: "Pennsylvania / DHS",
    bbce: true,
    bbce_threshold_pct: 200,
    bbce_fpl_basis: "federal_fiscal_year",
    asset_waiver: true,
    sua_by_tier: null,
    allotment_tier: "48",
    drug_felony_ban: false,
    abawd_waiver_avail: true,
    rmp_operated: false,
  },
  // Ohio is BBCE at the FEDERAL 130% — categorical eligibility that waives the
  // asset test without raising the income screen, the same archetype as
  // Georgia. Worth knowing before anyone assumes BBCE means 200%.
  OH: {
    state_code: "OH",
    label: "Ohio / ODJFS",
    bbce: true,
    bbce_threshold_pct: 130,
    bbce_fpl_basis: "federal_fiscal_year",
    asset_waiver: true,
    sua_by_tier: null,
    allotment_tier: "48",
    drug_felony_ban: false,
    abawd_waiver_avail: true,
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
