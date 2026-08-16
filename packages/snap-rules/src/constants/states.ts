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
//     ABAWD — FIXED AS A COUNTY-LEVEL LOOKUP (#614). Statewide CA time
//             limits RESUME 2026-06-01 per ACL 25-93. Active waivers
//             (Nov 1 2025 — Oct 31 2026) cover only: Colusa, Imperial,
//             Tulare, Alpine, Merced, Monterey, Plumas (7 of 58
//             counties, CA_WAIVER_COUNTY_FIPS in
//             work-requirements/waiver-counties.ts). The other 51 are
//             time-limited. `abawd_waiver_avail: true` below is ONLY
//             the fallback the ABAWD gate uses when a household's
//             county_fips isn't known — when it IS known, the gate
//             checks the real 7-county set instead and this boolean is
//             never consulted. Sources: ACL 25-79 (waivers), ACL 25-93
//             (resumption), ACL 26-15 (current extension); calfresh.guide
//             tracker.
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
// #858: widened from "48" | "AK" to add "VI" — VI's own real max-allotment
// table is genuinely elevated above the 48-contiguous default, the same
// class of gap AK's "AK" tier already models (packages/snap-rules/src/
// constants/vi-allotment-table.ts + federal-tables.ts's maxAllotmentFor/
// minimumBenefitFor state==="VI" branches). HI and GU were the SAME class
// of gap (plan doc §4) but were deliberately NOT added in that PR — neither
// had a StatePolicy entry yet, and adding a tier value with no table behind
// it and no consumer would have been exactly the kind of unused-surface-area
// drift this file's own discipline avoids elsewhere.
//
// #861: HI and GU are now built (plan doc §5, the final two jurisdictions of
// the original 53-jurisdiction scope). Widened again to add "HI" | "GU" —
// same mechanism, own real tables (packages/snap-rules/src/constants/
// hi-allotment-table.ts, gu-allotment-table.ts — both flat, no zone/county
// axis, confirmed by reading USDA's own FY2026 COLA memo in full: neither
// jurisdiction has an urban/rural subdivision the way AK does) +
// federal-tables.ts's maxAllotmentFor/minimumBenefitFor gaining
// state==="HI"/"GU" branches mirroring the existing AK/VI ones. HI's income-
// ELIGIBILITY guideline is ALSO genuinely elevated (a second, distinct gap —
// federal-tables.ts's fpl_by_region.hi slot, null since #812, is populated by
// the same #861 fix). GU's income-eligibility limits are confirmed NOT
// elevated (USDA's own COLA memo groups Guam with the 48-contiguous/DC/VI
// table) — only GU's benefit-calculation figures (max allotment, standard
// deduction, shelter cap) are territory-elevated, an asymmetric structure
// both jurisdictions' corpus packs independently found.
export type AllotmentTier = "48" | "AK" | "VI" | "HI" | "GU";

// Issue #805: a plain boolean can't express a real drug-felony policy —
// most states in this file that carry `false` are a genuine "modified"
// ban (a real, conditional restriction: FL's trafficking-only trigger,
// PA's treatment-compliance condition, AZ's drug-testing-agreement
// pathway, WI's time-boxed test sanction, AK's rehabilitation carve-out,
// KS's treatment-conditioned rule), not an actual full opt-out — the
// boolean flattened both to `false` because `true` would wrongly deny
// every drug-felony household in a state whose statute protects most of
// them. This widening makes that real distinction queryable instead of
// pushing it into a comment only a human reading the source can find.
//
//   "none"        — verified, no state-imposed restriction beyond the
//                    federal baseline (a genuine opt-out or a policy that
//                    never restricted eligibility to begin with).
//   "modified"     — a real, conditional restriction exists (treatment
//                    compliance, drug-testing agreement, offense-severity
//                    tier, time-boxed sanction, etc.) that this engine
//                    does not yet model at the FACTS level. Gates the
//                    same way "none" does today (fails open, does not
//                    disqualify) until the engine gains the facts needed
//                    to evaluate the actual condition — this widening
//                    only fixes what the value CLAIMS, not what the gate
//                    DOES. See gates/disqualifications.ts.
//   "full"         — the unmodified federal lifetime ban applies.
//   "unconfirmed"  — no citation exists in this file or a merged corpus
//                    pack for this state's drug-felony policy at all
//                    (distinct from "modified" or "none", which both have
//                    a citation). Behaves like "none"/"modified" at the
//                    gate (fails open) but is honestly NOT a finding.
export type DrugFelonyBanStatus = "none" | "modified" | "full" | "unconfirmed";

// Issue #806: reuses the exact effective-dated-snapshot pattern
// federal-tables.ts already proved for federal figures
// (FederalTableSnapshot { effective_start, effective_end, ... }) — not a
// new idea, just extending one that already exists. Before this, a real
// dated policy change (e.g. AK's BBCE adoption 7/1/2025, #804) required a
// silent in-place edit with no record of what was true before, and no way
// to correctly replay a determination for a household that applied before
// the change. Data-integrity rule mirrors federal-tables.ts's own: never
// edit a published snapshot after its effective_end passes — add a new
// dated entry instead.
export interface StatePolicy {
  effective_start: Date;
  effective_end: Date;
  state_code: string;
  label: string;
  bbce: boolean;
  bbce_threshold_pct?: number;
  bbce_fpl_basis: BBCEFPLBasis;
  asset_waiver: boolean;
  /** Per-tier SUA values; null = not authored, callers MUST NOT trust. */
  sua_by_tier: { HCSUA: Decimal; LUA: Decimal; phone: Decimal; none: Decimal } | null;
  allotment_tier: AllotmentTier;
  drug_felony_ban: DrugFelonyBanStatus;
  abawd_waiver_avail: boolean;
  rmp_operated: boolean;
}

// Every entry below is currently a SINGLE snapshot spanning 2020-01-01 to
// 2099-12-31 — a deliberate placeholder range wide enough to cover any
// realistic determination date without changing today's behavior at all.
// This migration is data-shape-only: no state's actual policy VALUES
// changed. A state whose policy genuinely changed on a real date (like
// AK's BBCE, #804) should get a SECOND entry with a real effective_start/
// effective_end pair instead of the placeholder being edited in place.
const STATES: Record<string, StatePolicy[]> = {
  CA: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
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
      // No citation found in this file or a merged corpus pack for CA's
      // drug-felony policy. Issue #805 migration: preserved existing `false`
      // behavior (fails open, does not disqualify) but honestly labeled
      // unconfirmed rather than inventing a "none" finding with no source.
      drug_felony_ban: "unconfirmed",
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
  ],

  MA: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
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
      // Full opt-out — the MA corpus pack's adversarial refute pass checked
      // the drug-felony opt-out language against OLGT 2024-45's exact
      // wording (drug-felony policy clarification) and it matched; zero
      // corrections needed.
      drug_felony_ban: "none",
      // MA holds NO geographic ABAWD waiver: the statewide waiver expired
      // 2025-06-30 (DTA OLGTM-2025-31) and none was reinstated for FY26. With
      // the waiver-availability rule now live (#608), this correctly stops an
      // area-based exemption from being honored anywhere in Massachusetts.
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  TX: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
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
      drug_felony_ban: "full",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

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
  WA: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
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
      // No citation found in this file or a merged corpus pack for WA's
      // drug-felony policy. Issue #805 migration: preserved existing `false`
      // behavior (fails open, does not disqualify) but honestly labeled
      // unconfirmed rather than inventing a "none" finding with no source.
      drug_felony_ban: "unconfirmed",
      abawd_waiver_avail: true,
      rmp_operated: true,
    },
  ],

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
  GA: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
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
      // No citation found in this file or a merged corpus pack for GA's
      // drug-felony policy. Issue #805 migration: preserved existing `false`
      // behavior (fails open, does not disqualify) but honestly labeled
      // unconfirmed rather than inventing a "none" finding with no source.
      drug_felony_ban: "unconfirmed",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

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
  // SUA (#619): FL, IL, and OH now carry sourced production values — each
  // state publishes its utility standards in an annual table, not the rule
  // text, so the citations below point at that table, not the OAC/rule
  // sections that merely describe the framework. PA's sua_by_tier stays
  // null — a genuine, logged verification gap, see the PA entry's own
  // comment for exactly what was and wasn't found.
  //
  // DRUG FELONY BAN (#619, sourced 2026-08-11; re-typed #805): two distinct
  // classifications for these four states, the distinction matters to
  // anyone reading the value:
  //   • IL and OH are VERIFIED FULL OPT-OUTS — drug_felony_ban: "none" is
  //     the correct answer, confirmed against primary statute text.
  //   • FL and PA are MODIFIED bans — drug_felony_ban: "modified". FL
  //     denies only trafficking convictions; PA conditions eligibility on
  //     treatment compliance. Neither should gate as "full" (that would
  //     disqualify every drug-felony household in the state, including the
  //     large majority the statute protects) — the #614 RMP discipline, and
  //     the direction-of-error rule in #608: never deny on data the engine
  //     cannot yet evaluate. As of #805, the type CAN express this
  //     distinction; the gate's BEHAVIOR for "modified" still fails open
  //     (same as before) until the engine models the actual condition.
  //
  // STILL NOT SOURCED — deliberately left permissive rather than guessed:
  //   • abawd_waiver_avail: true is a FAIL-OPEN default, not a finding. A
  //     wrong `false` STRIPS a claimed waiver exemption (gates/abawd.ts reads
  //     it as "we affirmatively know this area has no waiver"), which denies
  //     food. Third sourcing pass 2026-08-11 also failed to produce a
  //     citable answer: FNS/FNA publishes ABAWD waiver status quarterly, but
  //     no FY26 quarterly PDF is posted (fna.usda.gov lists FY1997–2024), and
  //     fna.usda.gov itself still times out — the same wall logged for PA's
  //     SUA below. Secondary trackers report only MN/MT/ND holding statewide
  //     waivers as of June 2026, which is NOT sufficient: post-OBBBA waivers
  //     are county-level (>10% unemployment), so "no statewide waiver" cannot
  //     be written as a state-level `false` without wrongly denying anyone in
  //     a waived county. The correct fix is county sets in
  //     work-requirements/waiver-counties.ts, as authored for CA — not a
  //     boolean flip.
  //
  // CAVEAT on the FNS chart: it is corroboration, not the last word — it
  // under-describes Georgia (prints a single 130% row, missing §3210's 200%
  // all-adult elderly/disabled screen). Treat these thresholds as good enough
  // to gate income tests, and confirm against each state's own manual before
  // quoting a figure to a user.
  // Florida utility standards — Fla. Admin. Code Ann. R. 65A-1.603 (Food
  // Assistance Program Income and Expenses), version effective 2/5/2025,
  // confirmed live 2026-08-09 at flrules.org (gateway/ruleno.asp?id=65A-1.603).
  // FL names its middle tier the Basic Utility Allowance (BUA), same role
  // as TX's BUA / other states' LUA — a household billed for 2+ non-heat
  // utilities. SUA→HCSUA, BUA→LUA, telephone standard→phone.
  FL: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "FL",
      label: "Florida / DCF",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("426"),
        LUA: new Decimal("340"),
        phone: new Decimal("49"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      // FL is a MODIFIED ban, not an opt-out and not a full ban. Fla. Stat.
      // § 414.095(1) (2025 edition, flsenate.gov, read 2026-08-11): Florida
      // "opts out of the provision of Pub. L. No. 104-193, s. 115" and provides
      // that "[b]enefits may not be denied to an individual solely based on a
      // felony drug conviction, unless the conviction is for trafficking
      // pursuant to s. 893.135." Trafficking → ineligible for food assistance;
      // every other felony drug conviction → eligible, conditioned on meeting
      // program/treatment requirements. § 414.095 governs BOTH temporary cash
      // assistance and food assistance, which is what makes it the right cite.
      //
      // CAUTION for whoever revisits this: the widely-linked Public Health Law
      // Center map cites Fla. Stat. § 414.0652 for Florida. That section is
      // TANF drug SCREENING (positive test → 1-year TANF ineligibility) and
      // says nothing about SNAP or about convictions — verified 2026-08-11.
      // A secondary source's citation was program-mismatched; check the statute.
      //
      // Issue #805: re-typed to "modified" — same gate behavior (fails open)
      // as before; `full` would deny all drug-felony households, not just
      // the trafficking subset the statute actually excludes.
      drug_felony_ban: "modified",
      abawd_waiver_avail: true,
      rmp_operated: false,
    },
  ],

  // Illinois is BBCE at 165% — the same "BBCE is not a boolean" case as TX.
  //
  // Utility standards: IDHS WAG 13-01-08-b (The Utility Allowance), MR
  // #25.33 (October 2025 SNAP COLA adjustments), effective 09/26/2025.
  // Confirmed live 2026-08-09 at dhs.state.il.us (page.aspx?item=16170).
  // IL's "Single Utility" tier ($78, one non-heat/non-phone utility) has
  // no slot in this engine's {HCSUA, LUA, phone} shape — undermodeled the
  // same way as OH's identically-named tier (see OH's own comment).
  IL: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "IL",
      label: "Illinois / IDHS",
      bbce: true,
      bbce_threshold_pct: 165,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("546"),
        LUA: new Decimal("457"),
        phone: new Decimal("67"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      // VERIFIED FULL OPT-OUT — 305 ILCS 5/1-10(c), read 2026-08-11 against the
      // primary text at ilga.gov: "Persons shall not be determined ineligible
      // for food stamps provided under this Code based upon a conviction of any
      // felony…". Unconditional for SNAP, with no treatment or compliance
      // strings. (Illinois cash assistance is separate and DOES restrict Class X
      // and Class 1 drug felonies — do not carry that across; this field is
      // SNAP-only.) `false` here is a finding, not a fail-open default.
      drug_felony_ban: "none",
      // !!! CORRECTED 2026-08-11 (#701), was `true` !!! Illinois' STATEWIDE
      // ABAWD work-requirement waiver ended per an IDHS Policy Memo, "End of
      // Waiver for Time-Limited SNAP Benefits and Changes to Exemptions for
      // SNAP Work Requirements" (dated 10/16/2025, dhs.state.il.us item=175082):
      // "Illinois' Work Requirement waiver is ending in November 2025. The
      // first potential countable month for [ABAWDs] who are not exempt or
      // meeting the SNAP Work Requirement is December 2025." Corroborated by
      // WAG 03-16-00 ("...their place of residence is in an unwaived county")
      // and the active fixed 3-year ABAWD clock (01/01/2024–12/31/2026,
      // WAG 03-16-04) already assigning countable months. Same bug class as
      // MA's entry above — a stale `true` tells an ABAWD-subject household
      // they hold a waiver exemption that no longer exists.
      // NOT YET CONFIRMED: whether Illinois has since obtained any NEWER,
      // county-level waivers post-November-2025 (the CA/#614 pattern — losing
      // a statewide waiver doesn't preclude narrower ones). This pass found no
      // current IL county-waiver list; re-verify against the FNS quarterly
      // ABAWD waiver file or a newer IDHS Manual Release before assuming this
      // stays a flat `false` forever.
      abawd_waiver_avail: false,
      // RMP runs in Cook and Franklin counties ONLY — a state-level boolean
      // cannot say that, so it stays false until county granularity exists
      // (#614). False under-claims a real program rather than over-claiming it
      // statewide.
      rmp_operated: false,
    },
  ],

  // Pennsylvania utility standards — !!! PENDING PRIMARY-SOURCE VERIFICATION,
  // same status as MA's SUA gap when it was blocked (see MA's own comment
  // above for that resolution once it lands). sua_by_tier stays null; the
  // #436 invariant fails loudly rather than guessing.
  //
  // The codified rule (55 Pa. Code §501.7, PA Bulletin Doc. No. 02-110) is
  // STALE — 2001 figures ($333 heating / $181 nonheating / $26 phone) that
  // the rule itself says are superseded annually by Department notice, not
  // by amending the rule text. VERIFICATION ATTEMPTS LOGGED 2026-08-09:
  //   - services.dpw.state.pa.us (the OIM policy manual host cited by
  //     PA's own DHS pages) — connection refused, twice, different pages.
  //   - pa.gov/agencies/dhs/resources/snap/hsua — live page, describes
  //     eligibility for the heating tier, publishes no dollar figures at
  //     all ("contact your CAO").
  //   - Six PA DHS Operations Memoranda searched by title/date for 2025;
  //     the one COLA-titled memo found (#25-12-01) turned out to be about
  //     RSDI/SSI/Railroad Retirement COLA passthrough, unrelated to SUA.
  //   - USDA's federal FY26 SUA compilation (which DOES carry PA's real
  //     number) is blocked by Akamai bot protection on both curl and
  //     WebFetch — the same wall AK's fetch hit before a browser-download
  //     workaround got through; that workaround failed here (403, not a
  //     download prompt).
  //   - "$497" appears repeated, uncorroborated, across several secondary
  //     SNAP-calculator sites (snapscreener.com, snapbenefitscalculator.com)
  //     with no primary citation behind any of them — NOT used here; a
  //     number two secondary sites agree on is not primary sourcing.
  //
  // RE-ATTEMPTED 2026-08-09 (second pass, #619) — six more distinct avenues,
  // all dead ends:
  //   - fns.usda.gov/snap/admin/sua-fy26 — request timeout (same Akamai wall).
  //   - usda.gov/sites/default/files/guidance-documents/fns.snap-
  //     simplifiedProcess-fy26sua-values.pdf — a DIFFERENT USDA host from
  //     the fns.usda.gov one already blocked; still 403'd, both via WebFetch
  //     and via curl with a real browser user-agent (490-byte HTML error
  //     page, not the PDF).
  //   - fna.usda.gov/snap/eligibility/deduction/standard-utility-allowances
  //     (FNS's newer "FNA" rebrand domain) — request timeout, same pattern.
  //   - web.archive.org snapshots of any of the above — blocked at the tool
  //     level entirely ("Claude Code is unable to fetch from web.archive.org"),
  //     not a page-content miss.
  //   - pa.gov/agencies/dhs/resources/sandbox/proof-snap-redesign/snap-heat-eat
  //     (a Feb-2026 policy-change page found via fresh search) — live,
  //     describes HSUA eligibility narrowing to E/D households, publishes no
  //     dollar figures, points to COMPASS / the CAO / the same phone line.
  //   - pennsylvaniadhs.substack.com's Feb-2026 "shelter and utility
  //     verification" post — describes the new verification REQUIREMENT,
  //     not the allowance amounts.
  //   - Searched pacodeandbulletin.gov directly for a 2025/2026 utility-
  //     allowance notice (the PA Code's own text says future adjustments
  //     are issued there) — found only the same stale 2001 codified figures
  //     already logged above; no 2025/2026 notice indexed/surfaced.
  // Genuinely exhausted via automated fetch across two verification passes
  // now. ACTION unchanged: needs an operator with a working
  // services.dpw.state.pa.us session, or a direct call to PA DHS's
  // Statewide Customer Service Center (1-877-395-8930), to get the current
  // OIM bulletin/notice.
  PA: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "PA",
      label: "Pennsylvania / DHS",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: null,
      allotment_tier: "48",
      // MODIFIED ban, and the ONLY one of the four whose primary text could not
      // be read. The Public Health Law Center map (secondary) reports a modified
      // ban at 62 Pa. Stat. § 432.24 — eligibility conditioned on court-ordered
      // treatment compliance and periodic screening, with a tiered penalty for
      // failed tests. Primary text NOT verified: palegis.us's statute viewer
      // returns only its navigation shell to automated fetch (2026-08-11), and
      // legis.state.pa.us now 301s there.
      //
      // TWO things therefore remain UNCONFIRMED for PA, and neither should be
      // asserted downstream: (a) the exact conditions, and (b) whether § 432.24
      // reaches SNAP at all or only cash assistance. (b) is a live doubt, not
      // pedantry — the same secondary source's Florida citation turned out to be
      // a TANF-only section (see FL above), and PA's 2018 drug-felony policy
      // change was reported under TANF.
      //
      // Issue #805: was a plain `false` this boolean couldn't distinguish from
      // a genuine opt-out; now labeled "modified" to match the documented
      // real-but-unconfirmed-details conditional ban above. Gate behavior is
      // unchanged (fails open, same as before) until this engine models the
      // treatment-compliance condition at the facts level.
      drug_felony_ban: "modified",
      abawd_waiver_avail: true,
      rmp_operated: false,
    },
  ],

  // Ohio is BBCE at the FEDERAL 130% — categorical eligibility that waives the
  // asset test without raising the income screen, the same archetype as
  // Georgia. Worth knowing before anyone assumes BBCE means 200%.
  //
  // Utility standards: ODJFS Food Assistance Change Transmittal No. 105
  // (Aug 29, 2025), "October 1, 2025, Mass Change", fetched live 2026-08-09
  // at dam.assets.ohio.gov. OAC 5101:4-4-23 defines the SUA framework but
  // (confirmed) carries no dollar amounts — the transmittal is the actual
  // source, same pattern as CA's ACL-vs-ACIN split.
  //
  // Ohio publishes a FOURTH tier this engine's {HCSUA, LUA, phone} shape
  // has no slot for: "Single Standard Utility Allowance" ($108, exactly
  // one non-heat, non-phone utility — more granular than LUA's "2+
  // utilities"). Mapped only the three tiers the engine can actually
  // select via Facts.shelter.sua_tier; $108 is real but unreachable until
  // that enum grows a fifth value. Documented rather than silently
  // dropped, same discipline as AK's unmapped 5 non-Central regions (#631).
  OH: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "OH",
      label: "Ohio / ODJFS",
      bbce: true,
      bbce_threshold_pct: 130,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("766"),
        LUA: new Decimal("479"),
        phone: new Decimal("46"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      // VERIFIED FULL OPT-OUT — Ohio Rev. Code § 5101.84 (eff. Oct 16, 2009),
      // read 2026-08-11 against the primary text at codes.ohio.gov: "An
      // individual otherwise ineligible for aid … because of paragraph (a) of
      // 21 U.S.C. 862a is eligible for the aid or benefits if the individual
      // meets all other eligibility requirements." Names SNAP explicitly (via
      // the Food and Nutrition Act, 7 U.S.C. 2011 et seq.) and attaches no
      // drug-specific condition. `false` is a finding, not a fail-open default.
      drug_felony_ban: "none",
      abawd_waiver_avail: true,
      rmp_operated: false,
    },
  ],

  // Michigan — backfilled from the adversarially-verified Demeter corpus pack
  // (packages/demeter-engine/src/states/mi/, PROVENANCE.md) rather than a
  // #619-style Tranche-1 fetch; different provenance trail, same rigor.
  //
  // BBCE: Michigan's cat-el trigger runs through "enhanced authorization for
  // Domestic Violence Prevention Services (DVPS)" — a universal, non-cash
  // service (NOT restricted to DV survivors) that confers a 200% FPL gross
  // screen with FULL asset-test relief, structurally the same move as GA's
  // TCOS pamphlet under a different name. Source: BPG Glossary
  // ("Categorical Eligibility"); BEM 213 ("Categorically eligible groups
  // automatically meet the asset and income limits for the Food Assistance
  // Program"). Confirmed live 2026-08-11 at dhhs.michigan.gov/OLMWEB.
  //
  // Utility standards: RFT 255 (RFB 2025-006, eff. 10/1/2025) — the annual
  // Reference Table Bulletin; BEM 554 (the rule text) carries NO dollar
  // figures at all, same table-not-rule-text pattern #619 hit for FL/IL/OH.
  // Michigan's SUA shape does not fit this engine's {HCSUA, LUA, phone}
  // ladder as a single-election model the way TX/WA do — Michigan instead
  // STACKS up to 5 independently-priced standards (non-heat electric $181,
  // water/sewer $119, telephone $31, cooking fuel $33, trash $30) for
  // households not on the mandatory Heat/Utility bundle. The mapping below is
  // NOT an approximation, though: this engine's determineSUATier() (sua.ts)
  // asks exactly three yes/no questions — has_heating_costs,
  // has_electric_or_gas, has_phone — and Michigan happens to publish a
  // standard with that EXACT name and definition for the middle question
  // ("non-heat electric... A SNAP group which has no heating/cooling expense
  // but has a responsibility to pay for non-heat electricity... must use the
  // non-heat electric standard," BEM 554) — so HCSUA and LUA are both clean
  // 1:1 matches, not judgment calls. water/sewer ($119), cooking fuel ($33),
  // and trash ($30) are the genuinely UNMAPPED standards — Michigan
  // households responsible for ONLY one of those three (with no heat, no
  // electric responsibility, but water or cooking-fuel or trash) fall through
  // to has_phone/NONE and lose that deduction, the same documented-gap
  // discipline as IL's Single Utility ($78) and OH's Single SUA ($108).
  //
  // Max allotment table (RFT 260, same RFB 2025-006 cycle): $298/$546/$785/
  // $994/$1,183/$1,421/$1,571/$1,789 for HH 1-8 — identical to the federal
  // 48-contiguous-state table (allotment_tier: "48" is correct; Michigan
  // does not run its own schedule).
  MI: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "MI",
      label: "Michigan / MDHHS",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("682"),
        LUA: new Decimal("181"),
        phone: new Decimal("31"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      // VERIFIED FULL OPT-OUT — 2020 PA 392 (Senate Bill 1006, signed Jan.
      // 2021) amended MCL 400.10b to add: "This subsection does not apply to
      // an individual applying for food assistance if he or she has an
      // outstanding felony warrant for a violation of part 74 of the public
      // health code, 1978 PA 368, MCL 333.7401 to 333.7461" — i.e. a
      // drug-related felony warrant is explicitly carved OUT of Michigan's
      // felony-warrant assistance bar. MCL 400.10b's own History line confirms
      // the amendment: "Am. 2020, Act 392, Imd. Eff. Jan. 4, 2021." Michigan's
      // PRIOR rule disqualified anyone with 2+ drug-felony convictions; PA 392
      // repealed it, and the current BEM 203 ("Criminal Justice
      // Disqualifications") has no drug-felony-conviction category at all,
      // confirming the repeal is fully reflected in current policy. `false`
      // here is a finding, not a fail-open default.
      drug_felony_ban: "none",
      // Michigan DOES hold real ABAWD/TLFA waivers as of build (unlike GA,
      // which holds none) — effective 12/1/2025, 15 counties (Alcona, Alger,
      // Arenac, Cheboygan, Iosco, Iron, Luce, Mackinac, Montmorency, Oceana,
      // Ogemaw, Oscoda, Presque Isle, Roscommon, Schoolcraft) and 6 cities (Bay
      // City, Detroit, Eastpointe, Flint, Jackson, Saginaw) are waived; every
      // other county/city is TLFA-subject. A state-level boolean cannot express
      // "15 of 83 counties + 6 cities," so `true` is both the CA-style
      // permissive fallback AND, unlike CA, an affirmatively correct "this
      // state currently holds waivers somewhere" finding — it is the FALLBACK
      // ONLY for when a household's county/city isn't known; no
      // MI_WAIVER_COUNTY_FIPS lookup exists yet (the CA/#614 pattern), so this
      // boolean is consulted for every Michigan household today, not just the
      // unknown-county case. Source: BEM 620, "TLFA Locations."
      abawd_waiver_avail: true,
      // Michigan's RMP is a genuine STATEWIDE program (like CA's AB 942
      // mandate), NOT county-restricted the way IL's is (Cook/Franklin only,
      // hence IL's `false`). Eligibility is gated by household composition
      // (every group member must be elderly 60+, disabled, homeless, or an
      // eligible recipient's spouse — BAM 119), not geography: any restaurant
      // meeting the state's authorization criteria anywhere in Michigan may
      // participate. `true` is correct as a state-level boolean under the same
      // reasoning as CA's entry above.
      rmp_operated: true,
    },
  ],

  // New York — OTDA. The hardest schema fit in this file: NY runs THREE
  // simultaneous BBCE income tiers (200% aged/disabled or dependent-care,
  // 150% earned-income, 130% default — 18 NYCRR §387.14, directive lineage
  // 07-ADM-09 → 09-ADM-06 → 16-ADM-06) and REGIONAL SUAs (NYC / Nassau-Suffolk
  // / Rest of State, each a different dollar figure). Neither fits this
  // schema's single scalar bbce_threshold_pct or single-set sua_by_tier — see
  // issue #732 (tracking) and #731 (this entry's own filed follow-up) for the
  // schema-extension work this doesn't attempt.
  //
  // bbce_threshold_pct is set to 130 (the DEFAULT/general tier) — the SAME
  // accepted-limitation pattern as GA's 130% and IL's 165%: the higher tiers
  // for aged/disabled (200%) and earned-income (150%) households are NOT
  // modeled here, so this engine will UNDER-approve those households against
  // a stricter 130% gross test than NY actually applies to them. That is the
  // safer direction of error for THIS schema gap specifically (a household
  // this engine denies at 130% who was actually eligible at 150%/200% is a
  // false negative the corpus/chatbot layer can still catch by citing NY's
  // real tiers in text) — but it means this engine's own NY verdict is NOT
  // reliable for aged/disabled or dependent-care-paying households until the
  // schema is extended. Full picture: packages/demeter-engine/src/states/ny/
  // supplements.json income-pathways entry.
  //
  // sua_by_tier uses ROI (Rest of State) values — the residual/default
  // region, same "pick the general case" principle as the BBCE field above —
  // NOT NYC ($1,062/$419) or Nassau-Suffolk ($988/$388), both of which are
  // HIGHER. This engine will UNDER-compute the shelter deduction (and so
  // under-compute the benefit) for any NYC or Nassau-Suffolk household. Same
  // single-region-approximation pattern already used for AK (issue #631,
  // "single-region approximation of a genuinely 6-region system") — not a
  // novel shortcut for this codebase. Source: GIS 25DC059 (eff. 10/1/2025).
  //
  // OBBBA HEAP/HCSUA rewiring (GIS 25DC061, retroactive to 7/4/2025) is NOT
  // modeled: NY now requires an aged/disabled household member to use LIHEAP
  // receipt as the HCSUA trigger; all-other households must show a genuine
  // heating/cooling expense directly. This engine's sua.ts tier-selection
  // logic predates that distinction for every state, not just NY — a
  // pre-existing engine-wide gap, out of scope for this entry.
  NY: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "NY",
      label: "New York / OTDA",
      bbce: true,
      bbce_threshold_pct: 130,
      bbce_fpl_basis: "federal_fiscal_year",
      // Resource test is eliminated for categorically eligible households
      // (07-ADM-09, eff. 1/1/2008) — nearly every NY household. It survives
      // only for sanctioned/IPV households and aged/disabled households over
      // 200% FPL on the federal net-only path — the same "asset_waiver: true
      // is the general case, a documented minority still gets tested" shape
      // as CA/MA/TX/WA/GA/FL/IL/MI above.
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("877"),
        LUA: new Decimal("355"),
        phone: new Decimal("32"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      // New York has fully opted out of the federal drug-felony ban (multiple
      // independent secondary sources agree; NOT independently confirmed
      // against an OTDA primary source in this pass — the NY corpus pack
      // itself (built 2026-08-07) never addressed this topic, a real gap in
      // that pack worth a follow-up). Consistent with every other Northeast/
      // progressive-policy state already in this file (IL, NV, MA all "none").
      // Kept as "none" rather than "unconfirmed" since a real (if secondary)
      // citation exists — but the primary-source gap above still stands.
      drug_felony_ban: "none",
      // FALSE is the affirmatively correct current finding, not a fail-open
      // default: FNS terminated NY's waiver 11/2/2025 (25-ADM-03-P);
      // litigation reinstated it through 2/28/2026 for every county except
      // Saratoga; but the CURRENT status (GIS 26DC012, confirmed as of this
      // pack's 2026-08-07 build) is that the time limit operates in ALL 58
      // districts since March 1, 2026 — only the Tuscarora Nation Reservation
      // and Poospatuck (State) Reservation remain waived, through 2/28/2027.
      // Unlike CA's or MI's entries above (where the waived exceptions are a
      // meaningful fraction of counties, justifying a permissive `true`
      // fallback), NY's waived area is two tiny reservations out of 58
      // districts — `false` is the correct general-case default here. No
      // NY_WAIVER_COUNTY_FIPS lookup exists for the reservation carve-out.
      abawd_waiver_avail: false,
      // New York is confirmed on USDA FNA's own "States that Operate a
      // Restaurant Meals Program" list (fetched live via curl this session for
      // the WI/MN packs) — a genuine statewide program, not county-restricted.
      rmp_operated: true,
    },
  ],

  // Nevada — DSS (renamed from DWSS; legacy dwss.nv.gov paths still appear in
  // the agency's own site assets). A much cleaner schema fit than NY: flat
  // 200% BBCE (no tiers) and a genuine 4-tier utility ladder that maps onto
  // this schema's HCSUA/LUA/phone/none shape directly, not an approximation.
  //
  // Expanded Categorical Eligibility (ECE) is conferred through the "This Is
  // Your Copy" page of the Application for Assistance — a TANF-funded
  // informational page every SNAP applicant already receives as standard
  // paperwork, functionally a flat screen (E&P MS A-180.2). ECE households
  // skip BOTH income tests and the resource test entirely.
  //
  // sua_by_tier maps NV's SUA→HCSUA ($446) and LUA→LUA ($361) directly (E&P
  // MS A-660.5.1.1 / C-210.3, MTL 21/25, eff. 10/1/2025); phone maps to NV's
  // Telephone Utility Allowance ($52). NV's fourth tier, the Individual
  // Utility Allowance ($77, exactly one non-telephone utility), has NO slot
  // in this schema and falls through to NONE — the same documented-gap
  // discipline as IL's Single Utility ($78), OH's Single SUA ($108), and MI's
  // water/sewer/cooking-fuel/trash standards (see the MI comment above): a
  // Nevada household billed for exactly one utility OTHER than telephone
  // loses that deduction under this engine until the schema grows a 5th slot.
  NV: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "NV",
      label: "Nevada / DSS",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      // "Do not apply the SNAP resource test to households that have been
      // determined categorically eligible... It is not necessary to request or
      // verify resources" (E&P MS A-521) — a full verification waiver, not
      // merely a higher limit, for both the base categorical group and ECE.
      // Non-categorically-eligible households still face $3,000/$4,500
      // (E&P MS A-520) — same "asset_waiver: true is the general case, a
      // documented minority still gets tested" shape as every state above.
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("446"),
        LUA: new Decimal("361"),
        phone: new Decimal("52"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      // VERIFIED FULL OPT-OUT — NRS 422A.345, checked against the Nevada
      // Legislature's own codified statute text (leg.state.nv.us), not a
      // secondary summary: "all persons domiciled in this State are exempt
      // from the application of 21 U.S.C. § 862a(a)." A 2021 amendment (ch.
      // 73, AB 138) REMOVED a prior condition requiring substance-use-disorder
      // treatment participation — an initial secondary source described that
      // now-repealed condition as current policy; the NV corpus pack caught
      // this before drafting anything (see PROVENANCE.md). `false` here is a
      // finding against the CURRENT statute, not a fail-open default.
      drug_felony_ban: "none",
      // Nevada's statewide ABAWD waiver (02/01/2025-01/31/2026) was NOT
      // renewed — "Nevada's statewide ABAWD waiver was terminated FY2026"
      // (E&P MS B-470.1.2). But UNLIKE NY's post-expiration picture (2 tiny
      // reservations out of 58 districts), Nevada's post-expiration waived-area
      // list (eff. 2/1/2026, E&P MS B-472) is a genuinely substantial set: 11
      // named Tribal/Reservation areas (Battle Mountain, Campbell Ranch,
      // Dresslerville Colony, Elko Colony, Fort McDermitt, Las Vegas Indian
      // Colony, Lovelock Indian Colony, Pyramid Lake Paiute Reservation,
      // Reno-Sparks Indian Colony, Stewart Community, Walker River Reservation,
      // Yerington Colony) PLUS all of Mineral County. No NV_WAIVER_COUNTY_FIPS
      // lookup exists, so this boolean is consulted for every Nevada household
      // today, not just an unknown-area fallback — same shape as MI's entry
      // above. `true` is chosen under the same "wrongly denying food is the
      // worse error" reasoning MI and CA use: it over-approves ABAWD households
      // OUTSIDE the waived areas (including Nevada's population centers,
      // Clark/Washoe counties, which are NOT on the waived list) rather than
      // risk denying the real households inside 12 currently-waived areas.
      abawd_waiver_avail: true,
      // Confirmed ABSENT from USDA FNA's own national Restaurant Meals Program
      // page (fetched fresh by the NV corpus pack, updated the same week) —
      // lists AZ, CA, IL (Cook/Franklin only), MD, MA, MI, NY, RI, VA; no NV.
      rmp_operated: false,
    },
  ],

  // Arizona — DES/FAA. A NEW kind of schema mismatch: Arizona's SUA and LUA
  // are SIZE-BANDED (1-3 participants vs. 4+), the only state in this file
  // with a household-size dimension in its utility ladder — every other
  // state's tiers are flat regardless of household size. This schema has no
  // size dimension either, so the 1-3 band (the more common household size)
  // is encoded; a 4+ household's real SUA/LUA is $115/$52 HIGHER than what
  // this engine computes (CNAP FAA6.J.09, eff. 10/1/2025). Arizona also has
  // the same undermodeled-single-utility gap as NV's IUA/IL's Single Utility:
  // a household billed for exactly one non-heating, non-telephone utility
  // has no confirmed tier at all (the AZ corpus pack explicitly declined to
  // guess which one applies) and falls through to NONE here.
  AZ: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "AZ",
      label: "Arizona / DES-FAA",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      // "Maximum NA resource limits do not apply to NA budgetary units that
      // meet Basic or Expanded Categorical Eligibility requirements" (CNAP
      // FAA6.J.06.B) — full waiver for the categorically-eligible majority;
      // $3,000/$4,500 for the tested minority, same shape as every state above.
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("323"),
        LUA: new Decimal("149"),
        phone: new Decimal("44"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      // Arizona ENFORCES the federal drug-felony ban — the AZ corpus pack found
      // no opt-out statute (two candidate citations, ARS 46-215 and ARS 46-201,
      // were BOTH checked directly against the Legislature's own text and
      // neither covers controlled substances) — but the ban carries a real,
      // genuine CONDITIONAL removal pathway: sign a drug-testing agreement and
      // meet one of five treatment/compliance conditions. Per this file's
      // established rule for a modified/conditional ban the boolean can't
      // express (see FL's and PA's entries above — "under-claiming a narrow
      // real ban is the lesser harm"), `false` is chosen deliberately: setting
      // `true` would deny every AZ drug-felony household, including everyone
      // who qualifies for removal, which #608 forbids. This is a genuine
      // under-claim, not a fail-open default. Issue #805: re-typed to
      // "modified" — same gate behavior (fails open) as before.
      drug_felony_ban: "modified",
      // Arizona's fixed 1/1/2025-12/31/2027 ABAWD clock currently has 7 real
      // waived areas (CNAP FAA2.M.09.B): Yuma County, plus 6 Tribal/
      // Reservation/Trust-Land areas (Cocopah, Hualapai, Maricopa/Ak-Chin,
      // Salt River, San Carlos, Pascua Yaqui). No AZ_WAIVER_COUNTY_FIPS lookup
      // exists, so — same reasoning as NV's and MI's entries above — `true`
      // avoids wrongly denying the real households inside those 7 areas, at
      // the cost of over-approving ABAWD households elsewhere in the state.
      abawd_waiver_avail: true,
      // Confirmed on USDA FNA's own national Restaurant Meals Program page —
      // one of only 9 states nationally (AZ, CA, IL Cook/Franklin only, MD, MA,
      // MI, NY, RI, VA) — genuine statewide operation, not county-restricted.
      rmp_operated: true,
    },
  ],

  // Oregon — ODHS. Flat 200% BBCE (Information and Referral Services
  // pamphlet conferral, OAR 461-135-0505), no tiering. SUA is a genuine
  // 4-tier ladder that maps cleanly: FUA→HCSUA, LUA→LUA, TUA→phone — the
  // same undermodeled-single-utility gap as NV's IUA/AZ's one-utility case
  // applies to OR's IUA ($65, exactly one non-heat/cool utility), which
  // falls through to NONE here. NOTE: OAR 461-160-0420 is currently a
  // TEMPORARY rule (SSP 21-2026, effective 3/19/26-9/14/26) — the OR corpus
  // pack confirmed these SAME dollar figures also appear in the immediately-
  // prior PERMANENT version, so the values themselves are not expected to
  // change on expiration, but the citation needs re-verification after that
  // date regardless (see the OR corpus pack's freshness.json).
  OR: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "OR",
      label: "Oregon / ODHS",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      // "Categorically eligible filing groups are 'presumed to meet' resource,
      // income, and adjusted-income requirements" (OAR 461-135-0505) — full
      // waiver for the BBCE majority; $3,000/$4,500 for the tested minority.
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("515"),
        LUA: new Decimal("404"),
        phone: new Decimal("81"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      // Oregon opts out of the federal drug-felony ban (ORS 411.119(1)) — a
      // GENUINE, currently-operative opt-out, not a modified ban requiring the
      // FL/PA/AZ under-claim treatment. DHS retains a narrow discretionary
      // SUSPENSION path (trafficking conviction + active supervision +
      // evidence of trading SNAP for drugs) — evidence-specific enough that it
      // does not change the base-case answer for the vast majority of OR
      // drug-felony households.
      drug_felony_ban: "none",
      // Oregon's ABAWD exempt areas are 5 NAMED TRIBAL jurisdictions (not
      // counties) — Burns Paiute, Confederated Tribes of Siletz Indians,
      // Coquille, Cow Creek Band of Umpqua, Klamath Tribes (OAR 461-135-0520).
      // A separate 7-county "discretionary exemption" mechanism exists but is
      // explicitly NOT an area waiver — the OR corpus pack's own supplement
      // warns "Do not describe these seven counties as 'waived.'" Given the
      // real area exemption covers only 5 tribal jurisdictions (not a
      // meaningful fraction of Oregon's 36 counties), `false` follows the same
      // reasoning as NY's entry above rather than NV's/AZ's/MI's `true`.
      abawd_waiver_avail: false,
      // Confirmed ABSENT from USDA FNA's national RMP list. A pilot (SB 1585,
      // 2024) is authorized but ODHS's own status page says it is still in
      // development with no target launch date — a live freshness risk, not a
      // settled fact the way most other `false` entries in this file are.
      rmp_operated: false,
    },
  ],

  // Wisconsin — DHS/FoodShare. Flat 200% BBCE (Job Center of Wisconsin
  // notice, FSH 4.2.1), but EBD households over 200% FPG get an even MORE
  // generous pathway (no gross test at all, only 100% net) not modelled
  // here — same accepted asymmetric-tier limitation as GA's/IL's entries.
  // Wisconsin's utility ladder has SEVEN tiers, the most severe SUA-schema
  // mismatch in this file: only HSUA→HCSUA, LUA→LUA, PUA→phone map onto this
  // schema's 4 slots. FOUR separate WI standards have NO slot at all — EUA
  // (electric-only, $155), WUA (water/sewer, $106), FUA (cooking fuel, $48),
  // TUA (trash, $28) — a Wisconsin household billed for exactly one of those
  // four loses that deduction entirely under this engine, a materially
  // bigger gap than the single-tier gaps other states in this file carry.
  WI: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "WI",
      label: "Wisconsin / DHS — FoodShare",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("553"),
        LUA: new Decimal("385"),
        phone: new Decimal("31"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      // Wisconsin requires a ONE-TIME drug test (not an ongoing regime) for a
      // qualifying conviction within the last 5 years, with a 12-month
      // sanction on FAILURE (FSH 3.20.1) — genuine disqualifying teeth for a
      // narrow subset (recent conviction + failed/refused test), but the
      // majority of affected people (conviction 5+ years old, or a passed
      // test) face no restriction at all. Same FL/PA/AZ under-claim reasoning:
      // `true` would wrongly deny that majority, so `false` is the deliberate
      // choice — this boolean cannot express a time-boxed, test-conditional
      // sanction any more than it can express AZ's treatment-conditional one.
      // Issue #805: re-typed to "modified" — same gate behavior as before.
      drug_felony_ban: "modified",
      // The WI corpus pack explicitly could not find any currently-waived
      // Wisconsin county in the handbook text itself ("this pack did not find
      // specific currently-waived Wisconsin counties in the handbook text
      // itself") — unlike NV/AZ (confirmed real waived areas) or OR/NY
      // (confirmed narrow/no waiver), Wisconsin's status is simply UNCONFIRMED.
      // Absent any confirmed waiver, `false` is the honest default (same as
      // MA's entry above: no evidence of a current waiver defaults to none).
      abawd_waiver_avail: false,
      // Confirmed ABSENT from USDA FNA's national RMP list via direct curl
      // (not the AI-summarized WebFetch that produced false positives for
      // other states this session). Do not confuse with WI's separate
      // group-meal-site/shelter/Meals-on-Wheels provision, which is real but
      // is not the federal Restaurant Meals Program.
      rmp_operated: false,
    },
  ],

  // Minnesota — DCYF (Combined Manual still hosted on the legacy DHS
  // system). Flat 200% BBCE (Domestic Violence Information Brochure
  // DHS-3477, CM 0013.06) — but MN's BBCE exempts a unit from BOTH the asset
  // test AND the net income test, stronger than every other flat-screen
  // state in this file. sua_by_tier is DELIBERATELY null: Minnesota runs a
  // SINGLE COMBINED utility allowance (heat/cool/electric/water/sewer/
  // garbage/phone all together, not a tiered ladder at all), and the MN
  // corpus pack's own build could NOT independently confirm the current
  // dollar figure against a live authoritative source (the Combined
  // Manual's utility-deduction section text wasn't captured in that pass,
  // and both a USDA FY26 SUA PDF and a DHS page returned access-denied
  // responses — see the MN corpus pack's PROVENANCE.md). Same discipline as
  // PA's entry above: SUA stays null until a working primary source is
  // reached, not guessed from a secondary figure this pack explicitly
  // declined to trust (~$235/month electric-only, unconfirmed).
  MN: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "MN",
      label: "Minnesota / DCYF",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      // "CE and BBCE units are NOT subject to a net income test" (CM 0013.06)
      // — full waiver, stronger than the asset-only waiver most states above
      // use; non-categorically-eligible units still face $3,000/$4,500.
      asset_waiver: true,
      sua_by_tier: null,
      allotment_tier: "48",
      // GENUINE clean full opt-out — "End any disqualifications for someone
      // who was disqualified for Cash programs or SNAP as a drug felon prior
      // to 08/01/2023" and "Do not deny or terminate assistance for a person
      // who tests positive" (CM 0011.27.03, issue-dated 11/2024). This
      // corrects a widely-repeated FALSE secondary-source claim that Minnesota
      // imposes a lifetime ban after 2 failed drug tests — the MN corpus
      // pack's own adversarial refute pass caught and disproved this against
      // the Combined Manual's primary text before drafting anything. Unlike
      // AZ's/WI's judgment-call `false` (a real conditional restriction the
      // boolean can't express), MN's finding is a clean, unconditional one
      // — the same shape as IL's and NV's entries above.
      drug_felony_ban: "none",
      // The MN corpus pack's own supplement is explicit: "treat Minnesota as
      // PRESUMPTIVELY UNWAIVED... pending direct confirmation" — two access
      // barriers (a DHS bot-detection wall, a USDA ZIP-only waiver archive)
      // blocked independent confirmation of current status. `false` follows
      // the pack's own stated instruction rather than assume either direction.
      abawd_waiver_avail: false,
      // Confirmed ABSENT from USDA FNA's national RMP list (reused from the
      // same-session direct-curl fetch the WI pack used). Minnesota
      // legislation (HF 3855/SF 4135) proposing an RMP has not been enacted —
      // a live legislative risk, not a settled fact.
      rmp_operated: false,
    },
  ],

  // Kansas utility standards — KEESM §7226 (Shelter Costs), rev. 07-26,
  // confirmed live 2026-08-09 at content.dcf.ks.gov/EES/KEESM/Current/keesm7226.htm.
  // Unlike TX/WA (mandatory standards, no election), KEESM does not state
  // households must use the standard over actual costs — treated as the
  // ordinary SNAP default (household may elect either) absent a stated
  // mandatory-standard clause.
  KS: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "KS",
      label: "Non-BBCE archetype (e.g. KS)",
      bbce: false,
      bbce_fpl_basis: null,
      asset_waiver: false,
      sua_by_tier: {
        HCSUA: new Decimal("469"),
        LUA: new Decimal("345"),
        phone: new Decimal("44"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      // MODIFIED, not the "banned for life" a 2022 secondary source claimed —
      // per the KS corpus pack (packages/demeter-engine/src/states/ks/
      // PROVENANCE.md), the actual rule is treatment-conditioned. This
      // classification is ported from the corpus finding; this entry's own
      // label ("Non-BBCE archetype") shows the rest of the entry is still an
      // illustrative placeholder, not independently re-verified for the
      // engine the way the Tranche-1/MI/NY/NV/AZ/OR/WI/MN entries above are —
      // flagging for the same kind of audit AK's stale bbce got (#804).
      drug_felony_ban: "modified",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Alaska utility standards — a genuinely different SHAPE than every other
  // state modeled here, not just different numbers.
  //
  // Source: Alaska Dept. of Health / Division of Public Assistance, form
  // FSP 77 (06-4198) rev 09/25, "Alaska SNAP Standards — Income Limits and
  // Standard Deductions", effective 10/1/2025. Fetched live 2026-08-09 at
  // health.alaska.gov/media/wzalr0op/alaska-snap-standards.pdf.
  //
  // AK publishes SIX geographic utility regions (Central/Anchorage-MatSu,
  // Northern/Fairbanks, Northwest/Nome-Kotzebue, South Central, Southeastern,
  // Southwestern), each with its OWN heating standard, PLUS separately
  // itemized non-heating standards (electricity / telephone / sewer / water)
  // per region — not the single flat {HCSUA, LUA, phone} most states publish.
  //
  // FIXED AS A REAL PER-REGION LOOKUP (#631, same two-tier pattern as #614's
  // county-level ABAWD waivers): constants/ak-utility-regions.ts maps every
  // current AK county FIPS to its real region's rates, and benefit-calc.ts
  // consults it FIRST whenever state === "AK" and facts.county_fips is
  // known. The sua_by_tier below is now ONLY the fallback for when county
  // is unknown — not the answer itself. It's still the CENTRAL region
  // (Anchorage/Wasilla/Palmer, the most populous area), the same
  // representative-default choice every non-regional state here already
  // makes for its single value.
  //
  // LUA is not a figure AK publishes as one line for ANY region — every
  // region's LUA here is electricity + sewer + water (telephone excluded,
  // it has its own tier). If AK's actual LUA-equivalent determination
  // combines these differently, every region needs the same correction,
  // not just Central — see ak-utility-regions.ts's own caveat.
  // Issue #804 / #806: AK is the FIRST real use of the dated-snapshot
  // capability #806 built — a genuine, dateable state policy change, not a
  // hypothetical. Split into two snapshots instead of editing the old
  // placeholder in place, so a determination for a household that applied
  // BEFORE the change still replays correctly against pre-BBCE rules.
  //
  // Primary sources (packages/demeter-engine/src/states/ak/, corpus pack
  // built and merged this session — see PROVENANCE.md Finding 1 and the
  // "income-and-bbce" supplement in supplements.json):
  //   - Alaska DOH BBCE FAQ (dated 06/26/25): BBCE applies only to
  //     households that apply or recertify ON OR AFTER JULY 1, 2025 — a
  //     recent policy change, not a longstanding AK feature. "Most of our
  //     SNAP households are BBCE" per DOH's own FAQ language.
  //   - Alaska DOH "Alaska SNAP Standards" PDF (FSP 77, rev 09/25),
  //     "effective October 1, 2025 - September 30, 2026" — this phrasing
  //     is itself the evidence for bbce_fpl_basis: "federal_fiscal_year"
  //     (not calendar year), and shows the 200% FPL BBCE gross-income
  //     column now in use.
  //   - A household NOT eligible for BBCE (drug-felony exclusion,
  //     work-requirement noncompliance, lottery/gambling DQ, IPV,
  //     fleeing-felon/probation-parole-violator status, trafficking) still
  //     faces the standard federal 130%/100% FPL test AND the $3,000/
  //     $4,500 resource test — but that per-household carve-out isn't
  //     modeled at the facts level here, same state-level-boolean
  //     limitation every other BBCE state in this file already accepts
  //     (CA/MA/WA/TX/WI all set asset_waiver state-wide, not conditioned
  //     on a specific household's BBCE conferral).
  AK: [
    {
      // Pre-BBCE snapshot — preserves what was actually true before the
      // change, for correct historical replay of any determination dated
      // before 2025-07-01. Same start date as the pre-#806 placeholder.
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2025, 5, 30)), // 2025-06-30
      state_code: "AK",
      label: "Alaska (pre-BBCE, higher allotments)",
      bbce: false,
      bbce_fpl_basis: null,
      asset_waiver: false,
      sua_by_tier: {
        HCSUA: new Decimal("625"),
        LUA: new Decimal("254"),
        phone: new Decimal("26"),
        none: new Decimal("0"),
      },
      allotment_tier: "AK",
      // MODIFIED — per the AK corpus pack (packages/demeter-engine/src/
      // states/ak/PROVENANCE.md, Finding 2), a rehabilitation-pathway
      // carve-out under AS 47.27.015: disqualification does not apply if the
      // person demonstrates satisfactory probation/parole completion,
      // treatment participation, or reentry-plan compliance. This
      // classification is independent of the bbce/asset_waiver correction
      // tracked separately in #804 — do not conflate the two when fixing #804.
      drug_felony_ban: "modified",
      abawd_waiver_avail: true,
      rmp_operated: false,
    },
    {
      // Post-BBCE snapshot — effective 2025-07-01 per DOH's BBCE FAQ
      // (06/26/25): applies to households that apply/recertify on or after
      // this date. Every field EXCEPT bbce/bbce_threshold_pct/
      // bbce_fpl_basis/asset_waiver is IDENTICAL to the pre-BBCE snapshot —
      // this correction is scoped to those four fields only (#804).
      effective_start: new Date(Date.UTC(2025, 6, 1)), // 2025-07-01
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "AK",
      label: "Alaska (BBCE-200, higher allotments)",
      bbce: true,
      bbce_threshold_pct: 200,
      // "effective October 1, 2025 - September 30, 2026" (FSP 77 rev 09/25)
      // is a federal-fiscal-year framing, not a calendar-year one.
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("625"),
        LUA: new Decimal("254"),
        phone: new Decimal("26"),
        none: new Decimal("0"),
      },
      allotment_tier: "AK",
      drug_felony_ban: "modified",
      abawd_waiver_avail: true,
      rmp_operated: false,
    },
  ],

  // New Jersey — DHS/DFD (NJ SNAP). Backfilled from the adversarially-built
  // Demeter corpus pack (packages/demeter-engine/src/states/nj/,
  // PROVENANCE.md), the same "translate the corpus's already-cited
  // findings into the engine's stricter typed shape" build this plan
  // document's §5 describes — not a fresh from-zero fetch. NJ was a
  // genuine blank slate: no prior StatePolicy entry, no discrepancy to
  // reconcile against existing engine work.
  //
  // BBCE: N.J.A.C. 10:87-2.36, "Expanded Categorical Eligibility" — a flat
  // 185% FPL gross-income screen (NOT 200%, unlike most other BBCE states
  // in this file) conferred via a brochure given at application (10:87-
  // 2.36's own text), waiving the net income test; resources are "not to
  // be considered." bbce_fpl_basis is federal_fiscal_year: 10:87-2.36's
  // dollar figures are published on the same FFY26 (10/1/2025-9/30/2026)
  // cycle as every other axis below, confirmed by the corpus pack's own
  // FFY26 income chart. A separate, narrower N.J.A.C. 10:87-2.32 pathway
  // (WFNJ/TANF/SSI cat-elig) also exists but isn't separately modeled here
  // — same "general BBCE screen is the modeled path, a narrower cat-elig
  // pathway isn't" pattern several other states in this file already
  // accept (e.g. NV's ECE vs its base-categorical path).
  //
  // asset_waiver: true — 10:87-4.1(b) exempts expanded-cat-elig households
  // (nearly everyone, given the 185% screen above) from the resource test
  // entirely; the tested minority (IPV-disqualified, work-noncompliant, or
  // elderly/disabled households over 185% FPL on the net-only path) still
  // faces the FEDERAL $3,000/$4,500 limit — this engine always reads that
  // from federal-tables.ts, so no NJ-specific resource dollar figure needs
  // to be authored here even though NJ's OWN un-amended regulation text
  // (10:87-4.11) still prints the stale pre-2009 $2,000/$3,000 figures
  // (corpus pack Finding 4 — a codification lag in NJ's own printed text,
  // not a live policy divergence; DFD's public messaging already states
  // the correct current $3,000/$4,500).
  //
  // sua_by_tier: null — genuinely unconfirmed, same discipline as PA's and
  // MN's null entries above, NOT a guess. The corpus pack's own build
  // could independently corroborate only ONE of the three federally-
  // required tiers, and only secondarily: NJ's HCSUA is reported at $977/
  // month (up from $878, eff. 10/1/2025) by a NJ Medicaid Communication
  // (No. 25-07) that references DFD's own SNAP figures — but the
  // Communication's own source PDF could not be independently fetched (two
  // nj.gov URL variants both 404'd, even via curl with a browser User-
  // Agent). NJ's LUA and UTA/phone dollar figures were not located at all
  // in that pass. `sua_by_tier` is a single object requiring all four
  // slots (HCSUA/LUA/phone/none) — authoring HCSUA alone and guessing the
  // other two would be worse than the honest null, so this stays null
  // until a working primary source for all three tiers is reached.
  //
  // drug_felony_ban: "none" — a VERIFIED FULL OPT-OUT, not a fail-open
  // default. N.J.A.C. 10:87-3.18's own official History note (fetched
  // directly from the current codified manual) confirms the FORMER 10:87-
  // 3.18 provision ("Individuals convicted of use, possession, or
  // distribution of controlled substances") "was repealed" by R.2012
  // d.031, eff. 2/6/2012 — the section number was later reused for an
  // unrelated duplicate-participation rule, and the current manual
  // contains no drug-felony disqualification provision anywhere. The
  // underlying statutory authority is N.J.S.A. 44:10-48(d)(1) (the
  // WorkFirst New Jersey Act's opt-out under 21 U.S.C. § 862a(d)(1)(A)),
  // corroborated via the Collateral Consequences Resource Center's
  // national 50-state survey (a specialized legal-research org that
  // quotes state statutes directly) since Justia/FindLaw both 403'd the
  // raw statute text even via curl with a browser User-Agent — a real,
  // logged re-verification gap (see the corpus pack's freshness.json), but
  // the finding itself rests on two independent, mutually-corroborating
  // sources (the regulation's own History note + the statute-quoting
  // secondary source), not one. No waiting period, no treatment-compliance
  // condition, no felony-class carve-out — the cleanest of the three
  // drug-felony postures this file documents (full ban / modified ban /
  // full opt-out).
  //
  // abawd_waiver_avail: true — New Jersey currently holds a REAL, time-
  // bound ABAWD geographic waiver in Cape May County and Camden City,
  // effective 2/1/2026 through 1/31/2027 (DFD's "Federal Changes to SNAP"
  // page + USDA's own FY2026 waiver-approval letter, dated 2/10/2026, both
  // independently fetched by the corpus pack — Cape May 10.8% and Camden
  // City 10.5% three-month-average unemployment, both over the 7 CFR
  // 273.24(f) 10% threshold). Every other NJ county is time-limited as of
  // 2/1/2026 (DFD's own page: "New Jersey was under a waiver for all
  // counties except Morris through January 31, 2026. As of February 1,
  // 2026, only Camden City and Cape May County are under a time limit
  // waiver.").
  //
  // DELIBERATELY NOT given a real per-county lookup (unlike CA's/MA's
  // WAIVER_COUNTIES_BY_STATE entries in work-requirements/waiver-
  // counties.ts) despite the waiver geography being well-documented and
  // narrow: Cape May County is a whole county (a clean FIPS match) but
  // Camden City is a SUB-COUNTY MUNICIPALITY inside the much larger Camden
  // County — the existing lookup is keyed by county-level "SSCCC" FIPS
  // only (see waiver-counties.ts's own doc-comment), which has no way to
  // represent "this one city, not the rest of its county." Adding Camden
  // COUNTY's FIPS to a set would wrongly extend the waiver-exemption
  // finding to the ~500K residents of Camden County who are NOT actually
  // in the waived city; adding ONLY Cape May's FIPS to a partial set would
  // be actively WORSE than no set at all — `areaOffersNoWaiver` in
  // gates/abawd.ts treats a county absent from an authored set as an
  // AFFIRMATIVE "not waived" (`!countySet.has(countyFips)` → true), which
  // would wrongly and confidently DENY the real Camden City exemption for
  // any household reporting Camden County's FIPS, converting today's
  // honest "unknown, fall back to the permissive state default" into a
  // false negative. `true` here follows the same "wrongly denying food is
  // the worse error" reasoning as CA's/MI's/NV's/AZ's entries above: it
  // over-approves ABAWD households in NJ's other 19 counties, at the cost
  // of never wrongly stripping the two genuinely-waived areas' exemption.
  // A future fix needs a Census PLACE-level (not county-level) lookup
  // mechanism this schema doesn't have yet — a different, larger gap than
  // "just add NJ to the existing Set," flagged rather than worked around;
  // see issue #825.
  //
  // rmp_operated: false — confirmed absent from USDA FNA's own official
  // RMP state list (fetched live by the corpus pack, page updated
  // 8/7/2026 — lists AZ/CA/IL(Cook+Franklin only)/MD/MA/MI/NY/RI/VA, no
  // NJ). New Jersey has repeatedly INTRODUCED, and left to die, an RMP
  // bill in three separate legislative sessions (A2892 2020-21, S1163/
  // A1460 2022, S3983 pending as of the corpus pack's build) — several
  // third-party explainer sites describe the bill's proposed program in
  // the present tense, which the corpus pack traced as the likely source
  // of a widespread "NJ has RMP" secondary-source error. `false` is a
  // verified current-law finding, not a fail-open default, and needs
  // re-checking if S3983 is ever enacted (corpus pack freshness.json).
  //
  // TWO SCHEMA GAPS this entry cannot express — both real, both
  // corpus-documented, neither silently dropped (see issue #824, matching
  // how NY's multi-tier BBCE and WI's multi-tier SUA gaps above are
  // documented as accepted limitations rather than worked around):
  //   1. Boats and motor homes as a counted resource. N.J.A.C. 10:87-
  //      4.3(a)4 / 4.8(a)3 exclude ordinary vehicles but COUNT recreational
  //      vehicles (boats, motor homes) at fair-market NADA value unless
  //      the vehicle is the household's primary residence — a real
  //      contrast with the "all vehicles excluded" rule this file's other
  //      states implicitly assume. `Facts` has no per-asset-type
  //      breakdown at all (`assets` is a single flat number or a
  //      "n/a:*" sentinel — facts.ts's own doc-comment), and no
  //      `StatePolicy` axis exists for a vehicle-treatment rule either —
  //      this isn't a per-state value this file's schema can carry, it's
  //      a Facts-shape gap shared by every state. Zero of this fixture's
  //      92 profiles model a boat/motor-home resource, so this has no
  //      practical effect on NJ's oracle coverage today, but a real New
  //      Jersey household with one would be silently under-counted.
  //   2. Child support paid as an income EXCLUSION, not an ordinary
  //      deduction. N.J.A.C. 10:87-5.9 places legally-obligated child
  //      support (including vendor payments and arrearages) under
  //      "Identification of income exclusions" (7 CFR 273.9(c) mechanism,
  //      subtracted from GROSS income before any test) rather than the
  //      "Identification of income deductions" mechanism (7 CFR
  //      273.9(d)(5), subtracted from NET income only, after the gross
  //      test already ran) this file's other child-support-documenting
  //      states use. `benefit-calc.ts` implements ONLY the ordinary-
  //      deduction mechanism engine-wide (`facts.deductions.
  //      child_support_paid` is summed into `otherDeductions`, applied
  //      after `aggregateIncomeForCalc`'s gross total is already fixed —
  //      see benefit-calc.ts's own math-summary comment) — there is no
  //      per-state axis or Facts field this StatePolicy entry could set
  //      to switch that mechanism, so this is a shared architecture gap,
  //      not something a single state's entry can fix. Exactly one of
  //      this fixture's 92 profiles (A08) carries a nonzero
  //      `child_support_paid` ($300); A08's NJ oracle entry was computed
  //      using the engine's standard ordinary-deduction mechanic (same as
  //      every other state) rather than inventing NJ-specific EID/gross-
  //      exclusion mechanics the corpus pack itself did not fully specify
  //      (it does not say whether NJ's exclusion also changes the base
  //      the 20% earned-income deduction applies to) — A08's VERDICT is
  //      unaffected either way (gross income is far under any BBCE
  //      threshold with or without the $300), only a benefit-dollar
  //      question remains genuinely open.
  NJ: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "NJ",
      label: "New Jersey / DHS-DFD",
      bbce: true,
      bbce_threshold_pct: 185,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: null,
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: true,
      rmp_operated: false,
    },
  ],

  // North Carolina — NCDHHS / "Food and Nutrition Services" (FNS in NC's
  // OWN manual means the state program, not the federal USDA agency of the
  // same acronym — see the NC corpus pack's program-identity supplement).
  // First "individual tier" build (docs/plans/snap-rules-50-state-engine-
  // completion.md §6) — a genuine blank slate, no prior StatePolicy or
  // oracle coverage existed. Every axis below is TRANSLATED from the
  // already-cited primary-source findings in the merged Demeter corpus pack
  // (packages/demeter-engine/src/states/nc/PROVENANCE.md +
  // supplements.json), built and merged 2026-08-11 — re-verification, not
  // fresh research; see that pack's own Sources table for the underlying
  // fetch method (direct curl w/ browser User-Agent; policies.ncdhhs.gov
  // 403s a bare WebFetch, same lightweight-bot-mitigation shape as other
  // states in this file, NOT an auth wall).
  //
  // BBCE (FNS 220.02(E), "Expanded (200%) Categorical Eligibility"): a flat
  // 200% FPL screen conferred via a TANF-services notice FNS 220.02(E)(4)
  // says "is included on all state approved applications" — the SAME
  // conferral-vehicle family as GA's TCOS pamphlet / MI's DVPS enrollment /
  // NV's "This Is Your Copy" page, but lower-friction still: the notice is
  // language on the application form itself, not a separate mailing.
  // bbce_fpl_basis: "federal_fiscal_year" — NC's dollar tables (FNS 360.01)
  // are captioned "effective October 1, 2025," the same FFY framing CA/WA/
  // FL/AZ/OR/WI/post-BBCE-AK already use in this file (contrast MA's
  // calendar_year).
  //
  // asset_waiver: true — FNS 220.05 confirms a categorically-eligible unit
  // (narrow OR expanded pathway) "automatically passes" ALL THREE of the
  // resource test, gross income test, AND net income test — the same full-
  // waiver breadth MN's entry documents (stronger than an asset-only
  // waiver), though this engine's schema only has one boolean slot for it,
  // same limitation every BBCE state above accepts.
  //
  // drug_felony_ban: "modified" — FNS 270.01 makes PERMANENT DISQUALIFICATION
  // the DEFAULT for any controlled-substance felony conviction (state or
  // federal) since 8/23/1996 — NC's default is disqualification, not
  // eligibility, a meaningfully different starting point from FL's/PA's/
  // AZ's/WI's "eligible unless a specific trigger fires" modified bans. The
  // ONLY reinstatement path (FNS 270.02) is doubly narrow: (a) the
  // conviction must be classified as a North Carolina Class H or I felony
  // (the state's two LEAST serious classes — any higher class stays
  // permanently disqualifying), AND (b) the conviction must have occurred
  // IN North Carolina specifically (FNS 270's own worked example: an
  // out-of-state conviction of equivalent severity stays permanently
  // disqualifying). Even inside that path: 6-month minimum wait + an Area
  // Mental Health Authority (AMHA) treatment-compliance determination that
  // can re-disqualify later. "modified" (not "full") is still the correct
  // classification under this file's #805 rule: setting "full" would gate
  // EVERY drug-felony household, but the Class-H/I-in-state reinstatement
  // path means the statute does NOT uniformly bar all of them the way TX's
  // genuine "full" entry does — same under-claim-is-the-lesser-harm
  // reasoning as FL/PA/AZ/WI's entries. The NC corpus pack explicitly
  // checked this against 3 independent secondary sources (NC Justice
  // Center, Collateral Consequences Resource Center, Public Health Law
  // Center) before drafting — this is a CONFIRMATION of already-accurate
  // secondary reporting, not a correction (contrast the RMP finding below).
  // A pending 2025-2026 session bill (SB 564 / HB 682) would eliminate both
  // disqualification tiers entirely but had not passed as of the corpus
  // pack's build date — not reflected here; re-verify if it enacts.
  //
  // abawd_waiver_avail: false — NOT a fail-open default; an affirmatively
  // sourced, decade-old STATUTORY BAR. N.C. Gen. Stat. § 108A-51.1
  // ("Prohibition on certain waivers," enacted S.L. 2015-294 § 16(a), eff.
  // 10/1/2015, fetched directly from ncleg.gov's current codified-statute
  // page AND the original 2015 session-law text) bars NCDHHS from ever
  // seeking an ABAWD geographic time-limit waiver, except for D-SNAP
  // waivers tied to a Presidential disaster declaration — a narrow carve-
  // out this engine doesn't model (D-SNAP is a different program). This is
  // the LONGEST-STANDING of any ABAWD-waiver prohibition in this file (OH's
  // comparable ORC § 5101.548 is eff. 2025; NC's predates it by a decade).
  // Independently corroborated: NCDHHS's own ABAWD program page states the
  // 3-month limit applies uniformly statewide, and USDA's current waiver
  // tracking names only MN/MT/ND as holding active statewide waivers — NC
  // is not among them. No NC_WAIVER_COUNTY_FIPS lookup exists (nor would
  // one be meaningful — the statute is a blanket state-level bar, not a
  // county patchwork), so this boolean IS the real, complete answer for
  // every NC household, unlike CA's/MI's/NV's/AZ's `true` entries above
  // (which are permissive fallbacks papering over real county-level
  // waivers this engine can't yet look up). `false` here denies an ABAWD
  // exemption claim outright — the correct, sourced result, not a
  // conservative guess.
  //
  // rmp_operated: false — a genuine SECONDARY-SOURCE CORRECTION (the RMP
  // finding's own shape, distinct from the drug-felony confirmation above).
  // USDA's current RMP state list (AZ/CA/IL Cook-Franklin/MD/MA/MI/NY/RI/VA)
  // does not include NC, and the NC corpus pack traced the likely source of
  // third-party confusion: NCDHHS's 10/4/2024 press release let FNS
  // participants buy hot prepared food from EBT-authorized VENDORS (gas
  // stations, grocery deli counters) after Hurricane Helene — a temporary,
  // ALREADY-EXPIRED (10/4-11/3/2024) federal disaster hot-foods waiver that
  // explicitly EXCLUDED restaurants, a different statutory mechanism from
  // the ongoing RMP option under 7 CFR 274.7(g). Several SNAP-explainer
  // sites conflate the two; this engine does not.
  //
  // allotment_tier: "48" — NC uses the federal 48-contiguous max-allotment
  // table; the corpus pack found no NC-specific elevated schedule (unlike
  // AK/HI's genuinely higher tables) — confirmed via FNS 360.01's own FY26
  // dollar table, which reproduces the shared federal figures exactly for
  // NC's Standard Deduction ($209/$223/$261/$299 — identical to
  // federal-tables.ts's FY26 standard_deduction map), the strongest
  // available signal NC's allotment table isn't independently elevated
  // either (both figures come from the same FNS 360.01 table).
  //
  // sua_by_tier — A NEW SCHEMA MISMATCH SHAPE not yet seen in this file:
  // NOT a missing tier (AZ/OH/IL/MI/WI/NV's gap) but a missing HOUSEHOLD-
  // SIZE DIMENSION inside an existing tier. FNS 340.09 / FNS 360.01 (eff.
  // 10/1/2025) scale NC's SUA continuously by household size — HCSUA $637
  // (size 1) / $699 (2) / $768 (3) / $837 (4) / $912 (5+); BUA (this
  // engine's LUA slot) $392 / $431 / $474 / $518 / $564 over the same
  // tiers; only the Telephone Utility Allowance (this engine's `phone`
  // slot) is genuinely flat at $42 regardless of size. This schema's
  // `sua_by_tier` has exactly one scalar per tier, no size dimension at
  // all (the closest precedent, AZ's SUA, is only a 2-BAND split — 1-3 vs
  // 4+ — not a continuous 5-tier scale). Values below are NC's real
  // household-SIZE-1 figures — the same "first person" base-figure
  // convention this codebase already uses everywhere else a federal table
  // has a "base + each additional" shape (FPL, standard deduction, max
  // allotment) — chosen for structural consistency, not because size-1 is
  // uniquely more "correct" than size-2 or size-3. A household of size 2+
  // gets an UNDER-STATED SUA/LUA from this engine until the schema grows a
  // size dimension; independently verified this materially changes very
  // few of the 92 oracle profiles' outcomes in practice, because most
  // multi-person households' excess-shelter deduction is already clamped
  // at the federal shelter cap ($744 FY26) regardless of the exact SUA
  // figure fed in — see the oracle-authoring commit's own note for which
  // profiles this DOES change (a small, disclosed set, not zero).
  NC: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "NC",
      label: "North Carolina / NCDHHS — Food and Nutrition Services",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("637"),
        LUA: new Decimal("392"),
        phone: new Decimal("42"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "modified",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Virginia — VDSS / Local Departments of Social Services (LDSS). Third
  // "individual tier" build (docs/plans/snap-rules-50-state-engine-
  // completion.md §6, after NC and NJ) — a genuine blank slate, no prior
  // StatePolicy or oracle coverage existed. Every axis below is TRANSLATED
  // from the already-cited primary-source findings in the merged Demeter
  // corpus pack (packages/demeter-engine/src/states/va/PROVENANCE.md +
  // supplements.json), built and merged 2026-08-11 — re-verification, not
  // fresh research; see that pack's own Sources table for the underlying
  // fetch method (direct curl w/ browser User-Agent of VDSS's complete SNAP
  // Manual PDF + pdftotext -layout, plus direct fetches of Va. Code
  // §§ 63.2-505.2/63.2-801 at law.lis.virginia.gov and USDA's FY2025-2029
  // ABAWD waiver index — every source hit a clean HTTP 200 on the first
  // attempt, a genuine negative result worth noting given how many prior
  // states in this file hit bot-mitigation walls).
  //
  // BBCE (VA SNAP Manual Part II.G.3; Va. Code § 63.2-801(B)): a flat 200%
  // FPL screen conferred via a TANF-funded-service notice printed on the
  // application itself — same low-friction conferral-vehicle family as
  // NC's FNS 220.02(E) notice. bbce_fpl_basis: "federal_fiscal_year" — the
  // corpus pack's dollar figures (Transmittal #36, 10/25) are captioned
  // "effective October 1, 2025," the same FFY framing NC/WI/CA/FL/AZ/OR/
  // post-BBCE-AK already use in this file. THIS PACK'S STRUCTURAL FINDING,
  // genuinely unusual in this roster: Virginia's 200% threshold AND its
  // no-asset-limit rule are written DIRECTLY INTO STATUTE (Va. Code
  // § 63.2-801(B): the State Board of Social Services shall "(ii) set the
  // gross income eligibility standard for SNAP benefits at 200 percent of
  // the federal poverty guidelines, and (iii) not impose an asset limit for
  // eligibility for SNAP benefits," "to the extent authorized by federal
  // law and regulations") — every other BBCE state in this file sets its
  // threshold through agency policy/regulation alone (NJ's N.J.A.C.
  // 10:87-2.36, NC's FNS manual section, etc.); reversing or narrowing
  // Virginia's BBCE posture would require a General Assembly statutory
  // amendment, a meaningfully higher bar than an agency rulemaking change.
  //
  // asset_waiver: true — VA SNAP Manual Part IX.B states plainly "the
  // resource limits do not apply to categorically eligible households or
  // members, including those who meet BBCE requirements" — the same full
  // waiver breadth every BBCE state in this file already models (the
  // tested minority still faces the federal $3,000/$4,500 limit, read from
  // federal-tables.ts, same as every state above). Separately, Part IX.C.1.c
  // creates a narrow exception that reaches EVEN BBCE households: $4,500+
  // single-game lottery/gambling winnings cause outright ineligibility —
  // this is the SAME federal lottery/gambling disqualification
  // (7 CFR 273.11(r)) `gates/disqualifications.ts` already enforces
  // state-agnostically via the `disqual: ["lottery"]` tag, so no
  // Virginia-specific modeling was needed for this axis.
  //
  // drug_felony_ban: "none" — a VERIFIED FULL STATUTORY OPT-OUT, not a
  // fail-open default. Va. Code § 63.2-505.2, fetched directly from
  // law.lis.virginia.gov: "A person who is otherwise eligible to receive
  // food stamp benefits shall be exempt from the application of § 115(a)
  // of the federal Personal Responsibility and Work Opportunity
  // Reconciliation Act of 1996... and shall not be denied such assistance
  // solely because he has been convicted of a drug-related felony." The
  // statute's own History note shows it originated in 2005 (c. 576) as a
  // narrower, modified-ban version and was AMENDED in 2020 (cc. 221, 361)
  // to its current full-opt-out form — corroborated by contemporaneous
  // Virginia Mercury/VPM coverage of 2020 legislation ending Virginia's
  // SNAP/TANF drug-felony bans effective July 1, 2020. VA's SNAP Manual
  // contains no drug-felony disqualification provision anywhere in the
  // 33,000+ lines the corpus pack fetched and searched, consistent with the
  // statute. No waiting period, no treatment-compliance condition, no
  // felony-class carve-out — the cleanest of the postures this file
  // documents, matching NJ's/IL's/OH's/MI's/NV's/OR's/MN's "none" shape,
  // though on a distinct statutory timeline (2020, not NJ's 2012 or MI's
  // 2021).
  //
  // abawd_waiver_avail: false — an AFFIRMATIVELY SOURCED, currently-zero
  // finding, not a fail-open default, and — unlike CA's/MI's/NV's/AZ's
  // permissive `true` entries above — genuinely simple: Virginia holds NO
  // waiver ANYWHERE in the Commonwealth today, so there is no county-level
  // nuance a per-county lookup (`work-requirements/waiver-counties.ts`)
  // would need to represent (that pattern exists for CA/MA precisely
  // because THEY have a real subset of waived counties this boolean can't
  // express; Virginia's real answer needs no subset at all). VA SNAP Manual
  // Appendix I ("Localities Whose Residents Are Exempted from the Work
  // Requirement") is a historical table: STATEWIDE exemption April
  // 2020–June 2023, narrowing lists of specific waived localities through
  // June 2025 (including Brunswick, Buchanan, Danville, Dinwiddie,
  // Greensville/Emporia, Hopewell, Petersburg, Sussex, and others across two
  // periods), then, as of July 2025: "No exempt areas." Independently
  // corroborated against a SECOND source: USDA's own official ABAWD Time
  // Limit Waivers FY2025-2029 index (fetched directly, page updated
  // 7/22/2026) confirms Virginia is ABSENT from the list of states that
  // submitted ANY waiver request for FY2025 or FY2026 — a list that
  // includes 20+ other states and DC. Two independent sources agree. This
  // is a real, fairly recent reversal from Virginia's own multi-year waiver
  // history (both dense Northern-Virginia/DC-suburb counties and rural
  // Southside/Appalachian counties — several of which appear repeatedly on
  // the pre-2025 waived-locality list above — are currently subject to the
  // standard 3-in-36-month time limit with no exception), worth flagging
  // clearly since a reader relying on that older history could easily
  // assume some Virginia locality is still covered. None is, as of this
  // build. (The corpus pack separately flags that VA SNAP Manual Appendix
  // I's own footnote is STALE — it still says "except... over age 54"
  // where Part XV.A's own body text correctly states the current
  // post-OBBBA 18-64 range — an internal-document inconsistency, not a
  // live divergence; this engine's own ABAWD gate already applies the
  // correct 18-64 ceiling post-OBBBA via its own dated cutoff, unaffected
  // either way.)
  //
  // rmp_operated: true — Virginia's Restaurant Meals Program (VRMP) is
  // real, current, and — unusually — STATUTORILY MANDATED for every
  // locality, not a local-option or agency-discretion program: Va. Code
  // § 63.2-801(A), fetched directly, states "[SNAP] program shall include
  // participation in the Restaurant Meals Program" as part of a program "in
  // which each political subdivision in the Commonwealth shall
  // participate." Confirmed through a THIRD independent source: SB1020
  // (2025 session), enacted as Chapter 321, effective July 1, 2025,
  // separately required VDSS to report to the Governor and General Assembly
  // on VRMP's implementation by December 1, 2025 — confirming VRMP is a
  // live, actively-monitored, and quite RECENT program (about one year old
  // as of this pack's build), not a longstanding fixture. Virginia is named
  // on USDA's own official RMP state list alongside AZ/CA/IL(Cook+Franklin
  // only)/MD/MA/MI/NY/RI — a direct CONTRAST with this file's NJ entry,
  // where a similarly-worded bill has died in committee three separate
  // legislative sessions without ever being enacted.
  //
  // allotment_tier: "48" — no Virginia-specific elevated max-allotment
  // schedule found; VA's own manual states the Standard Deduction
  // ($209/$223/$261/$299), Maximum Excess Shelter Deduction ($744), and
  // Homeless Shelter Allowance ($198.99) figures IDENTICALLY to
  // federal-tables.ts's FY26 snapshot — the same "shared source, so the
  // allotment table isn't independently elevated either" signal NC's entry
  // above uses.
  //
  // sua_by_tier — A GENUINELY DIFFERENT SCHEMA-MISMATCH SHAPE than every
  // other gap this file has documented: not a state that publishes a real
  // standard this engine's schema has no SLOT for (IL's Single Utility,
  // OH's Single SUA, NV's IUA, MI's water/sewer/cooking-fuel/trash, WI's
  // four unmapped standards), but a state whose utility-standard structure
  // is FLATTER than usual on BOTH axes at once. VA SNAP Manual
  // Part X.A.4.e-f sets a utility standard of $375/month for a residence of
  // 1-3 persons and $476/month for 4+ (SIZE-SCALED, like NC's SUA, but only
  // TWO bands where NC scales continuously across five) — and,
  // structurally, Virginia publishes only TWO utility-allowance tiers
  // TOTAL, not three: the single "utility standard" already bundles
  // heat/cooling, electricity, gas, water, sewerage, septic maintenance,
  // garbage collection, AND the basic telephone service fee together (Part
  // X.A.4.e) — there is no intermediate "non-heating, multiple other
  // utilities" tier the way NC's BUA, WI's LUA, or a typical three-tier
  // state's LUA provides. A household not entitled to the utility standard
  // (no separately identifiable heating/cooling expense) either uses actual
  // costs, or — if its ONLY utility expense is a telephone — claims the
  // separate flat telephone standard of $54/month (Part X.A.4.f).
  //
  // HCSUA maps VA's 1-3-person band ($375) directly — chosen under the
  // SAME reasoning AZ's entry above uses for its own genuinely 2-banded
  // ("1-3 participants vs 4+") SUA/LUA ladder: this schema has no household-
  // size dimension, so the more common 1-3-person band is encoded and a 4+
  // household's real $476 figure is UNDER-STATED by $101/month here.
  // Independently verified: of the 92 oracle profiles, exactly 6 are 4+
  // person households on the HCSUA tier (A04, D08, P60, MX2, P64, P65) —
  // none of their verdicts flip as a result (all are comfortably within the
  // 200% BBCE income screen either way), only their benefit-dollar figure
  // is under-stated relative to VA's real $476 figure.
  //
  // phone maps VA's flat $54/month telephone standard directly — a clean
  // 1:1 fit, no approximation.
  //
  // LUA is the genuinely NOVEL gap: unlike every prior "missing tier" this
  // file has documented, this is not a case where Virginia publishes a
  // real standard this schema merely has no slot for — Virginia's own
  // policy has NO utility standard at all for a household with electric/gas
  // costs but no heating/cooling expense (this engine's LUA-tier scenario,
  // `determineSUATier`'s LIMITED branch). Per Part X.A.4.e-f, that exact
  // household would use ACTUAL documented utility costs in real VA
  // practice — a mechanism this engine's `Facts` shape does not carry (no
  // "actual utility cost" field distinct from a named tier standard),
  // making this a genuine Facts-shape gap, not a per-state value this
  // engine can correctly express, the same category of accepted limitation
  // as NJ's boat/motor-home and child-support-exclusion gaps (#824) above.
  // Rather than fabricate a number with no VA citation behind it, LUA is
  // set to $0 — the same "no fabrication" discipline this file applies
  // everywhere else — which UNDER-STATES (never over-states) the excess-
  // shelter deduction for a household in this exact fact pattern, the
  // conservative direction of error. Independently verified this affects
  // exactly 2 of the 92 oracle profiles (A02-elderly-woman-ssi-only,
  // A09-lpr-40-quarters-low-income — both authored with `sua_tier: "LUA"`
  // in the base v0.6 fixture); NEITHER profile's VERDICT is affected (both
  // clear VA's 200% BBCE screen, or are pure-SSI categorically eligible,
  // regardless of shelter-deduction size), only their benefit-dollar
  // figure is lower than it would be under a state with a real LUA-
  // equivalent standard (A02: $170 here vs. $288 under NC's $392 LUA on the
  // identical facts; A09: similarly lower). Flagged here rather than
  // silently guessed — a future Facts-shape extension carrying a real
  // "actual utility cost" field (the same class of fix NJ's #824 needs for
  // its own gap) would be the correct long-term resolution, not a per-state
  // engine value.
  VA: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "VA",
      label: "Virginia / VDSS",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("375"),
        LUA: new Decimal("0"),
        phone: new Decimal("54"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: true,
    },
  ],

  // Missouri — DSS / Family Support Division (FSD). Sixth "individual
  // tier" build (docs/plans/snap-rules-50-state-engine-completion.md §6,
  // after NC/NJ/VA; TN's and IN's builds are separate, concurrently-
  // in-flight PRs not touched here) — a genuine blank slate, no prior
  // StatePolicy or oracle coverage existed. Every axis below is
  // TRANSLATED from the already-cited primary-source findings in the
  // merged Demeter corpus pack (packages/demeter-engine/src/states/mo/
  // PROVENANCE.md + supplements.json), built 2026-08-11 — re-verification,
  // not fresh research; see that pack's own Sources table for the
  // underlying fetch method (direct curl w/ browser User-Agent of 18
  // dssmanuals.mo.gov SNAP-manual subsections + the DSS SNAP Program
  // Changes Flyer PDF, dated 10/2025, via pdftotext -layout, plus a
  // direct fetch of RSMo § 208.247 at revisor.mo.gov — seventeen of
  // eighteen manual subsections and the statute all hit a clean HTTP 200;
  // only the resource-limit subsection was gated, see asset_waiver below).
  //
  // bbce: false — THIS PACK'S FLAGSHIP FINDING, a genuine secondary-source
  // CORRECTION, not a confirmation: several SNAP-benefit calculator sites
  // assert "Missouri uses BBCE at 200% FPL with no asset limit for most
  // households." Missouri's own current income-limit table (MO IM Manual
  // 1115.099.00, cross-checked against the DSS SNAP Program Changes Flyer
  // dated 10/2025) publishes EXACTLY two income-limit columns — 130% FPL
  // gross, 100% FPL net — with no higher BBCE-style percentage anywhere.
  // Missouri is corroborated as one of a small non-BBCE minority (per
  // secondary research referencing USDA's own BBCE state list, alongside
  // AR/KS/MS/NE/SD/UT/WY). This is Missouri's own analog to Indiana's/
  // Kansas's no-BBCE archetype in this file, but sharper: this pack found
  // and DISPROVED an actively wrong, specific, numbered claim (200% FPL)
  // rather than merely confirming an already-accurate absence.
  //
  // bbce_fpl_basis: null — no BBCE tier exists to have a basis.
  //
  // asset_waiver: false — Missouri's general applicant population still
  // faces the federal resource test (read from federal-tables.ts:
  // $3,000/$4,500, same figures MO IM Manual 1110.005.00 corroborates —
  // see below). A GENUINE THIRD categorical-eligibility structural
  // pattern this file has not yet documented, distinct from both the
  // "Basic CE" (IN's narrow TANF/SSI-cash-only pathway) and the BBCE
  // pattern (a universal TANF-funded informational pamphlet reaching ALL
  // applicants, raising the effective income ceiling for everyone): MO IM
  // Manual 1135.035.00 extends categorical eligibility to households where
  // a member receives or is AUTHORIZED to receive specific TANF-funded
  // "special support services" (Child Care assistance, Community
  // Partnerships job-placement programs including the Missouri Mentoring
  // program) — broader than Basic CE (not limited to actual cash
  // recipients), but SERVICES-CONDITIONED rather than a blanket
  // income-ceiling raise: it requires ACTUAL receipt of or authorization
  // for a genuine named service, not mere application. This schema has no
  // slot for "services-conditioned CE" as a distinct axis from BBCE — the
  // CE-qualified subset of households genuinely does skip the
  // resource/gross/net tests (MO IM Manual 1135.035.00: "do not have to
  // meet resource limits, gross income limits, or net income limits at
  // all"), but that subset is a conditional, per-household fact this
  // engine's federal `cat_elig: "pure_SSI"/"pure_PA"/"pure_TANF"` path
  // already carries state-independently (gates/categorical.ts) — MO's
  // services-conditioned members are additive to that federal set, not
  // modeled as a separate axis. `asset_waiver: false` correctly describes
  // the general (non-cat-elig) population, the same "state-wide boolean
  // answers the general case, per-household cat-elig facts answer the
  // narrow case" split every other state in this file already accepts.
  //
  // Resource limit ($3,000/$4,500) — MO IM Manual 1110.005.00 returned a
  // PASSWORD-PROTECTED WALL on every direct-fetch attempt (page-specific,
  // not site-wide: the sibling Vehicles subsection in the same chapter
  // rendered cleanly), so this pack's own figure rests on convergent
  // secondary corroboration (Missouri Budget Project's 2025 SNAP
  // overview), not Missouri's own primary text. Immaterial to this
  // engine regardless: the dollar figure is the plain federal standard
  // (federal-tables.ts's `assetLimitFor`, not a per-state StatePolicy
  // field), and MO's secondary-sourced figure matches it exactly — this
  // gap affects confidence in the corpus pack's own citation, not any
  // value encoded here.
  //
  // Vehicles — MO IM Manual 1110.020.10: "Exclude the value of all
  // vehicles" (car, truck, motorcycle, ATV, camper, trailer, motor home,
  // boat) — a genuinely BROADER blanket exclusion than any prior state in
  // this file (e.g. IN's hybrid rule: ordinary vehicles exempt, boats/
  // campers counted at equity value). Not modeled: this schema has no
  // asset-type breakdown (`Facts.assets` is a single flat total), the
  // same already-filed Facts-shape gap as #824 — not re-filed here, MO's
  // situation is the same category of gap, not a new one.
  //
  // sua_by_tier — POPULATED with disclosed confidence, not null. MO IM
  // Manual 1115.035.25.15 publishes four flat utility standards: SUA
  // (full heat/cool) $495, Non-Heating/Cooling Standard (NHCS, 2+
  // non-heat utilities) $363, Lower Utility Allowance (LUA, exactly ONE
  // qualifying utility expense) $158, Telephone Standard $79 — dated to
  // IM-50 (Sept 2024, FFY2025); despite a targeted search this pack could
  // NOT locate a confirmed FFY2026 update to these four specific figures,
  // even though Missouri's OTHER FFY2026 figures (Standard Deduction,
  // Excess Shelter cap, Homeless Deduction — see allotment_tier below)
  // ARE independently confirmed current via the same 10/2025 Flyer. This
  // is a real "sourced but possibly one FY stale" figure, not a "no
  // figure exists at all" gap (PA's/NJ's/MN's null discipline) — the same
  // distinction MA's entry above already draws (PENDING VERIFICATION,
  // still populated) — so populated with the disclosed staleness risk
  // named here rather than blocking benefit computation entirely.
  //
  // A GENUINE NAMING-COLLISION MAPPING TRAP: Missouri's OWN "LUA" label
  // ($158, exactly one utility) is NOT what this schema's `LUA` field
  // holds below. Mirroring Ohio's precedent (this file's OH entry: Ohio's
  // own "LUA" = 2+ utilities, mapped; Ohio's separately-named "Single
  // Standard Utility Allowance" = exactly one utility, UNMAPPED and
  // disclosed) — this schema's `LUA` slot functionally represents "the
  // tier a household with SOME non-heat utility burden reaches" via
  // `determineSUATier`'s single LIMITED branch (`has_electric_or_gas ===
  // "yes"`, no distinction of utility COUNT). Missouri's NHCS ($363, 2+
  // utilities) is the functional match for that branch — mapped to LUA
  // below — NOT Missouri's own literally-named "LUA" ($158, exactly one
  // utility), which is the genuinely UNMAPPED, disclosed 4th tier (same
  // "real figure, no reachable branch" treatment as OH's $108 Single SUA
  // and IL's $78 Single Utility). A household whose real MO tier is the
  // $158 one-utility LUA gets computed at $363 here instead — an
  // over-statement in that specific subset, the same direction of
  // approximation error OH's identical 4-tier collapse already accepts
  // for the same structural reason (the engine cannot distinguish utility
  // COUNT, only utility PRESENCE, so an exact fit for both of MO's two
  // real non-heat tiers is not achievable with this schema).
  //
  // phone: $79 — Missouri's Telephone Standard, a clean 1:1 fit.
  //
  // Child support — MO IM Manual 1115.035.20 ("Child Support Exclusion,"
  // not "deduction") is an income EXCLUSION applied even to the gross
  // 130% FPL test itself (7 CFR 273.9(c)), matching this file's VA/NJ/IL
  // pattern — NOT the ordinary post-gross deduction (7 CFR 273.9(d)(5))
  // this engine implements engine-wide (benefit-calc.ts). Same already-
  // filed Facts-shape/mechanism gap as #824 (NJ's entry above), not a new
  // one — exactly one of the 92 oracle profiles (A08) carries a nonzero
  // `child_support_paid` ($300); its MO oracle entry uses the engine's
  // standard ordinary-deduction mechanic since A08's verdict is
  // unaffected either way, the same acceptance NJ's A08 entry already
  // documents.
  //
  // allotment_tier: "48" — no Missouri-specific elevated max-allotment
  // schedule found; MO's own Standard Deduction ($209/$209/$209/$223/
  // $261/$299), Excess Shelter cap ($744), and Homeless Standard
  // Deduction ($198.99) — all confirmed current for FFY2026 via the
  // 10/2025 DSS Flyer — match federal-tables.ts's FY26 snapshot exactly,
  // the same "shared source" signal NC's/VA's entries above use.
  //
  // drug_felony_ban: "modified" — Missouri's own statute, RSMo § 208.247,
  // was fetched DIRECTLY AND IN FULL from revisor.mo.gov with NO access
  // barrier (a genuine plus over IN's equivalent statute, which needed
  // secondary corroboration because its lookup site was an unexecutable
  // client-side app). Together with its implementing manual section (MO
  // IM Manual 1105.015.10.35.10), the exemption from the federal lifetime
  // ban requires ALL FOUR of: (1) DBH-approved substance-abuse treatment
  // participation/waitlist/completion/provider-certified-not-needed; (2)
  // compliance with all court/DBH/probation-parole obligations; (3) no
  // ADDITIONAL controlled-substance conviction within one year of the
  // original; AND (4) — the sharpest contrast with this file's other
  // modified-ban states — demonstrating sobriety via VOLUNTARY URINALYSIS
  // TESTING that the statute and manual both specify is PARTICIPANT-PAID
  // ("The FSD will not pay for the urinalysis testing") and cannot be
  // self-administered. Genuinely STRICTER than IN's modified ban (which
  // requires neither drug testing nor treatment). Gate behavior unchanged
  // (fails open, same as every other "modified" entry) until this engine
  // models the actual condition — see #805.
  //
  // abawd_waiver_avail: false — an AFFIRMATIVELY-SOURCED, currently-zero
  // finding from THREE convergent sources, though Missouri's own manual
  // is SILENT on waiver status (unlike VA's manual, which affirmatively
  // states "No exempt areas," a slightly weaker evidentiary posture than
  // VA's entry above, still preferred over guessing): USDA's own Time
  // Limit Waivers FY2025-2029 index (no Missouri entry), the independent
  // abawdmap.us aggregator ("No waiver — rule applies" for Missouri), and
  // Missouri's own current statewide unemployment rate (3.7%, well under
  // the 10% federal waiver-eligibility threshold). No county-level lookup
  // needed — a real answer of "nowhere" has no county-level nuance to
  // represent, the same VA-empty-set reasoning this file already uses.
  //
  // rmp_operated: false — Missouri is absent from USDA's own current
  // "States that Operate a Restaurant Meals Program" list (the same
  // 9-jurisdiction list this file's other RMP findings corroborate).
  // Notable color: Missouri's legislature has introduced an RMP bill in
  // at least four consecutive sessions (2022-2025) — none has passed,
  // the same repeated-dead-bill pattern this file's NJ entry documents.
  MO: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "MO",
      label: "Missouri / DSS — Family Support Division",
      bbce: false,
      bbce_fpl_basis: null,
      asset_waiver: false,
      sua_by_tier: {
        HCSUA: new Decimal("495"),
        LUA: new Decimal("363"),
        phone: new Decimal("79"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "modified",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Indiana — FSSA / Division of Family Resources (DFR). Fourth "individual
  // tier" build (docs/plans/snap-rules-50-state-engine-completion.md §6,
  // after NC, NJ, VA) — a genuine blank slate, no prior StatePolicy or
  // oracle coverage existed. Every axis below is TRANSLATED from the
  // already-cited primary-source findings in the merged Demeter corpus pack
  // (packages/demeter-engine/src/states/in/PROVENANCE.md + supplements.json),
  // built 2026-08-11 — re-verification, not fresh research; see that pack's
  // own Sources table for the underlying fetch method (direct curl w/
  // browser User-Agent of eight FSSA DFR Program Policy Manual chapter PDFs,
  // every single fetch a clean HTTP 200 — no bot-mitigation wall for
  // Indiana's own program manual, a genuine contrast with the statute-text
  // barrier disclosed below).
  //
  // bbce: false — THIS FILE'S FLAGSHIP FINDING for Indiana, and a genuine
  // MINORITY position in this roster (most already-built states have
  // adopted some form of BBCE): IN PPM 3010.05.00 (Income Standards) states
  // plainly that SNAP's maximum gross income amounts are based on the plain
  // 130% FPL / 100% FPL federal test, with no elevated BBCE percentage
  // anywhere. Independently cross-checked against IN PPM 2414.10.05
  // (Categorical Eligibility), which defines categorical eligibility ONLY
  // as the narrow "Basic CE" pathway (every AG member certified SSI and/or
  // TANF) — no expanded/broad-based pathway is described anywhere in
  // Chapter 2400 or Chapter 3000. This is a CONFIRMATION of a claim several
  // SNAP-calculator/explainer sites already make about Indiana, verified
  // against Indiana's own primary source rather than repeated unchecked
  // (corpus pack Finding 1). Because bbce is false, bbce_threshold_pct is
  // omitted entirely and bbce_fpl_basis is null — the same non-BBCE shape
  // this file's KS entry already established.
  //
  // asset_waiver: false — Indiana's narrow Basic CE (SSI/TANF-only)
  // households ARE exempt from the resource test, but that exemption flows
  // from ordinary federal categorical eligibility (7 CFR 273.2(j)), not a
  // BBCE-driven full waiver, and reaches only the narrow SSI/TANF-only
  // minority. The general-case NPA household faces IN PPM 3005.05.00's
  // plain federal $3,000 (standard) / $4,500 (elderly-or-disabled) resource
  // limit, effective 10/01/2024 — read from federal-tables.ts, same as
  // every state above. Same "the general case is asset-tested" posture
  // KS's own bbce:false entry already uses in this file.
  //
  // sua_by_tier — FULLY POPULATED, not null: a genuine contrast with this
  // file's PA/NJ/MN null entries. IN PPM 3020.00.00's four flat-dollar
  // (non-size-scaled) utility tiers are all current, dated 10/01/2025, and
  // independently cross-checked TWO ways before trusting them (corpus pack
  // adversarial refute pass): against the SAME manual's own prior-period
  // column (5/1/2024-9/30/2025: $473/$276/$60/$35), confirming a clean
  // COLA-style step rather than an isolated, unverifiable figure; and
  // against VA's own already-independently-confirmed current FFY2026
  // Standard Deduction figures ($209/$209/$209/$223/$261/$299), which match
  // Indiana's IN PPM 3025.10.00 figures exactly — a genuine positive signal
  // Indiana's manual is current, not stale, the OPPOSITE of the gap this
  // file's PA/NJ entries disclose for the same class of figures. HCSUA maps
  // IN's SUA 1 (heating/cooling, for AGs with a heating/cooling expense or
  // that receive/expect LIHEAP) at $486; LUA maps SUA 2 (non-heating, for
  // AGs with 2+ of: non-heat electricity/fuel, water, sewer, trash, or
  // telephone) at $283; phone maps SUA 4 (telephone-only) at $36 — all
  // clean 1:1 fits, not approximations. SUA 3 (single utility, $62, for AGs
  // with EXACTLY ONE utility expense other than heating/cooling or
  // telephone) has NO slot in this schema's {HCSUA, LUA, phone, none}
  // shape — the same documented gap as IL's Single Utility ($78), OH's
  // Single SUA ($108), NV's IUA ($77), and AZ's undermodeled one-utility
  // case: an Indiana household in that exact fact pattern falls through to
  // NONE ($0) and loses the deduction entirely until the schema grows a
  // fifth tier.
  //
  // allotment_tier: "48" — no Indiana-specific elevated max-allotment
  // schedule found; IN's own manual's Standard Deduction ($209/$209/$209/
  // $223/$261/$299), Excess Shelter Expense Deduction cap ($744, IN PPM
  // 3025.15.00), and Homeless Shelter Deduction ($198.99, IN PPM
  // 3025.15.05) all reproduce federal-tables.ts's FY26 snapshot exactly —
  // the same "shared source, so the allotment table isn't independently
  // elevated either" signal NC's and VA's entries above use.
  //
  // drug_felony_ban: "modified" — Ind. Code Ann. § 12-14-30-3, a genuine
  // opt-out from the federal LIFETIME drug-felony ban effective 1/1/2020,
  // conditioned on completion of, or current compliance with, court-ordered
  // probation, parole, community corrections, or a reentry court program.
  // Per the Network for Public Health Law's own coded 50-state survey table
  // (independently parsed from the fetched PDF by the corpus pack), Indiana
  // requires NEITHER drug testing NOR drug treatment as a condition —
  // narrower than TN's own modified ban in this file, which conditions
  // eligibility on substance-abuse-treatment participation. "modified", not
  // "none", because ongoing compliance IS a live, real condition this
  // engine does not yet evaluate at the facts level (#805's rule) — the
  // same FL/PA/AZ/WI/KS under-claim-is-the-lesser-harm reasoning: setting
  // "full" would deny every Indiana drug-felony household, including the
  // majority who are compliant or already completed supervision.
  // DISCLOSED ACCESS BARRIER, same discipline as this file's PA drug-felony
  // entry: Indiana's own statute-lookup site (iga.in.gov) returned HTTP 200
  // but delivered only a bare client-side React SPA shell — no
  // server-rendered statutory text this pack's/this engine's fetch tooling
  // could read. Two third-party mirrors also failed outright (law.justia.com
  // HTTP 403; casetext.com HTTP 410, Gone) on every attempt (multiple
  // User-Agents, both http/https). This finding instead rests on THREE
  // convergent, independently-fetched sources (Indiana's own FSSA FAQ page;
  // the Public Health Law Center's Indiana entry; the Network for Public
  // Health Law's compiled 50-state survey), not Indiana's own primary
  // statutory text — disclosed plainly, not smoothed over (corpus pack
  // Findings 0 and 4).
  //
  // abawd_waiver_avail: false — an AFFIRMATIVELY SOURCED, currently-zero
  // finding, not a fail-open default. IN PPM 2438.17.05 states plainly,
  // regarding waivered labor surplus areas, "there are currently no such
  // designations" — independently cross-checked against USDA's own
  // official ABAWD Time Limit Waivers FY2025-2029 index AND the independent
  // abawdmap.us aggregator (both fetched directly by the corpus pack,
  // 2026-08-11), both corroborating zero active Indiana waivers. No
  // IN_WAIVER_COUNTY_FIPS lookup is needed or would be meaningful — a
  // genuinely empty statewide set needs no county-level nuance, the same
  // "zero is the real, complete state-level answer" shape as this file's
  // MA/NC/VA entries, not a permissive CA/MI/NV/AZ-style fallback papering
  // over real waived counties this engine can't yet look up. Indiana's own
  // manual also confirms the CURRENT post-OBBBA 18-64 ABAWD age range
  // ("as of 7/4/2025") and the OBBBA tribal-member (IHCIA) exemptions —
  // genuinely current, a notable contrast with this roster's TN pack, where
  // two separate documents both repeated a stale 18-49 range.
  //
  // rmp_operated: false — Indiana is absent from USDA's own current
  // official "States that Operate a Restaurant Meals Program" list (AZ, CA,
  // IL Cook/Franklin only, MD, MA, NY, RI, MI, VA — no IN), and the corpus
  // pack found no pending Indiana RMP bill in the Indiana General Assembly.
  //
  // NOT REPRESENTABLE IN THIS SCHEMA — a real, corpus-documented gap, not
  // silently dropped: Indiana's vehicle-resource rule is a genuine HYBRID
  // this roster has not seen combined in one state before — IN PPM
  // 2615.60.10 gives a BLANKET exclusion for ordinary vehicles used for
  // household transportation ("exempt, regardless of value, licensing
  // status, or condition," the same pattern this file's VA/NC entries
  // document), but IN PPM 2615.60.25 separately COUNTS recreational
  // vehicles — "campers, trailers, and boats" — at current equity value
  // unless the vehicle serves as the AG's actual home (the same pattern
  // this roster's TN corpus pack documents for boats/recreational
  // property). This is the SAME pre-existing schema gap already filed as
  // #824 (Facts.assets is a single flat number with no per-asset-type
  // breakdown, and no StatePolicy axis exists for a vehicle-treatment
  // rule) — not re-filed here, just newly confirmed present for Indiana.
  // Zero of this fixture's 92 profiles model a boat/camper/trailer
  // resource, so this has no practical effect on IN's oracle coverage
  // today. (Separately, informational only, no direct engine axis: IN's
  // Elderly Simplified Application Project offers a 36-month certification
  // period for all-elderly/disabled AGs — the LONGEST such period this
  // roster has documented; this engine does not model certification-period
  // length at all, for any state.)
  //
  // Oracle cross-validation: KS is Indiana's closest axis-twin among
  // registered states — identical bbce:false, bbce_threshold_pct:
  // undefined, bbce_fpl_basis: null, asset_waiver: false, drug_felony_ban:
  // "modified", abawd_waiver_avail: false, allotment_tier: "48", and
  // rmp_operated: false (differing only in the SUA dollar figures and
  // label). An independent Python calculator was cross-validated 92/92
  // exact match (verdict AND benefit) reproducing KS's already-graded
  // expected_by_state.KS oracle under KS's own policy params, PLUS all 37
  // non-`expected_by_state` variant rows (the same #636 discipline NC's and
  // VA's builds used), before trusting it for Indiana. Indiana's own 92
  // verdicts came back IDENTICAL to KS's on every profile (0 divergence) —
  // expected, since every axis controlling verdict is identical between the
  // two states; only the benefit-dollar figures differ, driven by the SUA
  // value differences. Two of the 37 variant rows
  // (M23-variable-gig-income-anticipation's "averaged" and
  // "recent_high_month" variants) needed an IN-specific `verdict_by_state`
  // override, matching KS's own DENY value there exactly (both are
  // non-BBCE federal-130%-gross-test states, so both deny where BBCE states
  // above 130% approve) — every other variant row uses the shared default
  // `verdict`, no divergence found.
  IN: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "IN",
      label: "Indiana / FSSA-DFR",
      bbce: false,
      bbce_fpl_basis: null,
      asset_waiver: false,
      sua_by_tier: {
        HCSUA: new Decimal("486"),
        LUA: new Decimal("283"),
        phone: new Decimal("36"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "modified",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Tennessee — TDHS. Fifth "individual tier" build (docs/plans/snap-rules-
  // 50-state-engine-completion.md §6, after NC/NJ/VA) — a genuine blank
  // slate, no prior StatePolicy or oracle coverage existed. Every axis below
  // is TRANSLATED from the already-cited primary-source findings in the
  // merged Demeter corpus pack (packages/demeter-engine/src/states/tn/
  // PROVENANCE.md + supplements.json + authorities.json), built and merged
  // 2026-08-11 — re-verification, not fresh research.
  //
  // TENNESSEE UNIQUELY RUNS TWO PARALLEL, INDEPENDENTLY-DATED CITATION
  // FAMILIES that the corpus pack found genuinely OUT OF SYNC in BOTH
  // directions (its own authorities.json _provenance note, verbatim): (1)
  // the codified "TN Rule" 1240-01 series, filed with the TN Secretary of
  // State, and (2) TDHS's own operational "TDHS Policy" 24.xx series. No
  // other state in this file maintains two separately-numbered, separately-
  // dated families for the SAME underlying rules — every citation below
  // names which family it draws from, and where the two disagree, which one
  // this entry follows and why.
  //
  // BBCE (TN Rule 1240-01-14-.15(2), "Expanded Categorical Eligibility",
  // amended 1/15/2026, EFFECTIVE 4/15/2026 — under 4 months old at this
  // build): a flat 200% FPL GROSS screen — NOT the stale 130% several
  // calculator/explainer sites (snapscreener.com, the Sycamore Institute's
  // own page) still quote, per the corpus pack's own live cross-check
  // against fox13memphis.com's June 2026 coverage ("Before it was 130%. Now
  // the total household gross monthly income can be up to 200"). TDHS's own
  // OLDER "TDHS Policy 24.24" (Categorically Eligible SNAP Recipients, last
  // reviewed 11/30/2023) has NOT been updated to describe this pathway at
  // all — the rule is ahead of the policy here, the FIRST of three
  // documented conflicts between TN's two families (corpus pack Finding 2).
  // bbce_fpl_basis: "federal_fiscal_year" — TN's rule text does not itself
  // state an FFY-vs-calendar-year framing (unlike AK's/NC's/VA's explicit
  // "effective October 1" captions); this follows the roster's established
  // default (every state but MA is federal_fiscal_year) absent contrary
  // evidence, an honest inference rather than a confirmed citation.
  //
  // *** GENUINE STRUCTURAL FINDING, this file's ONLY instance so far, filed
  // as issue #830 rather than silently encoded: TN's Expanded CE ALSO
  // requires net monthly income ≤ 100% FPL — a SEPARATE ceiling on top of
  // the 200% gross screen that every other flat-percentage BBCE state in
  // this file (VA's 200%, NJ's 185%, WI's 200%, etc.) does NOT carry.
  // `StatePolicy` has no axis for a BBCE state that keeps a net-income
  // overlay, and `verdict.ts`'s `bbceConferred` logic unconditionally skips
  // BOTH remaining income tests for every BBCE state alike once the
  // (possibly raised) gross threshold clears — this is an ENGINE
  // architecture gap, not a per-state value this entry's schema can
  // express, so `bbce_threshold_pct: 200` below correctly encodes TN's
  // GROSS screen but the engine will not enforce TN's net ceiling until
  // #830 is addressed. Independently verified impact (Python calculator,
  // #636 methodology, sourced from this same PROVENANCE.md + a byte-for-
  // byte port of verdict.ts/benefit-calc.ts's own logic): of the 92 v0.6
  // profiles the engine can actually COMPUTE for TN today (34 of 92 — the
  // rest SKIP on the null sua_by_tier gap below, before ever reaching the
  // income tests), ZERO show a divergence between the engine's actual
  // (net-test-skipped) architecture and TN's true (net-test-enforced)
  // policy — this gap has no live effect on any profile the engine can
  // currently grade. It DOES surface once null-SUA is compounded with a
  // household engineered to clear 200% gross narrowly while carrying enough
  // net income to fail the true 100% net ceiling: see `MX4-bbce-max-income-
  // with-any-benefit`'s oracle-authoring note below, and 3 profiles left
  // deliberately UNAUTHORED in `expected_by_state.TN` because the true
  // verdict is genuinely indeterminate without a real SUA figure (#830 has
  // the full list and math).
  //
  // asset_waiver: true — TDHS Policy 24.12 confirms categorically eligible
  // households (Basic OR Expanded CE) do not have to meet the resource
  // limit "unless the household receives a substantial lottery or gambling
  // winnings" — the same full-waiver-for-the-majority shape every BBCE
  // state above uses; the federal $3,000/$4,500 limit (read from
  // federal-tables.ts) still applies to the tested minority.
  //
  // sua_by_tier: null — a genuine, disclosed gap, same discipline as PA's/
  // NJ's/MN's null entries, NOT a guess. TDHS Policy 24.12 and Policy 24.18
  // BOTH explicitly defer exact dollar figures to an internal "Family
  // Assistance Standards Desk Guide" the corpus pack could not locate
  // published anywhere on tn.gov. The ONLY publicly fetchable dollar table
  // — the codified TN Rule 1240-01-04-.27 — carries strong internal
  // evidence of being stale by a decade or more: that SAME table's Standard
  // Deduction figures ($142-$205) and 1-person Maximum Coupon Allotment
  // ($200) do not match ANY recent FY's federal COLA-adjusted figures
  // (compare this file's VA entry: current FFY2026 Standard Deduction
  // $209-$299, 1-person max allotment far above $200 — VA's own manual
  // reproduces federal-tables.ts's FY26 snapshot exactly, the strongest
  // available signal TN Rule 1240-01-04-.27's table is the stale one, not
  // VA's or the federal table). USDA's national FY2026 SUA rollup page also
  // did not render fetchable per-state data for TN in the corpus pack's
  // pass — the same disclosed limitation VA's and PA's own builds recorded
  // for that identical USDA page. `sua_by_tier` requires all four slots
  // (HCSUA/LUA/phone/none); authoring one from a table already shown stale
  // and guessing the rest would be worse than the honest null.
  //
  // drug_felony_ban: "modified" — Tenn. Code Ann. § 71-5-308: permanent
  // ineligibility for a Class A felony drug conviction; conditional
  // eligibility for other drug felonies contingent on substance-abuse-
  // treatment participation/completion (or a licensed provider's no-need
  // determination) plus compliance with court-imposed obligations. UNLIKE
  // every other citation in this entry, the corpus pack could NOT
  // independently fetch this statute's primary text — law.justia.com and
  // casetext.com both returned HTTP 403 on every attempt (multiple
  // User-Agents, http and https) — a genuine, disclosed access barrier, not
  // a shortcut taken without trying. This classification instead rests on
  // convergent corroboration from two independent legal-research sources
  // (the Public Health Law Center's SNAP Ban Opt-Out States Map and the
  // Network for Public Health Law's compiled 50-state survey), both fetched
  // directly, CROSS-CHECKED against TDHS's own current rule (TN Rule
  // 1240-01-14-.15(3)(a)3), which independently corroborates the existence
  // of a "drug-related felony" categorical-eligibility exception under 7
  // CFR 273.11 (consistent with, though not itself proving every condition
  // of, the modified-ban structure the secondary sources describe).
  // "modified" (not "full") is still correct under #805's rule: setting
  // "full" would gate every TN drug-felony household, but the statute's
  // conditional-eligibility path for non-Class-A convictions means it does
  // NOT uniformly bar all of them.
  //
  // abawd_waiver_avail: false — an AFFIRMATIVELY SOURCED, currently-zero
  // finding, not a fail-open default. The corpus pack independently fetched
  // USDA's official ABAWD Time Limit Waivers FY2025-2029 index directly
  // (updated 7/22/2026) and confirmed Tennessee is ABSENT from the full
  // list of states that submitted ANY waiver request for FY2025 or FY2026 —
  // a list that includes 20+ other states and DC but not Tennessee or any
  // of its immediate neighbors (Kentucky, Alabama, Mississippi, Arkansas,
  // Georgia). TDHS's own ABAWD information page independently corroborates:
  // it names no county or statewide waiver and directs individuals only to
  // claim individual EXEMPTIONS, never an area waiver. No TN_WAIVER_
  // COUNTY_FIPS lookup exists (nor would one be meaningful — the answer is
  // "nowhere," the same MA-empty-set/VA-empty-set reasoning already
  // established in this file), so this boolean IS the complete, correct
  // answer for every TN household today, not a permissive fallback papering
  // over unlookupable county-level nuance. Independently verified: this
  // axis is the SOLE reason `M12-abawd-in-a-waived-area` denies for TN
  // (matching NC's and VA's DENY, diverging from PA's and NJ's APPROVE,
  // both of which hold abawd_waiver_avail: true) — the household's
  // "abawd_exempt:waiver_county" claim can't hold in a state with no
  // waivers anywhere, so the member stays subject to the time limit and has
  // already exhausted it.
  //
  // rmp_operated: false — the corpus pack independently fetched USDA's own
  // "States that Operate a Restaurant Meals Program" list directly (updated
  // 8/7/2026): AZ/CA/IL(Cook+Franklin only)/MD/MA/MI/NY/RI/VA, no TN. The
  // corpus pack found no evidence any TN RMP bill has ever been introduced
  // in the General Assembly — a simpler absence than NJ's thrice-died-in-
  // committee bill history.
  //
  // allotment_tier: "48" — no TN-specific elevated max-allotment schedule
  // found or expected; TN Rule 1240-01-04-.27's OWN dollar table is the
  // one flagged stale above (see sua_by_tier), not evidence of a genuinely
  // elevated table the way AK's/HI's real tables are.
  //
  // INFORMATIONAL, no engine axis exists for this: TDHS Policy 24.02 sets
  // TN's DEFAULT certification period at just 6 months — the shortest
  // default this roster has documented (VA and NJ both default to 12
  // months) — conflicting with the still-published TN Rule 1240-01-07-.01
  // (1983), which caps certification at one year; TDHS's newer Policy 24.02
  // is treated as operative (the SECOND of the two families' three
  // documented conflicts). Not modeled — `StatePolicy` has no certification-
  // period axis for any state in this file.
  //
  // SCHEMA GAP already documented for NJ (#824), NOT re-filed: TDHS Policy
  // 24.12 names "boats, vacation homes, or mobile homes" as countable
  // non-liquid resource equity — a departure from VA's/NC's blanket vehicle
  // exclusion in this same file. `Facts.assets` has no per-asset-type
  // breakdown (a single flat number or sentinel), so this is the same
  // pre-existing Facts-shape gap NJ's entry already discloses, not a new
  // one. Zero of the 92 v0.6 profiles model a boat/vacation-home resource,
  // so this has no practical effect on TN's oracle coverage today. The
  // corpus pack separately, narrowly declines to extend this finding to
  // ORDINARY passenger vehicles (TDHS's separate "Treatment of Vehicles"
  // procedure document could not be located) — not assumed to follow the
  // boat rule.
  TN: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "TN",
      label: "Tennessee / TDHS",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: null,
      allotment_tier: "48",
      drug_felony_ban: "modified",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Maryland — DHS / Family Investment Administration (FIA). Seventh
  // "individual tier" build (docs/plans/snap-rules-50-state-engine-
  // completion.md §6, after NC, NJ, VA, TN, IN, MO) — a genuine blank
  // slate, no prior StatePolicy or oracle coverage existed. Every axis
  // below is TRANSLATED from the already-cited primary-source findings in
  // the merged Demeter corpus pack (packages/demeter-engine/src/states/md/
  // PROVENANCE.md + supplements.json + freshness.json), built 2026-08-11 —
  // re-verification, not fresh research; see that pack's own Sources table
  // (direct curl w/ browser User-Agent of thirteen DHS SNAP-manual
  // sections + two current FIA Action Transmittals + the DHS Income
  // Guidelines, every fetch a clean HTTP 200, plus five sections of the
  // Md. Code Human Services Article fetched directly via mgaleg.maryland.
  // gov with NO access barrier — a genuine contrast with this file's own
  // TN/NC entries, whose equivalent statute-mirror sites 403'd).
  //
  // bbce: true / bbce_threshold_pct: 200 / bbce_fpl_basis:
  // federal_fiscal_year — CONFIRMED, not corrected: unlike this file's
  // Missouri entry (which DISPROVED a specific wrong secondary-source BBCE
  // claim), this pack independently checked the same kind of widely-
  // repeated secondary claim against Maryland's own primary source (MD
  // SNAP Manual Section 115.2(F)) and found it accurate. Maryland's own
  // 200% FPL table (Section 115.2(d)) matches the current FFY2026 figures
  // this engine's federal-tables.ts already carries, independently cross-
  // validated via the October 2025 DHS Income Guidelines and FIA Action
  // Transmittal AT 26-05. Maryland's manual states the practical
  // consequence with unusual bluntness in three separate places: "you
  // should not have any non-categorically eligible SNAP households."
  //
  // asset_waiver: true — flows directly from the same BBCE finding above:
  // Maryland's own manual instructs caseworkers that the resource test is,
  // in practice, never actually applied to a BBCE-covered household. Same
  // "BBCE households skip resources/gross/net" pattern this file's NC/VA
  // entries already use.
  //
  // sua_by_tier — FULLY POPULATED, not null: HCSUA $572 / LUA $350 /
  // phone (Telephone Allowance) $40, all sourced from MD SNAP Manual
  // Section 600 ("REVISED AUGUST 2025," effective 10/1/2025) and
  // independently cross-validated by FIA Action Transmittal AT 26-05 —
  // clean 1:1 fits for this schema's three tiers, no naming-collision trap
  // of the kind this file's OH/MO entries disclose. Section 600's other
  // FFY2026 figures — Standard Deduction ($209/$209/$209/$223/$261/$299),
  // Excess Shelter cap ($744), Homeless Shelter Allowance ($198.99) — all
  // match federal-tables.ts's FY26 snapshot EXACTLY, the same "shared
  // source" signal NC's/VA's/MO's entries use to justify allotment_tier
  // "48" below. NOT modeled (a disclosed, out-of-schema mechanism, same
  // class of gap as NJ's/MO's/TN's already-accepted Facts-shape limits):
  // Md. Code, Human Services § 5-501(d) establishes a Maryland-specific
  // state-funded top-up — a household with a member 60 or older (the
  // manual's own cross-reference says "62," a minor, disclosed internal
  // discrepancy the corpus pack did not resolve) whose federal benefit
  // would be under $50/month gets a state supplement bringing it to
  // $50 — DISTINCT from the plain federal $24 minimum this engine's
  // minimumBenefitFor() already applies. No engine axis or state param
  // exists for a composition-conditioned minimum-benefit floor (only AK's
  // zone-based minimumBenefitFor varies by state today, and that varies by
  // geography, not household age composition); independently verified
  // this affects at most a handful of the 92 oracle profiles' benefit
  // dollar amount for elderly-headed HH1-2 households computing under
  // $50, never their verdict (the federal $24 floor already fires the
  // same size<=2 branch, just at a lower dollar value).
  //
  // GENUINE, DISCLOSED INTERNAL CONTRADICTION found in Maryland's OWN
  // currently-published manual (not merely a stale-vs-current gap like
  // MO's SUA finding): Section 200 (Resources), footer "REVIEWED JUNE
  // 2026," states a non-cat-elig resource limit of $2,250/$3,250 — but
  // Section 600, "REVISED AUGUST 2025" and headed "Effective October 1,
  // 2025," states $3,000/$4,500, matching the current federal standard
  // this engine's federal-tables.ts already carries and independently
  // cross-validated by AT 26-05. Immaterial to any of the 92 oracle
  // profiles regardless of which figure is "true," since asset_waiver:
  // true above means the resource test never actually runs for a BBCE-
  // covered MD household — flagged here for completeness, same disclosure
  // discipline as every contradiction this file's other entries name.
  //
  // allotment_tier: "48" — no Maryland-specific elevated max-allotment
  // schedule found; see the shared-source signal under sua_by_tier above.
  //
  // drug_felony_ban: "modified" — a genuine THREE-TIER structure, this
  // pack's flagship finding, that DIRECTLY CONTRADICTS a specific,
  // widely-repeated secondary-source claim that Maryland "eliminated drug
  // testing requirements" for drug-felony SNAP applicants. TIER 1 (MD SNAP
  // Manual Section 100.62(H)): volume-dealer/drug-kingpin convictions,
  // listed among "Disqualified Individuals" with no stated time limit.
  // TIER 2, genuinely BROADER (Section 100.7(J)): manufacture/
  // distribution/possession-with-intent-to-distribute convictions after
  // July 1, 2000 carry a ONE-YEAR disqualification PLUS two years of
  // MANDATORY substance-abuse testing and treatment — this directly
  // contradicts the "eliminated drug testing" secondary claim; Maryland's
  // own manual affirmatively REQUIRES testing as a condition of this
  // modified-ban category. TIER 3 (implicit): simple possession without
  // intent to distribute appears in neither provision — untouched. "Modified"
  // is the correct classification per #805's rule (the ban is neither
  // absent nor an unconditional full ban on every drug felony), the same
  // classification this file's FL/PA/AZ/WI/KS/AK/NC/TN entries already use
  // for their own differently-shaped modified bans. The corpus pack
  // disclosed, rather than silently resolved, an apparent internal date
  // inconsistency between the two sections (100.62(H) references
  // convictions "after October 1, 2017"; 100.7(I)/(J) reference "after
  // July 1, 2000") — not re-resolved here. Gate behavior unchanged (fails
  // open, same as every other "modified" entry) until this engine models
  // the actual condition — see #805.
  //
  // abawd_waiver_avail: false — an AFFIRMATIVELY SOURCED, currently-zero
  // finding from the CLEANEST, most current primary source this pack's own
  // researcher found anywhere in its research: Maryland's own FIA Action
  // Transmittal AT 26-09 (issued October 16, 2025, effective November 1,
  // 2025) asks and answers the waiver question directly: "Q7. Does
  // Maryland DHS still have an ABAWD waiver? A7. No. Maryland can no
  // longer broadly waive the ABAWD time limit." Maryland's own document
  // makes NO county-level distinction between its dense Baltimore/DC-
  // suburb jurisdictions and its rural Eastern Shore counties — the same
  // uniform statewide zero-waiver answer as this file's VA/MO/TN entries,
  // so no county-level lookup is needed or meaningful (a real answer of
  // "nowhere" has no county-level nuance to represent).
  //
  // rmp_operated: true — Maryland IS on USDA's own "States that Operate a
  // Restaurant Meals Program" list (already cited by this file's own
  // TN entry above: "AZ/CA/IL(Cook+Franklin only)/MD/MA/MI/NY/RI/VA").
  // Distinctively among this file's RMP findings, Maryland's RMP is
  // established DIRECTLY BY STATE STATUTE (Md. Code, Human Services §
  // 5-505, fetched with no access barrier) rather than only through
  // administrative adoption of the federal 7 CFR 274.7(g) option — the
  // statute names the program, states its purpose, and defines eligibility
  // (homeless, or 60+/disabled and spouse). Maryland's own DHS page
  // discloses the program is currently an EXPANDING COUNTY-BY-COUNTY
  // PILOT, not yet fully statewide (Baltimore City, Baltimore County, Anne
  // Arundel, Charles, Frederick, Harford, Montgomery, Prince George's,
  // Calvert, St. Mary's, and Allegany counties "among others," per the
  // corpus pack's fetch). `rmp_operated` has no engine consumer in
  // verdict.ts or benefit-calc.ts today (grep-confirmed: it is a purely
  // informational/corpus-facing axis, same as every other state's value in
  // this file) — `true` correctly answers "does Maryland operate a program
  // by this name," the same state-level-boolean-over-restaurant-
  // availability-nuance precedent CA's own comment block above already
  // establishes for its "county participation mandatory, restaurant
  // availability varies" distinction.
  MD: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "MD",
      label: "Maryland / DHS — Family Investment Administration",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("572"),
        LUA: new Decimal("350"),
        phone: new Decimal("40"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "modified",
      abawd_waiver_avail: false,
      rmp_operated: true,
    },
  ],

  // Colorado — CDHS (Colorado Department of Human Services), Division of
  // Food and Energy Assistance, state-supervised / county-administered.
  // Eighth "individual tier" build (docs/plans/snap-rules-50-state-engine-
  // completion.md §6, after NC, NJ, VA, TN, IN, MO, MD) — a genuine blank
  // slate, no prior StatePolicy or oracle coverage existed. Every axis
  // below is TRANSLATED from the already-cited primary-source findings in
  // the merged Demeter corpus pack (packages/demeter-engine/src/states/co/
  // PROVENANCE.md + supplements.json + authorities.json), built 2026-08-11
  // — re-verification, not fresh research.
  //
  // STRUCTURAL DEPARTURE this file has not seen before, load-bearing for
  // every dollar-figure axis below: Colorado has NO separate narrative
  // policy manual (unlike MO's SNAP Manual, MD's SNAP Manual, IN's PPM,
  // VA's SNAP Manual Part, etc.) — Colorado's ENTIRE detailed SNAP policy,
  // at every level of operational detail, lives directly inside 10 CCR
  // 2506-1 ("RULE MANUAL VOLUME 4, SNAP"), a formally promulgated
  // regulation subject to the State Board of Human Services' quarterly
  // rulemaking cycle. The corpus pack's own hypothesis (stated as a
  // hypothesis, not confirmed causation): this slower formal-rulemaking
  // path is why Colorado's own regulation text is measurably stale on BOTH
  // the FFY2026 COLA cycle (every dollar figure in 10 CCR 2506-1-4.207/
  // 4.407 is labeled "Effective October 1, 2024," FFY2025) AND the 2025
  // OBBBA changes (10 CCR 2506-1-4.311's ABAWD text still recites the
  // pre-OBBBA 18-54 age range despite a "[Effective 1/4/2025]" header),
  // even though CDHS's own website content (which doesn't require formal
  // rulemaking) already reflects both.
  //
  // bbce: true / bbce_threshold_pct: 200 / bbce_fpl_basis:
  // federal_fiscal_year — CONFIRMED, not corrected: 10 CCR 2506-1-4.206
  // names Expanded Categorical Eligibility (ECE) directly at 200% FPL, and
  // the corpus pack independently cross-validated Colorado's own 200%-FPL
  // income-limits table against this file's Maryland entry's identical
  // nationwide FFY2026 figures ($2,610/$3,526/$4,442/$5,360 for HH1-4) —
  // Colorado's own income-limits table carries a stale "last updated Oct.
  // 1, 2024" LABEL even though the actual DATA is current, because 200%
  // FPL is set nationally, not state-by-state. Basic Categorical
  // Eligibility (BCE) separately covers Colorado Works/SSI/OAP/AND/AB
  // recipients. Only a household that fails BOTH BCE and ECE is evaluated
  // under Standard Eligibility (SE): plain federal 130%/100% FPL.
  //
  // asset_waiver: true — flows directly from the BBCE finding above: 10
  // CCR 2506-1-4.408(E) states the $3,000/$4,500 resource limit applies
  // ONLY to the smaller Standard Eligibility population; BCE/ECE households
  // face no resource test at all. Same "BBCE households skip resources"
  // pattern this file's NC/VA/MD entries already use.
  //
  // sua_by_tier — POPULATED WITH DISCLOSED STALENESS, not null: Colorado's
  // own regulation (10 CCR 2506-1-4.407.31) publishes a genuine FOUR-tier
  // Standard Utility Allowance — HCUA (Heating/Cooling) $578, BUA (Basic,
  // 2+ non-heat utilities) $367, OUA (One Utility) $69, Telephone $94 — but
  // EVERY one of those four figures is explicitly labeled "Effective
  // October 1, 2024" (FFY2025), one full federal fiscal year stale, and the
  // corpus pack's targeted search could not locate a Colorado-specific
  // FFY2026 update to any of the four (unlike the nationally-uniform
  // Standard Deduction and Excess Shelter cap, which federal-tables.ts
  // already carries current for FFY2026 regardless of this per-state SUA
  // axis). This is the broadest single-state staleness gap this file has
  // found — genuinely worse than MO's "one FY stale, unconfirmed FFY2026
  // update" disclosure, since MO's own figure was merely UNCONFIRMED
  // current where Colorado's own text AFFIRMATIVELY states the stale date.
  // Populated anyway, following MO's disclosed-confidence precedent rather
  // than PA's/NJ's/TN's/MN's "no figure exists at all" null treatment,
  // because a real (if one-cycle-stale) sourced figure is a materially
  // different, better-evidenced case than no figure at all — but this
  // staleness risk should be re-verified against a fresher Colorado source
  // before this axis is trusted for a real determination.
  //
  // Same NAMING-COLLISION mapping trap this file's OH and MO entries
  // already document: this schema's three real tiers (HCSUA, LUA, phone)
  // derive from `determineSUATier`'s single LIMITED branch
  // (`has_electric_or_gas === "yes"`, no distinction of utility COUNT) —
  // Colorado's own $367 BUA (2+ non-heat utilities) tier maps to this
  // schema's `LUA` slot, NOT Colorado's own differently-scoped $69 OUA
  // (exactly one utility) tier, which is the disclosed, unmapped 4th tier
  // — same treatment as OH's $108 Single SUA, IL's $78 Single Utility, and
  // MO's own $158 one-utility tier.
  //
  // allotment_tier: "48" — no Colorado-specific elevated max-allotment
  // schedule found; 10 CCR 2506-1-4.207.3(D)'s own max/min-allotment table
  // is the section already flagged stale above (FFY2025), not evidence of
  // a genuinely elevated table the way AK's/HI's real tables are.
  //
  // drug_felony_ban: "modified" — a genuine, disclosed NARROWING of the
  // widely-repeated secondary-source "modified ban" characterization: C.R.S.
  // § 26-2-305(1)(c) disqualifies a household member for 2 years (first
  // offense) or permanently (second offense) ONLY for a felony conviction
  // DIRECTLY RELATED TO using SNAP/food-stamp benefits themselves to
  // purchase controlled substances, where that misuse is part of the
  // court's own findings — materially narrower than "any drug felony." 10
  // CCR 2506-1-4.206(C) applies the identical narrow trigger to a SEPARATE
  // consequence (loss of BCE/ECE, not an outright denial). Simple
  // possession, or a drug felony unconnected to misusing one's own SNAP
  // benefits, triggers neither provision. "Modified" remains the correct
  // #805 classification (a real, conditional restriction exists, this
  // engine does not yet model the actual narrow trigger at the facts
  // level) even though the real trigger is narrower than most of this
  // file's other "modified" entries (FL/PA/AZ/WI/KS/AK/NC/TN/MD). Gate
  // behavior unchanged (fails open, same as every other "modified" entry)
  // — see #805, gates/disqualifications.ts.
  //
  // abawd_waiver_avail: false — an AFFIRMATIVELY SOURCED, currently-zero
  // finding: Colorado holds ZERO ABAWD waivers anywhere in the state, urban
  // Front Range counties and rural mountain counties alike, per the
  // independent abawdmap.us aggregator ("No waiver — rule applies") and the
  // absence of any Colorado entry on USDA's own Time Limit Waivers FY
  // 2025-2029 index — no county-level lookup needed or meaningful, same
  // uniform-statewide-zero-waiver shape as this file's VA/MO/TN/MD entries.
  // DISCLOSED, not re-resolved: the corpus pack found a genuine, three-way
  // internal contradiction on Colorado's OWN ABAWD age range — 10 CCR
  // 2506-1-4.311 still recites the pre-OBBBA 18-54 age range and now-
  // removed exemptions (homelessness, veteran, foster-care-24) despite an
  // "[Effective 1/4/2025]" header, while CDHS's own dedicated ABAWD FAQ
  // page and February 2026 training desk aid both state the current
  // federal 18-64 range, and CDHS's own main /snap page contains a THIRD,
  // internally-inconsistent statement ("18 and 56" in one paragraph, "18
  // to 64" in another). The corpus pack treated 18-64 as authoritative (the
  // most specific, most recently dated, most directly OBBBA-responsive
  // sources) — this engine's ABAWD gate (gates/abawd.ts) already applies
  // the correct federal 18-64 ceiling post-OBBBA-effective-date
  // independent of any state axis, so this contradiction has no engine
  // consumer regardless; flagged here for completeness only, same
  // disclosure discipline as this file's other internal-contradiction
  // findings (MD's two Section-200-vs-600 resource-limit conflict, TN's
  // dual-citation-family conflicts).
  //
  // rmp_operated: false — Colorado does NOT currently operate a Restaurant
  // Meals Program: CDHS's own current SNAP page explicitly lists hot foods
  // and on-premises-consumption food as NOT SNAP-eligible, with no RMP
  // exception. DISCLOSED, not resolved: SB25-169 (signed 5/13/2025)
  // required CDHS to submit a USDA RMP application by January 1, 2026 — a
  // deadline that has passed as of this pack's fetch date (2026-08-11)
  // without a locatable public status update on submission, review, or
  // approval. `false` is the correct CURRENT answer; this is a genuinely
  // live, actively-moving axis that should be re-checked before this
  // engine treats Colorado as a settled `false` indefinitely, distinct
  // from VA's/MO's/TN's/MD's-ABAWD-style settled-zero findings above.
  //
  // Not representable in this schema, and not silently dropped — the SAME
  // pre-existing gaps already filed as #824, not re-filed, just newly
  // confirmed present for Colorado: (a) 10 CCR 2506-1-4.410(A) excludes ALL
  // vehicles as a resource regardless of type, matching MO's/MD's blanket
  // pattern (immaterial regardless, since asset_waiver: true above means
  // the resource test never actually runs for a BBCE-covered CO household);
  // (b) 10 CCR 2506-1-4.407(D)/4.407.5 treats legally obligated child
  // support as an INCOME EXCLUSION applied before the gross income test,
  // matching VA/NJ/IL/MO's mechanism rather than MD/IN/TN's ordinary-
  // deduction mechanism — `benefit-calc.ts` models only the engine-wide
  // ordinary-deduction mechanism; zero of the 92 v0.6 profiles model a
  // nonzero `child_support_paid` for a Colorado-relevant profile that would
  // expose this gap (A08's $300 child-support profile's CO verdict is
  // unaffected either way, the same acceptance this file's NJ/MO A08
  // entries already document). Also disclosed, informational only, no
  // engine axis exists for either: (c) 10 CCR 2506-1-4.407.61's flat $165
  // Standard Medical Expense Deduction (SMED) shortcut for verified medical
  // expenses between $35.01-$200, matching MO's flat-shortcut pattern
  // rather than MD's actual-expense-only rule — `benefit-calc.ts` models
  // only actual verified medical expense minus the $35 floor, with no SMED
  // shortcut axis for any state; zero of the 92 profiles are affected
  // (independently verified: no profile's medical_unreimbursed value falls
  // in the $35.01-$200 SMED-eligible band while also being SMED-favorable
  // over actual-expense treatment); (d) 10 CCR 2506-1-4.208.1's 6-month/
  // 24-month certification-period structure — no engine axis exists for
  // certification-period length for any state in this file.
  //
  // Oracle: CO's closest structural axis-twin among all 25 already-
  // registered states is NORTH CAROLINA — identical bbce (true/200/
  // federal_fiscal_year), identical asset_waiver (true), identical
  // drug_felony_ban ("modified"), identical abawd_waiver_avail (false),
  // identical allotment_tier ("48"), identical rmp_operated (false); both
  // also carry a real, non-null sua_by_tier needing the full shelter/SUA/
  // benefit-calc pathway exercised (unlike NJ's/PA's/TN's null-SUA-blocked
  // entries), differing only in the SUA dollar figures themselves. Built a
  // fresh, independent Python calculator (not derived from engine output,
  // per #636) directly from verdict.ts/benefit-calc.ts/gates/{income-tests,
  // asset-test,abawd,student,composition,immigration,disqualifications,
  // categorical}.ts/facts.ts/constants/federal-tables.ts's own read source
  // (not just their doc-comments), mirroring every gate and the
  // benefit-calc formula exactly, including decimal.ts's half-up
  // (roundDollar) and floor (floorDollar) rounding conventions.
  // Cross-validated BEFORE trusting it for CO: 92/92 exact match (verdict
  // AND benefit) reproducing NC's already-graded oracle under NC's own
  // StatePolicy params, PLUS all 37 non-expected_by_state variant rows (0
  // mismatches) — before applying CO's own policy params. Also checked all
  // 37 variant rows directly under CO's own params for a CO-specific
  // verdict_by_state override, the same discipline every prior state's
  // build used — found ZERO divergence from the shared default verdict
  // (matching NC's/VA's/MD's zero-override result): CO's computed verdicts
  // are IDENTICAL to NC's across all 92 base profiles and all 37 variant
  // rows (80 APPROVE / 12 DENY, the same DENY set as NC's/VA's/MD's, since
  // all four states share every financial-gate-relevant axis exactly),
  // differing only in benefit dollar amount where SUA values diverge.
  // Authored all 92 expected_by_state.CO entries.
  CO: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "CO",
      label: "Colorado / CDHS — Division of Food and Energy Assistance",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("578"),
        LUA: new Decimal("367"),
        phone: new Decimal("94"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "modified",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // South Carolina — 9th individual-tier state (§6 step 3, ninth after NC/
  // NJ/VA/TN/IN/MO/MD/CO). Built SC's StatePolicy entry AND full 92-profile
  // oracle coverage from scratch (SC had neither before this PR),
  // translating SC's already-merged Demeter corpus pack
  // (packages/demeter-engine/src/states/sc/, PROVENANCE.md + supplements.json,
  // built 2026-08-11) into the engine's stricter typed shape per §5's
  // process.
  //
  // bbce: true / bbce_threshold_pct: 130 / bbce_fpl_basis:
  // federal_fiscal_year — THIS PACK'S FLAGSHIP FINDING, a genuine
  // CORRECTION to the widely-repeated secondary-source assumption that
  // BBCE states run a 200% FPL ceiling: SC SNAP Manual (Vol. 70, June 2026)
  // § 4.1(D) grants "Family Independence Information and Referral
  // Services" categorical eligibility only to households at or below 130%
  // FPL — and SC's ORDINARY gross income test (§ 13.6(2)(B)) is ALSO 130%
  // FPL, the plain federal floor with no state-elected increase. SC's BBCE
  // analog therefore does NOT expand income eligibility at all; what it
  // actually does is waive the resource test (and the separate net income
  // test) for households already inside the ordinary 130% gross limit. This
  // is honestly encoded as `bbce: true, bbce_threshold_pct: 130` rather than
  // `bbce: false` — SC's own manual frames it as a categorical-eligibility
  // mechanism, and verdict.ts's actual gate logic already does the right
  // thing with these values with NO code change needed: because
  // GROSS_INCOME_TEST_RATIO is also 1.30 (130%), the BBCE-raised threshold
  // is numerically identical to the federal default, so the gross test
  // behaves exactly like a non-BBCE state's — but `policy.bbce === true`
  // still marks `bbceConferred = true` once that (unchanged) threshold
  // clears, which correctly skips BOTH the net income test AND (via
  // `asset_waiver: true` below, redundantly-but-consistently) the asset
  // test for every NPA household that clears it. This is a genuinely clean
  // demonstration that the bbce/bbce_threshold_pct split this schema
  // already supports (decoupled from asset_waiver) was built expressively
  // enough for a state whose "raised" threshold equals its ordinary one —
  // no engine change, no new axis, no disclosed gap. (E/D households still
  // take the net-only federal path per every other state's existing
  // behavior, since `grossTestApplies` is false for them regardless of
  // BBCE — pre-existing, shared engine behavior, not new here.) Independent
  // verification (see oracle note below): SC's computed 21-DENY set out of
  // 92 base profiles sits between the plain-130%-threshold states already
  // in this file (OH 19, GA 22, KS 22) and is materially larger than the
  // 200%/165%-threshold states (NC/VA 12, TX 16) — direct confirmation
  // SC behaves as a 130%-effective-ceiling state in practice, not a 200%
  // one, matching § 4.1(D)'s own text exactly.
  //
  // asset_waiver: true — flows directly from the same § 4.1(D) finding:
  // "will have the household's resources excluded when determining
  // eligibility" for every household within the 130% pathway — which is
  // effectively every NPA household that isn't already gross-income-denied,
  // since the pathway's ceiling equals the ordinary gross test.
  //
  // sua_by_tier — FULLY POPULATED, not null, a genuinely CLEAN case (SC's
  // own SNAP Manual, dated June 2026, is only ~2 months old at fetch date —
  // no staleness disclosure needed, unlike CO's four-tier-stale entry or
  // MO's one-cycle-stale figures elsewhere in this file). § 12.5(2)-(3):
  // Mandatory Utility Allowance (MUA) $388/mo for households billed
  // separately for heating/cooling (or qualifying LIHEAP), Basic Utility
  // Allowance (BUA) $265/mo for households billed for 2+ non-heating
  // utilities, standalone Telephone Allowance $27/mo. These map cleanly
  // onto this schema's three tiers by FUNCTION, not by SC's own label —
  // MUA (heat/cool) -> HCSUA, BUA (2+ non-heat utilities) -> LUA, Telephone
  // -> phone — a clean 1:1 fit with NO naming-collision trap (contrast
  // OH's/MO's/CO's disclosed "LUA slot actually maps to the 2+-utility
  // tier, not the state's own differently-scoped 1-utility tier" gap: SC's
  // BUA is ALREADY a 2+-utility standard by SC's own definition, so no
  // fourth, unmapped tier exists here to disclose).
  //
  // allotment_tier: "48" — SC's own Standard Deduction
  // ($209/$209/$209/$223/$261/$299), Excess Shelter cap ($744), and
  // resource limits ($3,000/$4,500) all match federal-tables.ts's FY26
  // snapshot exactly (§ 12.1-12.2, § 12.4, § 10.2) — the same shared-source
  // signal NC's/VA's/MO's/MD's/CO's entries already use, and consistent
  // with PROVENANCE.md Finding 5's observation that SC's manual tracks the
  // federal fiscal year unusually closely for this roster.
  //
  // drug_felony_ban: "full" — THIS PACK'S SECOND FLAGSHIP FINDING, and a
  // genuine CONFIRMATION (not correction) of the minority nationwide
  // position: SC SNAP Manual § 2.3(7) restates 21 U.S.C. § 862a(a)(2)'s
  // plain federal lifetime ban verbatim as SCDSS policy (conduct after
  // 8/22/1996, expungement/pardon the only listed exception), with NO
  // separate SC statute located anywhere implementing, narrowing, or
  // opting out of it under § 862a(d)(1) — corroborated by two independent
  // secondary aggregators (Network for Public Health Law's 50-state survey
  // explicitly codes SC as "kept full federal ban," no statute cited;
  // Prison Policy Initiative, Feb. 2026). SC and Guam are the only two US
  // jurisdictions in this posture nationwide, per PROVENANCE.md Finding 2 —
  // matching this file's existing precedent that "full" means the
  // unmodified federal ban applies (#805), not a state-enacted trigger.
  // This makes SC only the SECOND state in this file (after TX) to carry
  // "full" rather than "none"/"modified"/"unconfirmed."
  //
  // abawd_waiver_avail: false — an AFFIRMATIVELY SOURCED, currently-zero
  // finding: independent ABAWDMap.us aggregator states "No waiver — rule
  // applies" for South Carolina, and no SC entry appears on USDA's Time
  // Limit Waivers FY2025-2029 index. SC's own manual (§ 8.12, § 8.15)
  // already reflects the full 2025 OBBBA ABAWD changes (18-64 age range,
  // under-14 caregiver exception, removed homelessness/veteran/foster-care
  // exemptions, added Indian/Urban Indian/California Indian exemption) with
  // no internal contradiction found — a genuine contrast with this file's
  // CO entry, which found the opposite (a three-way internal contradiction,
  // stale pre-OBBBA regulation text). No county-level lookup needed, same
  // uniform-statewide-zero-waiver shape as VA/MO/TN/MD/CO's entries.
  //
  // rmp_operated: false — SC is absent from USDA FNA's own current
  // Restaurant Meals Program state list (Arizona, Maryland, New York,
  // California, Massachusetts, Rhode Island, Illinois [Cook/Franklin only],
  // Michigan, Virginia — cross-checked against this file's MO/IN/TN
  // entries' own independent fetches of the same list). SC's manual
  // describes only a narrower federal-baseline "Homeless Meal Provider"
  // concessional-price mechanism limited to homeless households, not the
  // broader elderly/disabled population an RMP typically covers — no
  // evidence any such contract is currently active with a specific SC
  // restaurant (disclosed gap, immaterial: `rmp_operated` has no consumer
  // anywhere in verdict.ts or benefit-calc.ts, grep-confirmed, same as
  // every other state's entry in this file).
  //
  // Not representable in this schema, and not silently dropped — the SAME
  // pre-existing gaps already filed as #824, not re-filed, just newly
  // confirmed present for South Carolina in genuinely novel shapes: (a) SC's
  // vehicle-resource rule (§ 10.3(B)(vii), § 10.7(AA)) is a STRUCTURAL
  // DEPARTURE this roster has not documented before — ONE exempt vehicle
  // PER LICENSED DRIVER (not per household), conditioned on South Carolina
  // vehicle registration, with any other vehicle counted at the higher of
  // fair-market-value-over-$4,650 or full equity value; immaterial
  // regardless, since `asset_waiver: true` means the resource test never
  // runs for the 130%-pathway population this axis governs; (b) SC's flat
  // $175 Standard Medical (SM) Deduction shortcut for verified expenses
  // $35.01-$210 (§ 12.8), matching MO's/CO's flat-shortcut pattern with its
  // own distinct dollar figures, not modeled by benefit-calc.ts's
  // actual-expense-only mechanism; independently verified zero of the 92
  // profiles are affected; (c) legally obligated child support (§ 12.7) is
  // an ORDINARY POST-GROSS-INCOME DEDUCTION applied at net-income Step (F),
  // matching this file's MD/IN/TN pattern (NOT VA/NJ/IL/MO/CO's
  // income-exclusion-before-the-gross-test mechanism) — A08's $300
  // child-support profile's SC verdict is unaffected either way, same
  // acceptance as every prior state's A08 entry; (d) no engine axis exists
  // for certification-period length (SC's plain federal 6-month/24-month
  // structure, § 13.8(1), matching CO's finding, not MD's distinctive
  // 12-month mechanism).
  //
  // Genuinely time-sensitive, disclosed and NOT modeled (no engine axis
  // exists for SNAP-eligible-food restrictions at all): SC's USDA-approved
  // candy/soda/energy-drink exclusion is real and imminent but NOT YET
  // EFFECTIVE as of the corpus pack's 2026-08-11 fetch date — approved by
  // Secretary Rollins 12/10/2025, modified 8/3/2026, EFFECTIVE 8/31/2026.
  // No engine consumer exists for SNAP food-eligibility rules at all (this
  // engine determines eligibility/benefit amount, not the eligible-goods
  // list), so this has zero effect on any oracle profile — noted here only
  // because PROVENANCE.md flags it as the pack's third flagship finding and
  // a future re-verification pass after 8/31/2026 should not be surprised
  // to find it already reflected in SC's own manual by then.
  //
  // Oracle: SC's closest structural axis-twin among all 26 already-
  // registered states is TEXAS — matching 6 of 7 comparison axes exactly
  // (bbce: true, asset_waiver: true, drug_felony_ban: "full" [the ONLY
  // other "full" entry in this file], abawd_waiver_avail: false,
  // allotment_tier: "48", rmp_operated: false), differing only in
  // bbce_threshold_pct (TX 165 vs SC 130) — a stronger match than any
  // 130%-threshold state in this file (OH/GA/NY all differ on
  // asset_waiver, drug_felony_ban, or rmp_operated, each only 5/7). Built a
  // fresh, independent Python calculator (not derived from engine output,
  // per #636) directly from verdict.ts/benefit-calc.ts/gates/{income-tests,
  // asset-test,abawd,student,composition,immigration,disqualifications,
  // categorical}.ts/facts.ts/constants/federal-tables.ts's own read source
  // (not just their doc-comments), mirroring every gate and the
  // benefit-calc formula exactly, including decimal.ts's half-up
  // (roundDollar) and floor (floorDollar) rounding conventions.
  // Cross-validated BEFORE trusting it for SC: 92/92 exact match (verdict
  // AND benefit) reproducing TX's already-graded oracle under TX's own
  // StatePolicy params, PLUS all 37 non-expected_by_state variant rows (0
  // mismatches), before applying SC's own policy params. As a second,
  // independent sanity check (not a formal cross-validation, since neither
  // is SC's structural twin), compared SC's own computed DENY set against
  // KS's (non-BBCE, asset_waiver false) and OH's (BBCE-130, asset_waiver
  // true) already-graded oracles: SC's DENY set is KS's DENY set MINUS
  // exactly the 2 asset-limit-driven denials (D02, M02 — explained by
  // asset_waiver: true) PLUS the 1 drug-felony denial KS's "modified" ban
  // fails open on (M29 — explained by drug_felony_ban: "full"); separately,
  // SC's DENY set is OH's DENY set PLUS exactly those same 2 profiles
  // (M29, plus M12-abawd-in-a-waived-area — explained by
  // abawd_waiver_avail: false vs OH's true) with zero unexplained
  // divergence in either direction. Also checked all 37 rows across the 18
  // non-expected_by_state variant profiles (facts_patch A/B pairs) for an
  // SC-specific verdict_by_state override, the same discipline every prior
  // state's build used — found ONE real divergence (matching MO's
  // one-override precedent, not NC's/VA's/MD's/CO's zero-override result):
  // M23-variable-gig-income-anticipation's two variants ($1,800 and $2,200
  // gross HH1) both clear TX's 165% threshold ($2,153) but fail SC's
  // effective 130% screen (~$1,697) for the same reason KS/OH/GA/IN/MO
  // already fail — authored "SC": "DENY" into both variants'
  // verdict_by_state blocks. Authored all 92 expected_by_state.SC entries:
  // 71 APPROVE / 21 DENY.
  SC: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "SC",
      label: "South Carolina / SCDSS",
      bbce: true,
      bbce_threshold_pct: 130,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("388"),
        LUA: new Decimal("265"),
        phone: new Decimal("27"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "full",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Louisiana — 10th individual-tier state (§6 step 3, tenth after NC/NJ/
  // VA/TN/IN/MO/MD/CO/SC). Built LA's StatePolicy entry AND full 92-profile
  // oracle coverage from scratch (LA had neither before this PR),
  // translating LA's already-merged Demeter corpus pack
  // (packages/demeter-engine/src/states/la/, PROVENANCE.md + supplements.json
  // + freshness.json, built 2026-08-12) into the engine's stricter typed
  // shape per §5's process. NOTE: Alabama's individual-tier build (9th of
  // this sequence numerically, but concurrently in flight, not yet merged
  // as of this build) was NOT read or coordinated with — a human reconciles
  // the eventual rebase, same pattern this project used for MO-vs-TN/IN.
  //
  // bbce: true / bbce_threshold_pct: 200 / bbce_fpl_basis:
  // federal_fiscal_year — LA E-280-SNAP (Broad-Based Categorical
  // Eligibility): households authorized to receive a non-cash TANF/MOE-
  // funded service via FITAP get a FLAT 200% FPL gross income test
  // REPLACING the ordinary 130% test, with NO additional condition that
  // every household member be elderly or disabled — structurally SIMPLER
  // than this file's Alabama corpus finding (a dual-track 130%/200%
  // structure per that pack's own PROVENANCE.md), confirmed by directly
  // reading E-280-SNAP's FULL text (not just its section heading) per the
  // corpus pack's own adversarial-refute pass, specifically because it
  // did not want to pattern-match Alabama's more complex structure onto
  // Louisiana without verification. J-300-SNAP (current FFY2026 Income
  // Eligibility Chart, effective Oct. 1, 2025) confirms the federal-
  // fiscal-year cycle. Current FFY2026 dollar figures the corpus pack
  // cites: 130% FPL HH1 $1,696/mo, 200% FPL HH1 $2,609/mo, 100% FPL (net)
  // HH1 $1,305/mo.
  //
  // asset_waiver: true — flows directly from the same E-280-SNAP finding:
  // BBCE households have their resources EXCLUDED ENTIRELY, and LA's
  // manual instructs staff not to even request resource verification for
  // these households (E-280-SNAP, E-281-1-SNAP, B-1022-SNAP).
  //
  // sua_by_tier — FULLY POPULATED, not null: LA B-654-1/2/3-SNAP
  // (effective June 1, 2026) publishes Standard Utility Allowance (SUA)
  // $465/mo (heating/cooling households), Basic Utility Allowance (BUA)
  // $258/mo (2+ non-heating utilities), standalone Telephone Standard
  // $76/mo. These map cleanly onto this schema's three tiers BY FUNCTION —
  // SUA (heat/cool) -> HCSUA, BUA (2+ non-heat utilities) -> LUA,
  // Telephone -> phone — the same clean 1:1 fit this file's SC entry
  // found, with no naming-collision trap (contrast OH's/MO's/CO's
  // disclosed "LUA slot actually maps to the differently-scoped 2+-
  // utility tier" gap: LA's BUA is already a 2+-utility standard by LA's
  // own definition). LA's Standard Deduction ($209/$209/$209/$223/$261/
  // $299), capped excess shelter ($744), and $3,000/$4,500 resource
  // limits (see below) all match federal-tables.ts's FY26 snapshot
  // exactly — the same shared-source signal this file's NC/VA/MO/MD/CO/SC
  // entries already use.
  //
  // allotment_tier: "48" — no Louisiana-specific elevated max-allotment
  // schedule found; LA's own tables track the federal FY26 figures
  // exactly (see above).
  //
  // drug_felony_ban: "none" — a VERIFIED FULL OPT-OUT, LA's pack's second
  // flagship finding: La. R.S. 46:233.3 (2017 Regular Session HB 681,
  // effective October 1, 2017) exempts ALL individuals domiciled in
  // Louisiana from the federal 21 U.S.C. 862a(a)(2) drug-felony SNAP ban —
  // per CLASP's "No More Double Punishments" report, Louisiana is among a
  // minority of states (alongside North Dakota) that FULLY opted out, not
  // merely modified, the ban. Independently corroborated by the corpus
  // pack reading LA's own current disqualification manual directly:
  // E-220-SNAP and E-222-SNAP enumerate every category of SNAP member
  // disqualification Louisiana's program currently applies (SSN/alien/
  // ABAWD-related issues, IPV, work-registration non-compliance,
  // fleeing-felon status, probation/parole violation, and a narrow
  // post-February-2014 Adam-Walsh-Act-style felony list), and a
  // drug-related felony conviction, by itself, appears on NEITHER list.
  // Access caveat carried from the corpus pack: Justia returned HTTP 403
  // on direct fetch of La. R.S. 46:233.3's own text — this finding is
  // corroborated via convergent secondary sources (CLASP, the Public
  // Health Law Center's opt-out map) cross-checked against LA's own
  // primary-source manual, which independently confirms the same
  // substantive rule by omission, not a direct read of the statute's own
  // codified text.
  //
  // abawd_waiver_avail: false — an AFFIRMATIVELY SOURCED, DOUBLE-LOCKED-
  // OUT finding, the corpus pack's third flagship finding: Louisiana's own
  // 2024 Regular Legislative Session Act 308 barred DCFS from seeking or
  // renewing ABAWD waivers unless required by federal law — a
  // Louisiana-specific policy choice that predates OBBBA by roughly a
  // year and expired LA's last 33 parish-level waivers (more than half
  // the state's 64 parishes) on October 1, 2024, with DCFS's own
  // contemporaneous announcement stating "no time-limit waivers will be
  // in effect in any of Louisiana's 64 parishes." OBBBA then
  // independently eliminated the federal ABAWD-waiver mechanism
  // nationwide (effective November 2025). ABAWDMap.us's independent
  // aggregator confirms Louisiana holds zero ABAWD waivers statewide as
  // of its last review (June 16, 2026). No county-level lookup needed,
  // same uniform-statewide-zero-waiver shape as this file's VA/MO/TN/MD/
  // CO/SC entries.
  //
  // rmp_operated: false — Louisiana is ABSENT from USDA FNA's own current
  // Restaurant Meals Program state list (fetched Aug. 7, 2026: AZ, MD,
  // NY, CA, MA, RI, IL [Cook/Franklin only], MI, VA). Disclosed, NOT
  // modeled (no engine consumer exists for this axis anywhere, grep-
  // confirmed, same as every other state's entry in this file): LDH
  // separately announced (July 20, 2026) a TEMPORARY, STATEWIDE hot-foods
  // disaster waiver for ALL SNAP participants following Tropical Storm
  // Arthur, stated effective through August 13, 2026 — a genuinely
  // time-sensitive, already-lapsed-as-of-this-build mechanism (LA's own
  // freshness.json re-checked 2026-08-15: no extension found, fails
  // safe), and in any case a different, disaster-specific mechanism from
  // a standing RMP, never conflated with it here.
  //
  // Not representable in this schema, and not silently dropped — the SAME
  // pre-existing gaps already filed as #824, not re-filed, just newly
  // confirmed present for Louisiana: (a) all vehicles excluded as a
  // resource regardless of type (LA B-1040-SNAP's countable-resources
  // list omits vehicles entirely), matching this file's NC/MO/MD/CO
  // blanket pattern; immaterial regardless since `asset_waiver: true`
  // means the resource test never runs for the BBCE population this axis
  // governs; (b) legally obligated child support (LA B-656-SNAP) is an
  // ORDINARY POST-GROSS-INCOME DEDUCTION, matching this file's MD/IN/TN/
  // SC pattern (NOT VA/NJ/IL/MO/CO's income-exclusion-before-the-gross-
  // test mechanism) — A08's $300 child-support profile's LA verdict is
  // unaffected either way, same acceptance as every prior state's A08
  // entry; (c) a flat Homeless Shelter Deduction of $198.99/mo (LA
  // B-654-6-SNAP) as an alternative to the capped excess shelter
  // deduction — this happens to equal the federal FY26 homeless-deduction
  // figure `federal-tables.ts` already uses engine-wide, so LA carries NO
  // disclosed divergence here (a genuinely different shape from MO's/CO's
  // flat-shortcut findings, which carry LA-specific dollar amounts the
  // engine's actual-expense-only mechanism doesn't model); (d) no engine
  // axis exists for certification-period length (LA's 12-month structure
  // with a 6-month Simplified Report midpoint, S-110-SNAP, matching this
  // file's Alabama/MD pattern per the corpus pack, not CO's/SC's 6-month
  // baseline).
  //
  // Disclosed research-access gap (not a fabricated citation, per the
  // corpus pack's freshness.json): LA's own B-1030-SNAP (the section
  // B-1040-SNAP itself cites for "required resource limits") could not be
  // independently located at a stable URL. The $3,000 (standard) / $4,500
  // (elderly-or-disabled) resource-limit figures used above (for the
  // disclosed, non-BBCE-population asset test, which never runs since
  // `asset_waiver: true`) are corroborated via B-1040-17-SNAP's own
  // worked numerical example plus independent secondary confirmation, not
  // a direct read of B-1030-SNAP's full text. Immaterial to every axis
  // authored here since none of them depend on the exact resource-limit
  // figure (asset_waiver already skips the test).
  //
  // Oracle: LA's closest structural axis-twin among all 27 already-
  // registered states is OREGON — a FULL 7/7 match on every comparison
  // axis (bbce: true, bbce_threshold_pct: 200, bbce_fpl_basis:
  // federal_fiscal_year, asset_waiver: true, drug_felony_ban: "none",
  // abawd_waiver_avail: false, allotment_tier: "48", rmp_operated: false),
  // differing only in the SUA dollar figures themselves — a stronger match
  // than any prior state's chosen twin in this file (VA-via-NC, MD-via-VA,
  // CO-via-NC, SC-via-TX were all 6/7). Built a fresh, independent Python
  // calculator (not derived from engine output, per #636) directly from
  // verdict.ts/benefit-calc.ts/gates/{income-tests,asset-test,abawd,
  // student,composition,immigration,disqualifications,categorical}.ts/
  // facts.ts/constants/federal-tables.ts's own read source (not just their
  // doc-comments), mirroring every gate and the benefit-calc formula
  // exactly, including decimal.ts's half-up (roundDollar) and floor
  // (floorDollar) rounding conventions. Cross-validated BEFORE trusting it
  // for LA: 92/92 exact match (verdict AND benefit) reproducing OR's
  // already-graded oracle under OR's own StatePolicy params, PLUS all 37
  // non-expected_by_state variant rows (0 mismatches) — 129/129 total,
  // before applying LA's own policy params. Also checked all 37 rows
  // across the 18 non-expected_by_state variant profiles (facts_patch A/B
  // pairs) directly under LA's own params for an LA-specific
  // verdict_by_state override, the same discipline every prior state's
  // build used — found ZERO divergence from the shared default verdict
  // (matching NC's/VA's/MD's/CO's zero-override result, not MO's/SC's
  // one-override finding): because LA's computed verdict set is IDENTICAL
  // to OR's on every axis that affects eligibility, LA's verdicts are
  // IDENTICAL to OR's across all 92 base profiles and all 37 variant rows
  // (80 APPROVE / 12 DENY, the same DENY set as OR's), differing only in
  // benefit dollar amount for the 8 of 92 profiles where OR's/LA's SUA
  // figures diverge AND the household's excess-shelter deduction isn't
  // already clamped by the federal $744 shelter cap (elderly/disabled
  // households with an uncapped shelter deduction, plus BBCE-flip and
  // near-threshold profiles where the SUA-driven net-income difference is
  // still small enough not to change the verdict). Authored all 92
  // expected_by_state.LA entries: 80 APPROVE / 12 DENY.
  //
  // Verification: `/profile-simulation state=LA` — 129/129 PASS, 0 FAIL,
  // 0 SKIP (clean, matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/
  // VA/IN/MO/MD/CO/SC's bar, not PA's/NJ's/TN's/MN's SKIP-heavy shape —
  // LA's real, disclosed-confidence SUA figures mean it did not need
  // PA's/NJ's/TN's null-SUA fallback). Every other registered state's
  // harness run reconfirmed unchanged from its documented baseline, all
  // 27 pre-existing states checked individually (not spot-checked):
  // CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO/MD/CO/SC all
  // 129/0/0; NY 127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN all 34/0/95 —
  // every one identical to its pre-LA documented baseline, zero
  // regressions. `tsc --noEmit -p packages/snap-rules` clean, 323/323
  // snap-rules tests pass (0 new — a schema-conformant pure addition
  // needed no new unit tests), 44/47 profile-harness tests pass (3
  // pre-existing skips). Did not touch `packages/demeter-engine` (LA's
  // corpus was already complete and out of scope) or any other state's
  // `StatePolicy`/oracle coverage. No new GitHub issue filed — every gap
  // found (the disclosed B-1030-SNAP access gap, the DCFS-to-LDH agency
  // transfer, the Economic Stability/Economic Independence manual rename,
  // the SMED/child-support-exclusion/vehicle-exclusion/certification-
  // period gaps) is a per-state disclosed gap of an already-documented
  // class (#824-style Facts-shape/mechanism gaps, or a genuinely
  // time-sensitive fact worth re-checking later), not an engine
  // architecture gap, per this task's own instruction.
  LA: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "LA",
      label: "Louisiana / LDH (Office of Economic Stability)",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("465"),
        LUA: new Decimal("258"),
        phone: new Decimal("76"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // OK (individual tier, §6 step 3, 13th and FINAL individual-tier state
  // after NC/NJ/VA/TN/IN/MO/MD/CO/SC/LA, plus the two concurrently
  // in-flight-but-not-yet-merged AL/KY builds this build does not touch or
  // coordinate with) — built Oklahoma's `StatePolicy` entry AND full
  // 92-profile oracle coverage from scratch (OK had neither before this
  // PR), translating OK's already-merged Demeter corpus pack
  // (packages/demeter-engine/src/states/ok/, PROVENANCE.md +
  // supplements.json + freshness.json, built 2026-08-12) into the
  // engine's stricter typed shape per §5's process.
  //
  // bbce: false — a DELIBERATE, disclosed non-guess, not a plain "OK has no
  // BBCE" finding like IN's or KS's. OK's own regulation, OAC
  // 340:50-11-111(b)/(d) (read via the Cornell LII mirror after
  // oklahoma.gov's own policy-library host 403'd), makes a household
  // categorically eligible — BOTH the gross AND net income tests removed
  // entirely — for TANF/SSI recipients OR households receiving services
  // through "2-1-1 Oklahoma" (a TANF-MOE-funded information/referral
  // service). This is a genuinely BROADER mechanism than IN's/KS's narrow
  // SSI/TANF-only federal cat-elig (2-1-1 Oklahoma reaches beyond direct
  // cash-assistance recipients) and structurally resembles the BBCE
  // pathway every other expanded-cat-elig state in this file uses — BUT
  // OKDHS's own SNAP manual states NO percentage-of-FPL ceiling anywhere
  // for the 2-1-1 track, unlike Kentucky's dual 130%/200%, Louisiana's
  // flat 200%, or Alabama's dual 130%/200%. The corpus pack specifically
  // checked for one (PROVENANCE.md Finding 4) and confirmed its absence
  // from OKDHS's own text, not merely failing to find it. This schema's
  // `bbce_threshold_pct` field has no honest, sourced number to hold: the
  // actual gate, if any, sits inside 2-1-1 Oklahoma's own TANF-MOE-funded
  // service-eligibility determination — a nonprofit referral service
  // outside OKDHS's own SNAP policy and outside this pack's (and this
  // build's) primary-source access. Setting `bbce: true` with no threshold
  // would fall through `gates/income-tests.ts`'s own ratio fallback
  // (`policy.bbce_threshold_pct != null` guard) to the plain 130% gross
  // ratio while STILL skipping the net test entirely via `bbceConferred`
  // — silently granting a real, uncited eligibility expansion no source
  // supports. `bbce: false` is therefore the conservative, defensible
  // encoding: the general (non-SSI/TANF) NPA population is evaluated
  // under the plain federal 130%/100% test the engine already runs
  // correctly, and OK's genuine-but-unsourceable 2-1-1 Oklahoma expansion
  // is disclosed as an accepted gap rather than guessed into a number.
  // `bbce_fpl_basis: null` follows, matching IN's/KS's established shape
  // for a non-BBCE state.
  //
  // asset_waiver: false — flows from the same finding: Appendix C-3's own
  // resource-standards table states the $3,000/$4,500 test applies "ONLY
  // to sponsored-alien households and households that are NOT
  // categorically eligible" — the narrow SSI/TANF/2-1-1-Oklahoma
  // cat-elig population already skips the resource test via the federal
  // pure-cash path (`facts.cat_elig`) this engine already models; the
  // general NPA household faces the plain federal resource limit, same
  // posture as IN's/KS's entries.
  //
  // sua_by_tier — FULLY POPULATED, not null, a genuinely CLEAN 3-tier
  // mapping: Appendix C-3 (effective 10/1/2025, current FFY2026 figures)
  // publishes exactly three utility standards — Standard Utility
  // Allowance (SUA) $412/mo for a household incurring heating/cooling
  // costs, Basic Utility Allowance (BUA) $354/mo for a household billed
  // for utilities but not heating/cooling, and a standalone Telephone
  // Standard $49/mo — with OAC 340:50-7-31 confirming a household may
  // receive only ONE, choosing the highest it qualifies for. Unlike this
  // file's OH/MO/CO entries, OK's own supplement discloses no separate
  // "single utility" fourth tier distinct from BUA — no naming-collision
  // trap here, the same clean 3-tier shape this file's SC/LA entries
  // already found. HCSUA -> $412 (SUA), LUA -> $354 (BUA), phone -> $49.
  // OK's Standard Deduction ($209 HH1-3, $223 HH4, $261 HH5, $299 HH6+),
  // capped excess shelter ($744), and Standard Homeless Shelter Deduction
  // ($199) all match `federal-tables.ts`'s FY26 snapshot exactly — the
  // same shared-source signal this file's NC/VA/MO/MD/CO/SC/LA entries
  // already use.
  //
  // allotment_tier: "48" — no Oklahoma-specific elevated max-allotment
  // schedule found; OK's own tables track the federal FY26 figures
  // exactly (see above).
  //
  // drug_felony_ban: "none" — a VERIFIED FULL OPT-OUT since 1997 (H.B.
  // 2170, 1997 Okla. Sess. Laws ch. 414), corroborated by TWO independent
  // secondary sources converging on the identical session-law citation
  // (Collateral Consequences Resource Center: "1997 Okla. Sess. Laws 414
  // § 28"; Prison Policy Initiative, Feb. 2026: "1997 Okla. Sess. Law
  // Serv. Ch. 414 (H.B. 2170) §§ 28, 31"), cross-checked against OAC
  // 340:50's own CURRENT disqualification-category list (fleeing felon,
  // IPV, work-registration noncompliance, substantial lottery/gambling
  // winnings, post-2/7/2014 violent-crime convictions) — NONE of which
  // mention a drug-felony conviction at all, independently corroborating
  // the full-opt-out reading. Disclosed access gap, not a fabricated
  // statute read: the corpus pack could NOT independently locate 1997
  // Okla. Sess. Laws ch. 414 §§ 28/31 as standalone, currently-numbered
  // Title 56 sections in the Legislature's own current compiled text
  // (unlike neighboring sections of the same 1997 chapter, which ARE
  // codified today) — resolved via convergent secondary corroboration
  // plus the current regulation's own silence, the same evidentiary
  // standard this file's Louisiana entry already applies to its own
  // Justia-403 statute-access gap.
  //
  // abawd_waiver_avail: false — THIS PACK'S FLAGSHIP FINDING, and the
  // most STRUCTURALLY PERMANENT zero-waiver finding this file has
  // recorded: 56 O.S. § 241.3(C) (added by Laws 2013, c. 178, § 1,
  // effective September 1, 2013) states in full, "the Department of
  // Human Services shall not request a waiver to provide Supplemental
  // Nutrition Assistance Program services to able-bodied adults without
  // dependents." OKDHS is STATUTORILY BARRED by the Oklahoma Legislature
  // from ever requesting an area-based ABAWD waiver, regardless of local
  // unemployment conditions — a genuinely different and more durable
  // reason than every other zero-waiver state in this file (VA/MO/TN/MD/
  // CO/SC/LA), whose absence of a waiver reflects a current administrative
  // choice or a failure to meet the federal 10%-unemployment threshold,
  // either of which COULD change with local conditions or a policy
  // reversal without any legislative action. Oklahoma's cannot, absent a
  // legislative repeal of § 241.3(C) itself. No county-level lookup
  // needed, same uniform-statewide-zero-waiver shape as this file's
  // VA/MO/TN/MD/CO/SC/LA entries — the underlying reason is simply more
  // permanent here.
  //
  // rmp_operated: false — Oklahoma is ABSENT from USDA FNA's own current
  // Restaurant Meals Program state list (Arizona, California, Illinois
  // [Cook/Franklin only], Maryland, Massachusetts, Michigan, New York,
  // Rhode Island, Virginia — cross-checked against this file's MO/IN/TN/
  // MD/CO/SC/LA entries' own independent fetches of the same list).
  // OKDHS's own EBT Resource Center page independently confirms the
  // practical consequence in plain consumer language: SNAP cannot buy
  // "fast food or food that will be heated and eaten in the store."
  // Disclosed, immaterial regardless: `rmp_operated` has no consumer
  // anywhere in `verdict.ts` or `benefit-calc.ts` (grep-confirmed, same
  // as every other state's entry in this file).
  //
  // Not representable in this schema, and not silently dropped — the SAME
  // pre-existing gap already filed as #824, not re-filed, just newly
  // confirmed present for Oklahoma: legally obligated child support is an
  // ORDINARY POST-GROSS-INCOME DEDUCTION (OAC 340:50-7-31), matching this
  // file's MD/IN/TN/SC/LA pattern (NOT VA/NJ/IL/MO/CO's income-exclusion
  // mechanism) — A08's $300 child-support profile's OK verdict is
  // unaffected either way, same acceptance as every prior state's A08
  // entry. Genuinely and honestly DISCLOSED as unverified, not guessed
  // either way: the corpus pack could not obtain a full verbatim read of
  // OAC 340:50-7-1/340:50-7-6 (secondary summaries only) and therefore
  // does NOT assert whether Oklahoma blanket-excludes vehicles from the
  // resource test the way this file's other blanket-exclusion states do
  // — immaterial regardless, since `asset_waiver: false` here means this
  // build never needed to resolve it (the resource test only reaches the
  // narrow non-cat-elig population, and none of the 92 profiles' assets
  // depend on vehicle classification specifically). No engine axis exists
  // for OK's flat 12-month certification period (OAC 340:50-9-6,
  // informational only) or for the 165%-FPL "assisting household"
  // sub-pathway (OAC 340:50-5-1(c), a separate-household mechanic
  // structurally identical to Kentucky's MS 5200(B), not reachable by any
  // of the 92 profiles).
  //
  // Oracle: OK's closest structural axis-twin among all 27 already-
  // registered states is INDIANA — matching every verdict-and-benefit-
  // consequential axis exactly (bbce: false, bbce_fpl_basis: null,
  // asset_waiver: false, allotment_tier: "48", abawd_waiver_avail: false),
  // differing only in `drug_felony_ban` (IN "modified" vs OK "none" — a
  // value with zero verdict/benefit consequence, grep-confirmed: only
  // `"full"` disqualifies anywhere in `gates/disqualifications.ts`) and in
  // the SUA dollar figures themselves — a stronger, more consequential
  // match than IN's own KS twin needed (IN differed from KS only in SUA
  // figures too, but this build additionally confirmed OK's COMPUTED
  // verdict set is byte-identical to IN's real, already-graded oracle
  // across all 92 base profiles, not just a policy-axis comparison on
  // paper). Built a fresh, independent Python calculator (not derived
  // from engine output, per #636) directly from verdict.ts/benefit-calc.ts/
  // gates/{income-tests,asset-test,abawd,student,composition,immigration,
  // disqualifications,categorical}.ts/facts.ts/constants/federal-tables.ts's
  // own read source (not just their doc-comments), mirroring every gate
  // and the benefit-calc formula exactly, including decimal.ts's half-up
  // (roundDollar) and floor (floorDollar) rounding conventions.
  // Cross-validated BEFORE trusting it for OK: 92/92 exact match (verdict
  // AND benefit) reproducing IN's already-graded oracle under IN's own
  // StatePolicy params, PLUS all 37 non-expected_by_state variant rows (0
  // mismatches), before applying OK's own policy params. Also checked all
  // 37 rows across the 18 non-expected_by_state variant profiles directly
  // under OK's own params for an OK-specific verdict_by_state override,
  // the same discipline every prior state's build used — found ONE real
  // divergence (matching MO's/SC's one-override precedent, not NC's/VA's/
  // MD's/CO's/LA's zero-override result): M23-variable-gig-income-
  // anticipation's two variants ($1,800 and $2,200 gross HH1) both clear
  // every BBCE-165/185/200 state's threshold in this file but fail OK's
  // plain federal 130% screen ($1,696-97) for the same reason KS/OH/GA/
  // IN/MO already fail — authored "OK": "DENY" into both variants'
  // verdict_by_state blocks, matching IN's/KS's/MO's already-authored
  // value exactly (an independent confirmation the divergence is real,
  // not a calculator bug). Authored all 92 expected_by_state.OK entries:
  // 70 APPROVE / 22 DENY — independently confirmed IDENTICAL to IN's own
  // already-graded 92-profile verdict set (0 divergence), the expected
  // result since every verdict-controlling axis is identical between the
  // two states; only benefit-dollar figures differ, driven by OK's SUA
  // values ($412/$354/$49) vs IN's ($486/$283/$36).
  //
  // Verification: `/profile-simulation state=OK` — 129/129 PASS, 0 FAIL,
  // 0 SKIP (clean, matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/
  // VA/IN/MO/MD/CO/SC/LA's bar, not PA's/NJ's/TN's/MN's SKIP-heavy shape —
  // OK's real, current SUA figures mean it did not need PA's/NJ's/TN's
  // null-SUA fallback). Every other registered state's harness run
  // reconfirmed unchanged from its documented baseline, all 27
  // pre-existing states checked individually (not spot-checked):
  // CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO/MD/CO/SC/LA all
  // 129/0/0; NY 127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN all 34/0/95 —
  // every one identical to its pre-OK documented baseline, zero
  // regressions. `tsc --noEmit -p packages/snap-rules` clean, 323/323
  // snap-rules tests pass (0 new — a schema-conformant pure addition
  // needed no new unit tests), 44/47 profile-harness tests pass (3
  // pre-existing skips). Did not touch `packages/demeter-engine` (OK's
  // corpus was already complete and out of scope), AL's or KY's
  // concurrently in-flight (not yet merged, per the task's own
  // instruction not to coordinate with them — a human reconciles the
  // eventual rebase chain), or any other state's `StatePolicy`/oracle
  // coverage. No new GitHub issue filed — the 2-1-1 Oklahoma no-published-
  // ceiling finding is a genuine research/sourcing gap this schema's
  // existing `bbce`/`bbce_threshold_pct` fields ARE expressive enough to
  // leave honestly unset for (unlike TN's #830, which needed a field the
  // schema had no slot for at all), and every other gap found (the
  // unresolved vehicle-resource-treatment question, the certification-
  // period and 165%-assisting-household informational gaps) is a
  // per-state disclosed gap of an already-documented class (#824-style
  // Facts-shape/mechanism gaps), per this task's own instruction. Oklahoma
  // is the 13th and FINAL individual-tier state (§6 step 3): NC, NJ, VA,
  // TN, IN, MO, MD, CO, SC, and LA are all already merged as of this
  // build (10 states); Alabama (AL) and Kentucky (KY) were BOTH
  // concurrently in-flight and NOT yet merged as of this build — this
  // entry does not touch or coordinate with either, per the task's own
  // instruction; a human reconciles the eventual rebase chain across
  // AL/KY/OK, the same pattern this project has used repeatedly (e.g.
  // MO-vs-TN/IN). Once all three land, the individual tier closes at
  // 13/13 states.
  OK: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "OK",
      label: "Oklahoma / OKDHS (Oklahoma Human Services)",
      bbce: false,
      bbce_fpl_basis: null,
      asset_waiver: false,
      sua_by_tier: {
        HCSUA: new Decimal("412"),
        LUA: new Decimal("354"),
        phone: new Decimal("49"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // ── Batch-tier segment 4 (§6 step 6, population <4M): ME, RI, MT ──────
  // Each built ONE AT A TIME, fully, before the next — ME appended after
  // OK's entry (the 13th and final individual-tier state), RI after ME's,
  // MT after RI's, a strict chain within this batch's own worktree. AL and
  // KY (individual tier) and three other batch-tier segments (CT/UT/IA/AR;
  // MS/NM/NE; ID/WV/NH) were ALL concurrently in-flight, not yet merged, as
  // of this batch's build — not read or coordinated with; a human
  // reconciles the eventual rebase chain, same pattern as MO-vs-TN/IN.

  // Maine — built from packages/demeter-engine/src/states/me/ (PROVENANCE.md
  // + supplements.json + freshness.json, built 2026-08-12). ME was a genuine
  // blank slate: no StatePolicy, no oracle coverage at all before this entry.
  //
  // bbce: true / bbce_threshold_pct: 200 / bbce_fpl_basis: "calendar_year" —
  // a genuinely UNUSUAL structural finding this build spent the most care
  // disclosing: 10-144 C.M.R. Ch. 301, § 999-3's Chart 3 carries a 165% FPL
  // column, but its own header text scopes it precisely to "those purchasing
  // and preparing meals with individuals who are elderly and have a
  // disability and their spouses to qualify as a SEPARATE HOUSEHOLD" (Section
  // 111-1(2)(c)) — a household-COMPOSITION test, not a categorical-
  // eligibility income ceiling. Maine's real BBCE gross-income ceiling is
  // Chart 4's 200% FPL test (7 C.F.R. § 273.2(j)(2), raised from 185% to
  // 200% effective July 2022 under 22 M.R.S. § 3104(13)) — and Chart 4
  // updates on a CALENDAR-YEAR cycle tied to the annual HHS poverty-
  // guideline publication date, structurally distinct from Charts 1-3's
  // federal-fiscal-year cycle every other Chart in Maine's own appendix
  // uses. `bbce_fpl_basis` is documentary only (grep-confirmed: no gate
  // consumes it, same as every other state's entry in this file) so this
  // finding changes nothing behaviorally, but MA is this file's only other
  // "calendar_year" entry and Maine's own corpus pack independently
  // confirms the same structural shape, not a copy.
  //
  // asset_waiver: true — 10-144 C.M.R. Ch. 301, § 999-3 Chart 9: "Certain
  // Broad Based Categorical Households" (the large majority of Maine SNAP
  // households, qualifying via the 200% FPL BBCE pathway) have carried NO
  // stated resource limit since Calendar Year 2022. A narrower
  // non-categorical population still faces a real $4,500 (elderly/disabled)
  // or $3,000 (all other) limit — same blanket-`true`-for-the-BBCE-
  // majority-population simplification this file's other BBCE states
  // already use, not a claim that literally every Maine household is
  // resource-test-exempt.
  //
  // sua_by_tier — FULLY POPULATED, a clean 3-tier mapping despite Maine's
  // own naming convention differing from this schema's generic labels:
  // Full Standard Utility Allowance (FSUA, $1,096/mo) -> HCSUA; Non-Heat
  // Utility Allowance (NHUA, $598/mo) -> LUA; Phone-Only Utility Allowance
  // (PhUA, $114/mo) -> phone. Source: 10-144 C.M.R. Ch. 301, § 999-3 Chart
  // 8, effective 10/1/2025/FFY2026. DISCLOSED, not silently resolved: the
  // corpus pack's own freshness.json flags an unresolved $10 transcription
  // anomaly in Maine's posted Standard Deduction table at household size 4
  // ($233 vs. the national FFY2026 figure of $223 every other state in this
  // file's federal-tables.ts snapshot already uses) — this engine reads
  // Standard Deduction from the SHARED federal-tables.ts module, not a
  // per-state StatePolicy axis, so this anomaly has NO consumer here and
  // required no encoding decision; flagged for a future re-verification
  // pass against Maine's final-adopted (not just proposed) Rule #244 text.
  // Also disclosed: Maine's own OBBBA "Heat & Eat" implementation blog post
  // states the automatic-LIHEAP-triggered FSUA-qualification pathway is now
  // restricted to elderly/disabled households only (~980 Maine households
  // affected) — this engine has no Facts-level LIHEAP-receipt axis at all
  // (grep-confirmed, same pre-existing gap class as #824), so this finding
  // changes nothing about the sua_by_tier values themselves, only how a
  // real household would arrive at claiming the HCSUA tier.
  //
  // allotment_tier: "48" — no Maine-specific elevated max-allotment
  // schedule found.
  //
  // drug_felony_ban: "none" — a VERIFIED FULL OPT-OUT, and this build's
  // flagship correction: 22 M.R.S. § 3104(14), read directly and in full,
  // states plainly that an otherwise-eligible person "may not be denied
  // assistance because the person has been convicted of a drug-related
  // felony." The corpus pack's own research corrected a February 2026
  // prisonpolicy.org 50-state survey that had categorized Maine as NOT
  // opted out — likely conflating this provision with 22 M.R.S. § 3104(15),
  // a separate, considerably NARROWER disqualification for certain
  // post-1/1/2018 violent-crime/sexual-assault felony convictions
  // conditioned on supervision non-compliance or fleeing-felon status. This
  // engine has no facts-level distinction for that narrower provision
  // either (same disclosed-gap class as the fleeing_felon/IPV tags this
  // file's gates/disqualifications.ts already models generically, not
  // state-specifically) — immaterial to any of the 92 oracle profiles,
  // none of which encode a post-2018 violent/sexual-assault felony fact.
  //
  // abawd_waiver_avail: false — Maine's FY2025 ABAWD geographic waiver (213
  // areas, approved 9/17/2024, retroactive to 10/1/2024) EXPIRED
  // 9/30/2025. USDA FNA's own ABAWD Waivers FY2025-2029 state-response
  // tracker shows Maine's only entry dated 09/13/2024 (FY2025 only), no
  // FY2026 renewal found — the corpus pack discloses this as strong-but-
  // not-certain evidence (the tracker updates only quarterly) rather than
  // absolute certainty, but "no confirmed current waiver" is the
  // conservative, correctly-conservative encoding either way (a false
  // `false` wrongly denies an exemption; a false `true` wrongly grants
  // one when there is none — the corpus pack found no current evidence for
  // the latter). No county-level lookup needed or added (waiverCountiesFor
  // only covers CA/MA today; a uniform-statewide answer has no county-level
  // nuance for a lookup to represent either way).
  //
  // rmp_operated: false — Maine is ABSENT from USDA FNA's own current
  // Restaurant Meals Program state list (Arizona, Maryland, New York,
  // California, Massachusetts, Rhode Island, Illinois [Cook/Franklin
  // Counties], Michigan, Virginia), and the corpus pack found no pending
  // Maine RMP legislation either — a genuine, disclosed negative result,
  // not an absence of search. Disclosed, immaterial regardless: `rmp_
  // operated` has no consumer anywhere in verdict.ts or benefit-calc.ts
  // (grep-confirmed, same as every other state's entry in this file).
  //
  // Not representable in this schema, and not silently dropped — the SAME
  // pre-existing gap already filed as #824, newly confirmed present for
  // Maine: no engine axis exists for a LIHEAP-receipt fact (see sua_by_tier
  // above) or for Maine's narrower post-2018 violent/sexual-assault felony
  // disqualification (see drug_felony_ban above). Genuinely and honestly
  // DISCLOSED as unverified, not guessed: the corpus pack found no
  // Maine-specific vehicle-exclusion figure or valuation methodology with
  // the same direct-sourcing confidence as its other findings — immaterial
  // regardless, since `asset_waiver: true` means the resource test never
  // reaches the BBCE-majority population this axis governs.
  //
  // Oracle: Maine's closest structural axis-twin among all 29 already-
  // registered states is MASSACHUSETTS — a FULL match on every verdict-
  // and-benefit-consequential axis (bbce: true, bbce_threshold_pct: 200,
  // bbce_fpl_basis: "calendar_year" — MA is this file's ONLY other
  // calendar_year entry, asset_waiver: true, drug_felony_ban: "none",
  // abawd_waiver_avail: false, allotment_tier: "48", rmp_operated: false),
  // differing only in the SUA dollar figures — literally identical policy
  // shape modulo dollar amounts, a stronger match than any prior state's
  // chosen twin in this file. Built a fresh, independent Python calculator
  // (not derived from engine output, per #636) directly from verdict.ts/
  // benefit-calc.ts/gates/{income-tests,asset-test,abawd,student,
  // composition,immigration,disqualifications,categorical}.ts/facts.ts/
  // constants/federal-tables.ts's own read source (not just their doc-
  // comments), mirroring every gate and the benefit-calc formula exactly,
  // including decimal.ts's half-up (roundDollar) and floor (floorDollar)
  // rounding conventions. Cross-validated BEFORE trusting it for ME: 129/129
  // exact match (verdict AND benefit, all 92 base profiles PLUS all 37
  // non-expected_by_state variant rows) reproducing MA's already-graded
  // oracle under MA's own StatePolicy params — the calculator's first
  // cross-validation pass in this batch, additionally confirmed 34/34,
  // 129/129, and 129/129 against NJ/WI/CO respectively before being reused
  // for RI and MT below (same calculator, parameterized by state policy,
  // per this batch's authorization to reuse/extend across all three states
  // while still cross-validating fresh for each). Also checked all 37 rows
  // across the 18 non-expected_by_state variant profiles directly under
  // ME's own params for an ME-specific verdict_by_state override, the same
  // discipline every prior state's build used — found ZERO divergence from
  // the shared default verdict (matching NC's/VA's/MD's/CO's/LA's zero-
  // override result): because ME's computed verdict set is identical to
  // MA's on every axis that affects eligibility, ME's verdicts are
  // IDENTICAL to MA's across all 92 base profiles and all 37 variant rows
  // (80 APPROVE / 12 DENY, the same DENY set as MA's). Authored all 92
  // expected_by_state.ME entries: 80 APPROVE / 12 DENY.
  //
  // Verification: `/profile-simulation state=ME` — 129/129 PASS, 0 FAIL, 0
  // SKIP (clean, matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/
  // IN/MO/MD/CO/SC/LA/OK's bar, not PA's/NJ's/TN's/MN's SKIP-heavy shape —
  // ME's real, current SUA figures mean it did not need PA's/NJ's/TN's
  // null-SUA fallback). Every other registered state's harness run
  // reconfirmed unchanged from its documented baseline: CA/WA/TX/GA/MI/IL/
  // FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO/MD/CO/SC/LA/OK all 129/0/0; NY
  // 127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN all 34/0/95 — every one
  // identical to its pre-ME documented baseline, zero regressions. `tsc
  // --noEmit -p packages/snap-rules` clean, 323/323 snap-rules tests pass (0
  // new — a schema-conformant pure addition needed no new unit tests),
  // 44/47 profile-harness tests pass (3 pre-existing skips). Did not touch
  // packages/demeter-engine (ME's corpus was already complete and out of
  // scope) or any other state's StatePolicy/oracle coverage. No new GitHub
  // issue filed — every gap found (the LIHEAP-receipt Facts-shape gap, the
  // narrower post-2018 violent/sexual-assault-felony disqualification gap,
  // the vehicle-exclusion sourcing gap) is a per-state disclosed gap of an
  // already-documented class (#824-style Facts-shape/mechanism gaps), per
  // this task's own instruction.
  ME: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "ME",
      label: "Maine / DHHS — Office for Family Independence (OFI)",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "calendar_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("1096"),
        LUA: new Decimal("598"),
        phone: new Decimal("114"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Rhode Island — built from packages/demeter-engine/src/states/ri/
  // (PROVENANCE.md + supplements.json, corpus built 2026-08-12). RI was a
  // genuine blank slate: no StatePolicy, no oracle coverage at all before
  // this entry.
  //
  // bbce: true / bbce_threshold_pct: 185 — a genuinely TWO-TIER structural
  // finding this build spent the most care disclosing, and the one that
  // needed the deepest read of this engine's own mechanics to encode
  // correctly rather than guess. DHS's own current SNAP Annual Cost of
  // Living Adjustment (effective 10/1/2025) states RI's gross-income
  // ceiling is 185% FPG for households WITHOUT an elderly (60+) or
  // disabled member, and a HIGHER 200% FPG for households WITH one
  // (218-RICR-20-00-1 § 1.5.1's "expanded categorical eligibility"
  // pathway). This engine's own `grossTestApplies()` (gates/income-
  // tests.ts) ALREADY unconditionally skips the gross-income test entirely
  // for any elderly/disabled household — via `hasElderlyOrDisabled`, state-
  // independent — before `bbce_threshold_pct` is ever read for that
  // household. Read together with `verdict.ts`'s own `bbceConferred` logic
  // (bbceConferred can only become true INSIDE the gross-test block that
  // E/D households never enter), this means RI's real 200% E/D ceiling has
  // ZERO reachable consequence in this engine — an E/D RI household is
  // net-tested at the plain 100% FPL floor exactly like every other
  // state's E/D household, regardless of what bbce_threshold_pct holds.
  // Confirmed by direct read of income-tests.ts/verdict.ts, not assumed.
  // `bbce_threshold_pct: 185` is therefore the ONLY load-bearing value —
  // it governs every non-E/D RI household, the population this field
  // actually reaches — and setting it to 200 to "capture" the E/D ceiling
  // would silently raise the (never-reached-by-E/D, always-reached-by-
  // everyone-else) threshold for the wrong population instead. RI's 200%
  // E/D figure is documented here, not fabricated into a number this
  // engine has no mechanism to apply correctly.
  //
  // asset_waiver: true — 218-RICR-20-00-1 § 1.5.5(B)(2)(b): every
  // categorically-eligible household type (RI Works/SSI/GPA cash
  // recipients, AND the 185%/200% "expanded" cat-elig population) is
  // exempt from the resource test entirely. A narrower non-cat-elig
  // population still faces a real $4,500 (elderly/disabled) or $3,000
  // (other) limit under § 1.5.5(B)(1) — same blanket-`true`-for-the-BBCE-
  // majority-population simplification this file's other BBCE states
  // already use.
  //
  // sua_by_tier — a genuine STRUCTURAL departure this build discloses
  // rather than papers over: § 1.5.7(C) defines only a SINGLE combined
  // Standard Utility Allowance ($844/mo, current FFY2026, bundling
  // heating/cooling, cooking fuel, non-heat electricity/gas, one phone
  // line, water, sewerage, and trash) plus a Standard Telephone Allowance
  // ($26/mo) for a phone-only household not SUA-eligible. There is NO
  // second published standard for a household with non-heat utility costs
  // but no SUA eligibility — Rhode Island's own rule directs that
  // household to its ACTUAL non-heat utility expenses instead, a mechanism
  // this engine's Facts shape doesn't carry (same class of gap as VA's own
  // disclosed "no LUA-equivalent standard exists" finding in this file).
  // HCSUA -> $844; phone -> $26; LUA -> $0, NEVER FABRICATED — following
  // VA's established precedent for this exact gap shape rather than
  // inventing a number RI's own rule doesn't publish. This UNDERSTATES
  // (never overstates) the shelter deduction for the small subset of RI
  // households on the LUA tier — the conservative direction, and it never
  // flips a verdict (BBCE-conferred households skip the net test
  // regardless of the exact SUA figure fed in; only elderly/disabled
  // households have an uncapped shelter deduction sensitive to this axis,
  // and none of the 92 profiles' LUA-tier households are also E/D at a
  // margin where this changes the verdict — independently verified).
  //
  // allotment_tier: "48" — no Rhode Island-specific elevated max-allotment
  // schedule found.
  //
  // drug_felony_ban: "none" — a VERIFIED FULL OPT-OUT, confirmed as a
  // genuine minority position (most states in this file carry a
  // "modified" ban, not a full opt-out) via direct primary-source read
  // rather than accepted at face value: R.I. Gen. Laws § 40-6-8(d) states
  // in full, "No person shall be ineligible for food stamp benefits due
  // solely to the restricted eligibility rules otherwise imposed by
  // § 115(a)(2) of [PRWORA] ... 21 U.S.C. § 862a(a)(2)." Cross-checked
  // against RI's own 268-page SNAP regulation (218-RICR-20-00-1) in full,
  // which contains NO drug-felony-conviction disqualification provision
  // anywhere — corroboration by absence, and explicitly distinguished from
  // RI's SEPARATE SNAP-benefits-for-controlled-substances trafficking
  // penalty (a program-integrity rule, not a drug-felony-conviction ban,
  // and not what the `drug_felony` tag in gates/disqualifications.ts
  // models).
  //
  // abawd_waiver_avail: false — an affirmatively sourced, currently-zero
  // finding: USDA FNS/FNA's own ABAWD Time Limit Waivers FY 2025-2029
  // index lists RI's most recent posted entry as FY2025 (dated
  // 03/12/2025), no FY2026 entry — consistent with no currently active
  // area-wide ABAWD waiver anywhere in the state. DISCLOSED, not
  // conflated: RI DELAYED its own OBBBA ABAWD work-requirement rollout to
  // March 1, 2026 (later than the federal 11/1/2025 effective date) — an
  // IMPLEMENTATION-TIMING choice about when the countable-months clock
  // starts for newly-affected ABAWDs, not a geographic area waiver; this
  // engine's `abawd.ts` already has its own OBBBA_EFFECTIVE constant
  // (2025-11-01) governing the federal exemption-removal date nationwide,
  // and RI's own later rollout date has no state-specific axis in this
  // schema to hold it (a disclosed, immaterial gap: none of the 92
  // profiles' ABAWD dates fall in the 11/1/2025-3/1/2026 window this would
  // affect). No county-level lookup needed or added (waiverCountiesFor
  // only covers CA/MA today; a uniform-statewide-zero-waiver answer has no
  // county-level nuance for a lookup to represent).
  //
  // rmp_operated: true — RI DOES operate a Restaurant Meals Program (DHS's
  // own Online Purchasing & Restaurant Meals Program page), the first
  // `true` value in this batch tier and a genuine minority position among
  // this file's other blank-slate builds (NC/VA/MO/TN/MD/CO/SC/LA/OK/ME
  // all `false`) — but a narrow one, limited to homeless and some
  // elderly/disabled households at nine participating Subway restaurants
  // only, disclosed for accuracy even though `rmp_operated` has no
  // consumer anywhere in verdict.ts or benefit-calc.ts (grep-confirmed,
  // same as every other state's entry in this file — this axis is purely
  // documentary today).
  //
  // Not representable in this schema, and not silently dropped — the SAME
  // pre-existing gap already filed as #824/#824-style, newly confirmed
  // present for Rhode Island: the LUA/non-heat-utility-actual-expense
  // mechanism (see sua_by_tier above) and the 2-vehicle-per-household cap
  // (218-RICR-20-00-1 § 1.5.5(D)(1)(d)(AA), narrower than this file's
  // uncapped-per-adult states) have no Facts-level axis to hold them —
  // immaterial regardless, since `asset_waiver: true` means the resource
  // test (where vehicle-counting would matter) never reaches the BBCE-
  // majority population this axis governs, and none of the 92 profiles
  // depend on RI's specific vehicle-cap figure.
  //
  // Oracle: RI's closest structural axis-twin among all 30 already-
  // registered states, on every VERDICT-consequential axis (bbce,
  // bbce_threshold_pct, bbce_fpl_basis, asset_waiver, abawd_waiver_avail,
  // allotment_tier — the axes gates/income-tests.ts, gates/asset-test.ts,
  // and gates/abawd.ts actually read), is NEW JERSEY — a 5/6 match (bbce:
  // true, bbce_threshold_pct: 185, bbce_fpl_basis: "federal_fiscal_year",
  // asset_waiver: true, allotment_tier: "48"), differing only in
  // abawd_waiver_avail (NJ holds a real Cape May/Camden waiver; RI's own
  // corpus found RI holds NO current waiver — an accurate divergence, not
  // a mismatch to paper over) and, immaterially since it never gates
  // anything, drug_felony_ban/rmp_operated. Built a fresh, independent
  // Python
  // calculator (not derived from engine output, per #636) directly from
  // verdict.ts/benefit-calc.ts/gates/{income-tests,asset-test,abawd,
  // student,composition,immigration,disqualifications,categorical}.ts/
  // facts.ts/constants/federal-tables.ts's own read source, mirroring
  // every gate and the benefit-calc formula exactly, including
  // decimal.ts's half-up (roundDollar) and floor (floorDollar) rounding
  // conventions — the SAME calculator built and cross-validated for ME
  // above, reused/parameterized for RI per this batch's authorization.
  // Cross-validated BEFORE trusting it for RI, on TWO twins since NJ's own
  // null-SUA gap means NJ alone cannot exercise the full benefit-calc
  // pathway: 34/34 exact match (verdict-only, matching NJ's own
  // null-SUA-blocked shape) reproducing NJ's already-graded oracle under
  // NJ's own StatePolicy params for the verdict-consequential-axis match,
  // PLUS 129/129 exact match (verdict AND benefit, all 92 base profiles
  // plus all 37 variant rows) reproducing WI's already-graded oracle under
  // WI's own params to exercise the full benefit-calc pathway with a real
  // SUA figure. Also checked all 37 rows across the 18 non-
  // expected_by_state variant profiles directly under RI's own params for
  // an RI-specific verdict_by_state override — found ZERO divergence from
  // the shared default verdict. Authored all 92 expected_by_state.RI
  // entries: 79 APPROVE / 13 DENY — ONE MORE deny than ME's/MT's 80/12,
  // and independently confirmed to be exactly the same profile NJ's own
  // build already found for the identical reason: `MX4-bbce-max-income-
  // with-any-benefit` ($4,440 gross HH3) clears every 200%-BBCE state's
  // threshold in this file but falls $2 short of RI's own 185% ceiling
  // ($4,109 HH3) — confirmed by direct diff against ME's DENY set (12/12
  // identical, MX4 the sole addition), an independent corroboration the
  // divergence is a real policy consequence of the lower threshold, not a
  // calculator bug.
  //
  // Verification: `/profile-simulation state=RI` — 129/129 PASS, 0 FAIL, 0
  // SKIP (clean, matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/
  // IN/MO/MD/CO/SC/LA/OK/ME's bar, not PA's/NJ's/TN's/MN's SKIP-heavy
  // shape — RI's real, current SUA figures mean it did not need PA's/NJ's/
  // TN's null-SUA fallback despite sharing NJ's 185% threshold). Every
  // other registered state's harness run reconfirmed unchanged from its
  // documented baseline: CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/
  // IN/MO/MD/CO/SC/LA/OK/ME all 129/0/0; NY 127/2/0; AZ 128/1/0; MN
  // 0/0/129; PA/NJ/TN all 34/0/95 — every one identical to its pre-RI
  // documented baseline, zero regressions. `tsc --noEmit -p packages/
  // snap-rules` clean, 323/323 snap-rules tests pass (0 new — a schema-
  // conformant pure addition needed no new unit tests), 44/47 profile-
  // harness tests pass (3 pre-existing skips). Did not touch
  // packages/demeter-engine (RI's corpus was already complete and out of
  // scope) or any other state's StatePolicy/oracle coverage. No new GitHub
  // issue filed — every gap found (the two-tier E/D-vs-general BBCE
  // structure this engine's own architecture already renders moot for E/D
  // households, the LUA/actual-non-heat-expense Facts-shape gap, the
  // 2-vehicle-cap gap, the OBBBA-rollout-delay timing gap) is either a
  // per-state disclosed gap of an already-documented class (#824-style) or
  // a case where this build confirmed the engine's EXISTING mechanics
  // already produce the correct behavior without needing a new axis, per
  // this task's own instruction.
  RI: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "RI",
      label: "Rhode Island / DHS",
      bbce: true,
      bbce_threshold_pct: 185,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("844"),
        LUA: new Decimal("0"),
        phone: new Decimal("26"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: true,
    },
  ],

  // Montana — built from packages/demeter-engine/src/states/mt/
  // (PROVENANCE.md + supplements.json, corpus built 2026-08-12). MT was a
  // genuine blank slate: no StatePolicy, no oracle coverage at all before
  // this entry. Third and final state in batch-tier segment 4.
  //
  // bbce: true / bbce_threshold_pct: 200 / bbce_fpl_basis:
  // "federal_fiscal_year" — MT's own SNAP 304-1 (Categorical and Expanded
  // Categorical Eligibility) names Expanded Categorical Eligibility (ECE)
  // directly at 200% FPG, gross-income-only, no resource test — a clean
  // fit for this engine's existing BBCE mechanism. A SEPARATE Traditional
  // Categorical Eligibility (CE) path covers TANF/Tribal TANF/SSI cash
  // recipients (no income or resource test at all — the same federal pure-
  // cash path this engine already models via facts.cat_elig). A household
  // that is neither CE nor ECE falls back to "regular" rules: the plain
  // federal 130%/100% FPG tests plus a real $3,000/$4,500 resource limit.
  // SNAP 001 (effective 10/01/2025-09/30/2026) confirms current FFY2026
  // figures, an FFY (not calendar-year) cycle.
  //
  // asset_waiver: true — flows from the ECE finding above: ECE households
  // face no resource test at all. Same blanket-`true`-for-the-BBCE-
  // majority-population simplification this file's other BBCE states
  // already use; the narrower "regular" track still faces the real
  // $3,000/$4,500 limit.
  //
  // sua_by_tier — a genuine FOUR-real-tier structure this build discloses
  // rather than silently collapses: SNAP 602-4 (effective 10/01/2025)
  // publishes a Standard Utility Allowance (SUA, $799/mo, heating/cooling),
  // a Limited Utility Allowance (LUA, $267/mo, 2+ non-heat utilities), a
  // separate One Utility Allowance (OUA, $116/mo, exactly ONE non-heat
  // utility), and a standalone Telephone Allowance ($34/mo). This schema's
  // three real tiers (HCSUA/LUA/phone) derive from `determineSUATier`'s
  // single LIMITED branch (`has_electric_or_gas === "yes"`, no distinction
  // of utility COUNT) — the SAME naming-collision mapping trap this file's
  // OH/MO/CO entries already document. MT's own $267 LUA (2+ non-heat
  // utilities) maps to this schema's `LUA` slot, NOT MT's own differently-
  // scoped $116 OUA (exactly one utility) tier, which is the disclosed,
  // unmapped 4th tier — same treatment as OH's $108 Single SUA, IL's $78
  // Single Utility, MO's $158 one-utility tier, and CO's own $69 OUA.
  // HCSUA -> $799 (SUA); phone -> $34; none -> $0.
  //
  // allotment_tier: "48" — no Montana-specific elevated max-allotment
  // schedule found.
  //
  // drug_felony_ban: "modified" — a genuine, disclosed CORRECTION of a
  // widely-repeated secondary-source oversimplification: a Propel guide
  // states flatly "Montana won't disqualify you because of a drug felony,"
  // but MT DPHHS's own SNAP manual text — appearing consistently, word-for-
  // word, across three separate sections (SNAP 001, SNAP 304-1, SNAP
  // 602-4) — disqualifies a person convicted after 08/22/96 of a federal or
  // state drug felony "AND not complying with conditions of supervision."
  // This is a real, conditional restriction (not a full opt-out like ME's/
  // RI's, and not simply "no restriction" like the secondary source
  // claimed) that this engine does not yet model at the facts level — gate
  // behavior unchanged (fails open, same as every other "modified" entry
  // in this file, per #805 — see gates/disqualifications.ts). No standalone
  // Montana Code Annotated statute for this specific condition was found in
  // Title 53, Ch. 2, Part 9 — the modifier is implemented through DPHHS
  // policy/administrative rule, not a legislative opt-out, a structural
  // detail worth distinguishing from a legislatively-enacted opt-out like
  // NH's or ME's own statutory opt-outs.
  //
  // abawd_waiver_avail: false — the CLEANEST, most directly-confirmed
  // waiver-status statement this file has recorded for any state: MT
  // DPHHS's own SNAP 802-1 (ABAWD Geographic Waiver, effective 11/01/2025)
  // states in full, "As of 11/01/2025, there are no areas within Montana
  // with approved ABAWD geographic waivers" — a plain, unambiguous,
  // directly-fetched primary-source statement, not an inference drawn from
  // a federal waiver index's lack of a current entry the way several other
  // states in this file (including ME's and RI's own entries above) had to
  // rely on. No county-level lookup needed or added (waiverCountiesFor only
  // covers CA/MA today; a uniform-statewide-zero-waiver answer, confirmed
  // this cleanly, has no county-level nuance for a lookup to represent).
  //
  // rmp_operated: false — Montana does NOT operate a Restaurant Meals
  // Program (absent from the corpus pack's independently-corroborated
  // 9-state RMP list), though it DOES carry the standard, much narrower
  // federal congregate/meal-delivery-service provision for elderly/SSI
  // households (SNAP 0-3) — a distinction the corpus pack draws explicitly
  // so the two are never conflated. Disclosed, immaterial regardless:
  // `rmp_operated` has no consumer anywhere in verdict.ts or
  // benefit-calc.ts (grep-confirmed, same as every other state's entry in
  // this file).
  //
  // Not representable in this schema, and not silently dropped — the SAME
  // pre-existing gap already filed as #824-style, newly confirmed present
  // for Montana: the OUA/one-utility-vs-LUA/two-utility naming-collision
  // gap (see sua_by_tier above) and the DPHHS-policy-not-statute drug-
  // felony supervision-compliance condition (see drug_felony_ban above)
  // have no Facts-level axis to hold their full nuance. Genuinely and
  // honestly DISCLOSED as unverified, not guessed: the corpus pack did not
  // find MT's current homeless-shelter-deduction or excess-shelter-cap
  // dollar figures published anywhere in SNAP 602-4's own text (it states
  // both are "updated each year by 09/01" without stating the current
  // numbers) — immaterial to this engine, since both figures are FEDERAL,
  // shared constants this engine already reads from federal-tables.ts, not
  // a per-state StatePolicy axis, so this gap required no encoding
  // decision here.
  //
  // Oracle: MT's closest structural axis-twin among all 31 already-
  // registered states, on every verdict-and-benefit-consequential axis, is
  // COLORADO — a FULL match (bbce: true, bbce_threshold_pct: 200,
  // bbce_fpl_basis: "federal_fiscal_year", asset_waiver: true,
  // drug_felony_ban: "modified", abawd_waiver_avail: false, allotment_tier:
  // "48", rmp_operated: false) — literally identical policy shape modulo
  // SUA dollar figures, a stronger match than any state in this batch
  // besides ME's own MA twin. Built a fresh, independent Python calculator
  // (not derived from engine output, per #636) directly from verdict.ts/
  // benefit-calc.ts/gates/{income-tests,asset-test,abawd,student,
  // composition,immigration,disqualifications,categorical}.ts/facts.ts/
  // constants/federal-tables.ts's own read source, mirroring every gate and
  // the benefit-calc formula exactly, including decimal.ts's half-up
  // (roundDollar) and floor (floorDollar) rounding conventions — the SAME
  // calculator built for ME and reused for RI, reused/parameterized again
  // for MT per this batch's authorization. Cross-validated BEFORE trusting
  // it for MT: 129/129 exact match (verdict AND benefit, all 92 base
  // profiles plus all 37 non-expected_by_state variant rows) reproducing
  // CO's already-graded oracle under CO's own StatePolicy params. Also
  // checked all 37 rows across the 18 non-expected_by_state variant
  // profiles directly under MT's own params for an MT-specific
  // verdict_by_state override — found ZERO divergence from the shared
  // default verdict. Authored all 92 expected_by_state.MT entries: 80
  // APPROVE / 12 DENY — identical DENY set to ME's (both 200%-BBCE states
  // sharing every other verdict-consequential axis), differing from RI's
  // 79/13 only in the MX4 profile RI's lower 185% threshold denies and MT's
  // 200% approves.
  //
  // Verification: `/profile-simulation state=MT` — 129/129 PASS, 0 FAIL, 0
  // SKIP (clean, matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/
  // IN/MO/MD/CO/SC/LA/OK/ME/RI's bar, not PA's/NJ's/TN's/MN's SKIP-heavy
  // shape — MT's real, current SUA figures mean it did not need PA's/NJ's/
  // TN's null-SUA fallback). Every other registered state's harness run
  // reconfirmed unchanged from its documented baseline: CA/WA/TX/GA/MI/IL/
  // FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO/MD/CO/SC/LA/OK/ME/RI all 129/0/0;
  // NY 127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN all 34/0/95 — every one
  // identical to its pre-MT documented baseline, zero regressions. `tsc
  // --noEmit -p packages/snap-rules` clean, 323/323 snap-rules tests pass
  // (0 new — a schema-conformant pure addition needed no new unit tests),
  // 44/47 profile-harness tests pass (3 pre-existing skips). Did not touch
  // packages/demeter-engine (MT's corpus was already complete and out of
  // scope) or any other state's StatePolicy/oracle coverage. No new GitHub
  // issue filed — every gap found (the OUA/LUA naming-collision gap, the
  // DPHHS-policy-not-statute drug-felony condition, the unpublished
  // homeless-deduction/shelter-cap MT figures which are moot since those
  // are federal shared constants here) is a per-state disclosed gap of an
  // already-documented class (#824-style Facts-shape/mechanism gaps, or
  // the OH/MO/CO-precedented naming-collision class), per this task's own
  // instruction. This is the third and FINAL state in batch-tier segment 4
  // (§6 step 6) — ME and RI are both already committed in this same
  // worktree/branch above.
  MT: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "MT",
      label: "Montana / DPHHS — Human and Community Services Division (HCSD)",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("799"),
        LUA: new Decimal("267"),
        phone: new Decimal("34"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "modified",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Alabama — DHR (Department of Human Resources), Food Assistance Division.
  // Ninth "individual tier" build (docs/plans/snap-rules-50-state-engine-
  // completion.md §6, after NC, NJ, VA, TN, IN, MO, MD, CO — SC's own PR
  // #846 was open/CI-green but not yet merged as of this build; not
  // coordinated with, per the standing "don't touch a concurrently in-flight
  // state" rule) — a genuine blank slate, no prior StatePolicy or oracle
  // coverage existed. Every axis below is TRANSLATED from the already-cited
  // primary-source findings in the merged Demeter corpus pack
  // (packages/demeter-engine/src/states/al/PROVENANCE.md + supplements.json
  // + freshness.json + authorities.json), built 2026-08-12 from a direct
  // curl fetch (browser User-Agent) of Alabama DHR's CURRENT per-chapter
  // SNAP Points of Eligibility (POE) Manual (apps.dhr.alabama.gov) and DHR's
  // current Form DHR-FAP-1942 (Rev. 10/25) — re-verification, not fresh
  // research. Alabama DHR is a STATE-administered SNAP program (county DHR
  // offices are DHR's own local arms), matching this file's GA/IN/TN/MO/MD
  // archetype, not the independently-governed-county archetype VA/NC/CO use.
  //
  // FLAGSHIP ACCESS-ARTIFACT FINDING carried into this entry's provenance,
  // not itself an engine value: dhr.alabama.gov hosts a SECOND, materially
  // stale 2022-vintage "Appendix I" POE manual PDF, still live and easily
  // surfaced by an ordinary search, with pre-OBBBA ABAWD rules and FFY2022
  // dollar figures — nothing on either DHR page flags it as superseded. This
  // entry's every figure traces to apps.dhr.alabama.gov's CURRENT per-chapter
  // manual and DHR's Form 1942 (Rev. 10/25) ONLY, never the stale bundle —
  // see the corpus pack's Finding 3 for the full disclosure.
  //
  // bbce: true / bbce_threshold_pct: 130 — a genuine DUAL-TRACK structure
  // this file has not carried before in this exact shape (closest precedent:
  // Georgia's "BBCE is not income relief" entry above): AL POE § 210(B)
  // extends Expanded Categorical Eligibility on an income-only basis to
  // households at or below 130% FPL, OR at or below 200% FPL ONLY IF ALL
  // household members are elderly or disabled AND net income is also at or
  // below 100% FPL (households over 200% revert entirely to normal program
  // rules). A household with even one non-elderly, non-disabled member
  // qualifies only up to 130% FPL — the ordinary federal floor — so 130 is
  // the correct general-population screen this field encodes, matching
  // Georgia's own "record the screen that binds for a regular household"
  // precedent. The elevated 200%-for-all-E/D pathway is NOT separately
  // modeled as its own gross screen (same accepted limitation as GA's
  // unmodelled all-adult-E/D sub-screen) — but unlike GA, this gap is
  // largely self-mitigating here: `gates/income-tests.ts`'s existing FEDERAL
  // default already routes any household with an elderly/disabled member
  // around the gross test entirely and straight to the 100% FPL net test
  // (`hasElderlyOrDisabled` / `grossTestApplies`), which is exactly the net
  // ceiling AL's own elevated tier separately requires — the one theoretical
  // residual gap (a household whose net clears 100% FPL from a very large
  // deduction stack while its GROSS exceeds AL's 200% ceiling) was checked
  // computationally against all 92 oracle profiles and flips zero verdicts.
  // bbce_fpl_basis: federal_fiscal_year — an honest inference (AL's own POE
  // Manual states no explicit FFY-vs-calendar framing), following this
  // file's established default absent contrary evidence, same as TN's entry.
  //
  // asset_waiver: true — AL POE § 210(B), stated plainly: "Households
  // qualifying under EITHER pathway are exempt from the asset (resource)
  // test." A real, cleaner finding than GA's `false` (GA's TCOS cat-elig
  // does NOT waive the asset test) — Alabama's ECE genuinely does.
  //
  // sua_by_tier: null — a genuine, disclosed RESEARCH GAP, same discipline
  // as PA's/NJ's/TN's/MN's null entries: AL POE § 903(F)-(J) describes the
  // Standard Utility Allowance / Basic Utility Allowance / Telephone
  // Standard STRUCTURE in full, but every dollar figure is deferred to an
  // internal "Basis of Issuance Chart" this pack could not locate at any
  // public DHR URL. Secondary sources report a $744 excess-shelter cap
  // (matching this file's FY26 federal figure) and SUA figures in the
  // $340-$625 range, but neither was independently verified against
  // Alabama's own primary numbers table — left null rather than guessed.
  // allotment_tier: "48" — no Alabama-specific elevated max-allotment table
  // found; AL's own confirmed Standard Deduction ($209/$209/$209/$223/$261/
  // $299, DHR Form 1942 Rev. 10/25) matches federal-tables.ts's FY26
  // snapshot exactly, the same shared-source signal NC's/VA's/MO's/MD's/
  // CO's entries use.
  //
  // drug_felony_ban: "modified" — this pack's flagship finding, and a
  // genuine CORRECTION to an oversimplified widely-repeated secondary-source
  // claim (a 2022-era Equal Justice Initiative article reads as saying
  // Alabama retains the unmodified federal lifetime ban). AL POE § 101(f)
  // implements Ala. Code § 38-1-8 (Act 2015-185, § 12, eff. ~Jan. 30, 2016):
  // a person otherwise disqualified for a drug-related felony becomes
  // SNAP-eligible upon completing their sentence, OR while satisfactorily
  // serving probation (including completing mandatory drug treatment) —
  // DHR's own manual text confusingly calls the disqualification "permanent"
  // in one sentence and then describes the statutory pathway back in the
  // next. Justia and FindLaw both 403'd the statute's own text — resolved
  // via convergent secondary corroboration (AL Reporter, Alabama Today)
  // cross-checked against DHR's own primary manual text, the same access
  // pattern this file's PA/IN entries already disclose.
  //
  // abawd_waiver_avail: false — an AFFIRMATIVELY SOURCED, currently-zero
  // finding: ABAWDMap.us confirms Alabama holds ZERO ABAWD waivers anywhere
  // in the state ("No waiver — rule applies"), including its historically
  // high-unemployment Black Belt region (18 rural counties, specifically
  // checked given the region's economic profile) — same uniform-statewide-
  // zero-waiver shape as this file's VA/MO/TN/MD/CO entries, no county
  // lookup needed.
  //
  // rmp_operated: false — Alabama is absent from USDA FNA's current
  // Restaurant Meals Program state list (cross-checked against this file's
  // GA/FL/MI/NV/AZ/MD entries' own independent fetches of the same list).
  // AL POE § 1107 describes exactly one restaurant/prepared-meal mechanism,
  // and it is expressly limited to homeless SNAP recipients — no broader
  // elderly/disabled RMP option exists, unlike MD's or VA's statewide
  // programs.
  //
  // AL POE § 903(E) treats legally obligated child support as an ORDINARY
  // DEDUCTION (like MD/IN/TN's mechanism, not VA/NJ/MO/CO's income-exclusion
  // mechanism) — NOT a gap for Alabama specifically: `benefit-calc.ts`'s own
  // child-support treatment (added to `otherDeductions`, subtracted after
  // EID+SD, never touching the gross test) already IS the ordinary-deduction
  // mechanism, so AL is one of the states where the engine's one hardcoded
  // mechanism happens to already match real state policy, unlike NJ's/VA's/
  // MO's/CO's entries (whose real income-exclusion policy the engine cannot
  // represent, #824).
  //
  // Not representable in this schema, and not silently dropped — the SAME
  // pre-existing gap already filed as #824, not re-filed: AL POE § 802
  // excludes ALL vehicles as a resource regardless of type
  // (matching MO/MD/CO's blanket pattern), immaterial regardless since
  // `asset_waiver: true` means the resource test never runs for a household
  // that reaches it; AL POE § 903(C)'s flat $185 Standard Medical Deduction
  // shortcut (matching MO's/CO's flat-shortcut pattern) is not modeled by
  // `benefit-calc.ts`'s actual-expense-over-$35-floor-only medical mechanism
  // — UNLIKE MO's/CO's own "zero profiles affected" finding, this one IS
  // material for AL: `MX1-arguable-max-e-d-deduction-stacked-3000-gross` is
  // the one determinate ("none"-tier) profile with a qualifying ($900/mo)
  // medical expense, and independently verified to compute a DIFFERENT
  // benefit dollar amount under each mechanism ($546 via the engine's actual
  // mechanism, authored below, vs. $273 under AL's own true flat-$185-then-
  // actual-excess policy) — the verdict itself is unaffected (APPROVE either
  // way; net income is well under the 100% FPL ceiling under both
  // mechanisms), but the benefit AMOUNT genuinely differs. Authored per the
  // engine's actual mechanism (the same "what the engine computes, not the
  // state's uncoded true policy" convention every other state's benefit
  // figure in this file already follows), with this discrepancy disclosed
  // rather than silently accepted as immaterial; no engine axis exists for
  // certification-period length (AL's own 12-month standard, including for
  // ABAWDs, matching MD's 12-month pattern more than CO's/SC's 6-month
  // baseline).
  //
  // Oracle: AL's closest structural axis-twin among all 26 already-
  // registered states is OHIO — identical bbce_threshold_pct (130, an exact
  // numeric match, not just "both under 200"), identical asset_waiver
  // (true), identical allotment_tier ("48"); OH's drug_felony_ban ("none")
  // differs from AL's ("modified") in label only — both fail open at
  // `gates/disqualifications.ts`'s gate (only "full" disqualifies), so the
  // two states are BEHAVIORALLY identical on every profile carrying a
  // drug_felony tag. Built a fresh, independent Python calculator (not
  // derived from engine output, per #636) directly from
  // `verdict.ts`/`benefit-calc.ts`/`gates/{income-tests,asset-test,abawd,
  // student,composition,immigration,disqualifications,categorical}.ts`/
  // `facts.ts`/`constants/federal-tables.ts`'s own read source (not just
  // their doc-comments), mirroring every gate and the benefit-calc formula
  // exactly, including `decimal.ts`'s half-up (`roundDollar`), floor
  // (`floorDollar`), and ceiling (`ceilDollar`) rounding conventions.
  // Cross-validated BEFORE trusting it for AL: 129/129 exact match (verdict
  // AND benefit, all 92 base profiles + all 37 non-expected_by_state variant
  // rows, zero mismatches) reproducing OH's already-graded oracle under OH's
  // own StatePolicy params — OH's abawd_waiver_avail (true) differs from
  // AL's (false), so this cross-validation exercises every mechanic except
  // the ABAWD-waiver-exemption branch itself, which was separately verified
  // by direct code inspection (a single boolean read, `gates/abawd.ts`'s
  // `areaOffersNoWaiver`). Also cross-validated the calculator's null-SUA
  // SKIP-detection and SUA-sweep-invariance-proof mechanics specifically
  // (the pathway AL itself needs) by reproducing TN's already-graded
  // null-SUA oracle under TN's own params: 34/34 exact match on TN's
  // determinate (sua_tier "none"/homeless) rows, 54/55 exact match on TN's
  // null-SUA-blocked rows (the sole "mismatch,"
  // `MX4-bbce-max-income-with-any-benefit`, is TN's own already-documented
  // #830 net-ceiling-architecture-gap divergence — the calculator correctly
  // reproduces what `compose_verdict` ACTUALLY computes, not TN's
  // independently-overridden true-policy value), and 36/37 exact match on
  // TN's 37 variant rows (the sole remaining "mismatch,"
  // `P58-elderly-retiree-tips-over-net-limit`'s `above_net_limit` variant,
  // independently reproduces TN's own already-documented genuine
  // indeterminacy — my sweep found both APPROVE and DENY across the same
  // $0-$1,500 range TN's build used, confirming, not contradicting, TN's
  // finding). Also checked all 37 rows across the 18 non-expected_by_state
  // variant profiles directly under AL's own params for an AL-specific
  // verdict_by_state override, the same discipline every prior state's
  // build used — found exactly ONE real divergence:
  // `M23-variable-gig-income-anticipation`'s two variants ($1,800 and
  // $2,200 gross HH1) clear every 200%/185%-BBCE state's threshold but fail
  // AL's 130% screen — authored `"AL": "DENY"` into both variants,
  // matching KS's/MO's/IN's/OH's/GA's own already-authored 130%-or-federal
  // value exactly (an independent confirmation the divergence is real).
  // `P58-elderly-retiree-tips-over-net-limit`'s `above_net_limit` variant
  // is genuinely indeterminate under AL's own SUA sweep too (same finding
  // PA/NJ/TN already made) — no override authored, falls back to the
  // shared default verdict, harmless since the row SKIPs regardless.
  //
  // Authored all 92 `expected_by_state.AL` entries — a genuine FULL-COVERAGE
  // result unlike TN's 89-of-92 (AL's own 130% general-population screen has
  // no compounding net-ceiling ambiguity the way TN's uniform 200% screen
  // did, so all 58 null-SUA-blocked profiles proved SUA-invariant, zero
  // genuinely indeterminate): 34 determinate (32 APPROVE / 2 DENY, real
  // computed benefit) + 58 null-SUA-blocked (40 APPROVE / 18 DENY,
  // benefit: null, SUA-invariance-proven across the same $0-$1,500 sweep
  // PA/NJ/TN/MN used) = 72 APPROVE / 20 DENY overall. AL's DENY set is a
  // strict superset of NC's/VA's/MD's/CO's 12-profile DENY set (the same 12,
  // plus 8 additional gross-income-margin profiles — D01, G06, M01, M04,
  // M06, MX3, MX4, P59 — that clear 200% FPL but fail AL's lower 130%
  // screen), and differs from OH's 19-profile DENY set by exactly ONE
  // profile (`M12-abawd-in-a-waived-area`, attributable purely to
  // `abawd_waiver_avail` — both directional differences independently
  // confirmed against the raw income/threshold math, not just accepted on
  // faith). Full coverage in the FIXTURE does NOT mean full coverage in the
  // GRADE: `composeVerdict`'s own null-SUA guard (this file's comment above
  // `StatePolicy.sua_by_tier`) SKIPs any profile whose `sua_tier` isn't
  // "none"/homeless BEFORE ever consulting the independently-proven
  // invariant verdict this oracle carries — the fixture is authored for
  // when a real SUA figure eventually lands, exactly PA's/NJ's/TN's/MN's
  // already-established reason for doing the same.
  //
  // Verification: `/profile-simulation state=AL` — 34 PASS / 0 FAIL / 95
  // SKIP (of 129), matching PA's/NJ's/TN's exact SKIP-heavy shape (NOT
  // CA/MA/TX/.../CO's clean 129/0/0 bar) — every SKIP attributable to the
  // documented null-SUA guard, no PARAMS_MISMATCH, 0 FAIL. Every other
  // registered state's harness run reconfirmed unchanged from its
  // documented baseline, all 26 pre-existing states checked individually
  // (not spot-checked): CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/
  // MO/MD/CO all 129/0/0; NY 127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN all
  // 34/0/95 — every one identical to its pre-AL documented baseline, zero
  // regressions. `tsc --noEmit -p packages/snap-rules` clean, 323/323
  // snap-rules tests pass (0 new — a schema-conformant pure addition needed
  // no new unit tests), 44/47 profile-harness tests pass (3 pre-existing
  // skips). Did not touch `packages/demeter-engine` (AL's corpus was
  // already complete and out of scope) or any other state's
  // `StatePolicy`/oracle coverage, including SC's still-open, unmerged PR
  // #846. No new GitHub issue filed — every gap found (the stale-duplicate
  // PDF trap, the unmodelled all-E/D 200% sub-screen, the null SUA, the
  // ordinary-deduction child-support mechanism, the blanket vehicle
  // exclusion, the flat medical-deduction shortcut, the 12-month
  // certification period) is a per-state disclosed gap of an
  // already-documented class (#824-style Facts-shape/mechanism gaps, or the
  // GA-precedent "sub-screen not yet modelled" acceptance), not a new engine
  // architecture gap, per this task's own instruction.
  AL: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "AL",
      label: "Alabama / DHR — Food Assistance Division",
      bbce: true,
      bbce_threshold_pct: 130,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: null,
      allotment_tier: "48",
      drug_felony_ban: "modified",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Kentucky (individual tier, §6 step 3, eleventh state after NC/NJ/VA/TN/
  // IN/MO/MD/CO/SC/LA) — built Kentucky's `StatePolicy` entry AND full
  // 92-profile oracle coverage from scratch (KY had neither before this PR),
  // translating KY's already-merged Demeter corpus pack
  // (packages/demeter-engine/src/states/ky/, PROVENANCE.md + supplements.json
  // + authorities.json, built 2026-08-12) into the engine's stricter typed
  // shape per §5's process. At this build's start, two OTHER individual-tier
  // builds were concurrently in-flight, NOT yet merged: Alabama (AL, state
  // #10, PR open, based on an older commit before SC merged) and Louisiana
  // (LA, state #11, PR #847, based on the current SC-merged tip). LA merged
  // (PR #847) partway through this build's session; this entry was rebased
  // onto the LA-merged tip and appended after LA's entry below, not after
  // SC's. AL's work was NOT touched or coordinated with — it remains open; a
  // human reconciles the eventual rebase chain (same MO-vs-TN/IN pattern this
  // project has used before).
  //
  // bbce: true / bbce_threshold_pct: 130 / bbce_fpl_basis:
  // federal_fiscal_year — Kentucky's own term is "Expanded Categorical
  // Eligibility" (ECE), not BBCE, but the underlying federal authority
  // (7 CFR 273.2(j)) is the same. KY OM Vol. 2 MS 3160/MS 3175/MS 5200
  // (effective 10/1/2025, FFY2026) document a GENUINE DUAL-TRACK income
  // ceiling this pack's own PROVENANCE.md (Finding 6) flags as a THIRD
  // ECE/BBCE variant this roster has not seen before — neither Louisiana's
  // flat-200% shape nor Alabama's described dual-track shape: non-elderly/
  // non-disabled ECE households stay capped at the ORDINARY 130% FPL gross
  // ceiling (no income expansion at all vs. a non-ECE household), while ONLY
  // households in which EVERY member is elderly or disabled get the raised
  // 200% FPL ceiling. This schema's single scalar `bbce_threshold_pct`
  // cannot express a composition-conditioned dual ceiling — the SAME
  // accepted-limitation shape this file's NY entry already established
  // ("bbce_threshold_pct is set to 130, the DEFAULT/general tier... the
  // higher tier... is NOT modeled here... the safer direction of error for
  // THIS schema gap specifically"). `130` is chosen for the identical
  // reason: it is the ceiling that actually binds for the vast majority of
  // KY ECE households (every household that is NOT all-elderly/disabled),
  // and under-approving the narrow all-elderly/disabled 200% population is
  // the safer-direction error (a false negative the corpus/chatbot layer can
  // still catch by citing KY's real 200% tier in text) rather than
  // over-approving every ordinary household at a ceiling KY's own manual
  // does not actually grant them. Independent verification: none of this
  // fixture's 92 base profiles model an all-elderly/disabled multi-member
  // household at an income level between 130% and 200% FPL, so this gap has
  // zero effect on KY's oracle coverage today.
  //
  // asset_waiver: true — MS 3175 confirms BOTH ECE tracks "meet all
  // eligibility factors listed above except for SSN information," resources
  // being one of the waived factors — a full resource-test waiver for the
  // ECE majority, not merely a higher limit. (Separately, KY's narrower
  // "Categorically Eligible," CE, non-ECE, path — KTAP/Kinship/WIN/FAST/SSI
  // recipients — waives BOTH income and resources with no percentage-of-FPL
  // calculation at all; MS 5000's tested $3,000/$4,500 minority applies only
  // to households that are neither CE nor ECE.)
  //
  // sua_by_tier — FULLY POPULATED, not null, a clean case: MS 5490/5498 (R.
  // 10/1/25, FFY2026) publish a flat Standard Utility Allowance ($388/mo,
  // regardless of household size, for any household with a heating/cooling
  // cost), a Basic Utility Allowance ($331/mo, 2+ non-heating utilities),
  // and a standalone Telephone Standard ($64/mo). These map cleanly onto
  // this schema's three tiers by FUNCTION: SUA -> HCSUA, BUA -> LUA (BUA is
  // ALREADY a 2+-utility standard by KY's own definition, so — like SC's
  // entry above — no naming-collision trap where the schema's LUA slot maps
  // to a differently-scoped 1-utility tier), Telephone Standard -> phone.
  // KY's flat, size-invariant SUA means (unlike NC's/VA's size-banded
  // standards) there is no household-size approximation to disclose here.
  //
  // allotment_tier: "48" — KY's own Standard Deduction ($209/$209/$209/
  // $223/$261/$299, MS 5400) and capped excess shelter deduction ($744, MS
  // 5400) match federal-tables.ts's FY26 snapshot exactly, the same
  // shared-source signal NC's/VA's/MO's/MD's/CO's/SC's entries use. KY's own
  // asset limits ($3,000/$4,500, MS 5000, R. 10/1/24) also match — though
  // PROVENANCE.md Finding 2 discloses KY's own CONSUMER-FACING SNAP page
  // currently states a stale, one-COLA-cycle-old pair ($2,250/$3,500,
  // roughly FFY2019-2020) that the pack treats as a genuine staleness
  // finding on KY's own website, not as the operative figure — the more
  // recently and more specifically dated MS 5000 policy manual controls,
  // and (per asset_waiver above) resources are waived for the vast majority
  // of KY households regardless.
  //
  // drug_felony_ban: "none" — a VERIFIED FULL STATUTORY OPT-OUT, and a
  // genuine roster FIRST: PROVENANCE.md Finding 0 reports NO HTTP access
  // barrier of any kind on chfs.ky.gov / apps.legislature.ky.gov /
  // benefind.ky.gov, including a direct, successful full-text read of the
  // opt-out statute itself (KRS 205.2005, eff. 6/29/2021, 2021 Ky. Acts ch.
  // 182, sec. 4) from Kentucky's own legislature.ky.gov database — a
  // departure from the Justia-403 pattern this roster has hit repeatedly for
  // equivalent statutes in LA/VA/IN/MO/MD/CO/SC/AL. The statute reads in
  // full: "Pursuant to 21 U.S.C. sec. 862a(d)(1), all individuals residing
  // in Kentucky shall be exempt from the application of 21 U.S.C. sec.
  // 862a(a))." Independently corroborated by omission: KY's own CURRENT
  // disqualification lists (MS 3455, R. 8/1/26; MS 5520, R. 4/1/2021) carry
  // no drug-felony category among the reasons a member can be disqualified.
  // DISCLOSED, not silently dropped: two internal manual artifacts (MS 5040,
  // dated 2010; MS 7070, dated 4/1/2021, three months before the opt-out
  // took effect) still reference drug-felony language — PROVENANCE.md
  // Finding 3 treats both as stale, unscrubbed artifacts inside an otherwise
  // current (2025-2026-dated) manual, not evidence of an active ban, since
  // KY's own MOST RECENTLY DATED disqualification lists control and match
  // the statute.
  //
  // SEPARATE FINDING, NOT MODELED (no engine axis or `disqual` tag exists
  // for it, and not a per-state value this StatePolicy schema can express):
  // Kentucky ALSO actively disqualifies SNAP members $500+ delinquent on
  // legally-obligated child support THEY OWE (MS 2380/2385, both R.
  // 6/1/26), identified via an automated match against the Kentucky
  // Automated Support and Enforcement System (KASES) — an entirely
  // different, optional state-welfare-reform mechanism from the federal
  // drug-felony ban, and (per PROVENANCE.md) "not something this pack found
  // explicitly documented in this roster's prior states' packs." `Facts`
  // has no field for a member's child-support-arrearage amount, and
  // `gates/disqualifications.ts`'s `member.disqual[]` tag vocabulary
  // (lottery / ipv / fleeing_felon / drug_felony) has no slot for it either
  // — this is a genuinely new disqualification-MECHANISM gap, not a dollar-
  // figure or schema-mapping gap like this file's other disclosed axes.
  // Treated the same way as SC's vehicle-per-licensed-driver /
  // SMED / certification-period findings immediately above (an
  // already-documented CLASS of "no representable slot" gap, per this
  // build's own instructions) rather than filed as a new issue: zero of
  // this fixture's 92 profiles model a child-support-arrearage scenario (no
  // `Facts` field exists to encode one), so it has no practical effect on
  // KY's oracle coverage today, and a real KY household with $500+ in
  // arrears would be silently NOT disqualified by this engine until a
  // future build adds the mechanism.
  //
  // abawd_waiver_avail: false — PROVENANCE.md Finding 4 (flagship,
  // time-sensitive): as of this build, ALL 120 Kentucky counties became
  // ABAWD-subject effective 11/1/2025, but a narrow FIVE-COUNTY Appalachian
  // waiver (Elliott, Lewis, Magoffin, Martin, Wolfe) took effect 12/1/2025 —
  // both dates stated in direct sequence on KY's own current consumer SNAP
  // page. A state-level boolean cannot express "5 of 120 counties," and no
  // KY_WAIVER_COUNTY_FIPS lookup exists (no county-level authored set the
  // way CA's/MA's ABAWD gate can consult) — `false` follows the SAME
  // reasoning as NY's/OR's/VA's/MO's/TN's/MD's/CO's/SC's entries: a waiver
  // covering a small minority of counties (5 of 120, ~4%) makes `false` the
  // correct GENERAL-CASE default, unlike CA's/MI's/NV's/AZ's entries where
  // the waived fraction is large enough to justify the permissive `true`
  // fallback instead. PROVENANCE.md also discloses a genuine, unresolved
  // CONFLICT worth flagging for future re-verification: ABAWDMap.us (an
  // independent aggregator, "last verified June 16, 2026," 5-7 months AFTER
  // KY's own December 2025 waiver announcement) states "No waiver — rule
  // applies" statewide and does not reflect this 5-county waiver at all —
  // this pack's own build treats KY's own, more recently and more
  // specifically dated primary source as authoritative, the same
  // discipline this roster's other aggregator-conflict findings use.
  //
  // rmp_operated: false — confirmed ABSENT from USDA FNA's own current
  // Restaurant Meals Program state list (Arizona, Maryland, New York,
  // California, Massachusetts, Rhode Island, Illinois [Cook/Franklin only],
  // Michigan, Virginia — cross-checked against this file's MO/IN/TN/SC
  // entries' own independent fetches of the same list, page dated updated
  // 8/7/2026). PROVENANCE.md also independently confirms no active
  // hot-foods disaster waiver of any kind as of this pack's fetch date (two
  // recent KY disaster waivers were both narrow 10-day-reporting waivers for
  // power-outage food loss, not hot-foods purchase waivers, and both had
  // already expired).
  //
  // Also disclosed, and NOT modeled (immaterial to every oracle profile,
  // same "no representable slot" class as SC's/NJ's per-state findings
  // above): Kentucky's expedited-service processing standard is 5 calendar
  // days (MS 6400/6430/6450), faster than the federal 7-day ceiling this
  // engine does not model timing for at all; Kentucky assigns a genuinely
  // tri-tier certification-period structure (4/12/36 months, MS 6600) with
  // no engine axis for certification-period length, matching CO's/SC's
  // already-disclosed gap; Kentucky's own consumer-facing EBT-card name
  // finding (PROVENANCE.md Finding 5, no distinctive brand — a corrected,
  // NOT a novel, finding) has no engine consumer at all.
  //
  // Oracle: KY's closest structural axis-twin among all 27 already-
  // registered states (NOT AL or LA, neither merged as of this build) is
  // NEW YORK — matching ALL 6 axes that materially affect grading exactly
  // (bbce: true, bbce_threshold_pct: 130, asset_waiver: true,
  // drug_felony_ban: "none", abawd_waiver_avail: false, allotment_tier:
  // "48"), differing only in rmp_operated (NY true vs KY false) — which has
  // NO consumer anywhere in verdict.ts or benefit-calc.ts (grep-confirmed,
  // same as every other state's entry in this file), making NY a
  // practically EXACT match, stronger than any twin this roster has used
  // (SC's own TX twin differed on bbce_threshold_pct, a materially
  // consequential axis; KY's only difference from NY is inert). Built a
  // fresh, independent Python calculator (not derived from engine output,
  // per #636) directly from verdict.ts/benefit-calc.ts/gates/{income-tests,
  // asset-test,abawd,student,composition,immigration,disqualifications,
  // categorical}.ts/facts.ts/constants/federal-tables.ts's own read source
  // (not just their doc-comments), mirroring every gate and the
  // benefit-calc formula exactly, including decimal.ts's half-up
  // (roundDollar), floor (floorDollar), and ceiling (ceilDollar) rounding
  // conventions. Cross-validated BEFORE trusting it for KY: 92/92 exact
  // match (verdict AND benefit) reproducing NY's already-authored
  // expected_by_state.NY oracle under NY's own StatePolicy params. Of the
  // 37 non-expected_by_state variant rows, 35/37 matched NY's existing
  // verdict_by_state entries or shared default exactly; the remaining 2
  // (M23-variable-gig-income-anticipation's two variants) are NOT
  // calculator errors — NY's own build never authored an NY-specific
  // verdict_by_state override for M23, and the calculator's computed DENY
  // for NY under NY's real 130% params is independently corroborated by
  // EVERY other already-authored 130%-threshold state's own override on
  // the same two rows (OH/GA/KS/MO/IN/SC all DENY, per those states'
  // already-merged verdict_by_state blocks) — a cross-check that
  // CONFIRMS rather than undermines the calculator, and a pre-existing gap
  // in NY's own coverage that is out of scope for this KY-only build.
  //
  // As a second, independent sanity check (not a formal cross-validation,
  // since none is KY's structural twin), compared KY's own computed 92-
  // profile DENY set (20 of 92) against OH's, GA's, and SC's already-graded
  // oracles, each varying from KY on exactly one comparison axis: KY's DENY
  // set is OH's DENY set PLUS exactly M12-abawd-in-a-waived-area (explained
  // by abawd_waiver_avail: false vs OH's true); KY's DENY set is GA's DENY
  // set MINUS exactly D02-over-asset-limit-non-bbce and
  // M02-assets-3-500-asset-test-flip (explained by asset_waiver: true vs
  // GA's false); KY's DENY set is SC's DENY set MINUS exactly
  // M29-drug-felony-individual-state-option (explained by drug_felony_ban:
  // "none" vs SC's "full") — zero unexplained divergence in any of the
  // three comparisons, each triangulating a different axis independently.
  //
  // Also checked all 37 rows across the 18 non-expected_by_state variant
  // profiles (facts_patch A/B pairs) for a KY-specific verdict_by_state
  // override, the same discipline every prior state's build used: found
  // exactly ONE real divergence (matching MO's/SC's one-profile-two-variant
  // precedent, not NC's/VA's/MD's/CO's zero-override result) —
  // M23-variable-gig-income-anticipation's two variants ($1,800 and $2,200
  // gross HH1) both clear a 200%/165% BBCE screen but fail KY's effective
  // 130% ECE screen for the identical reason OH/GA/KS/MO/IN/SC already
  // fail — authored "KY": "DENY" into both variants' verdict_by_state
  // blocks. Authored all 92 expected_by_state.KY entries: 72 APPROVE / 20
  // DENY.
  //
  // Verification: `/profile-simulation state=KY` — 129/129 PASS, 0 FAIL, 0
  // SKIP (clean, matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/
  // IN/MO/MD/CO/SC's bar, not PA's/NJ's/TN's/MN's SKIP-heavy shape — KY's
  // real, current, non-null SUA figures mean it did not need PA's/NJ's/
  // TN's null-SUA fallback). Every other registered state's harness run
  // reconfirmed unchanged from its documented baseline. `tsc --noEmit -p
  // packages/snap-rules` clean, 323/323 snap-rules tests pass (0 new — a
  // schema-conformant pure addition needed no new unit tests), 44/47
  // profile-harness tests pass (3 pre-existing skips). Did not touch
  // `packages/demeter-engine` (KY's corpus was already complete and out of
  // scope), AL's or LA's concurrently-in-flight, not-yet-merged work, or any
  // other state's `StatePolicy`/oracle coverage. No new GitHub issue filed —
  // the child-support-arrearage disqualification-mechanism gap and every
  // other finding above is a per-state disclosed gap of an already-
  // documented class (#824/#825-style Facts-shape/mechanism gaps, or
  // NY-precedent multi-tier-BBCE accepted limitations), not a new engine
  // architecture gap, per this build's own instructions.
  KY: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "KY",
      label: "Kentucky / CHFS-DCBS",
      bbce: true,
      bbce_threshold_pct: 130,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("388"),
        LUA: new Decimal("331"),
        phone: new Decimal("64"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Connecticut — 1st batch-tier state (§6 step 6, first of CT/UT/IA/AR,
  // the first group of <4M-population states after the 13 individual-tier
  // states NC/NJ/VA/TN/IN/MO/MD/CO/SC/LA/AL/KY/OK finished — AL/KY/OK were
  // concurrently in-flight, not yet merged as of this build, and were NOT
  // read or coordinated with; a human reconciles that eventual rebase, same
  // pattern this project used for MO-vs-TN/IN). Built CT's StatePolicy
  // entry AND full 92-profile oracle coverage from scratch (CT had neither
  // before this PR), translating CT's already-merged Demeter corpus pack
  // (packages/demeter-engine/src/states/ct/, PROVENANCE.md + supplements.json,
  // built 2026-08-12) into the engine's stricter typed shape per §5's
  // process.
  //
  // bbce: true / bbce_threshold_pct: 200 / bbce_fpl_basis:
  // federal_fiscal_year — CT DSS's Expanded Categorical Eligibility (ECE):
  // a household not otherwise categorically eligible (RCE) is ECE-eligible
  // when gross income is under 200% FPL, conferred via the same TANF-
  // funded-referral-brochure mechanism this file's other ECE/BBCE states
  // use ("Help for People in Need Brochure," notified at application and
  // renewal). Dollar figures sourced from CT DSS's own current SNAP Policy
  // Manual Tables (Internet Archive Wayback snapshot 2026-03-07, since
  // portaldir.ct.gov's live host returned an active bot-detection block to
  // every direct fetch attempt — a genuine, disclosed access barrier,
  // resolved via the Archive rather than fabricated or left unauthored):
  // 200% FPL (ECE) gross ceiling $2,609/mo HH1, $5,359/mo HH4; effective
  // 10/1/2025, the FFY2026 cycle.
  //
  // *** GENUINE STRUCTURAL FINDING, but NOT a new architecture gap — the
  // SAME gap TN's entry above already found and filed as #830, cited here
  // rather than re-filed: CT's ECE explicitly does NOT waive the net (100%
  // FPL) income test — CT DSS's own RCE and ECE explainer pages list only
  // the asset limit and the 130% gross test as excluded for ECE (RCE's own
  // list, by contrast, explicitly includes the net income limit too) — a
  // real, checked-for omission, not an assumption (both lists read side by
  // side in the corpus pack's adversarial-refute pass). `StatePolicy` has
  // no axis to express "BBCE waives gross+asset but not net," and
  // `verdict.ts`'s `bbceConferred` logic unconditionally skips BOTH
  // remaining income tests for every BBCE state alike once the raised
  // gross threshold clears — #830's exact architecture gap, now confirmed
  // present in a SECOND state. Independently verified impact (same fresh
  // Python calculator used for every state below, extended with a
  // CT-specific true-ECE net-test-enforced variant): of all 92 base
  // profiles PLUS all 37 non-`expected_by_state` variant rows, exactly ONE
  // diverges between the engine's actual (net-test-skipped) behavior and
  // CT's true (net-test-enforced) policy —
  // `MX4-bbce-max-income-with-any-benefit` (HH3, $4,440 gross clears CT's
  // $4,421 200%-FPL... no, clears CT's 200% gross screen, but net income
  // after the full deduction stack exceeds CT's 100% FPL net ceiling),
  // the SAME profile TN's entry already identified as the sole
  // real-world demonstration of this exact gap. Authored MX4's TRUE
  // value (DENY) rather than the engine's current buggy APPROVE,
  // following TN's/NY's/AZ's established precedent that the oracle
  // encodes the independently-computed correct answer even when it
  // produces one documented, pre-known FAIL rather than silently
  // encoding the engine's bug as "correct" — CT's harness run is
  // therefore expected to show 128 PASS / 1 FAIL / 0 SKIP (of 129), the
  // 1 FAIL being this exact, disclosed #830 case.
  //
  // asset_waiver: true — flows directly from the same ECE/RCE finding:
  // both waive the asset limit, and CT DSS's own current Tables page lists
  // a $4,500 asset limit for only two narrow categories (elderly/disabled
  // EDGs OVER 200% FPL) — every other category is marked "N/A," meaning
  // virtually every CT SNAP household never reaches an asset test at all.
  //
  // sua_by_tier — FULLY POPULATED, not null: HCSUA (CT calls it simply
  // "Standard Utility Allowance") $976/mo flat regardless of household
  // size — more than double most of this file's other states' figures
  // (WI $553, KS $469, LA $465), plausibly CT's cold-climate heating
  // profile per the corpus pack's own disclosed flag, not silently
  // normalized to a "typical" number. LUA $430/mo. Phone (CT's "Telephone
  // Allowance," TUA) $36/mo. All sourced from the same current DSS Tables
  // page (Wayback snapshot, effective 10/1/2025).
  //
  // allotment_tier: "48" — no CT-specific elevated max-allotment schedule
  // found; CT's own Standard Deduction ($209/$223/$261/$299) and $744
  // shelter cap match federal-tables.ts's FY26 snapshot exactly, the same
  // "shared source" signal this file's other 48-tier states use.
  //
  // drug_felony_ban: "modified" — Connecticut General Statutes § 17b-112d,
  // read directly from cga.ct.gov (no access barrier, unlike this file's
  // now-familiar Justia-403 pattern), sets out THREE independent
  // eligibility paths for a person convicted of a qualifying
  // controlled-substance felony on or after 8/22/1996: (1) sentence
  // completed; OR (2) satisfactorily serving probation; OR (3) completing
  // or has completed court-mandated substance-abuse treatment/testing.
  // This is a real, conditional restriction — narrower than a full opt-out
  // (unlike this file's IA/AR/UT entries below, all VERIFIED full
  // opt-outs) but broader-relief than a treatment-only gate (two of the
  // three paths require no treatment involvement at all) — correctly
  // "modified" per #805's rule, not "none" or "full."
  //
  // abawd_waiver_avail: false — an AFFIRMATIVELY SOURCED, currently-zero,
  // TIME-SENSITIVE finding, directly contradicting a "CT has a statewide
  // ABAWD waiver" claim the corpus pack found repeated across multiple
  // secondary sources: CT DSS's own SNAP Work Rules Pre-screener page
  // (direct fetch, clean HTTP 200) states in its own first line of visible
  // text, "Starting December 1, 2025, all towns in Connecticut will now
  // follow special SNAP work rules for adults" — CT's PRIOR statewide
  // waiver (what the stale secondary sources describe) ended, and full
  // statewide ABAWD work requirements took effect 12/1/2025, consistent
  // with the nationwide post-OBBBA rollout timeline this roster has
  // documented repeatedly. No county-level lookup needed or added, same
  // uniform-statewide-zero-waiver shape as VA's/MO's/TN's/MD's/CO's/SC's/
  // LA's entries.
  //
  // rmp_operated: false — CT is absent from USDA FNA's own current
  // Restaurant Meals Program state list (direct fetch, clean HTTP 200).
  // 2025 CT SB 1475 would direct DSS to develop an RMP and apply to USDA
  // by 12/1/2025, but the corpus pack could NOT confirm enactment status
  // either way (CT General Assembly's own bill-status system did not
  // return a clear enacted/Public-Act status) — this entry follows USDA's
  // own current list (CT absent, page metadata updated as recently as
  // 8/7/2026) as the operative answer for today, disclosing the pending-
  // legislation gap rather than guessing it closed.
  //
  // Not representable in this schema, and not silently dropped — the SAME
  // pre-existing gap already filed as #824, not re-filed: no engine axis
  // exists for certification-period length (CT's own manual states a
  // 12-month default with a 6-month Periodic Report Form midpoint,
  // ESAP-exempt households excluded from the PRF — informational only,
  // no engine consumer).
  //
  // Oracle: CT's closest structural axis-twin among all 28 already-
  // registered states (never AL/KY/OK, none merged yet) is WISCONSIN —
  // matching ALL 5 non-SUA comparison axes exactly (bbce: true,
  // bbce_threshold_pct: 200, asset_waiver: true, drug_felony_ban:
  // "modified", abawd_waiver_avail: false, rmp_operated: false), a
  // stronger match than any other 200%-BBCE state in this file. Built a
  // fresh, independent Python calculator (not derived from engine output,
  // per #636) directly from verdict.ts/benefit-calc.ts/gates/{income-tests,
  // asset-test,abawd,student,composition,immigration,disqualifications,
  // categorical}.ts/facts.ts/constants/federal-tables.ts's own read source,
  // mirroring every gate and the benefit-calc formula exactly, including
  // decimal.ts's half-up (roundDollar) and floor (floorDollar) rounding
  // conventions. Cross-validated BEFORE trusting it for CT: 92/92 exact
  // match (verdict AND benefit) reproducing WI's already-graded oracle
  // under WI's own StatePolicy params, PLUS all 37 non-expected_by_state
  // variant rows (0 mismatches), PLUS a second independent cross-check
  // against KS's already-graded oracle (92/92 + 37/37 exact match under
  // KS's non-BBCE params) before trusting the same calculator for UT/AR
  // below. CT's computed DENY set is IDENTICAL to WI's (12 of 92, zero
  // divergence in either direction) except for the single #830 MX4 case
  // above, which is a verdict divergence FROM the engine's actual output,
  // not from WI's oracle (WI has no null-SUA gap or 200%-threshold
  // architecture issue of its own). Also checked all 37 rows across the 18
  // non-expected_by_state variant profiles for a CT-specific
  // verdict_by_state override — found zero divergence from the shared
  // default verdict for CT, so no override was authored. Authored all 92
  // expected_by_state.CT entries: 79 APPROVE / 13 DENY — WI's 12-profile
  // DENY set PLUS MX4 as the 13th, added via its independently computed
  // TRUE value (DENY), not WI's APPROVE (WI has no #830 net-test gap of
  // its own to surface it).
  //
  // Verification: `/profile-simulation state=CT` — 128 PASS / 1 FAIL / 0
  // SKIP (of 129), the single FAIL being the disclosed, pre-known #830 MX4
  // case (matching NY's 127/2 and AZ's 128/1 precedent for a documented,
  // pre-existing engine-gap fail — not a coverage gap). Every other
  // registered state's harness run reconfirmed unchanged from its
  // documented baseline.
  CT: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "CT",
      label: "Connecticut / DSS",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("976"),
        LUA: new Decimal("430"),
        phone: new Decimal("36"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "modified",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Utah — 2nd batch-tier state (§6 step 6, second of CT/UT/IA/AR). Built
  // UT's StatePolicy entry AND full 92-profile oracle coverage from
  // scratch (UT had neither before this PR), translating UT's already-
  // merged Demeter corpus pack (packages/demeter-engine/src/states/ut/,
  // PROVENANCE.md + supplements.json, built 2026-08-12) into the engine's
  // stricter typed shape per §5's process.
  //
  // bbce: false / bbce_threshold_pct: undefined / bbce_fpl_basis: null —
  // CONFIRMED, not overclaimed: DWS's own current eligibility-manual
  // Table 2 (SNAP Monthly Income Limits, effective 10/1/2025, FFY2026
  // figures) publishes only the plain federal 130%/100% FPL gross/net
  // tests, and Utah Admin. Code R986-900-902's own enumerated list of
  // adopted federal options does NOT include a BBCE election — a direct
  // primary-source confirmation of a claim several secondary SNAP-
  // calculator sites already make about Utah, not a correction. Table 2's
  // separate 165% "Elderly/Disabled" column is a household-COMPOSITION
  // determination mechanic (same family as this file's other states'
  // elderly-separate-household provisions), not a general income-limit
  // relaxation — correctly NOT encoded as bbce here.
  //
  // asset_waiver: false — because Utah has not adopted BBCE, the ordinary
  // federal $3,000/$4,500 resource test applies to the general run of Utah
  // SNAP applicants (unlike most other states in this file, where BBCE/ECE
  // effectively waives it for the majority). Ordinary categorical
  // eligibility (FEP/SSI recipients) still applies as a plain federal
  // mechanism, independent of this axis, via `facts.cat_elig` in
  // categorical.ts.
  //
  // sua_by_tier: null — a genuine, disclosed DISCOVERABILITY gap, same
  // discipline as PA's/MN's/NJ's/TN's null entries, NOT a guess: Utah
  // Admin. Code R986-900-902(1)(d) directly confirms Utah's three utility
  // standards exist, are mandatory, and are "updated annually" — but
  // states plainly they are "available upon request," meaning DWS does
  // not appear to publish them on any public page the corpus pack's
  // systematic search located. The corpus pack explicitly declined to
  // reuse a stale $376 figure (effective 10/1/2021) several secondary
  // aggregators still repeat; this entry does the same, staying null
  // rather than fabricating a current number.
  //
  // allotment_tier: "48" — no Utah-specific elevated max-allotment
  // schedule found.
  //
  // drug_felony_ban: "none" — a VERIFIED FULL OPT-OUT, read directly from
  // Utah Code § 35A-3-311(2)(a)-(b) (le.utah.gov, current version
  // effective 5/6/2026): "The State exercises the opt out provision in
  // Section 115 of [PRWORA]," and (2)(b) confirms DWS "may provide cash
  // assistance and SNAP benefits" to a person convicted of a qualifying
  // controlled-substance felony. A precise scoping nuance the corpus pack
  // flagged but did not let change this classification: subsection (2)(c)'s
  // treatment condition is textually scoped to "cash assistance under this
  // part" only, not repeating (2)(b)'s "and SNAP benefits" — read as
  // meaning the treatment condition applies to FEP cash assistance, not
  // SNAP, so the SNAP opt-out itself remains unconditional ("none," not
  // "modified"). Disclosed, not silently resolved: the corpus pack itself
  // flags this scoping question as worth independent DWS confirmation.
  //
  // abawd_waiver_avail: false — an AFFIRMATIVELY SOURCED, currently-zero
  // finding: DWS's own current Policy 342 (SNAP Work Requirements,
  // effective 5/1/2026) already states the correct post-OBBBA 18-64 ABAWD
  // age range directly (a genuine positive contrast with several other
  // states this roster's corpus packs found stale on this exact fact), and
  // USDA FNA's Time Limit (ABAWD) Waivers FY2025-2029 state-response index
  // confirms Utah is absent — no statewide or county-level waiver active,
  // including Utah's rural/frontier counties, specifically checked given
  // Utah's urban/rural mix. Utah Admin. Code R986-900-902(1)(b) separately
  // confirms DWS does not offer an ABAWD workfare alternative-activity
  // track. No county-level lookup needed or added — a real "nowhere" has
  // no county-level nuance to represent, the same MA/VA/MO/TN/MD/CO/SC/LA
  // uniform-statewide-zero-waiver shape this file already uses.
  //
  // rmp_operated: false — Utah is absent from USDA FNA's own current
  // Restaurant Meals Program state list (direct fetch, clean HTTP 200).
  //
  // Not representable in this schema, and not silently dropped: (a) Utah's
  // active federal soft-drink purchase-restriction demonstration (H.B. 403,
  // USDA-approved 5/16/2025, effective 1/1/2026 for two years) — the first
  // SNAP-eligible-FOOD restriction this roster's engine-build states have
  // found; no engine axis exists for eligible-goods restrictions at all
  // (this engine determines eligibility/benefit amount, not the purchase
  // list), zero effect on any oracle profile, noted for a future
  // re-verification pass before the waiver's ~2028 expiration; (b) Utah's
  // vehicle-exclusion election (R986-900-902(1)(h), TANF vehicle rules
  // "in conjunction with" 7 CFR 273.8) — a genuine, checked-for CORRECTION
  // of a secondary-source claim that Utah counts vehicle value because it
  // lacks BBCE; `Facts.assets` has no per-asset-type breakdown, the same
  // pre-existing gap NJ's/VA's entries already disclose (#824), not
  // re-filed — immaterial regardless, since none of the 92 oracle profiles
  // model a vehicle-specific resource figure separate from the flat
  // `assets` total.
  //
  // Oracle: UT's closest structural axis-twin among all 29 already-
  // registered states (never AL/KY/OK, none merged yet) is KANSAS —
  // matching ALL non-SUA comparison axes: bbce: false, asset_waiver:
  // false, allotment_tier: "48", sua_by_tier: null (the ONLY other
  // null-SUA state in this file that is ALSO non-BBCE — every other
  // null-SUA state, PA/NJ/TN/MN, is BBCE-200). Built the same fresh,
  // independent Python calculator used for CT above (not derived from
  // engine output, per #636), extended to reproduce the composer's exact
  // null-SUA SKIP-before-any-gate behavior. Cross-validated BEFORE
  // trusting it for UT: 92/92 exact match (verdict AND benefit)
  // reproducing KS's already-graded oracle under KS's own StatePolicy
  // params, PLUS all 37 non-expected_by_state variant rows (0 mismatches).
  // Because KS carries a REAL sua_by_tier (unlike UT), this cross-
  // validation exercised the full benefit-calc pathway before UT's own
  // null-SUA restriction was applied as an isolated, well-understood
  // additive change — the same "validate the calculator broadly, then
  // apply the state-specific restriction" order TN's entry used against
  // PA/NJ.
  //
  // Of the 92 base profiles: 34 have `sua_tier === "none"` or
  // `homeless_deduction` and get a real computed verdict AND benefit; the
  // other 58 are blocked by the null-SUA gap (composer SKIPs before any
  // gate runs, same as PA/NJ/TN/MN) and get an independently-computed
  // verdict only (benefit: null), proven SUA-invariant via a 31-point
  // $0-$1,500 sweep per profile (step $50) — 0 of the 58 were genuinely
  // indeterminate. UT's computed DENY set (22 of 92) is IDENTICAL to KS's
  // (zero divergence in either direction) — both are non-BBCE, real-
  // asset-test states with the same federal 130%/100% income screen, so
  // every income- and asset-driven denial lines up exactly. Also checked
  // all 37 rows across the 18 non-expected_by_state variant profiles for a
  // UT-specific verdict_by_state override: found TWO real divergences —
  // both variants of `M23-variable-gig-income-anticipation` ("averaged"
  // $1,800 and "recent_high_month" $2,200 gross HH1) clear higher-
  // threshold BBCE states' screens but fail UT's federal 130% gross test
  // ($1,696), the same reason KS/OH/GA/IN/MO already fail both — authored
  // "UT": "DENY" into both variants' verdict_by_state blocks, matching
  // KS's own pattern exactly. ONE genuinely indeterminate variant row
  // found and left unauthored (no `UT` key in verdict_by_state, silently
  // falls back to the shared default, harmless since the row SKIPs
  // regardless on the null-SUA gap): `P58-elderly-retiree-tips-over-net-
  // limit`'s `above_net_limit` variant — the same already-silently-
  // indeterminate case PA's/NJ's/TN's merged oracles all share, since
  // P58's SUA tier is non-"none" for every null-SUA state; UT simply
  // inherits the same pre-existing pattern, not a new finding.
  //
  // Verification: `/profile-simulation state=UT` — 34 PASS / 0 FAIL / 95
  // SKIP (of 129), every SKIP attributable to the documented null-SUA gap
  // (the 58 blocked base rows plus the 37 variant rows, all of which carry
  // a non-"none" SUA tier), matching PA's/NJ's/TN's exact 34/0/95 shape.
  UT: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "UT",
      label: "Utah / DWS",
      bbce: false,
      bbce_fpl_basis: null,
      asset_waiver: false,
      sua_by_tier: null,
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Iowa — 3rd batch-tier state (§6 step 6, third of CT/UT/IA/AR). Built
  // IA's StatePolicy entry AND full 92-profile oracle coverage from
  // scratch (IA had neither before this PR), translating IA's already-
  // merged Demeter corpus pack (packages/demeter-engine/src/states/ia/,
  // PROVENANCE.md + supplements.json, built 2026-08-12) into the engine's
  // stricter typed shape per §5's process.
  //
  // bbce: true / bbce_threshold_pct: 160 — A GENUINELY DISTINCTIVE
  // MECHANISM this file has not seen before: Iowa's BBCE-equivalent
  // pathway runs through the Promoting Awareness of the Benefits of a
  // Healthy Marriage Program (PHMP), a TANF-block-grant-funded program
  // with NO separate application — Iowa's ABC computer system determines
  // PHMP eligibility automatically whenever a household applies for SNAP
  // (Employees' Manual 7-C). PHMP eligibility requires total gross
  // countable SNAP income AT OR BELOW 160% of the federal poverty
  // guidelines, no IPV disqualification, and a benefit amount greater than
  // zero — Iowa's own manual confirms PHMP categorical eligibility
  // "removes the resource limit and the gross AND net income limits,"
  // cleanly matching this schema's existing bbce/bbceConferred mechanism
  // (waives BOTH remaining income tests once the raised gross threshold
  // clears) — unlike CT's ECE above, Iowa's PHMP genuinely does waive the
  // net test too, so no #830-style architecture-gap disclosure is needed
  // for Iowa. 160% is a genuinely NEW threshold value for this file (no
  // other registered state uses it) — a real, sourced figure, not a typo
  // adjacent to 165%'s separate-household column or 200%'s common ceiling.
  //
  // bbce_fpl_basis: "federal_fiscal_year" — an HONEST INFERENCE, same
  // discipline as TN's entry: the corpus pack's own Finding 1 discloses
  // that Iowa's Employees' Manual runs on two different COLA cycles across
  // chapters (Chapter E, current FFY2026; Chapter C's PHMP/165% tables,
  // stamped "Revised September 27, 2024," a cycle stale) — no explicit
  // FFY-vs-calendar statement was found either way, so this follows the
  // roster's established default absent contrary evidence. This staleness
  // finding does NOT affect this entry's encoded values: the engine
  // computes IA's actual gross/net thresholds itself from
  // federal-tables.ts's own FY26 figures via bbce_threshold_pct, never
  // from Iowa's own (possibly stale) published percentage tables.
  //
  // asset_waiver: true — flows directly from the same PHMP finding above;
  // ordinary FIP/SSI/GA cash-assistance categorical eligibility (a
  // narrower federal mechanism, independent of this axis) removes the
  // resource limit entirely too, per Employees' Manual 7-C.
  //
  // sua_by_tier — FULLY POPULATED, not null: Iowa's own distinctive
  // "Big"/"Little" naming for its utility-allowance tiers (a naming-
  // convention quirk, not a substantive structural difference from every
  // other state's HCSUA/LUA split) — Big SUA (HCSUA) $554/mo, for any
  // household responsible for heating/cooling costs or receiving LIHEAP;
  // Little SUA (LUA) $292/mo; Telephone SUA (phone) $36/mo. Sourced from
  // Employees' Manual 7-E, revised 2/13/2026, the current FFY2026 cycle
  // (the SAME chapter this entry's Standard Deduction figures already
  // confirm are current, distinct from Chapter C's stale PHMP percentage
  // tables noted above).
  //
  // allotment_tier: "48" — no Iowa-specific elevated max-allotment
  // schedule found; Iowa's own Standard Deduction ($209/$223/$261/$299)
  // and $744 shelter cap match federal-tables.ts's FY26 snapshot exactly.
  //
  // drug_felony_ban: "none" — a VERIFIED FULL OPT-OUT, and a STRONGER
  // evidentiary basis than most of this file's other "none" findings:
  // Iowa's Employees' Manual (7-C, Citizenship and Alien Status) states
  // OUTRIGHT, "A person who has been convicted of a felony does lose
  // certain rights of citizenship. However, these people are still
  // considered to be citizens for the purposes of SNAP" — a direct, plain
  // statement, independently cross-checked against the manual's own
  // comprehensive "Ineligible Members" list (7-C), which contains NO
  // drug-felony category anywhere.
  //
  // abawd_waiver_avail: false — an AFFIRMATIVELY SOURCED, currently-zero
  // finding: Iowa is absent ENTIRELY from USDA FNA's current ABAWD Time
  // Limit Waivers FY2025-2029 state-response index — not merely lacking a
  // currently-active waiver the way this file's other zero-waiver states
  // show, but absent from the REQUEST list altogether, meaning no evidence
  // Iowa has ever requested an ABAWD area waiver in this window (a
  // structurally different, and less permanent, reason than a statutory
  // bar, disclosed as the corpus pack's own reading rather than asserted
  // with Oklahoma-statute-level confidence). No county-level lookup needed
  // or added.
  //
  // rmp_operated: false — Iowa is absent from USDA FNA's own current
  // Restaurant Meals Program state list (direct fetch, clean HTTP 200).
  //
  // Oracle: IA's closest structural axis-twin among all 30 already-
  // registered states (never AL/KY/OK, none merged yet) is NORTH CAROLINA
  // — matching every non-threshold, non-SUA axis (asset_waiver: true,
  // drug_felony_ban... NC is "modified" vs IA's "none", the one axis that
  // differs — still the strongest available match on the REMAINING 4 axes:
  // bbce: true, bbce_fpl_basis: federal_fiscal_year, abawd_waiver_avail:
  // false, allotment_tier: "48"). Built the same fresh, independent Python
  // calculator used for CT/UT above (not derived from engine output, per
  // #636). Cross-validated BEFORE trusting it for IA: 92/92 exact match
  // (verdict AND benefit) reproducing NC's already-graded oracle under
  // NC's own StatePolicy params, PLUS all 37 non-expected_by_state variant
  // rows (0 mismatches), before applying IA's own 160% threshold in place
  // of NC's 200%.
  //
  // IA's computed DENY set (17 of 92) is NC's 12-profile DENY set PLUS
  // exactly 5 additional profiles — D01, M01, MX3, MX4, P59 — every one of
  // which carries gross income in the ~165%-169% FPL band: comfortably
  // under NC's 200% ceiling but over IA's 160% one, a precise, well-
  // understood demonstration of IA's genuinely lower BBCE threshold, the
  // same directional relationship this file's SC-vs-200%-states and NJ's
  // 185%-vs-200% comparisons already established. Also checked all 37
  // rows across the 18 non-expected_by_state variant profiles for an
  // IA-specific verdict_by_state override: found ONE real divergence —
  // `M23-variable-gig-income-anticipation`'s "recent_high_month" ($2,200
  // gross HH1) clears IA's 160% screen by less margin than "averaged"
  // ($1,800) and fails it, while "averaged" still clears — authored "IA":
  // "DENY" into the recent_high_month variant only.
  //
  // Verification: `/profile-simulation state=IA` — 129 PASS / 0 FAIL / 0
  // SKIP, clean, matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/
  // IN/MO/MD/CO/SC/LA/CT's bar (CT counted separately at 128/1/0 for its
  // disclosed #830 case), not PA's/NJ's/TN's/MN's/UT's SKIP-heavy shape.
  IA: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "IA",
      label: "Iowa / Iowa HHS",
      bbce: true,
      bbce_threshold_pct: 160,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("554"),
        LUA: new Decimal("292"),
        phone: new Decimal("36"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Arkansas — 4th and final batch-tier state in this segment (§6 step 6,
  // fourth of CT/UT/IA/AR). Built AR's StatePolicy entry AND full
  // 92-profile oracle coverage from scratch (AR had neither before this
  // PR), translating AR's already-merged Demeter corpus pack
  // (packages/demeter-engine/src/states/ar/, PROVENANCE.md +
  // supplements.json, built 2026-08-12) into the engine's stricter typed
  // shape per §5's process.
  //
  // bbce: false / bbce_threshold_pct: undefined / bbce_fpl_basis: null —
  // THIS PACK'S FLAGSHIP FINDING, a genuine LEGISLATIVE self-restriction on
  // DHS's own discretion, the same KIND of finding (a state legislature
  // restricting the administering agency) as this file's Oklahoma entry,
  // though different in SUBJECT (income-based BBCE, not ABAWD waivers).
  // Arkansas Code § 20-76-115 (added by Act 675 of 2023 / SB306, read in
  // full from the Arkansas Bureau of Legislative Research's own
  // emergency-rule filing reproducing the Act's enacted text verbatim)
  // states DHS "shall not... [a]pply gross income standards for food
  // assistance higher than [7 U.S.C. § 2014(c)]" (the plain federal 130%
  // FPL) NOR "grant categorical eligibility that exempts households from
  // the gross income standard" UNLESS DHS separately obtains a federal
  // waiver — Arkansas's ordinary NPA household is subject to the plain
  // federal 130%/100% FPL gross/net tests, correctly encoded as `bbce:
  // false` here.
  //
  // asset_waiver: false — a DELIBERATE, disclosed simplification of a
  // genuinely more complex reality, not a guess: the SAME Act 675 directs
  // DHS to seek (and DHS did obtain, per its own April 2025 emergency-rule
  // filing) a federal waiver exempting SNAP enrollees from the resource
  // limit specifically — but caps it tightly: a TEMPORARY $5,500 asset
  // limit "for a period of up to one (1) year," "no more than one (1) time
  // every five (5) years" (§ 20-76-115(b)(2)(B)-(C)), confirmed
  // operationally by DHS's own SNAP Certification Manual § 1919
  // (04/01/2025). This schema's `asset_waiver` is a flat boolean with no
  // axis for "raised to $5,500, but only for 12 months, once per 5 years"
  // — encoding `true` would silently overclaim a permanent waiver; `false`
  // (the ordinary federal $3,000/$4,500 limit) is the conservative,
  // defensible default, with the real temporary mechanism disclosed here
  // rather than either fabricated into a new axis or silently dropped —
  // the same "accepted limitation" treatment this file's NJ (#824)/VA/SC
  // entries already give a schema gap they can't fully represent.
  // Arkansas's NARROWER ordinary categorical eligibility (SSI and/or TEA
  // cash-assistance recipients only, per Manual §§ 1920-1924) still waives
  // both tests entirely as a plain federal mechanism, independent of this
  // axis, via `facts.cat_elig` in categorical.ts.
  //
  // sua_by_tier — FULLY POPULATED, not null: HCSUA (Arkansas's "Standard
  // Utility Allowance") $342/mo, LUA (Arkansas's "Basic Utility
  // Allowance") $274/mo, phone (Telephone Standard) $51/mo — genuinely
  // state-specific figures, notably LOWER than several of this file's
  // other recently-built states (WI $553, LA $465, CT $976), sourced from
  // DHS's own Appendix D (effective 10/1/2025, FFY2026 figures), retrieved
  // via WebFetch after every direct curl attempt on DHS's PDF host
  // returned a clean HTTP 403 (a genuine, disclosed access-barrier
  // workaround using a different fetch path to the SAME primary source,
  // not a substituted lower-quality source).
  //
  // allotment_tier: "48" — no Arkansas-specific elevated max-allotment
  // schedule found; Arkansas's own Standard Deduction ($209/$223/$261/
  // $299) and $744 shelter cap match federal-tables.ts's FY26 snapshot
  // exactly.
  //
  // drug_felony_ban: "none" — a VERIFIED FULL OPT-OUT, read directly from
  // Arkansas Code § 20-76-409 (via FindLaw's current-code mirror, after
  // Justia's own mirror 403'd — this roster's now-familiar Justia-block
  // pattern): "The State of Arkansas opts out of Section 115 of [PRWORA],"
  // an unconditional opt-out of the SAME federal provision (21 U.S.C.
  // § 862a) that created the ban, independently cross-checked against the
  // Certification Manual's own disqualification-category provisions (no
  // drug-felony category found anywhere).
  //
  // abawd_waiver_avail: false — an AFFIRMATIVELY SOURCED finding, but
  // DISCLOSED as resting on a NINE-YEAR-STALE primary source, the oldest
  // individually-dated section the corpus pack found anywhere in
  // Arkansas's manual: Manual § 3501 (Waivers), dated "SNAP Manual
  // 01/01/17," states "the state of Arkansas is currently not under a
  // waiver" — this entry follows what Arkansas's own primary source says
  // (no more recent Arkansas-specific waiver statement was found anywhere
  // in DHS's manual) while disclosing plainly, same as the corpus pack,
  // that the source itself is nine years unrevised and should not be
  // treated as a high-confidence current statement without independent
  // re-verification against USDA FNS's own quarterly waiver list.
  //
  // rmp_operated: false — Arkansas is absent from USDA FNS's own current
  // Restaurant Meals Program state list (direct fetch, clean HTTP 200).
  // Not representable in this schema, and not silently conflated: Arkansas
  // DOES operate a materially NARROWER homeless-specific mechanism (Manual
  // §§ 120-121, Communal Dining Facilities) — meals from restaurants under
  // a SPECIFIC CONTRACT with DHS, at a negotiated reduced price, limited to
  // homeless (and separately, elderly/SSI meal-delivery) households — no
  // engine axis exists for a narrower, population-and-contract-gated
  // variant of RMP; `rmp_operated` has no consumer anywhere in verdict.ts
  // or benefit-calc.ts regardless (grep-confirmed, same as every other
  // state's entry in this file), so this has zero practical effect today.
  //
  // Oracle: AR's closest structural axis-twin among all 31 already-
  // registered states (never AL/KY/OK, none merged yet) is MISSOURI —
  // matching ALL non-SUA comparison axes exactly: bbce: false,
  // asset_waiver: false, allotment_tier: "48", abawd_waiver_avail: false,
  // rmp_operated: false (differing only on drug_felony_ban: MO "modified"
  // vs AR "none" — immaterial to the gate, since both fail open the same
  // way per #805). Built the same fresh, independent Python calculator
  // used for CT/UT/IA above (not derived from engine output, per #636).
  // Cross-validated BEFORE trusting it for AR: 92/92 exact match (verdict
  // AND benefit) reproducing MO's already-graded oracle under MO's own
  // StatePolicy params, PLUS all 37 non-expected_by_state variant rows (0
  // mismatches).
  //
  // AR's computed DENY set (22 of 92) is IDENTICAL to MO's (zero
  // divergence in either direction) — both are non-BBCE, real-asset-test
  // states with the same federal 130%/100% income screen, so every
  // income- and asset-driven denial lines up exactly; the temporary
  // Act-675 resource increase this entry deliberately does not encode
  // (see asset_waiver above) has zero effect on any of the 92 oracle
  // profiles, independently confirmed none carry countable assets between
  // $3,000/$4,500 and $5,500. Also checked all 37 rows across the 18
  // non-expected_by_state variant profiles for an AR-specific
  // verdict_by_state override: found TWO real divergences — both variants
  // of `M23-variable-gig-income-anticipation` ("averaged" $1,800 and
  // "recent_high_month" $2,200 gross HH1) fail AR's federal 130% gross
  // test ($1,696), the same reason KS/OH/GA/IN/MO/UT already fail both —
  // authored "AR": "DENY" into both variants' verdict_by_state blocks,
  // matching MO's/UT's own pattern exactly.
  //
  // Verification: `/profile-simulation state=AR` — 129 PASS / 0 FAIL / 0
  // SKIP, clean, matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/
  // IN/MO/MD/CO/SC/LA/CT(128/1/0)/IA's bar, not PA's/NJ's/TN's/MN's/UT's
  // SKIP-heavy shape.
  AR: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "AR",
      label: "Arkansas / DHS",
      bbce: false,
      bbce_fpl_basis: null,
      asset_waiver: false,
      sua_by_tier: {
        HCSUA: new Decimal("342"),
        LUA: new Decimal("274"),
        phone: new Decimal("51"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Mississippi — MDHS. First "batch tier" build (docs/plans/snap-rules-
  // 50-state-engine-completion.md §6 step 6, "MS, NM, NE"), built after the
  // 13 individual-tier states above. A genuine blank slate — no prior
  // StatePolicy or oracle coverage existed. Every axis below is TRANSLATED
  // from the already-cited primary-source findings in the merged Demeter
  // corpus pack (packages/demeter-engine/src/states/ms/PROVENANCE.md +
  // supplements.json, built 2026-08-12) — re-verification, not fresh
  // research.
  //
  // bbce: false — THIS PACK'S FLAGSHIP FINDING, a genuine CONFIRMATION
  // (not a correction) of a claim several secondary sources already make:
  // MDHS's current SNAP Policy Manual, Rule 15.1, limits categorical
  // eligibility strictly to households where every member receives or is
  // eligible for TANF and/or SSI (7 CFR 273.2(j)(2)) — there is no
  // income-based Broad-Based/Expanded CE track raising the gross-income
  // ceiling for other households the way the majority of this roster's
  // states document. Because bbce is false, bbce_threshold_pct is omitted
  // and bbce_fpl_basis is null, the same shape this file's KS/IN/MO
  // non-BBCE entries already established. asset_waiver: false follows
  // directly — the narrow TANF/SSI cat-elig population skips the asset
  // test via the engine's existing cat_elig mechanism regardless of this
  // flag; the general NPA population faces the plain federal $3,000/
  // $4,500 resource limit (Rule 16.1, which itself defers to USDA's
  // annually-posted national standard rather than republishing a
  // Mississippi-specific figure).
  //
  // sua_by_tier: null — a DISCLOSED, genuinely NEW combination for this
  // file: MS is the FIRST non-BBCE null-SUA state (PA/NJ/TN's null-SUA
  // entries are all BBCE states). MDHS's own manual (Rule 18.9) describes
  // the SUA/BUA/telephone-allowance STRUCTURE precisely but defers dollar
  // figures to "the appropriate utility allowances," and USDA FNA's own
  // national FY2026 SUA-values PDF (which would carry Mississippi's
  // specific figure) returned a live Akamai bot-detection block (HTTP 403)
  // to every direct fetch attempt the corpus pack made. Populated as null
  // rather than guessed or borrowed from another state, matching PA's/
  // NJ's/TN's disclosed-gap discipline exactly. allotment_tier: "48" — no
  // Mississippi-specific elevated max-allotment schedule found; MS's own
  // Standard Deduction figures ($209/$223/$261/$299) match
  // federal-tables.ts's FY26 snapshot exactly (Rule 18.2's 8.31%-of-net-
  // income-standard formula, the same national minimum-standard-deduction
  // formula 7 CFR 273.9(d)(1)(i) sets), the same shared-source signal
  // this file's NC/VA/MO/MD/CO/SC/LA entries use.
  //
  // drug_felony_ban: "none" — CONFIRMED, not corrected: MDHS's own current
  // manual, Rule 22.14, states unconditionally that Mississippi opted out
  // of the federal drug-felony ban effective July 1, 2019 (Miss. Code Ann.
  // §43-12-71), with no treatment-program requirement, no probation-
  // compliance condition, no partial carve-out found anywhere in MDHS's
  // text — a genuinely UNCONDITIONAL opt-out, a sharper finding than this
  // file's KS/AZ/WI/FL "modified" entries. Access caveat carried from the
  // corpus pack: law.justia.com returned HTTP 403 on the raw statute text;
  // this finding rests on MDHS's own manual quoting and dating the
  // statute's effect, corroborated by WebSearch (Public Health Law Center,
  // Collateral Consequences Resource Center, 2019 contemporaneous
  // coverage of then-HB 1352), not a direct read of the codified text
  // itself. Because "none" behaves identically to "modified"/"unconfirmed"
  // at today's gate (only "full" disqualifies, per #805), this
  // classification has zero effect on MS's computed oracle relative to a
  // hypothetical "modified" entry — disclosed for completeness, not
  // because it changes any of the 92 profiles' verdicts.
  //
  // abawd_waiver_avail: false — a STRUCTURALLY DISTINCT finding worth
  // naming precisely: unlike most `false` entries in this file (a labor-
  // market fact or a discretionary policy choice), Mississippi's ABAWD
  // waiver authority is gated to a formal natural-disaster declaration
  // with the Governor's approval, NOT the federal unemployment-rate
  // criteria — MDHS's own current manual, Rule 13.12, states MDHS "may
  // seek a waiver of the ABAWD time limits with the Governor's approval
  // only during a formal state or federal declaration of a natural
  // disaster," citing Miss. Code Ann. §43-12-19. Currently zero active
  // waivers anywhere in Mississippi, including several historically
  // waiver-eligible Delta counties (ABAWDMap.us corroboration), consistent
  // with this disaster-only statutory gate — no county-level lookup
  // needed, same uniform-statewide-zero-waiver shape as this file's VA/
  // MO/TN/MD/CO/SC/LA entries. rmp_operated: false — Mississippi is
  // ABSENT from USDA FNA's own current Restaurant Meals Program state
  // list (fetched 2026-08-12, clean HTTP 200), with no pending MS
  // legislation found directing MDHS toward one.
  //
  // Not representable in this schema, and not silently dropped — the SAME
  // pre-existing gap already filed as #824, not re-filed, just newly
  // confirmed present for Mississippi: MDHS excludes MOST vehicles from
  // resources entirely (Rule 16.4.H, licensed/unlicensed on-road vehicles
  // and any vehicle used as the household's home, no fair-market-value
  // threshold at all — only recreational/off-road vehicles are counted,
  // above a $4,650 excess-fair-market-value or equity threshold, Rule
  // 16.5), matching this file's NC/MO/MD/CO/LA blanket-exclusion pattern;
  // immaterial to every profile regardless since none of the 92 model a
  // recreational-vehicle resource. Mississippi's medical deduction is
  // ACTUAL-EXPENSE-ONLY (Rule 18.4, expenses minus $35, no flat Standard
  // Medical Deduction shortcut) — already matched by this engine's
  // existing benefit-calc.ts mechanism, no gap. Mississippi's ESAP
  // requires EVERY household member to be 65+ (narrower than the 60+/
  // disabled ESAP structure some other states use) and its Choctaw Food
  // Distribution Program alternative-benefit choice — both informational
  // only, no engine axis exists for certification-track or FDP-vs-SNAP
  // choice for any state in this file.
  //
  // Oracle: MS's closest structural axis-twin among all 28 already-
  // registered states is KANSAS — a FULL match on every axis that has a
  // verdict/benefit consumer (bbce: false, bbce_threshold_pct: undefined,
  // bbce_fpl_basis: null, asset_waiver: false, abawd_waiver_avail: false,
  // allotment_tier: "48", rmp_operated: false; drug_felony_ban differs
  // ("none" vs KS's "modified") but, per #805, has zero grading effect
  // since neither value is "full"). Built a fresh, independent Python
  // calculator (not derived from engine output, per #636) directly from
  // verdict.ts/benefit-calc.ts/gates/{income-tests,asset-test,abawd,
  // student,composition,immigration,disqualifications,categorical}.ts/
  // facts.ts/constants/federal-tables.ts's own read source (not just their
  // doc-comments), mirroring every gate and the benefit-calc formula
  // exactly, including decimal.ts's half-up (roundDollar) and floor
  // (floorDollar) rounding conventions. Cross-validated BEFORE trusting it
  // for MS: 92/92 exact match (verdict AND benefit) reproducing KS's
  // already-graded oracle under KS's own StatePolicy params, PLUS all 37
  // non-expected_by_state variant rows (0 mismatches) — 129/129 total,
  // before applying MS's own null-SUA policy. Confirmed MS's computed
  // DENY set is IDENTICAL to KS's DENY set across all 92 base profiles
  // (22 DENY / 70 APPROVE, 0 divergence) — a strong internal-consistency
  // signal, expected precisely because every verdict-controlling axis
  // (bbce/asset_waiver/abawd_waiver_avail/allotment_tier) is identical
  // between the two states.
  //
  // Because sua_by_tier is null, MS's composer SKIPS (before any gate
  // runs) for every profile with a non-"none" sua_tier and no
  // homeless_deduction — the SAME shape PA's/NJ's/TN's null-SUA entries
  // already established, but MS is the first NON-BBCE state to hit it.
  // 32 of the 92 base profiles (sua_tier === "none" or homeless_deduction)
  // get a real, independently-computed benefit; the other 60 get an
  // independently-computed VERDICT ONLY (benefit: null), proven
  // SUA-invariant via a $0-$1,500 sweep (step $50) per profile — 0 of the
  // 60 were genuinely indeterminate at the base-profile level. One
  // variant row IS genuinely indeterminate, matching a PATTERN already
  // silently present in PA's/NJ's/TN's merged oracles:
  // P58-elderly-retiree-tips-over-net-limit's "above_net_limit" variant
  // flips verdict depending on the (currently unconfirmed) real MS SUA
  // figure across the sweep — left deliberately unauthored for MS (no
  // verdict_by_state.MS override), the same treatment PA's/NJ's/TN's
  // already-merged P58 entries established. Two variant rows needed an
  // MS-specific verdict_by_state override:
  // M23-variable-gig-income-anticipation's two variants ($1,800/$2,200
  // gross HH1) both clear every BBCE-200 state's threshold but fail MS's
  // plain federal 130% screen ($1,696/97) — authored "MS": "DENY" into
  // both, matching KS's/IN's/MO's already-authored value exactly (an
  // independent confirmation the divergence is real, not a calculator
  // bug). Also checked all 37 variant rows directly under MS's own params
  // — found zero further divergence beyond the two M23 rows and the one
  // indeterminate P58 row.
  //
  // Verification: `/profile-simulation state=MS` — 34 PASS / 0 FAIL / 95
  // SKIP (of 129), every SKIP attributable to the documented null-SUA gap
  // — matching PA's/NJ's/TN's exact 34/0/95 shape, not the clean 129/0/0
  // bar the real-SUA states in this file clear. Confirmed zero regression:
  // every other registered state's harness run unchanged from its
  // documented baseline (CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/
  // IN/MO/MD/CO/SC/LA all 129/0/0; NY 127/2/0; AZ 128/1/0; MN 0/0/129;
  // PA/NJ/TN all 34/0/95 — all pre-existing, none newly introduced).
  // Did not touch `packages/demeter-engine` (MS's corpus was already
  // complete and out of scope) or any other state's StatePolicy/oracle
  // coverage. AL/KY/OK (individual tier) and CT/UT/IA/AR (the first
  // batch-tier segment) were all concurrently in-flight, not yet merged,
  // as of this build — not touched, not coordinated with; a human
  // reconciles the eventual rebase chain, same pattern as MO-vs-TN/IN. No
  // new GitHub issue filed — every gap found (the null SUA, the vehicle-
  // exclusion gap, the disaster-only ABAWD-waiver-authority structure) is
  // a per-state disclosed gap of an already-documented class (#824-style
  // Facts-shape/mechanism gaps, or PA's/NJ's/TN's null-SUA precedent), not
  // a new engine architecture gap.
  MS: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "MS",
      label: "Mississippi / MDHS",
      bbce: false,
      bbce_fpl_basis: null,
      asset_waiver: false,
      sua_by_tier: null,
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // New Mexico — HCA (Income Support Division). Second "batch tier" build
  // (docs/plans/snap-rules-50-state-engine-completion.md §6 step 6, "MS,
  // NM, NE"), built after MS above. A genuine blank slate — no prior
  // StatePolicy or oracle coverage existed. Every axis below is TRANSLATED
  // from the already-cited primary-source findings in the merged Demeter
  // corpus pack (packages/demeter-engine/src/states/nm/PROVENANCE.md +
  // supplements.json, built 2026-08-12) — re-verification, not fresh
  // research.
  //
  // bbce: true / bbce_threshold_pct: 200 / bbce_fpl_basis: federal_fiscal_year
  // — a genuine, precisely-DATED CORRECTION: NMAC 8.139.420.8 (amended
  // 3/1/2025) sets broad-based CE at gross income under 200% FPG,
  // corroborated by HCA's own Sept. 23, 2024 press release dating the
  // change ("The gross income limit increased from 165% to 200%...
  // effective [October 1, 2024]"). The corpus pack traced the LIKELY
  // origin of a stale "165% FPG" figure several secondary/calculator sites
  // still repeat to a specific, still-live, pre-rename hsd.state.nm.us PDF
  // (revision 6-15-2023). asset_waiver: true — NMAC 8.139.420.8 exempts
  // broad-based CE households from resource VERIFICATION (a precise
  // structural point the corpus pack flags: this is a resource-
  // verification waiver, not an income-test waiver — broad-based CE
  // households in New Mexico still must meet BOTH the gross AND net income
  // standards, unlike financial-assistance/SSI CE households, who skip
  // both income tests entirely via this engine's existing cat_elig
  // mechanism). Because nearly every household under 200% FPG qualifies
  // for broad-based CE, HCA's own $3,000/$4,500 published asset figures
  // (matching the current FFY2026 national standard) are rarely reached in
  // practice — but they ARE real and operative for the narrower
  // non-CE population, so `asset_waiver: true` here follows this file's
  // established NC/VA/MD/CO/SC/LA convention (asset test never runs for
  // the BBCE-covered population) rather than the "New Mexico has no asset
  // limit" oversimplification the corpus pack found and rejected.
  //
  // sua_by_tier — FULLY POPULATED, not null, a genuinely CLEAN case (the
  // corpus pack found ZERO access barriers on HCA's own FFY2026 dollar-
  // figure PDF, a contrast with this file's own MS entry immediately
  // above): HCSUA $419 (Heating and Cooling Standard), LUA $289 (billed
  // for utilities but not heating/cooling), phone $51 (Telephone
  // Standard) — all from HCA's Income Eligibility Guidelines for SNAP &
  // Financial Assistance, FFY2026 (ISD 017, revision 9-30-2025), no
  // naming-collision trap (clean 1:1 fit by function, same shape as SC's/
  // LA's entries). allotment_tier: "48" — NM's own Standard Deduction
  // ($209/$223/$261/$299) and Excess Shelter Deduction cap ($744) match
  // federal-tables.ts's FY26 snapshot exactly, the same shared-source
  // signal this file's NC/VA/MO/MD/CO/SC/LA entries use. One disclosed
  // open item the corpus pack flagged: it did not find NM-specific
  // language distinguishing an elderly/disabled UNCAPPED shelter
  // deduction from the capped figure — this engine already applies the
  // federal E/D-uncapped rule regardless of state (benefit-calc.ts), so
  // this is not a gap this StatePolicy entry needs to carry.
  //
  // drug_felony_ban: "modified" — a genuinely DISCLOSED SCOPE AMBIGUITY,
  // not a clean opt-out: N.M. Stat. Ann. §27-2B-11(C) (fetched via two
  // independently-convergent secondary/quasi-primary mirrors — Public
  // Health Law Center, FindLaw — after both law.justia.com (403) and
  // nmonesource.com, New Mexico's own official statute host (404), failed)
  // invokes the FULL federal opt-out provision (21 U.S.C. §862a(d)(1)(A))
  // but narrows its own scope to convictions "on the basis of...
  // DISTRIBUTION of a controlled substance" specifically — NOT the federal
  // ban's full possession/use/distribution scope. Public Health Law
  // Center's OWN analysis independently makes the identical observation,
  // describing the possession/use scope as genuinely open, not resolved.
  // "Modified" (a real, conditional/narrower-than-full restriction this
  // engine does not yet model at the facts level) is the correct #805
  // classification — NOT "none" (a broader "fully opted out" secondary
  // characterization the corpus pack found but explicitly declined to
  // adopt as settled, given the statute's own narrower quoted text).
  // Because only "full" disqualifies at today's gate (#805), this
  // classification has zero effect on NM's computed oracle relative to a
  // hypothetical "none" or "unconfirmed" entry.
  //
  // abawd_waiver_avail: true — a genuine, precisely-dated REFINEMENT: New
  // Mexico's ABAWD waiver footprint narrowed sharply (from 29 counties + 18
  // reservations through 12/31/2025) but did NOT fully disappear on
  // January 1, 2026 — HCA's own current Keep Your Benefits, NM! page
  // states the new statewide work rules do "not apply in Luna County,
  // Laguna Pueblo, San Felipe Pueblo, Taos Pueblo, or Tesuque Pueblo," a
  // genuine, real, currently-active waiver footprint (one county + four
  // pueblos) — chosen `true` under this file's established "wrongly
  // denying food is the worse error" reasoning (same as NJ's/AZ's/CA's/
  // MI's/NV's entries) rather than treating the "statewide work rules"
  // headline as if it applied everywhere. Deliberately did NOT build a
  // real per-county WAIVER_COUNTIES_BY_STATE lookup for NM despite Luna
  // County being a clean FIPS match: four of the five waived jurisdictions
  // are PUEBLOS, not counties — the existing lookup is keyed by
  // county-level FIPS only and cannot represent tribal-land geography, the
  // SAME shape gap NJ's Camden-City-inside-Camden-County finding already
  // disclosed (#825) — a partial/wrong Set would be actively worse than
  // the honest state-level fallback. rmp_operated: false — New Mexico is
  // ABSENT from USDA FNA's own current Restaurant Meals Program state
  // list, with no pending NM legislation found directing HCA toward one.
  //
  // Not representable in this schema, and not silently dropped — the SAME
  // pre-existing gap already filed as #824, not re-filed, just newly
  // confirmed present for New Mexico in a genuinely novel shape: HCA's own
  // Sept. 23, 2024 press release describes a NEW-MEXICO-SPECIFIC state
  // supplement for elderly/disabled no-earned-income households (increased
  // from $32 to $100/month, same effective date as the BBCE change) — an
  // additional state-funded top-up on top of the federal SNAP allotment,
  // distinct from AK's zone-based minimum-benefit floor (the only
  // state-varying minimum-benefit mechanism this engine currently models)
  // and MD's own $50 elderly-composition-conditioned floor (#already
  // disclosed in this file's MD entry) — no engine axis exists for this
  // NM-specific supplement; zero of the 92 oracle profiles are affected
  // since it is additive on top of, not a substitute for, the federal
  // benefit this engine computes. Also informational only, no engine axis:
  // NM's 36-month certification period for all-60+/disabled no-earned-
  // income households (up from 12), and the federal FDPIR-vs-SNAP
  // household exclusivity rule relevant to NM's substantial tribal-land
  // population.
  //
  // Oracle: NM's closest structural axis-twin among all 29 already-
  // registered states is OREGON — matching 6 of 7 comparison axes exactly
  // (bbce: true, bbce_threshold_pct: 200, bbce_fpl_basis:
  // federal_fiscal_year, asset_waiver: true, allotment_tier: "48",
  // rmp_operated: false; drug_felony_ban differs, "modified" vs OR's
  // "none", but has zero grading effect per #805), differing only in
  // abawd_waiver_avail (NM: true, OR: false) — the one axis expected to
  // produce a real, explainable divergence. Built a fresh, independent
  // Python calculator (not derived from engine output, per #636) directly
  // from verdict.ts/benefit-calc.ts/gates/{income-tests,asset-test,abawd,
  // student,composition,immigration,disqualifications,categorical}.ts/
  // facts.ts/constants/federal-tables.ts's own read source (not just their
  // doc-comments), mirroring every gate and the benefit-calc formula
  // exactly, including decimal.ts's half-up (roundDollar) and floor
  // (floorDollar) rounding conventions. Cross-validated BEFORE trusting it
  // for NM: 92/92 exact match (verdict AND benefit) reproducing OR's
  // already-graded oracle under OR's own StatePolicy params, PLUS all 37
  // non-expected_by_state variant rows (0 mismatches) — 129/129 total,
  // before applying NM's own policy params.
  //
  // Confirmed the ONE expected divergence, and only that one: NM's
  // computed DENY set is IDENTICAL to OR's DENY set MINUS
  // M12-abawd-in-a-waived-area, which flips APPROVE for NM (matching this
  // file's NJ's/PA's precedent — abawd_waiver_avail: true) — 11 DENY / 81
  // APPROVE for NM vs OR's 12 DENY / 80 APPROVE, exactly the single
  // explained difference the axis comparison above predicted. Also checked
  // all 37 non-expected_by_state variant rows directly under NM's own
  // params for an NM-specific verdict_by_state override — found ZERO
  // divergence from OR's already-graded values (M23's both variants stay
  // APPROVE for NM, matching every other 200%-BBCE state in this file with
  // a real SUA and no net ceiling — VA/NC/PA/OR all APPROVE MX4/M23-style
  // profiles the non-BBCE states DENY). Authored all 92
  // expected_by_state.NM entries: 81 APPROVE / 11 DENY. Since NM's
  // sua_by_tier is fully populated (unlike MS's null entry), every
  // APPROVE profile gets a real, independently-computed benefit — no
  // SUA-sweep or indeterminacy handling was needed for NM at all.
  //
  // Verification: `/profile-simulation state=NM` — 129/129 PASS, 0 FAIL, 0
  // SKIP (clean, matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/
  // IN/MO/MD/CO/SC/LA's bar, not PA's/NJ's/TN's/MN's/MS's SKIP-heavy
  // shape). Every other registered state's harness run reconfirmed
  // unchanged from its documented baseline (CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/
  // WI/KS/OH/AK/NC/VA/IN/MO/MD/CO/SC/LA all 129/0/0; NY 127/2/0; AZ
  // 128/1/0; PA/NJ/TN/MS all 34/0/95; MN 0/0/129 — all pre-existing, none
  // newly introduced). Did not touch `packages/demeter-engine` (NM's
  // corpus was already complete and out of scope) or any other state's
  // StatePolicy/oracle coverage. AL/KY/OK (individual tier) and CT/UT/IA/
  // AR (the first batch-tier segment) were all concurrently in-flight, not
  // yet merged, as of this build — not touched, not coordinated with; a
  // human reconciles the eventual rebase chain, same pattern as
  // MO-vs-TN/IN. No new GitHub issue filed — every gap found (the NM
  // state-supplement mechanism, the drug-felony distribution-only scope
  // ambiguity, the Pueblo-geography ABAWD-lookup gap) is a per-state
  // disclosed gap of an already-documented class (#824/#825-style
  // Facts-shape/mechanism gaps), not a new engine architecture gap.
  NM: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "NM",
      label: "New Mexico / HCA (Income Support Division)",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("419"),
        LUA: new Decimal("289"),
        phone: new Decimal("51"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "modified",
      abawd_waiver_avail: true,
      rmp_operated: false,
    },
  ],

  // Nebraska — DHHS. Third "batch tier" build (docs/plans/snap-rules-
  // 50-state-engine-completion.md §6 step 6, "MS, NM, NE"), built after MS
  // and NM above. A genuine blank slate — no prior StatePolicy or oracle
  // coverage existed. Every axis below is TRANSLATED from the already-
  // cited primary-source findings in the merged Demeter corpus pack
  // (packages/demeter-engine/src/states/ne/PROVENANCE.md +
  // supplements.json, built 2026-08-12) — re-verification, not fresh
  // research.
  //
  // bbce: false — THIS PACK'S FLAGSHIP STRUCTURAL FINDING, and a genuine
  // NEW SHAPE this file hadn't documented before: Nebraska's DHHS SNAP
  // Program Standards table (effective 10/1/2025) DOES publish an elevated
  // 165% FPL gross-income column, but its own column header reads
  // precisely "Maximum Gross Monthly Income for an Elderly, Disabled,
  // Separate Household and ERP Households" — SCOPED to four specific
  // household types, NOT a blanket ceiling for every categorically-
  // eligible household the way this file's other BBCE states apply their
  // elevated percentage. An ordinary working-age household not separately
  // enrolled in Nebraska's own Expanded Resource Program (ERP) remains
  // subject to the plain federal 130% FPL gross test. Because this
  // engine's `Facts` shape has no ERP-enrollment axis (and none of the 92
  // oracle profiles model one), and because E/D households ALREADY skip
  // the federal gross test entirely regardless of any state's BBCE
  // posture (`grossTestApplies` in gates/income-tests.ts — the SAME
  // outcome NE's own 165% E/D column produces, just via a different
  // mechanism), encoding `bbce: false` here is not a workaround or a
  // simplification — it is the ACCURATE description of NE's actual policy
  // for every population this engine's Facts shape can represent. This is
  // a genuinely different shape from a state that simply never adopted
  // BBCE (KS/IN/MO's flat "no BBCE" finding): Nebraska DOES have an
  // elevated-income pathway, it is just scoped to a population this
  // engine cannot model (ERP enrollment has no Facts slot) or already
  // handles correctly through an unrelated mechanism (E/D gross-test
  // skip). Because bbce is false, bbce_threshold_pct is omitted and
  // bbce_fpl_basis is null, the same shape this file's KS/IN/MO non-BBCE
  // entries already established.
  //
  // asset_waiver: false — follows directly from the same finding: NE's
  // narrower Categorical Eligibility (CE) pathway (TANF/ADC, SSI, AABD
  // recipients) already skips the asset test via this engine's existing
  // cat_elig mechanism regardless of this flag. NE's ERP does NOT waive
  // the resource test the way most other BBCE-style states' cat-elig
  // waives it — DHHS's own SNAP Program Standards table instead RAISES the
  // ceiling to a specific, still-enforced $25,000 liquid-resource figure
  // for ERP households, a genuine structural departure from the full-
  // waiver shape this file's other BBCE states use, and one this engine's
  // schema has no slot to express (an ERP-specific elevated asset ceiling,
  // distinct from the flat $3,000/$4,500 federal figures `asset_waiver:
  // false` correctly applies to the general Non-Categorical population
  // this engine models). Zero of the 92 oracle profiles model ERP
  // enrollment, so this has no practical effect on any profile's verdict.
  //
  // sua_by_tier — FULLY POPULATED, not null: HCSUA $615 (Standard Utility
  // Allowance, heating/cooling), LUA $321 (Limited Utility Allowance, 2+
  // non-heating utilities), phone $54 (standalone Telephone Allowance) —
  // all from DHHS's SNAP Monthly Deductions guidance document (effective
  // 10/1/2025), fetched directly with zero access barrier. Nebraska
  // publishes a GENUINE FOURTH tier this schema has no slot for — One
  // Utility Allowance (OUA, $63), for a household billed for EXACTLY ONE
  // non-heating/non-telephone utility (475 NAC 3-003.01H3's own qualifying
  // language, "no more than one," distinct from LUA's "at least two") —
  // the SAME disclosed, unmapped-4th-tier pattern this file's OH/IL/MO/CO
  // entries already document (OH's $108 Single SUA, IL's $78 Single
  // Utility, MO's $158 one-utility tier, CO's $69 OUA), falling through to
  // NONE ($0) for a household in that exact configuration. allotment_tier:
  // "48" — NE's own Standard Deduction ($209/$223/$261/$299), Maximum
  // Shelter Deduction ($744), and Homeless Shelter Standard ($198.99) all
  // match federal-tables.ts's FY26 snapshot exactly, the same shared-
  // source signal this file's NC/VA/MO/MD/CO/SC/LA entries use.
  //
  // drug_felony_ban: "modified" — THIS PACK'S SECOND FLAGSHIP FINDING, a
  // genuine, consequential CORRECTION the corpus pack's own self-
  // correction process caught: Nebraska did NOT opt out of the federal
  // drug-felony ban in 2025. A 2025 bill (LB319) that would have replaced
  // Nebraska's existing modified ban with a broader eligibility rule
  // passed the Legislature 32-17 on May 14, 2025 — and Governor Jim Pillen
  // VETOED it the SAME DAY; an override motion failed 24-24 on May 19,
  // 2025, six votes short of the required supermajority. LB319 never
  // became law. Nebraska's operative, CURRENT statute, Neb. Rev. Stat.
  // §68-1017.02(1)(b) (fetched directly from nebraskalegislature.gov, no
  // access barrier), remains the older, narrower rule: permanent
  // ineligibility only for three or more possession/use felony
  // convictions or any sale/distribution felony conviction; 1-2
  // possession/use felony convictions remain eligible while participating
  // in or after completing a state-licensed/accredited substance-abuse
  // treatment program. "Modified" is the correct #805 classification for
  // this real, conditional restriction.
  //
  // abawd_waiver_avail: false — a STRUCTURALLY DISTINCT finding worth
  // naming precisely, matching the same "statutory self-restriction"
  // pattern this pack found in Oklahoma's and Arkansas's own corpus packs:
  // Neb. Rev. Stat. §68-1017.02 directly BARS DHHS from seeking, applying
  // for, accepting, or renewing an area-wide ABAWD work-requirement waiver
  // "except where expressly required by federal law" — a legislative
  // self-restriction on the agency's own waiver-request authority, not
  // merely a labor-market fact about Nebraska's unemployment rate.
  // Consistent with this statutory bar, the corpus pack found zero active
  // Nebraska ABAWD waivers anywhere in the state — no county-level lookup
  // needed, same uniform-statewide-zero-waiver shape as this file's VA/
  // MO/TN/MD/CO/SC/LA entries. Distinct from DHHS's retained, federally-
  // permitted discretion over individual, case-by-case ABAWD exemptions,
  // which the statute does not bar and which this engine already models
  // via the `abawd_exempt:*` work_class values. rmp_operated: false —
  // Nebraska is ABSENT from USDA FNS's own current Restaurant Meals
  // Program state list; 2025-2026 legislation (LB920) that would have
  // required DHHS to establish one FAILED on April 17, 2026.
  //
  // Not representable in this schema, and not silently dropped — the SAME
  // pre-existing gap already filed as #824 (the NE-specific ERP $25,000
  // elevated-asset-ceiling shape is disclosed above, in the asset_waiver
  // paragraph, as its own genuinely new instance of the same
  // "categorical-eligibility mechanism this schema can't fully express"
  // class), plus two genuinely NEW, time-sensitive findings this file
  // hasn't seen before, neither with any engine consumer: (a) Nebraska's
  // USDA-approved soda/energy-drink SNAP purchase restriction was
  // approved, took effect 2026-01-01, and was then VACATED by a federal
  // court (Aragon v. Rollins, D.D.C., 2026-06-22) — no engine axis exists
  // for SNAP-eligible-food restrictions at all (same as this file's SC
  // entry's not-yet-effective candy/soda finding), so this has zero effect
  // regardless; (b) no engine axis exists for certification-period length
  // (Nebraska's Simplified Reporting structure, itself disclosed by the
  // corpus pack as a lower-confidence finding pending direct 475 NAC
  // confirmation).
  //
  // Oracle: NE's closest structural axis-twin among all 30 already-
  // registered states is INDIANA — a FULL match on every axis that has a
  // verdict/benefit consumer (bbce: false, bbce_threshold_pct: undefined,
  // bbce_fpl_basis: null, asset_waiver: false, drug_felony_ban:
  // "modified", abawd_waiver_avail: false, allotment_tier: "48",
  // rmp_operated: false) — a stronger match than MS's KS twin above, since
  // IN also carries a real, non-null SUA, letting the full benefit-calc
  // pathway be exercised end-to-end rather than just the gating logic.
  // Built a fresh, independent Python calculator (not derived from engine
  // output, per #636) directly from verdict.ts/benefit-calc.ts/gates/
  // {income-tests,asset-test,abawd,student,composition,immigration,
  // disqualifications,categorical}.ts/facts.ts/constants/federal-tables.ts's
  // own read source (not just their doc-comments), mirroring every gate
  // and the benefit-calc formula exactly, including decimal.ts's half-up
  // (roundDollar) and floor (floorDollar) rounding conventions. Cross-
  // validated BEFORE trusting it for NE: 92/92 exact match (verdict AND
  // benefit) reproducing IN's already-graded oracle under IN's own
  // StatePolicy params, PLUS all 37 non-expected_by_state variant rows (0
  // mismatches) — 129/129 total, before applying NE's own policy params
  // (differing only in the SUA dollar figures).
  //
  // Confirmed NE's computed DENY set is IDENTICAL to IN's DENY set across
  // all 92 base profiles (22 DENY / 70 APPROVE, 0 divergence) — expected,
  // since every verdict-controlling axis is identical between the two
  // states; only benefit-dollar figures differ, driven by NE's higher SUA
  // values. Also checked all 37 non-expected_by_state variant rows
  // directly under NE's own params for an NE-specific verdict_by_state
  // override — found exactly TWO, matching IN's own already-authored
  // divergence exactly: M23-variable-gig-income-anticipation's two
  // variants ($1,800/$2,200 gross HH1) both clear every BBCE-200 state's
  // threshold but fail NE's plain federal 130% screen ($1,696/97) —
  // authored "NE": "DENY" into both (an independent confirmation the
  // divergence is real, not a calculator bug, matching KS's/IN's/MO's/
  // MS's already-authored value). Authored all 92 expected_by_state.NE
  // entries: 70 APPROVE / 22 DENY. Since NE's sua_by_tier is fully
  // populated (unlike MS's null entry), every APPROVE profile gets a
  // real, independently-computed benefit — no SUA-sweep or indeterminacy
  // handling was needed for NE at all.
  //
  // Verification: `/profile-simulation state=NE` — 129/129 PASS, 0 FAIL, 0
  // SKIP (clean, matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/
  // IN/MO/MD/CO/SC/LA/NM's bar, not PA's/NJ's/TN's/MN's/MS's SKIP-heavy
  // shape). Every other registered state's harness run reconfirmed
  // unchanged from its documented baseline (CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/
  // WI/KS/OH/AK/NC/VA/IN/MO/MD/CO/SC/LA/NM all 129/0/0; NY 127/2/0; AZ
  // 128/1/0; PA/NJ/TN/MS all 34/0/95; MN 0/0/129 — all pre-existing, none
  // newly introduced). Did not touch `packages/demeter-engine` (NE's
  // corpus was already complete and out of scope) or any other state's
  // StatePolicy/oracle coverage. AL/KY/OK (individual tier) and CT/UT/IA/
  // AR (the first batch-tier segment) were all concurrently in-flight, not
  // yet merged, as of this build — not touched, not coordinated with; a
  // human reconciles the eventual rebase chain, same pattern as
  // MO-vs-TN/IN. No new GitHub issue filed — the ERP-scoped-BBCE finding
  // was checked carefully against whether it constitutes a genuine engine
  // architecture gap (the TN #830 net-income-ceiling precedent) and found
  // NOT to be one: unlike TN's gap (a real mismatch for households this
  // engine DOES model), NE's `bbce: false` is the ACCURATE description for
  // every population this engine's Facts shape can represent — the
  // ERP-enrollment axis itself is a #824-style Facts-shape gap, not a
  // mismatch in how an existing axis is applied.
  NE: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "NE",
      label: "Nebraska / DHHS",
      bbce: false,
      bbce_fpl_basis: null,
      asset_waiver: false,
      sua_by_tier: {
        HCSUA: new Decimal("615"),
        LUA: new Decimal("321"),
        phone: new Decimal("54"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "modified",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Idaho — first state of batch-tier segment 3 (docs/plans/snap-rules-
  // 50-state-engine-completion.md §6 step 6, "ID, WV, NH"), built after the
  // 13 individual-tier states (NC/NJ/VA/TN/IN/MO/MD/CO/SC/LA merged;
  // AL/KY/OK concurrently in flight, not yet merged as of this build — not
  // touched or coordinated with, same reconciliation-later pattern as
  // MO-vs-TN/IN). Two OTHER batch-tier segments (CT/UT/IA/AR and MS/NM/NE)
  // were also concurrently in flight as of this build, likewise not
  // touched. Idaho is a genuine blank slate (no prior StatePolicy or
  // oracle coverage). Translated from Idaho's already-merged Demeter
  // corpus pack (packages/demeter-engine/src/states/id/, PROVENANCE.md +
  // supplements.json, built 2026-08-12) into the engine's stricter typed
  // shape per §5's process — re-verification against the corpus's own
  // primary sources (IDAPA 16.03.04, Idaho's SNAP administrative code;
  // Idaho DHW's live Apply for SNAP page), not fresh research.
  //
  // bbce: FALSE — a deliberate, reasoned departure from every other BBCE
  // state in this file, not an oversight. IDAPA 16.03.04.010.09 defines
  // Idaho's Broad-Based Categorical Eligibility precisely: BBCE-eligible
  // households are "ALSO SUBJECT TO resource, gross, and net income
  // eligibility standards" — i.e. Idaho's BBCE does NOT raise the
  // gross-income ceiling (DHW's own current income-limit table matches the
  // plain federal 130% FPL figures exactly, confirmed independently
  // matching this file's Nebraska-cycle cross-check to the dollar) and
  // does NOT exempt households from the net-income test either. Setting
  // `bbce: true` in this schema — even with `bbce_threshold_pct` left
  // undefined — would still incorrectly set `bbceConferred = true` in
  // verdict.ts once a household clears the (unmodified) gross test,
  // silently skipping the net income test for a state whose real law
  // confers no such skip. `bbce: false` is the encoding that correctly
  // reproduces Idaho's real income-test mechanics byte-for-byte, since
  // Idaho's income tests genuinely ARE the federal defaults (130% gross /
  // 100% net, always both enforced). Filed as a genuine engine-
  // architecture gap, #853 (StatePolicy.bbce bundles three effects —
  // raised gross ceiling, net-test conferral, and conventional
  // asset-waiver pairing — that don't universally co-vary; a sibling
  // finding to #830's TN gap, pointing the opposite direction: TN needs an
  // ADDITIONAL net-ceiling layered on top of BBCE conferral, Idaho needs
  // BBCE's income-test effects to be absent entirely).
  //
  // asset_waiver: FALSE — a disclosed, conservative approximation, not a
  // confirmed federal-baseline finding. Idaho's REAL resource limit is a
  // flat $5,000 for the BBCE population (IDAPA 16.03.04.305), RAISED (not
  // waived) above the federal baseline ($3,000 non-E/D / $4,500 E/D) that
  // applies to everyone else — independently cross-checked against Idaho
  // DHW's own consumer page ("For most households, resources must be
  // under $5,000... Household and recreational vehicles" among counted
  // resource types), which is itself a second, independent primary source
  // for the same figure and a second, independent contradiction of a
  // widely-repeated secondary-source claim that Idaho BBCE households face
  // "no resource limit" at all (the corpus pack's own flagship correction,
  // Finding 1 — this pack's OWN first-pass web search synthesis initially
  // reproduced that same wrong claim before primary-source verification
  // caught it). This schema has no numeric override slot for "a real,
  // enforced, but state-specific dollar limit distinct from both the
  // boolean waiver and the federal default" — `asset_waiver: true` would
  // wrongly skip the test for ANY asset level (Idaho's real law does not),
  // while `asset_waiver: false` (chosen here) enforces a real test but
  // under-states Idaho's genuine $5,000 generosity for households with
  // $3,000-$5,000 in assets. Same #853 gap as above. Independently
  // verified this has NO effect on any of the 92 v0.6 profiles' verdicts —
  // none carries assets in the disclosed $3,000-$5,000 band — so this is a
  // forward-looking gap disclosure, not a currently-observed miscompute.
  //
  // sua_by_tier: NULL — a genuine, disclosed sourcing gap, same discipline
  // as PA's/NJ's/MN's null entries. IDAPA 16.03.04.543 confirms Idaho runs
  // a FOUR-tier utility-allowance system (Standard/Limited/Minimum/
  // Telephone — a structural match to this roster's Nebraska corpus pack's
  // own four-tier finding, not a coincidence unique to either state) but
  // the rule text defines each tier by QUALIFYING CRITERIA only, with no
  // dollar figures — Idaho, like several states in this file, appears to
  // publish the actual current dollar figures in a non-public eligibility
  // manual this corpus pack's fetch window did not converge on. A $144
  // Standard Medical Expense figure and a $744 shelter-cap figure both
  // appear in secondary sources the corpus pack found, but neither is
  // independently confirmed from a dated Idaho DHW table — not encoded
  // here for that reason (the engine's shelter cap already comes from
  // federal-tables.ts, not a per-state value, so this only affects the
  // unconfirmed SUA dollar figures, correctly left null rather than
  // guessed).
  //
  // drug_felony_ban: "modified" — IDAPA 16.03.04.287: individuals convicted
  // of a controlled-substance possession/use/distribution felony "can
  // receive Food Stamps when they comply with the terms of a withheld
  // judgment, probation, or parole" and are ineligible only while NOT
  // complying — a real, conditional restriction (not a full ban, not a
  // full opt-out), correctly classified "modified" per #805's rule. Note a
  // genuine STRUCTURAL difference from this file's other "modified" states
  // worth naming precisely (the corpus pack's own Finding 3): Idaho's rule
  // conditions eligibility on ONGOING SENTENCE COMPLIANCE, not conviction
  // count (contrast SC's/other states' severity-tiered rules) and states
  // no explicit treatment-program requirement (contrast PA's/AZ's
  // treatment-conditioned rules) — the gate's mechanics are unaffected
  // either way ("modified" fails open engine-wide per #805 until the
  // engine models real per-condition facts), but the underlying policy
  // shape is genuinely distinct and disclosed as such.
  //
  // abawd_waiver_avail: false — the corpus pack's Finding 4 (secondary-
  // source-corroborated, not independently fetched from a dated current
  // USDA waiver list specific to Idaho) found no evidence Idaho currently
  // maintains an active statewide or area-wide ABAWD waiver. Chosen `false`
  // (all counties presumed time-limited absent an individual exemption)
  // consistent with the corpus pack's own operative reading, though
  // flagged there as secondary-source-only.
  //
  // rmp_operated: false — Idaho DHW's own About SNAP page lists "Hot,
  // prepared foods meant to be eaten right away" among non-purchasable
  // items with no elderly/disabled/homeless carve-out mentioned, and no
  // evidence of an Idaho RMP was found anywhere in the corpus pack's
  // research (DHW's consumer materials, IDAPA 16.03.04's full text, or
  // USDA's current RMP participation list).
  //
  // allotment_tier: "48" — no elevated-allotment finding for Idaho.
  //
  // FRESHNESS FLAG carried from the corpus pack, not modeled here (no
  // engine axis exists for it): IDAPA 16.03.04.257's own ABAWD-exemption
  // text (dated 7-1-24) is stale relative to OBBBA — still shows the
  // pre-OBBBA 18-53/55 age range and the veteran/homeless/foster-youth
  // exemptions OBBBA removed nationally 10/20/2025. The engine's own
  // `gates/abawd.ts` already applies the CORRECT post-OBBBA federal age
  // ceiling (64) and exemption rules engine-wide regardless of a state's
  // own administrative-code lag, so this is informational only — no
  // divergence between Idaho's stale rule text and the engine's actual
  // behavior, disclosed for completeness per the corpus pack's own Finding
  // 4.
  //
  // Oracle: built a fresh, independent Python calculator (not derived from
  // engine output, per #636) directly from verdict.ts/benefit-calc.ts/
  // gates/{income-tests,asset-test,abawd,student,composition,immigration,
  // disqualifications,categorical}.ts/facts.ts/constants/federal-tables.ts's
  // own read source, mirroring every gate and the benefit-calc formula
  // exactly, including decimal.ts's half-up (roundDollar) and floor
  // (floorDollar) rounding conventions. Cross-validated BEFORE trusting it
  // for ID against FOUR already-merged states spanning every code path
  // this batch needs (SC: bbce=true/130%/asset_waiver=true/drug="full";
  // LA: bbce=true/200%/asset_waiver=true/drug="none"; MO: bbce=false/
  // asset_waiver=false/drug="modified" — MO is Idaho's true 6-of-7 axis
  // twin, differing only in sua_by_tier (MO real, ID null); MD:
  // bbce=true/200%/asset_waiver=true/drug="modified") — 4 × (92 base +
  // 37 variant) = 516/516 exact match (verdict AND benefit) reproducing
  // each state's already-graded oracle under ITS OWN policy params before
  // applying ID's own. Also checked all 37 rows across the 18
  // non-expected_by_state variant profiles directly under ID's own params
  // for an ID-specific verdict_by_state override: TWO real divergences
  // found and authored (M23-variable-gig-income-anticipation's `averaged`
  // and `recent_high_month` variants both flip from the shared default
  // APPROVE to ID DENY — Idaho's plain-federal-130% gross screen ($1,696
  // HH1, FY26) denies both the $1,800 and $2,200 gross-income test points,
  // matching the exact same DENY pattern this file's KS/OH/GA/MO/IN/SC
  // federal-130-or-equivalent states already carry for the same two rows —
  // internally consistent, not a bug). ONE genuinely indeterminate row
  // found and deliberately left UNOVERRIDDEN (not fabricated either
  // direction): P58-elderly-retiree-tips-over-net-limit's
  // `above_net_limit` variant is an E/D household whose real verdict
  // depends on the unauthored SUA figure at a break-even point of exactly
  // $1,131.50 (APPROVE above, DENY below) within the $0-$1,500 sweep range
  // — this exact profile ALREADY carries an inline note in v0.6.json about
  // MA/CA SUA-sensitivity for this same row, so ID's sensitivity is
  // consistent with, not a departure from, prior-established precedent.
  // Since this row's SUA tier is non-"none" and non-homeless, the live
  // composer SKIPs it for ID regardless (same null-SUA gate as the 58
  // affected base profiles below), so leaving it unoverridden has zero
  // effect on any live grading — disclosed for completeness only.
  //
  // Authored all 92 expected_by_state.ID entries: 70 APPROVE / 22 DENY (a
  // materially higher DENY count than this file's 200%-BBCE states, exactly
  // as expected for a state running the plain federal 130%/100% income
  // tests with no BBCE elevation). 32 of the 92 carry a real computed $
  // benefit (sua_tier === "none" or homeless_deduction); the other 60 are
  // blocked by the null-SUA gap (benefit: null), proven SUA-invariant via
  // the same $0-$1,500 twelve-point sweep discipline PA's/NJ's/AK's builds
  // used (0 of 60 genuinely indeterminate among the BASE profiles — the
  // one indeterminate row found, P58's variant above, is a VARIANT row,
  // not one of the 92 base profiles, so it doesn't count against that
  // established "0 of N" pattern).
  //
  // Verification: `/profile-simulation state=ID` — 34 PASS / 0 FAIL / 95
  // SKIP (matching PA's/NJ's/TN's null-SUA-gap shape exactly, not
  // CA/MA/TX/.../LA's 129/0/0 clean bar — ID's real, disclosed null-SUA gap
  // means it needs the same SKIP-heavy grade PA/NJ/TN already established
  // as the correct, honest outcome for a genuinely unauthored SUA table).
  // Every other registered state's harness run reconfirmed unchanged from
  // its documented baseline: CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/
  // VA/IN/MO/MD/CO/SC/LA all 129/0/0; NY 127/2/0; AZ 128/1/0; MN 0/0/129;
  // PA/NJ/TN all 34/0/95 — every one identical to its pre-ID documented
  // baseline, zero regressions. `tsc --noEmit -p packages/snap-rules`
  // clean, 323/323 snap-rules tests pass (0 new — a schema-conformant pure
  // addition needed no new unit tests), 44/47 profile-harness tests pass
  // (3 pre-existing skips). Did not touch `packages/demeter-engine`
  // (Idaho's corpus was already complete and out of scope) or any other
  // state's `StatePolicy`/oracle coverage. Filed #853 for the genuine
  // engine-architecture gap found (bbce's 3-effect bundling + asset_waiver's
  // missing numeric-override slot) — every OTHER gap found (null SUA, the
  // stale ABAWD rule text, the unconfirmed SME/shelter-cap secondary-source
  // figures) is a per-state disclosed gap of an already-established class,
  // not a new architecture issue, per this task's own instruction.
  ID: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "ID",
      label: "Idaho / DHW — Self-Reliance Programs",
      bbce: false,
      bbce_fpl_basis: null,
      asset_waiver: false,
      sua_by_tier: null,
      allotment_tier: "48",
      drug_felony_ban: "modified",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // West Virginia — second state of batch-tier segment 3 (§6 step 6, "ID,
  // WV, NH"), built after Idaho within the same batch. Blank slate, no
  // prior StatePolicy or oracle coverage. Translated from West Virginia's
  // already-merged Demeter corpus pack (packages/demeter-engine/src/
  // states/wv/, PROVENANCE.md + supplements.json, built 2026-08-12) into
  // the engine's stricter typed shape per §5's process — re-verification
  // against the corpus's own primary sources (W. Va. Code § 9-2-3a; WV
  // Bureau for Family Assistance's live SNAP program page), not fresh
  // research.
  //
  // bbce: true / bbce_threshold_pct: 200 / bbce_fpl_basis:
  // federal_fiscal_year (an honest inference — WV BFA's own page doesn't
  // state FFY-vs-calendar-year framing explicitly, following this file's
  // established default absent contrary evidence, same discipline TN's
  // entry used) — WV BFA's live SNAP page publishes a two-column
  // 130%/200% FPL gross-income table, and the corpus pack's Finding 1
  // confirms the 200% figure applies BROADLY across household types, no
  // elderly/disabled/separate-household carve-out narrowing it (a genuine,
  // worth-naming CONTRAST with this roster's Nebraska corpus pack's
  // narrower 165% column — WV's is the more typical shape this file's
  // other elevated-BBCE states already use).
  //
  // asset_waiver: true — WV BFA's own page states "$3,000 for households"
  // ($4,500 elderly/disabled) as the federal baseline in the SAME
  // paragraph as "Most households will not be subject to the asset
  // limit" — read here as the standard BBCE resource-waiver mechanism
  // this file's other 200%-BBCE states already use (unlike Idaho's
  // genuinely different raised-not-waived $5,000 mechanism, WV's own page
  // does not describe a specific elevated dollar figure the way Idaho's
  // does — it describes a waiver, consistent with `asset_waiver: true`
  // being the correct encoding here, not #853's Idaho-specific gap).
  //
  // sua_by_tier: NULL — a genuine, disclosed sourcing gap, same discipline
  // as PA's/NJ's/MN's/ID's null entries. The corpus pack's Finding 0
  // explicitly distinguishes this from a bot-detection wall (none found
  // anywhere in WV's primary sources — bfa.wv.gov and
  // code.wvlegislature.gov both returned clean HTTP 200 throughout): this
  // is a genuine COVERAGE gap. The West Virginia Income Maintenance
  // Manual chapters this pack fetched (9 and 11) carry only procedural
  // content dated 2008-2013 in their page footers, not a current
  // deductions table (likely Chapter 12, which the corpus pack did not
  // locate a working URL for) — a secondary-source aggregator dollar
  // figure was deliberately REMOVED during the corpus pack's own
  // adversarial refute pass rather than left in unverified, and is
  // correctly not encoded here either.
  //
  // drug_felony_ban: "modified" — W. Va. Code § 9-2-3a (HB2459, 2019):
  // West Virginia exempts ALL individuals domiciled in the state from the
  // federal drug-felony ban UNLESS the offense of conviction itself
  // involved SNAP-benefit misuse, loss of life, or physical injury — a
  // real, conditional restriction (WV residents remain disqualified only
  // for that narrow subset of offenses), correctly classified "modified"
  // per #805's rule rather than "none" (this is NOT an unconditional
  // opt-out the way NH's SR 97-27 below is — a genuine, disqualifying
  // condition exists, just a narrow one) and not "full" (the
  // overwhelming majority of drug-felony convictions do NOT disqualify).
  // The corpus pack independently verified this TWICE — once from the
  // statute's own unamended text, and again via a LIVE 2026 WV Board of
  // Review decision (26-BOR-1601) applying this exact three-element test
  // to reverse a county denial — the strongest primary-source
  // confirmation of an operationally-current drug-felony policy anywhere
  // in this file's roster to date. The gate mechanics are unaffected
  // either way ("modified" fails open engine-wide per #805 until the
  // engine models real per-condition facts).
  //
  // abawd_waiver_avail: false — the corpus pack's Finding 3 (flagged
  // explicitly as THIS PACK'S OWN INFERENCE, not a directly-quoted DoHS/
  // USDA statement) found West Virginia's long-standing statewide ABAWD
  // waiver — reflecting decades of high unemployment in its Appalachian
  // coalfield counties — appears to have LAPSED under OBBBA's tightened
  // area-waiver threshold (>10% county unemployment; WV's highest county,
  // McDowell, sits at ~9.1% as of the corpus pack's fetch date).
  // Cross-checked directly against abawdmap.us's live status ("No waiver —
  // rule applies," the same status as neighboring KY/VA/MD). Chosen
  // `false` consistent with the corpus pack's own operative reading.
  //
  // rmp_operated: false — confirmed absent from USDA's current RMP state
  // list; Propel's WV state EBT guide directly corroborates WV "does not
  // participate in this program," with no pending WV RMP legislation
  // found (a contrast with this file's NJ entry, where a similarly-worded
  // bill has died in committee three separate sessions).
  //
  // allotment_tier: "48" — no elevated-allotment finding for WV.
  //
  // TIME-SENSITIVE FINDING carried from the corpus pack, not modeled here
  // (no engine axis exists for a food-purchase restriction): WV was the
  // FIRST state in the nation to implement a USDA-approved SNAP
  // soda-purchase restriction (eff. 1/1/2026, "Healthy Choices" waiver).
  // Unlike this roster's Nebraska waiver (vacated by a federal court in
  // Aragon v. Rollins, June 2026 — WV was NOT a party to that suit and
  // the corpus pack found no litigation affecting WV's restriction as of
  // its fetch date), WV's restriction is presumed live. Purely
  // informational — this engine has no axis for food-category purchase
  // restrictions at all, so this finding cannot diverge from any
  // encoded value.
  //
  // Oracle: built from the SAME independent Python calculator as Idaho's
  // entry above (parameterized by state policy, not derived from engine
  // output, per #636). Cross-validated BEFORE trusting it for WV: MD is
  // WV's true 6-of-7 axis twin among already-merged states (bbce=true/
  // 200%/federal_fiscal_year, asset_waiver=true, drug_felony_ban=
  // "modified", abawd_waiver_avail=false, allotment_tier="48" — differing
  // only in rmp_operated, which has no engine consumer) — reproduced MD's
  // already-graded 92 base + 37 variant = 129/129 exact match (verdict
  // AND benefit) under MD's own policy params. (The calculator was
  // additionally validated against SC/LA/MO for Idaho's build immediately
  // prior in this same batch, exercising every other code path this file
  // uses — 516/516 combined across all four cross-validation states,
  // 0 mismatches.) Also checked all 37 rows across the 18
  // non-expected_by_state variant profiles directly under WV's own
  // params: ONE divergence found, the SAME genuinely-indeterminate row
  // Idaho's entry disclosed above — P58-elderly-retiree-tips-over-net-
  // limit's `above_net_limit` variant (E/D household, break-even SUA
  // $1,131.50 within the $0-$1,500 sweep range) — deliberately left
  // UNOVERRIDDEN for the same reason: this row's SUA tier is non-"none"
  // and non-homeless, so the live composer SKIPs it for WV regardless of
  // which verdict is authored, matching the pre-existing precedent this
  // exact profile already carries for PA's/NJ's null-SUA oracles.
  //
  // Authored all 92 expected_by_state.WV entries: 80 APPROVE / 12 DENY —
  // IDENTICAL DENY set to every other 200%-BBCE/asset_waiver-true state in
  // this file with no additional net-ceiling overlay (MD, CO, VA, NC,
  // LA), since WV shares the same financial-gate-determining axes. 34 of
  // the 92 carry a real computed $ benefit (sua_tier === "none" or
  // homeless_deduction); the other 58 are blocked by the null-SUA gap
  // (benefit: null), proven SUA-invariant via the same $0-$1,500
  // twelve-point sweep discipline PA's/NJ's/ID's builds used (0 of 58
  // genuinely indeterminate among the BASE profiles).
  //
  // Verification: `/profile-simulation state=WV` — 34 PASS / 0 FAIL / 95
  // SKIP (matching PA's/NJ's/TN's/ID's null-SUA-gap shape exactly). Every
  // other registered state's harness run reconfirmed unchanged from its
  // documented baseline: CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/
  // IN/MO/MD/CO/SC/LA all 129/0/0; NY 127/2/0; AZ 128/1/0; MN 0/0/129;
  // PA/NJ/TN/ID all 34/0/95 — every one identical to its pre-WV documented
  // baseline, zero regressions. `tsc --noEmit -p packages/snap-rules`
  // clean, 323/323 snap-rules tests pass (0 new), 44/47 profile-harness
  // tests pass (3 pre-existing skips). Did not touch `packages/
  // demeter-engine` (WV's corpus was already complete and out of scope)
  // or any other state's `StatePolicy`/oracle coverage. No new GitHub
  // issue filed for WV specifically — every gap found (null SUA, the
  // ABAWD-lapse inference, the food-restriction-waiver litigation status)
  // is a per-state disclosed gap of an already-established class, not a
  // new engine-architecture issue.
  WV: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "WV",
      label: "West Virginia / DoHS — Bureau for Family Assistance",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: null,
      allotment_tier: "48",
      drug_felony_ban: "modified",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // New Hampshire — third and final state of batch-tier segment 3 (§6
  // step 6, "ID, WV, NH"). Blank slate, no prior StatePolicy or oracle
  // coverage. Translated from New Hampshire's already-merged Demeter
  // corpus pack (packages/demeter-engine/src/states/nh/, PROVENANCE.md +
  // supplements.json, built 2026-08-12) into the engine's stricter typed
  // shape per §5's process — re-verification against the corpus's own
  // primary sources (NH DHHS Food Stamp Manual (FSM) sections; SR 97-27),
  // not fresh research.
  //
  // bbce: true / bbce_threshold_pct: 200 / bbce_fpl_basis:
  // federal_fiscal_year (an honest inference — NH DHHS's own FSM text
  // does not state FFY-vs-calendar-year framing explicitly, same
  // established default WV's entry above uses absent contrary evidence)
  // — a MODELING SIMPLIFICATION worth naming precisely, not silently
  // assumed. NH's corpus pack's Finding 1 (flagship) documents NH
  // actually runs THREE parallel eligibility tracks, not a single BBCE
  // gate: a plain 130%/100% FPG track ($3,000 resource limit), a "Target"
  // elderly/disabled track ($4,500 resource limit), and an "Expanded
  // Categorically Eligible" (ECE) track at 200% FPG gross income with NO
  // resource test — but ECE itself requires a household to ALSO be
  // authorized for a non-cash MOE-funded service (satisfied via DHHS's
  // own BFA Form 77u), a condition this engine's `Facts` shape has no
  // field for. This is the SAME modeling simplification every other BBCE
  // state in this file already makes (NC's TANF-services notice, VA's
  // statutory rule, WV's page above — none separately models the
  // administrative-conferral condition as a Fact), not a NEW gap specific
  // to NH — disclosed here because NH's corpus pack is unusually explicit
  // that a real, enforced non-ECE track exists (with a real asset test)
  // for households that don't clear the Form-77u condition, where most
  // other states' corpus packs simply state the elevated percentage
  // without walking the multi-track structure this explicitly. In
  // practice this file's engine-wide simplification (treating the BBCE
  // asset waiver as a state-wide blanket rather than population-
  // conditioned) already absorbs this distinction the same way it does
  // for every other BBCE state.
  //
  // asset_waiver: true — consistent with the ECE track's real asset-test
  // waiver (the majority-case pathway per the corpus pack's own reading),
  // same blanket-simplification treatment described above.
  //
  // sua_by_tier: POPULATED, not null — a genuine contrast with this
  // batch's ID/WV entries and a genuine SCHEMA-MISMATCH shape not yet
  // seen in this file (distinct from NC's/VA's/AZ's own SUA-tier
  // mismatches): NH DHHS's FSM Table I lists FOUR tiers split partly by
  // utility TYPE, not purely by qualifying-utility COUNT — Heating/Cooling
  // $1,018, Utilities-Only $373 (2+ non-heating utilities), Electric-Only
  // $217 (exactly 1 non-heating, non-phone utility), Telephone-Only $39.
  // This engine's `Facts.shelter.sua_tier` enum (`HCSUA`/`LUA`/`phone`/
  // `none`) has no slot for NH's standalone Electric-Only tier — mapped
  // HCSUA to Heating/Cooling ($1,018), LUA to Utilities-Only ($373, the
  // ≥2-non-heating-utility tier — the closer conceptual match to the
  // engine's generic "Limited Utility Allowance" than the single-utility
  // Electric-Only tier), and phone to Telephone-Only ($39). A household
  // with NH's real Electric-Only tier (exactly one non-heating,
  // non-phone utility) has no representable Facts input in this engine —
  // an accepted limitation of the SAME already-established class as NJ's
  // boat/motor-home gap (#824) and NC's/VA's household-size-dimension SUA
  // gaps, not a new architecture issue. The $1,018 Heating/Cooling figure
  // is itself flagged by the corpus pack as single-source (no
  // cross-check against a second dated DHHS table found) — used here as
  // the best available primary-source figure, not fabricated, but
  // disclosed as lower-confidence than this file's typically
  // cross-checked SUA figures.
  //
  // drug_felony_ban: "none" — SR 97-27 (dated August 1997, implementing
  // HB 722-FN, Chapter 157, Laws of 1997): "an individual's felony drug
  // conviction status is not taken into account for purposes of
  // determining eligibility for TANF financial and/or medical assistance
  // and food stamps" — a genuine FULL statutory opt-out, independently
  // confirmed by the corpus pack fetching SR 97-27's own text directly
  // (not accepting several secondary sources' "fully opted out" framing
  // at face value) with no subsequent SR found narrowing or reversing it.
  // Distinct from NH's SEPARATE SNAP-trafficking disqualification penalty
  // (24 months first offense, permanent second offense) — a
  // program-integrity rule already modeled generically by this engine's
  // `disqual` tag mechanism, not a drug-felony-conviction ban, and not
  // conflated with this axis.
  //
  // abawd_waiver_avail: false — the corpus pack's Finding 5 (independently
  // cross-checked against USDA FNS/FNA's own ABAWD Time Limit Waivers FY
  // 2025-2029 index, which shows NH's most recent posted waiver-response
  // entry as FY2025 with no FY2026 entry) confirms New Hampshire currently
  // has NO active area-wide ABAWD waiver anywhere in the state — NH's
  // prior waiver covering Stratford and Hale's Location expired
  // 9/30/2025 and was not renewed. A directly-checked-against-a-federal-
  // index finding, stronger sourcing than WV's own inference above.
  //
  // rmp_operated: false — confirmed absent from USDA's current RMP state
  // list; DHHS's own consumer materials describe SNAP purchases as
  // grocery-style items for home preparation, explicitly excluding "any
  // 'hot' prepared foods that are ready to eat," with no pending NH RMP
  // legislation found.
  //
  // allotment_tier: "48" — no elevated-allotment finding for NH.
  //
  // STRUCTURAL FINDING carried from the corpus pack, not modeled here (no
  // engine axis exists for certification-period length): NH's STANDARD
  // certification period is only 6 months (FSM § 133.09) — half the
  // 12-month norm most other states in this file's roster use — with 36
  // months reserved for ESAP (all-elderly/disabled, no-earned-income)
  // households. Purely informational; this engine's oracle/verdict math
  // is a point-in-time determination and does not model recertification
  // cadence.
  //
  // Oracle: built from the SAME independent Python calculator as ID's/
  // WV's entries above (parameterized by state policy, not derived from
  // engine output, per #636). Cross-validated BEFORE trusting it for NH:
  // LA is NH's FULL 7-of-7 axis twin among already-merged states
  // (bbce=true/200%/federal_fiscal_year, asset_waiver=true,
  // drug_felony_ban="none", abawd_waiver_avail=false, allotment_tier="48",
  // rmp_operated=false — every axis identical, differing only in the SUA
  // dollar figures themselves, the strongest possible twin match this
  // file's precedent recognizes) — reproduced LA's already-graded 92 base
  // + 37 variant = 129/129 exact match (verdict AND benefit) under LA's
  // own policy params before applying NH's. (The calculator was
  // additionally validated against SC/MO/MD earlier in this same batch,
  // 516/516 combined across all four cross-validation states run this
  // batch, 0 mismatches.) Also checked all 37 rows across the 18
  // non-expected_by_state variant profiles directly under NH's own
  // params: ZERO divergence from the shared default verdict — NH's
  // computed verdict set is IDENTICAL to LA's on every axis that affects
  // eligibility (matching NC's/VA's/MD's/CO's/LA's own zero-override
  // precedent), and unlike ID's/WV's entries above, NH has a REAL sua_
  // by_tier table, so P58's above_net_limit indeterminacy does not arise
  // for NH — NH's real $1,018 HCSUA figure resolves it determinately
  // (well above the $1,131.50 break-even point... verified directly,
  // not assumed: NH's real figure computes a determinate DENY for that
  // row, consistent with LA's own DENY there).
  //
  // Authored all 92 expected_by_state.NH entries: 80 APPROVE / 12 DENY —
  // IDENTICAL DENY set to LA/MD/CO/VA/NC (same financial-gate-determining
  // axes). Real $ benefit dollar amounts differ from LA's/other states'
  // equivalent entries for profiles where NH's own SUA figures (much
  // higher HCSUA $1,018 vs LA's $465, lower LUA $373 vs LA's $258 —
  // asymmetric, not uniformly higher or lower) change the excess-shelter
  // deduction, but NO verdict ever flips as a result of any SUA-dollar
  // difference — every BBCE state in this file skips the net income test
  // once the raised gross threshold clears (for non-E/D households), so
  // SUA only ever changes the benefit AMOUNT for those households, never
  // eligibility; E/D households (which do run the net test regardless of
  // BBCE) were independently checked and none straddles NH's real,
  // determinate SUA figures the way the disclosed P58 variant does for
  // ID's/WV's null-SUA gap.
  //
  // Verification: `/profile-simulation state=NH` — 129/129 PASS, 0 FAIL,
  // 0 SKIP (clean, matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/
  // VA/IN/MO/MD/CO/SC/LA's bar, NOT ID's/WV's SKIP-heavy shape — NH's
  // real, disclosed-confidence SUA figures mean it did not need ID's/
  // WV's null-SUA fallback). Every other registered state's harness run
  // reconfirmed unchanged from its documented baseline: CA/WA/TX/GA/MI/
  // IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO/MD/CO/SC/LA all 129/0/0; NY
  // 127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN/ID/WV all 34/0/95 — every
  // one identical to its pre-NH documented baseline, zero regressions.
  // `tsc --noEmit -p packages/snap-rules` clean, 323/323 snap-rules tests
  // pass (0 new), 44/47 profile-harness tests pass (3 pre-existing
  // skips). Did not touch `packages/demeter-engine` (NH's corpus was
  // already complete and out of scope) or any other state's
  // `StatePolicy`/oracle coverage. No new GitHub issue filed for NH
  // specifically — the Electric-Only SUA-tier gap is a per-state
  // disclosed gap of the SAME already-established class NJ's/NC's/VA's
  // Facts-shape gaps already cover (#824-style), not a new engine-
  // architecture issue; the ECE administrative-conferral-condition
  // simplification is the SAME engine-wide blanket-BBCE-asset-waiver
  // approach every other BBCE state in this file already uses, not a
  // new gap either.
  NH: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "NH",
      label: "New Hampshire / DHHS — Bureau of Family Assistance",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("1018"),
        LUA: new Decimal("373"),
        phone: new Decimal("39"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Delaware — DHSS / Division of Social Services (DSS). First "batch tier"
  // build (docs/plans/snap-rules-50-state-engine-completion.md §6 step 6:
  // "DE, SD, ND"), and this file's 30th state overall — a genuine blank
  // slate, no prior StatePolicy or oracle coverage existed. Every axis below
  // is TRANSLATED from the already-cited primary-source findings in the
  // merged Demeter corpus pack (packages/demeter-engine/src/states/de/
  // PROVENANCE.md + supplements.json + freshness.json), built 2026-08-12 —
  // re-verification, not fresh research; see that pack's own Sources table
  // (direct curl fetches of dhss.delaware.gov and regulations.delaware.gov,
  // both clean HTTP 200 with no WAF barrier, plus the regulations.delaware.
  // gov API PDF endpoint for the full 114-page DSSM 9000 manual and the
  // archived DSSM 2000 manual, plus Delaware's own 2018 repeal order text).
  //
  // bbce: true / bbce_threshold_pct: 200 / bbce_fpl_basis: federal_fiscal_year
  // — DSSM 9042 (Categorically Eligible Households): any household with
  // gross income at or below 200% FPL is categorically eligible, via a
  // DISTINCTIVE Delaware mechanism this pack read directly from DSSM 9042's
  // own text (not a generic "BBCE" self-description several secondary
  // sources use): Delaware uses TANF funds to provide non-cash
  // pregnancy-prevention information (the 3rd statutory TANF purpose), with
  // an authorization for this information embedded directly in the Delaware
  // SNAP application itself. Delaware's own current Food Benefit Income
  // Eligibility Limits table (published for the FFY2026 cycle, 10/1/2025-
  // 9/30/2026) confirms the 200% figures ($2,610 HH1, $5,360 HH4) — the
  // federal-fiscal-year basis this file's other 200%-BBCE states already use.
  //
  // asset_waiver: true — DSSM 9045: categorically eligible households "do
  // not have to meet the resource limits or definitions" at all. Same "BBCE
  // households skip resources" pattern this file's NC/VA/MD/LA entries
  // already use — but Delaware's corpus pack flags a genuine, disclosed
  // internal-DSSM staleness catch this build does NOT need to resolve to
  // author this axis: a household that is NOT categorically eligible (e.g.
  // ineligible-alien member, student-provision ineligibility, fleeing-felon/
  // probation-violator status, non-exempt institutionalization, or
  // work-requirement noncompliance — DSSM 9042.2/9042.3) still faces a real
  // DSSM 9045 resource limit, and DSSM 9045's own text ($2,000/$3,000)
  // traces to at least a 2009-era baseline with no visible newer amendment
  // against the current federal FY2026 COLA-adjusted floor ($3,000/$4,500)
  // — immaterial to this axis since `asset_waiver: true` already means the
  // resource test never runs for the large majority of DE households this
  // axis governs (the 200% FPL cat-elig population), but flagged here
  // per the corpus pack's own disclosure rather than silently dropped.
  //
  // sua_by_tier: NULL — a genuine, disclosed gap, not a guess: DSSM 9060
  // explicitly defers Delaware's Standard Deduction AND all four
  // utility-allowance tiers (HCSUA/LUA/one-utility/telephone) to "the
  // current October Cost-of-Living Adjustment Administrative Notice," a
  // separate document the corpus pack could not locate at a working URL (a
  // 2022-vintage URL pattern now 404s). USDA FNS's own FY2026 SUA guidance
  // memo confirms these figures are now calculated PER-STATE via a 2.7%
  // CPI-U self-adjustment from each state's own FY2025 baseline rather than
  // published in one uniform national table — meaning Delaware's specific
  // current dollar figures are genuinely state-specific and undiscovered,
  // the same disclosed-null discipline this file's PA/NJ/TN entries already
  // use rather than fabricating a number.
  //
  // allotment_tier: "48" — no Delaware-specific elevated max-allotment
  // schedule found.
  //
  // drug_felony_ban: "none" — a VERIFIED FULL REPEAL, this pack's flagship
  // finding, reached by chasing a specific repealed citation rather than
  // accepting a secondary-source paraphrase: several secondary sources
  // describe Delaware as having a "modified" drug-felony ban conditioned on
  // sentence compliance — language traceable to DSSM 2027's own PRE-2018
  // text. The corpus pack fetched Delaware's current DSSM 2000-series
  // manual directly and found DSSM 2027 marked plainly "[Repealed - See 21
  // DE Reg. 722 (03/01/18)]," then fetched 21 DE Reg. 722's own Final Order
  // text directly: Delaware struck the drug-felony restriction from Cash
  // Assistance/General Assistance entirely, effective March 11, 2018,
  // implementing House Bill No. 11 (2017) and 31 Del. C. §524. DSSM 9042.2
  // (SNAP's own categorical-eligibility exclusion list) independently
  // confirms no drug-felony exclusion category exists in the SNAP-specific
  // rules either. One disclosed internal-DSSM inconsistency: DSSM 9013.2
  // still lists a drug-felony exclusion citing the repealed DSSM 2027 — the
  // corpus pack treats the repeal order and DSSM 9042.2's own current
  // exclusion list as authoritative over this stale, uncorrected
  // cross-reference. Inconsequential regardless for this axis's
  // verdict-and-benefit consequence (grep-confirmed: only "full" disqualifies
  // in gates/disqualifications.ts).
  //
  // abawd_waiver_avail: false — an AFFIRMATIVELY SOURCED, currently-lapsed
  // finding: USDA FNS's own ABAWD Time Limit Waivers FY2025-2029 index lists
  // Delaware's most recent posted waiver-response entry as the FY2025
  // waiver (approved 09/19/2024, covering Wilmington city plus the combined
  // Kent/Sussex County area), effective through September 30, 2025 — with
  // NO FY2026 entry as of the corpus pack's fetch (2026-08-12). A separate,
  // already-lapsed, one-month federal-shutdown-driven nationwide ABAWD
  // pause (November 2025 only) is a distinct, time-limited event, not an
  // ongoing Delaware-specific waiver. No county-level lookup needed, same
  // uniform-statewide-zero-waiver shape as this file's VA/MO/TN/MD/CO/SC/
  // LA/OK entries.
  //
  // rmp_operated: false — Delaware DHSS's own consumer page explicitly
  // lists "Hot or prepared foods" under items a household CANNOT buy with
  // SNAP benefits, cross-checked against secondary-source corroboration
  // that no DE RMP exists; no pending Delaware RMP legislation found.
  //
  // Not representable in this schema, and not silently dropped — a
  // NEW-TO-THIS-FILE type of disclosed gap: Delaware's DSSM 9060 states its
  // Homeless Shelter Deduction as a flat $143.00, but that specific
  // subsection's amendment footer shows no revision newer than 09/01/14,
  // while USDA's current national FY2026 maximum is $198.99 — a state MAY
  // legitimately set its own homeless-shelter-deduction figure below the
  // federal cap, so $143.00 is not necessarily wrong, but the corpus pack
  // could not confirm whether Delaware has since raised it. This engine has
  // no per-state homeless-deduction axis at all (benefit-calc.ts's
  // `homelessDeductionFor` is a single federal constant, engine-wide) — so
  // this gap is disclosed here but not actionable without a schema change,
  // the same category of accepted limitation as #824's NJ findings. Zero of
  // the 92 v0.6 profiles with `homeless_deduction: true` are DE-specific
  // enough for this to matter for THIS build's oracle (the federal $198.99
  // figure is what the engine actually applies regardless of state).
  //
  // Oracle: DE's closest structural axis-twin among all 29 already-
  // registered states is TENNESSEE — matching every verdict-and-benefit-
  // consequential axis exactly (bbce: true, bbce_threshold_pct: 200,
  // bbce_fpl_basis: federal_fiscal_year, asset_waiver: true, sua_by_tier:
  // null, allotment_tier: "48", abawd_waiver_avail: false), differing only
  // in `drug_felony_ban` (TN "modified" vs DE "none" — a value with zero
  // verdict/benefit consequence, grep-confirmed: only "full" disqualifies
  // anywhere in gates/disqualifications.ts). Built a fresh, independent
  // Python calculator (not derived from engine output, per #636) directly
  // from verdict.ts/benefit-calc.ts/gates/{income-tests,asset-test,abawd,
  // student,composition,immigration,disqualifications,categorical}.ts/
  // facts.ts/constants/federal-tables.ts's own read source (not just their
  // doc-comments), mirroring every gate and the benefit-calc formula
  // exactly, including decimal.ts's half-up (roundDollar), floor
  // (floorDollar), and ceiling (ceilDollar) rounding conventions. Because
  // TN's own fixture is missing 3 of 92 rows (TN deliberately left 3
  // genuinely-indeterminate profiles unauthored per its own build), this
  // build instead cross-validated the calculator against PENNSYLVANIA (also
  // null-SUA, 200%/federal_fiscal_year BBCE, asset_waiver true — PA has the
  // full 92/92 + 37/37 rows authored, differing from DE in
  // `abawd_waiver_avail` (PA true vs DE false) and `drug_felony_ban` (PA
  // "modified" vs DE "none"), a MORE rigorous check than matching DE's own
  // params since it forced the calculator to prove both the true and false
  // abawd_waiver_avail branches correct): 129/129 exact match (92 base +
  // 37 variant rows) reproducing PA's already-graded oracle under PA's own
  // StatePolicy params, using a realistic-range ($0-$1,000, 21-point) SUA
  // sweep for the null-SUA-blocked rows — a bounded, realistic sweep caught
  // ZERO indeterminate profiles for PA, unlike an earlier unrealistic
  // $0-$1,500 sweep attempt which manufactured one false-ambiguous signal on
  // a profile whose verdict only flips north of a ~$1,130 SUA figure no real
  // state utility standard anywhere in this file has ever published (noted
  // as a minor, out-of-scope PA cross-validation footnote, not touched here
  // — PA itself stays fully out of scope for this build). Also independently
  // cross-checked TN's own 89/92 authored rows for extra confidence: 88/89
  // matched (the one divergence, MX4-bbce-max-income-with-any-benefit, is a
  // TN-specific finding this build did not need to resolve or model, since
  // DE is built and verified independently against PA, not TN). Ran the
  // validated calculator under DE's own policy params: DE's computed DENY
  // set is IDENTICAL to LA's (LA — also 200%/federal_fiscal_year BBCE,
  // asset_waiver true, abawd_waiver_avail false — differing in `sua_by_tier`
  // only) and OR's already-graded oracles (independently confirmed, since
  // every verdict-controlling axis DE shares with LA/OR is identical).
  // Authored all 92 `expected_by_state.DE` entries: 80 APPROVE / 12 DENY.
  // Also checked all 37 rows across the 18 non-expected_by_state variant
  // profiles for a DE-specific verdict_by_state override, the same
  // discipline every prior state's build used — found ZERO divergence from
  // the shared default verdict for DE (matching NC's/VA's/MD's/CO's/LA's
  // zero-override result, not MO's/SC's/OK's one-override finding), since
  // DE's computed verdict set is identical to LA's/OR's on every axis that
  // affects eligibility.
  //
  // 58 of the 92 profiles use a non-"none" SUA tier and no
  // homeless_deduction, so — same as PA's/NJ's/TN's null-SUA entries —
  // `composeVerdict` legitimately SKIPs those rows for real grading
  // (bails before any gate runs); those 58 keep `benefit: null` and got a
  // verdict only after being independently proven SUA-invariant across the
  // realistic $0-$1,000 sweep described above (0 of 58 were genuinely
  // indeterminate). The other 34 profiles (`sua_tier === "none"` or
  // `homeless_deduction: true`) got a REAL, fully-computed benefit, since
  // neither path touches `policy.sua_by_tier` at all.
  //
  // Verification: `/profile-simulation state=DE` — 34 PASS / 0 FAIL / 95
  // SKIP (of 129), every SKIP attributable to the documented null-SUA gap,
  // no PARAMS_MISMATCH — matching PA's/NJ's/TN's exact SKIP-heavy shape,
  // not this file's clean-129/0/0 majority. Every other registered state's
  // harness run reconfirmed unchanged from its documented baseline (see
  // this build's own execution-log entry in docs/plans/snap-rules-50-state-
  // engine-completion.md for the full per-state totals list). `tsc
  // --noEmit -p packages/snap-rules` clean, 323/323 snap-rules tests pass
  // (0 new — a schema-conformant pure addition needed no new unit tests),
  // 44/47 profile-harness tests pass (3 pre-existing skips). Did not touch
  // `packages/demeter-engine` (DE's corpus was already complete and out of
  // scope) or any other state's `StatePolicy`/oracle coverage. No new
  // GitHub issue filed — every gap found (DSSM 9045's possibly-stale
  // resource limit, DSSM 9060's possibly-stale $143 homeless deduction, the
  // DSSM 9013.2 stale drug-felony cross-reference) is a per-state disclosed
  // gap of an already-documented class (#824-style Facts-shape/mechanism
  // gaps, or a genuinely time-sensitive fact worth re-checking later), not
  // a new engine architecture gap, per this task's own instruction.
  DE: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "DE",
      label: "Delaware / DHSS-DSS (Division of Social Services)",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: null,
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // South Dakota — DSS / Division of Economic Assistance. Second "batch
  // tier" build (docs/plans/snap-rules-50-state-engine-completion.md §6
  // step 6, after DE), 31st state overall — a genuine blank slate, no prior
  // StatePolicy or oracle coverage existed. Every axis below is TRANSLATED
  // from the already-cited primary-source findings in the merged Demeter
  // corpus pack (packages/demeter-engine/src/states/sd/PROVENANCE.md +
  // supplements.json), built 2026-08-12 — re-verification, not fresh
  // research; see that pack's own Sources table (a single, clean, direct
  // curl fetch of DSS's own 249-page SNAP Policy and Procedure Manual PDF,
  // dated "Updated July 2026" on its own cover page, extracted via
  // `pdftotext -layout`; no WAF/bot-detection barrier).
  //
  // bbce: false / bbce_fpl_basis: null — a genuine, primary-source-
  // confirmed STRUCTURAL FINDING: DSS's own manual §7700 defines
  // categorical eligibility narrowly (TANF, Tribal TANF, SSI, or Child Care
  // Services recipients only), with NO income-ceiling expansion the way
  // BBCE states run — §11300 states directly that non-categorically-
  // eligible households face the standard 130% FPG gross / 100% FPG net
  // income test. South Dakota is one of a small group of states nationally
  // (WebSearch corroboration names 6-7, this pack independently confirmed
  // only South Dakota's own status directly from its own manual) that has
  // not adopted BBCE. Same non-BBCE archetype as this file's KS/IN/OK
  // entries.
  //
  // asset_waiver: false — flows directly from the same non-BBCE finding:
  // the narrow SSI/TANF/Tribal-TANF/CCS cat-elig population already skips
  // the resource test via the federal pure-cash path (`facts.cat_elig`)
  // this engine already models; the general NPA household faces DSS's own
  // manual §9010 real, current resource limit ($4,500 elderly/disabled,
  // $3,000 all other) — same posture as IN's/KS's/OK's entries. Worth
  // noting: the corpus pack found and corrected a genuine, still-repeated
  // secondary-source staleness trap here — multiple current aggregator
  // sites quote a lower $2,750/$4,250 figure (consistent with an earlier,
  // likely-FFY2023 cycle), while DSS's own July-2026-dated manual gives the
  // CURRENT $4,500/$3,000 figures matching the national FFY2026 cycle.
  //
  // sua_by_tier — POPULATED, with ONE disclosed naming-collision gap: DSS's
  // manual runs a genuine FOUR-tier utility-allowance structure — Standard
  // Utility Allowance (SUA, heating/cooling) $950/mo, Limited Utility
  // Allowance (LUA, 2+ non-heat utilities) $265/mo, One Utility Allowance
  // (OUA, exactly ONE non-heat utility) $109/mo, and Phone Utility
  // Allowance (PUA, telephone-only) $60/mo — the manual's own Table of
  // Contents lists a STALE, lower set of figures ($850/$238/$98/$54)
  // contradicting the body text's IDENTICAL figures stated twice (§10400
  // and §10411); this build treats the twice-repeated, internally-
  // consistent body-text figures as authoritative, same judgment call the
  // corpus pack itself already made and disclosed. Mapped: SUA -> HCSUA
  // ($950), LUA -> LUA ($265, South Dakota's own "2+ utilities" LUA maps
  // cleanly onto this schema's LUA slot, unlike some other states' BUA/LUA
  // naming mismatches), PUA -> phone ($60). South Dakota's OWN $109 OUA
  // (exactly one non-heat utility) has NO slot in this schema's
  // three-tier {HCSUA, LUA, phone} shape — the SAME disclosed,
  // unmapped-4th-tier naming-collision gap this file's OH ($108 Single
  // SUA), MO ($158 one-utility), and CO ($69 OUA) entries already
  // document, via `determineSUATier`'s single LIMITED branch
  // (`has_electric_or_gas === "yes"`, no distinction of utility COUNT).
  // Independently verified this affects only a small subset of the 92
  // oracle profiles' benefit-dollar amounts (households using SD's real
  // OUA scenario are not present in the base fixture's SUA-tier axis,
  // which only exercises HCSUA/LUA/phone/none — the gap is disclosed for
  // completeness, not because it changed any of the 92 profiles' outcomes).
  //
  // allotment_tier: "48" — no South Dakota-specific elevated max-allotment
  // schedule found.
  //
  // drug_felony_ban: "none" — a CONFIRMED FULL OPT-OUT via two independent
  // lines of evidence: DSS's ENTIRE manual's felon-related disqualification
  // content contains only ONE felony-conviction category (§3920/§7370, the
  // 2014 Farm Bill's violent/sex-offense list — aggravated sexual abuse,
  // murder, child sexual exploitation, sexual assault — for convictions
  // after 2/7/2014), with NO separate drug-felony provision anywhere; this
  // silence is cross-checked against South Dakota Codified Law 28-12-3,
  // quoted by a secondary legal-research source (Collateral Consequences
  // Resource Center) as South Dakota's 2020 statutory opt-out of Pub. L.
  // 104-193 § 115(a)(2) (the federal drug-felony ban). Disclosed access
  // gap: the statutory text itself rests on the secondary source alone
  // (law.justia.com served an unresolvable Cloudflare JS-challenge wall);
  // inconsequential regardless for this axis's verdict/benefit consequence
  // (grep-confirmed: only "full" disqualifies in gates/disqualifications.ts).
  //
  // abawd_waiver_avail: false — an AFFIRMATIVELY SOURCED, currently-lapsed
  // finding: USDA FNS/FNA's own ABAWD Time Limit Waivers FY2025-2029 index
  // lists South Dakota's only posted waiver-response entry as FY2025
  // (dated 08/12/2024), with NO FY2026 entry — in explicit contrast to
  // Minnesota, Montana, and North Dakota, which DO show FY2026 entries on
  // the same current index. Separately, and NOT modeled by this axis (no
  // engine consumer exists for a personal, non-geographic exemption): DSS's
  // manual §13222 names a STATEWIDE (not reservation-restricted) Native
  // American ABAWD exemption, "individuals who are Native American who
  // live anywhere in the state," per the federal Indian Health Care
  // Improvement Act definition — a federal ABAWD exemption category this
  // schema has no per-member axis to represent, disclosed rather than
  // silently dropped. No county-level lookup needed for the geographic
  // waiver axis, same uniform-statewide-zero-waiver shape as this file's
  // VA/MO/TN/MD/CO/SC/LA/OK/DE entries.
  //
  // rmp_operated: false — DSS's manual explicitly excludes "hot foods
  // ready to eat" from SNAP-eligible purchases with no RMP carve-out
  // anywhere in its ~17,000 lines of text; South Dakota Senate Bill 149
  // (2022), which would have established an RMP, FAILED in the state
  // Senate 12-23 and was never enacted — flagged explicitly since a plain
  // web search for "South Dakota Restaurant Meals Program" surfaces the
  // bill's 2022 introduction coverage, which could otherwise mislead a
  // reader into believing SD has or is about to have an RMP.
  //
  // Not representable in this schema, and not silently dropped: (a) a
  // household disqualified from the Food Distribution Program on Indian
  // Reservations (FDPIR) for an Intentional Program Violation (IPV) is
  // disqualified from SNAP for the same period, and vice versa (DSS
  // manual §§6385-6387) — this engine's `disqual[]` tag model has no
  // FDPIR-specific tag, same category of accepted limitation as this
  // file's NJ (#824) findings; (b) South Dakota's flat-shortcut Medical
  // Expense Deduction mechanism ($165 standard for $36-$200 in expenses,
  // before the $35 disregard) is a DIFFERENT mechanism from this engine's
  // actual-expense-only medical-deduction math — independently verified
  // this affects 0 of the 92 oracle profiles (none put an E/D household's
  // medical expenses in that specific $36-$200 band).
  //
  // Oracle: SD's closest structural axis-twin among all 30 already-
  // registered states is OKLAHOMA — a FULL 7/7 match on every comparison
  // axis (bbce: false, bbce_fpl_basis: null, asset_waiver: false,
  // allotment_tier: "48", drug_felony_ban: "none", abawd_waiver_avail:
  // false, rmp_operated: false), differing only in the SUA dollar figures
  // themselves — the strongest possible twin match this file's non-BBCE
  // archetype has offered since IN-via-KS. Built a fresh, independent
  // Python calculator (not derived from engine output, per #636) directly
  // from verdict.ts/benefit-calc.ts/gates/{income-tests,asset-test,abawd,
  // student,composition,immigration,disqualifications,categorical}.ts/
  // facts.ts/constants/federal-tables.ts's own read source (not just their
  // doc-comments), mirroring every gate and the benefit-calc formula
  // exactly, including decimal.ts's half-up (roundDollar), floor
  // (floorDollar), and ceiling (ceilDollar) rounding conventions.
  // Cross-validated BEFORE trusting it for SD: 129/129 exact match (92
  // base + 37 variant rows) reproducing OK's already-graded oracle under
  // OK's own StatePolicy params. Ran the validated calculator under SD's
  // own policy params: SD's computed DENY set is IDENTICAL to OK's
  // already-graded oracle (independently confirmed, since every
  // verdict-controlling axis SD shares with OK is identical). Authored all
  // 92 `expected_by_state.SD` entries: 70 APPROVE / 22 DENY. Also checked
  // all 37 rows across the 18 non-expected_by_state variant profiles for
  // an SD-specific verdict_by_state override, the same discipline every
  // prior state's build used — found ONE real divergence (matching MO's/
  // SC's/OK's one-override precedent, not NC's/VA's/MD's/CO's/LA's/DE's
  // zero-override result): `M23-variable-gig-income-anticipation`'s two
  // variants ($1,800 and $2,200 gross HH1) both fail SD's plain federal
  // 130% screen for the same reason KS/OH/GA/IN/MO/OK already fail —
  // authored "SD": "DENY" into both variants' verdict_by_state blocks,
  // matching IN's/KS's/MO's/OK's already-authored value exactly (an
  // independent confirmation the divergence is real, not a calculator
  // bug).
  //
  // Verification: `/profile-simulation state=SD` — 129/129 PASS, 0 FAIL,
  // 0 SKIP (clean, matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/
  // VA/IN/MO/MD/CO/SC/LA/OK's bar, not PA's/NJ's/TN's/DE's SKIP-heavy
  // shape — SD's real, current SUA figures mean it did not need PA's/NJ's/
  // TN's/DE's null-SUA fallback). Every other registered state's harness
  // run reconfirmed unchanged from its documented baseline (see this
  // build's own execution-log entry in docs/plans/snap-rules-50-state-
  // engine-completion.md for the full per-state totals list). `tsc
  // --noEmit -p packages/snap-rules` clean, 323/323 snap-rules tests pass
  // (0 new — a schema-conformant pure addition needed no new unit tests),
  // 44/47 profile-harness tests pass (3 pre-existing skips). Did not touch
  // `packages/demeter-engine` (SD's corpus was already complete and out of
  // scope) or any other state's `StatePolicy`/oracle coverage. No new
  // GitHub issue filed — every gap found (the OUA/one-utility naming-
  // collision gap, the FDPIR-IPV-carryover mechanism gap, the flat-
  // shortcut medical-deduction mechanism gap, the statewide Native
  // American ABAWD exemption with no per-member axis) is a per-state
  // disclosed gap of an already-documented class (#824-style Facts-shape/
  // mechanism gaps, or the OH/MO/CO-precedent unmapped-4th-utility-tier
  // gap), not a new engine architecture gap, per this task's own
  // instruction.
  SD: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "SD",
      label: "South Dakota / DSS (Division of Economic Assistance)",
      bbce: false,
      bbce_fpl_basis: null,
      asset_waiver: false,
      sua_by_tier: {
        HCSUA: new Decimal("950"),
        LUA: new Decimal("265"),
        phone: new Decimal("60"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // North Dakota — HHS, delivered locally through 19 state-supervised
  // "Human Service Zones" (2019 restructuring, SB 2124 / N.D.C.C. ch.
  // 50-01.1). Third and FINAL "batch tier" build in this segment
  // (docs/plans/snap-rules-50-state-engine-completion.md §6 step 6: "DE,
  // SD, ND"), 32nd state overall — a genuine blank slate, no prior
  // StatePolicy or oracle coverage existed. Every axis below is TRANSLATED
  // from the already-cited primary-source findings in the merged Demeter
  // corpus pack (packages/demeter-engine/src/states/nd/PROVENANCE.md +
  // supplements.json), built 2026-08-12 — re-verification, not fresh
  // research; see that pack's own Sources table (direct fetches of HHS's
  // CURRENT, actively-versioned SNAP/ manual host, cross-checked against a
  // STALE legacy 43005/ manual mirror the corpus pack caught and
  // deliberately did not rely on for any dollar figure — see Finding 0 in
  // that pack's PROVENANCE.md).
  //
  // bbce: true / bbce_threshold_pct: 200 / bbce_fpl_basis:
  // federal_fiscal_year — HHS Manual §505 runs a 200% FPG track the manual
  // calls "BBCE (TANF I&R)" in its narrative text and "Expanded
  // Categorically Eligible (ECE)" in its income-table appendix (this build
  // treats these as the SAME pathway under two labels, per the corpus
  // pack's own explicit reading, not two separate tracks). Current FFY2026
  // (10/1/2025-9/30/2026) figures confirmed directly from HHS's own current
  // §505/Appendix B: 200% ECE/BBCE gross limit $2,610 HH1, matching the
  // federal-fiscal-year basis this file's other 200%-BBCE states already
  // use.
  //
  // asset_waiver: true — a household passing the 200% BBCE/ECE track faces
  // NO resource test at all, per HHS's own §505/§601 read together. Same
  // "BBCE households skip resources" pattern this file's NC/VA/MD/LA/DE
  // entries already use. A household that has not established BBCE/ECE
  // eligibility faces a REAL, current resource limit under §601 (revised
  // 5/16/2025): $4,500 elderly/disabled, $3,000 all other — the corpus
  // pack flags and corrects a genuine, still-repeated secondary-source
  // staleness trap here, multiple aggregator sites quoting a lower
  // $2,250/$3,250 figure that appears to reflect an un-updated older cycle.
  //
  // sua_by_tier — POPULATED, with ONE disclosed naming-collision gap, the
  // SAME shape this file's SD entry (immediately above) just documented:
  // HHS's own Policy Release 26.2 (Appendix B, "Table of Standards," eff.
  // 4/1/2026) publishes a genuine FOUR-tier utility structure — Standard
  // Utility Allowance (SUA, heating/cooling) $775/mo (a MID-FISCAL-YEAR
  // increase from $772, a genuinely unusual within-cycle adjustment this
  // file's other states hold constant for the full October-to-September
  // fiscal year; $775 is the figure operative as of this build's date and
  // therefore the CURRENT, not stale, figure to use — no effective-date
  // snapshot split needed since 4/1/2026 has already passed as of this
  // build), Limited Utility Allowance (LUSA, 2+ non-heat utilities)
  // $286/mo, Minimum Utility Standard (MU, exactly ONE non-heat utility)
  // $126/mo, and a standalone Telephone Standard $35/mo. Mapped: SUA ->
  // HCSUA ($775), LUSA -> LUA ($286, North Dakota's own "2+ utilities"
  // LUSA maps cleanly onto this schema's LUA slot), Telephone -> phone
  // ($35). North Dakota's OWN $126 MU (exactly one non-heat utility) has
  // NO slot in this schema's three-tier {HCSUA, LUA, phone} shape — the
  // SAME disclosed, unmapped-4th-tier naming-collision gap this file's
  // OH/MO/CO/SD entries already document. Independently verified this
  // gap affects only a small subset of the 92 oracle profiles' benefit-
  // dollar amounts (the base fixture's SUA-tier axis only exercises
  // HCSUA/LUA/phone/none, not ND's own one-utility scenario specifically).
  //
  // allotment_tier: "48" — no North Dakota-specific elevated max-allotment
  // schedule found.
  //
  // drug_felony_ban: "none" — a VERIFIED FULL OPT-OUT via state statute:
  // North Dakota Century Code § 50-06-05.1 (per Public Health Law Center's
  // secondary-source quotation, effective 2017) states HHS "may not deny
  // assistance under [SNAP] to any individual who has been convicted of a
  // felony offense that has as an element the possession, use, or
  // distribution of a controlled substance." Cross-checked against HHS's
  // own SNAP manual disqualification-rules text (§430-05-77-55, legacy
  // host — flagged by the corpus pack itself as not independently
  // re-fetched from the current SNAP/ host, though the underlying
  // statutory-opt-out claim does not depend on that specific gap) and
  // found only SNAP-program-integrity-specific disqualifications (benefit
  // trafficking, fleeing-felon/parole-violator status) with NO general
  // drug-felony-conviction ban at all — consistent with the full-opt-out
  // reading. Inconsequential regardless for this axis's verdict/benefit
  // consequence (grep-confirmed: only "full" disqualifies in
  // gates/disqualifications.ts).
  //
  // abawd_waiver_avail: false — a FLAGSHIP, PRIMARY-SOURCE CORRECTION of a
  // specific, wrong secondary-source claim: HHS's own Policy Release 25.7
  // (effective 11/1/2025, amended 11/13/2025) states directly that North
  // Dakota's prior ABAWD Geographic Waiver — covering the Turtle Mountain
  // Reservation and Rolette County under a 7/1/2025-6/30/2026 waiver
  // period — was ENDING effective 10/31/2025, with affected individuals
  // mailed notice on 10/10/2025. Cross-checked directly against USDA
  // FNS/FNA's own ABAWD Time Limit Waivers FY2025-2029 index, which lists
  // North Dakota's most recent posted waiver-response entry as FY2025
  // (dated 6/18/2025) with NO FY2026 entry — corroborating no renewal. The
  // corpus pack found and explicitly CORRECTED a WebSearch-surfaced
  // secondary-source (aggregator) claim that North Dakota "holds an active
  // statewide waiver through June 30, 2026" — both HHS's own dated release
  // and USDA's own tracker confirm ND currently has NO active ABAWD
  // geographic waiver anywhere in the state as of 11/1/2025 onward. No
  // county-level lookup needed (the real waiver geography, while it
  // existed, was already narrower than county-level — a specific
  // reservation, not authored as a lookup since it has since lapsed
  // entirely and a real "nowhere" answer has no county-level nuance for a
  // lookup to represent, the same VA/MO/TN/MD/CO/SC/LA/OK/DE/SD-precedent
  // uniform-statewide-zero-waiver shape).
  //
  // rmp_operated: false — HHS's own consumer FAQ page explicitly lists
  // "food that will be eaten in the store" and "foods that are hot at the
  // point of sale" among items households CANNOT buy with SNAP benefits,
  // cross-checked against secondary-source corroboration (Propel's state
  // EBT guide) that ND does not currently operate an RMP; no pending North
  // Dakota RMP legislation found.
  //
  // Not representable in this schema, and not silently dropped: (a) a
  // TIME-SENSITIVE, NOT-YET-EFFECTIVE finding the corpus pack flagged at
  // length — North Dakota received a rare USDA demonstration-project
  // waiver (approved 12/10/2025) excluding soft drinks, energy drinks, and
  // candy from SNAP-purchasable food, EFFECTIVE SEPTEMBER 1, 2026 — this
  // engine has no product-category-level purchasing-restriction axis at
  // all (a `Facts`-shape gap, not a per-state value, same category as
  // #824's NJ findings), and regardless is NOT YET ACTIVE as of this
  // build's date; disclosed rather than modeled. (b) North Dakota's own
  // narrow, reservation-tied vehicle-licensing accommodation (§604: "On
  // Indian reservations that do not require vehicles driven by tribal
  // members to be licensed, such vehicles must be treated as licensed
  // vehicles" for the standard resource-exclusion purpose) has no
  // per-vehicle-type axis in this engine's flat `assets: number` shape,
  // same category of accepted limitation as NJ's boat/motor-home gap; (c)
  // a household on or near a reservation may participate in EITHER SNAP OR
  // the Food Distribution Program (FDPIR/Commodities) but never both in
  // the same month (legacy-host §430-05-05-50/-50-05) — no engine axis
  // models this choice-of-program mutual exclusivity, same category as
  // SD's FDPIR gap documented immediately above. Zero of the 92 v0.6
  // profiles' facts touch any of these three gaps.
  //
  // Oracle: ND's closest structural axis-twin among all 31 already-
  // registered states is LOUISIANA — a FULL 7/7 match on every comparison
  // axis (bbce: true, bbce_threshold_pct: 200, bbce_fpl_basis:
  // federal_fiscal_year, asset_waiver: true, drug_felony_ban: "none",
  // abawd_waiver_avail: false, allotment_tier: "48", rmp_operated: false),
  // differing only in the SUA dollar figures — the same strength of match
  // LA itself found with OR, and matching this file's OK-via-IN/SD-via-OK
  // precedent for the strongest possible twin bond. Built a fresh,
  // independent Python calculator (not derived from engine output, per
  // #636) directly from verdict.ts/benefit-calc.ts/gates/{income-tests,
  // asset-test,abawd,student,composition,immigration,disqualifications,
  // categorical}.ts/facts.ts/constants/federal-tables.ts's own read source
  // (not just their doc-comments), mirroring every gate and the
  // benefit-calc formula exactly, including decimal.ts's half-up
  // (roundDollar), floor (floorDollar), and ceiling (ceilDollar) rounding
  // conventions — the SAME calculator already cross-validated against
  // PA (for DE) and OK (for SD) earlier in this same batch build.
  // Cross-validated BEFORE trusting it for ND: 129/129 exact match (92
  // base + 37 variant rows) reproducing LA's already-graded oracle under
  // LA's own StatePolicy params. Ran the validated calculator under ND's
  // own policy params: ND's computed DENY set is IDENTICAL to LA's/DE's
  // already-graded oracles (independently confirmed, since every
  // verdict-controlling axis ND shares with LA/DE is identical). Authored
  // all 92 `expected_by_state.ND` entries: 80 APPROVE / 12 DENY. Also
  // checked all 37 rows across the 18 non-expected_by_state variant
  // profiles for an ND-specific verdict_by_state override, the same
  // discipline every prior state's build used — found ZERO divergence
  // from the shared default verdict for ND (matching NC's/VA's/MD's/CO's/
  // LA's/DE's zero-override result, not MO's/SC's/OK's/SD's one-override
  // finding), since ND's computed verdict set is identical to LA's/DE's
  // on every axis that affects eligibility.
  //
  // Verification: `/profile-simulation state=ND` — 129/129 PASS, 0 FAIL,
  // 0 SKIP (clean, matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/
  // VA/IN/MO/MD/CO/SC/LA/OK/SD's bar, not PA's/NJ's/TN's/DE's SKIP-heavy
  // shape — ND's real, current SUA figures mean it did not need PA's/NJ's/
  // TN's/DE's null-SUA fallback). Every other registered state's harness
  // run reconfirmed unchanged from its documented baseline (see this
  // build's own execution-log entry in docs/plans/snap-rules-50-state-
  // engine-completion.md for the full per-state totals list). `tsc
  // --noEmit -p packages/snap-rules` clean, 323/323 snap-rules tests pass
  // (0 new — a schema-conformant pure addition needed no new unit tests),
  // 44/47 profile-harness tests pass (3 pre-existing skips). Did not touch
  // `packages/demeter-engine` (ND's corpus was already complete and out of
  // scope) or any other state's `StatePolicy`/oracle coverage. No new
  // GitHub issue filed — every gap found (the MU/one-utility naming-
  // collision gap, the not-yet-effective food-restriction-waiver
  // product-category gap, the reservation vehicle-licensing accommodation
  // gap, the FDPIR choice-of-program mutual-exclusivity gap) is a
  // per-state disclosed gap of an already-documented class (#824-style
  // Facts-shape/mechanism gaps, or the OH/MO/CO/SD-precedent
  // unmapped-4th-utility-tier gap), not a new engine architecture gap, per
  // this task's own instruction. This is the THIRD and FINAL state in
  // batch tier 5 (§6 step 6: "DE, SD, ND") — all three now have full
  // StatePolicy + 92-profile oracle coverage.
  ND: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "ND",
      label: "North Dakota / HHS (Human Service Zones)",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("775"),
        LUA: new Decimal("286"),
        phone: new Decimal("35"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Vermont (batch tier 6, §6 step 6 — VT/WY/DC, first of three; VT/WY/DC
  // were all in-flight in the SAME worktree as this build, appended
  // one-at-a-time: OK -> VT -> WY -> DC) — built Vermont's StatePolicy
  // entry AND full 92-profile oracle coverage from scratch (VT had neither
  // before this PR), translating VT's already-merged Demeter corpus pack
  // (packages/demeter-engine/src/states/vt/, PROVENANCE.md + supplements.json
  // + freshness.json, built 2026-08-12) into the engine's stricter typed
  // shape per §5's process.
  //
  // bbce: true, bbce_threshold_pct: 185, bbce_fpl_basis: federal_fiscal_year
  // — DCF's own Income Guidelines table (published "October 2025," the
  // FFY2026 cycle) states an Expanded Gross Monthly Income limit at 185%
  // FPL ($2,413 HH1, $4,957 HH4, +$848/additional), and DCF's own live
  // 3SquaresVT consumer page confirms a household is categorically
  // eligible — clearing BOTH gross and net income tests — at or below that
  // 185% figure. 185% matches NJ's threshold exactly (this file's only
  // other 185% state), a genuinely lower BBCE ceiling than the 200%
  // majority in this file (CA/MA/WA/OR/WI/NC/VA/IN/MO/MD/CO/SC/LA/TN).
  //
  // A STRUCTURAL FINDING this file had not yet recorded: Vermont runs a
  // SECOND, entirely independent categorical-eligibility route — a
  // household with children that received the Vermont Earned Income Tax
  // Credit in the 12 months before applying is ALSO categorically eligible,
  // regardless of the 185% gross test. This is the same BBCE-family
  // "TANF-funded service confers cat-elig" mechanism NC's/VA's/DC's/OK's
  // entries in this file already use, but routed through Vermont's OWN
  // state EITC program rather than a federal TANF-services notice — a
  // genuinely distinct trigger this schema has no second axis to encode.
  // Not representable: `StatePolicy` has exactly one bbce_threshold_pct
  // slot, so this second route is disclosed here rather than silently
  // dropped or double-counted. Zero of the 92 v0.6 profiles model a
  // VT-EITC-received household with children above 185% FPL gross income
  // (the only shape where this gap would change a verdict), independently
  // verified — no oracle-authoring consequence today, but a real future
  // gap once a profile tests that specific combination.
  //
  // asset_waiver: true — DCF's own page: a household clearing either
  // cat-elig route "does not have to pass either the gross or net income
  // test," the same "categorically eligible households face no resource
  // test" shape every other BBCE state in this file encodes as
  // asset_waiver: true. A household that clears NEITHER route (exceeds
  // 185% FPL AND has no EITC-linked child) can still qualify with
  // resources considered ONLY if it includes a member 60+ or disabled —
  // that narrower non-cat-elig track's $4,500 limit matches the current
  // federal FY2026 COLA-adjusted E/D ceiling exactly (`asset_limit_
  // elderly_disabled` in federal-tables.ts), so the engine's own federal
  // fallback already produces the right number for any household that
  // ever reaches the (state-wide-waived-when-cat-elig, federal-otherwise)
  // asset gate — no VT-specific override needed beyond the waiver flag
  // itself, the same reasoning this file's NJ/VA/NC/TX/CA entries already
  // rely on.
  //
  // sua_by_tier — FULLY POPULATED, not null: DCF's own dated 10/30/2025
  // legislative slide deck (Deputy Commissioner + Food and Nutrition
  // Program Director, submitted directly to the Vermont Legislature)
  // states three current utility-allowance tiers effective 10/1/2025
  // (FFY2026): Standard Utility Allowance (heating/cooling) $1,096/mo,
  // Basic Utility Allowance (2+ non-heating utilities) $311/mo, and a
  // telephone-only allowance of $37/mo. HCSUA -> $1,096 (SUA), LUA -> $311
  // (BUA — same naming-translation convention TX's/OK's entries in this
  // file already use for a "Basic" middle tier), phone -> $37. DISCLOSED,
  // not silently trusted at full confidence: this pack's own freshness.json
  // flags these three figures as resting on a SINGLE primary document (the
  // slide deck) rather than independently cross-verified against a second,
  // fully separate published DCF COLA notice — unlike VT's own
  // independently-cross-checked income-limit figures. Treated as
  // authoritative here (DCF's own dated, named, official legislative
  // testimony is a strong primary source) but the single-sourcing is
  // disclosed rather than hidden.
  //
  // allotment_tier: "48" — no Vermont-specific elevated max-allotment
  // schedule found.
  //
  // drug_felony_ban: "none" — a VERIFIED FULL STATUTORY OPT-OUT, and one of
  // the earliest and cleanest in this file: 33 V.S.A. § 1203a states in
  // full, "An individual domiciled in Vermont shall be exempt from the
  // disqualification provided for in 21 U.S.C. § 862a," added by 2009 No. 1
  // (Sp. Sess.), § E.323.2 — on the books since 2009, earlier than NJ's
  // 2012 repeal, VA's 2020 amendment, or OK's 1997 session law. Independently
  // corroborated by the Collateral Consequences Resource Center's 50-state
  // survey, which categorizes Vermont as "Fully Opted Out" for both SNAP
  // and TANF — a case where a minority-position claim (a clean,
  // unconditional full opt-out) is confirmed by BOTH the primary statutory
  // text AND a specialized secondary source, not resting on either alone.
  //
  // abawd_waiver_avail: false — DCF's own live Understanding 3SquaresVT
  // Work Rules page AND DCF's own dated 10/30/2025 legislative slide deck
  // INDEPENDENTLY confirm the current post-OBBBA criteria (18-64 age range,
  // child-under-14 exemption, homeless/veteran/foster-care exemptions
  // removed, new Indian/Urban Indian/California Indian exemption added).
  // USDA FNS's own ABAWD Time Limit Waivers FY2025-2029 index shows NO
  // Vermont entry anywhere — not even a lapsed one, a stronger negative
  // finding than several other states in this file whose absence reflects
  // only the current FY (Vermont has no PAST entry either). No county-level
  // lookup needed — a uniform statewide zero-waiver shape, same as this
  // file's VA/MO/TN/MD/CO/SC/LA/OK entries.
  //
  // rmp_operated: false — DCF's own dated 2/19/2025 legislative report
  // confirms Vermont currently operates NO formal Restaurant Meals Program
  // (DCF opposed 2024's S.215, citing cost). Disclosed, not modeled (no
  // engine consumer exists for this axis, grep-confirmed, same as every
  // other state's entry): Vermont is genuinely unusual among this file's
  // "no RMP" states — it is one of only FIVE states nationally authorized
  // to issue SNAP benefits as unrestricted CASH (not EBT) to households
  // where every member is 65+ and/or receiving SSI, and 43% of Vermont's
  // entire 3SquaresVT caseload (16,823 of 39,112 households, per DCF's own
  // report) already receives benefits this way — a completely separate
  // mechanism from RMP with no representable slot in this schema (the
  // engine models neither a cash-out benefit-delivery mode nor its
  // restaurant-spending consequence), disclosed here rather than silently
  // folded into the RMP boolean.
  //
  // Not representable in this schema, and not silently dropped — the SAME
  // pre-existing gap already filed as #824, newly confirmed present for
  // Vermont: no engine axis exists for VT's genuinely long elderly/disabled
  // certification track (up to 36 months, "3SquaresVT in a SNAP!," no
  // interim report) vs. the standard 12-month track with a month-5 interim
  // report — an informational/certification-period gap, not a
  // verdict/benefit-consequential one, matching this file's OK/LA/SC
  // certification-period disclosures.
  //
  // Oracle: VT's closest structural axis-twin among all 29 already-
  // registered states is WISCONSIN — matching bbce: true,
  // bbce_fpl_basis: federal_fiscal_year, asset_waiver: true,
  // allotment_tier: "48", abawd_waiver_avail: false, rmp_operated: false,
  // differing only in bbce_threshold_pct (WI 200 vs VT 185), drug_felony_ban
  // (WI "modified" vs VT "none" — no verdict/benefit consequence,
  // grep-confirmed: only "full" disqualifies), and the SUA dollar figures.
  // Built a fresh, independent Python calculator (not derived from engine
  // output, per #636) directly from verdict.ts/benefit-calc.ts/gates/
  // {income-tests,asset-test,abawd,student,composition,immigration,
  // disqualifications,categorical}.ts/facts.ts/constants/federal-tables.ts's
  // own read source (not just their doc-comments), mirroring every gate and
  // the benefit-calc formula exactly, including decimal.ts's half-up
  // (roundDollar), floor (floorDollar), and ceiling (ceilDollar) rounding
  // conventions. Cross-validated BEFORE trusting it for VT: 92/92 exact
  // match (verdict AND benefit) reproducing WI's already-graded oracle
  // under WI's own StatePolicy params, PLUS all 37 non-expected_by_state
  // variant rows (0 mismatches) — 129/129 total. ALSO cross-validated
  // 129/129 against OK's already-graded oracle (OK's own params) and 129/129
  // against NJ's already-graded oracle (34 PASS / 0 FAIL / 95 SKIP under
  // NJ's null-SUA gap — NJ shares VT's exact 185% threshold, a useful
  // second cross-check on the BBCE-percentage-sensitive gate specifically,
  // even though NJ's own null SUA means it can't validate the benefit-calc
  // pathway the way WI's non-null SUA does) — all three cross-checks passed
  // before applying VT's own policy params. Also checked all 37 rows across
  // the 18 non-expected_by_state variant profiles directly under VT's own
  // params for a VT-specific verdict_by_state override, the same discipline
  // every prior state's build used — found ZERO divergence from the shared
  // default verdict (matching NC's/VA's/MD's/CO's/LA's zero-override
  // result), so no override was authored. Authored all 92
  // expected_by_state.VT entries: 79 APPROVE / 13 DENY — one MORE deny than
  // this file's 200%-BBCE states' typical 12-DENY set (D03-D10 minus D01/D02,
  // M12, M19, S01, S04 — the shared non-financial-gate/E-D-income-gate DENY
  // set every BBCE state in this file shares), because MX4-bbce-max-income-
  // with-any-benefit ($4,440 HH3) clears every 200% state's threshold but
  // falls just short of VT's lower 185% ($4,109 HH3) — the SAME MX4 result
  // this file's NJ entry already found under its own identical 185%
  // threshold, an independent confirmation the divergence is real policy
  // consequence, not a calculator bug.
  //
  // Verification: `/profile-simulation state=VT` — 129/129 PASS, 0 FAIL,
  // 0 SKIP (clean, matching every 129/0/0-grade state in this file, not
  // PA's/NJ's/TN's/MN's SKIP-heavy shape — VT's real, current SUA figures
  // mean it did not need the null-SUA fallback). Every other registered
  // state's harness run reconfirmed unchanged from its documented baseline
  // (full per-state confirmation in this build's PR description and the
  // plan doc's execution-log entry). `tsc --noEmit -p packages/snap-rules`
  // clean, 323/323 snap-rules tests pass (0 new — a schema-conformant pure
  // addition needed no new unit tests), 44/47 profile-harness tests pass (3
  // pre-existing skips). Did not touch `packages/demeter-engine` (VT's
  // corpus was already complete and out of scope) or any other state's
  // StatePolicy/oracle coverage. No new GitHub issue filed — the VT-EITC
  // second-cat-elig-route gap and the 36-month certification-period gap are
  // both per-state disclosed gaps of an already-documented class (#824-style
  // Facts-shape/mechanism gaps, or a genuine schema-slot-count limitation
  // this file already discloses inline rather than files an issue for,
  // matching TN's dual-BBCE-family precedent), not a new engine architecture
  // gap, per this task's own instruction. This is the first of three
  // batch-tier-6 jurisdictions (VT, then WY, then DC) built in this same
  // worktree/PR, one at a time, each appended after the previous.
  VT: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "VT",
      label: "Vermont / DCF — 3SquaresVT",
      bbce: true,
      bbce_threshold_pct: 185,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: {
        HCSUA: new Decimal("1096"),
        LUA: new Decimal("311"),
        phone: new Decimal("37"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // Wyoming (batch tier 6, §6 step 6 — VT/WY/DC, second of three, appended
  // after VT in this same worktree/PR) — built Wyoming's StatePolicy entry
  // AND full 92-profile oracle coverage from scratch (WY had neither
  // before this PR), translating WY's already-merged Demeter corpus pack
  // (packages/demeter-engine/src/states/wy/, PROVENANCE.md + supplements.json
  // + freshness.json, built 2026-08-12) into the engine's stricter typed
  // shape per §5's process.
  //
  // bbce: false, bbce_fpl_basis: null — THIS PACK'S FLAGSHIP FINDING, and
  // rare in this file: Wyoming DFS's own current Table I income-limits
  // table carries NO 200% FPL column at all — only 165% (elderly/disabled
  // separate-HH gross test), 130% (standard federal gross), and 100%
  // (net). Independently confirmed by USDA FNS/FNA's own 16th-edition SNAP
  // State Options Report (June 2024), which lists Wyoming under "No BBCE
  // (9)" — one of only NINE states nationally without the option (alongside
  // AK [pre-7/1/2025, #804], AR, KS, MS, MO, SD, TN [pre-corpus-build], UT).
  // TWO independent primary sources (WY's own manual AND USDA's own federal
  // report) agree — a stronger evidentiary basis than a typical no-BBCE
  // finding in this file. Wyoming's own manual Section 502 confirms
  // categorical eligibility is narrowly SSI/POWER/Tribal-TANF-recipiency
  // based only, with no income-based gate.
  //
  // asset_waiver: false — flows directly from the no-BBCE finding: a
  // Wyoming household not receiving POWER/Tribal TANF/SSI faces BOTH the
  // 130%/100% FPL income tests AND the real resource limit (Section 800:
  // $3,000 general / $4,500 with a 60+/disabled member) — this figure
  // matches the current federal FY2026 COLA-adjusted floor exactly, the
  // same federal fallback the engine's own asset-test gate already applies
  // whenever asset_waiver is false. Same posture as this file's OK/IN/KS
  // entries.
  //
  // sua_by_tier — FULLY POPULATED, not null: WY DFS's own current Table I
  // page (self-dated "October 1, 2025 - September 30, 2026," with the
  // prior FFY2025 table visible for comparison on the same page) states a
  // Standard Utility Allowance (heating/cooling) of $510/mo, a
  // utilities-only standard (2+ non-heating utilities) of $340/mo, and a
  // telephone-only allowance of $57/mo. HCSUA -> $510 (SUA), LUA -> $340
  // (utilities-only — same naming-translation convention this file's
  // OK/TX/VA entries already use for a non-heating middle tier), phone ->
  // $57. DISCLOSED INTERNAL SITE INCONSISTENCY, resolved in favor of the
  // dated table: WY DFS's separate "Do I Qualify?" consumer page states a
  // DIFFERENT, materially lower, undated set of figures for the same
  // categories ($177/$184/$215/$246 standard deduction vs. Table I's
  // $209/$223/$261/$299; $569 shelter cap vs. Table I's $744) — this pack
  // treats the explicitly-dated Table I page as authoritative, the same
  // resolution rule this file's own "internal-site-staleness" precedent
  // (Delaware's DSSM catches, corroborated independently here) already
  // establishes; the "Do I Qualify" page's figures are NOT used anywhere
  // in this entry.
  //
  // allotment_tier: "48" — no Wyoming-specific elevated max-allotment
  // schedule found.
  //
  // drug_felony_ban: "none" — a VERIFIED FULL OPT-OUT, and a genuine
  // PRIMARY-SOURCE CORRECTION of a widely-repeated, template-style
  // secondary-source claim: several low-quality SNAP-aggregator sites
  // describe Wyoming as having a "modified" ban conditioned on
  // sentence/treatment compliance — language this pack traced to NO
  // identifiable Wyoming-specific primary source anywhere. USDA FNS/FNA's
  // own 16th-edition SNAP State Options Report lists Wyoming plainly under
  // "No disqualification (28)" for Drug Felony Disqualifications (7 CFR
  // 273.11(m)), independently corroborated against WY DFS's own manual:
  // the entire 600-series disqualification range (601-610) contains NO
  // drug-felony section at all — the ONLY criminal-justice disqualification
  // category in Wyoming's manual is fleeing-felon/probation-or-parole-
  // violator status (Section 610), a narrower, differently-scoped
  // provision. Unlike this file's Delaware/VT entries (a traceable REPEAL
  // of a provision that once existed), this pack found no evidence such a
  // drug-felony provision ever existed in Wyoming's own regulatory
  // history at all — a stronger correction than a typical staleness catch.
  //
  // abawd_waiver_avail: false — WY DFS's own manual Section 708 is ALREADY
  // current with the post-OBBBA 18-64 age band (unlike this file's
  // Delaware entry, whose text was found lagging the live consumer page on
  // this exact point) and explicitly exempts "a member of an Indian tribe"
  // from the ABAWD time limit entirely — directly relevant given Wyoming's
  // Wind River Reservation population (Eastern Shoshone + Northern
  // Arapaho, Fremont/Hot Springs Counties), though that membership-based
  // exemption isn't geography-dependent and needs no county lookup. USDA
  // FNA's SNAP Time Limit (ABAWD) Waivers FY2025-2029 index shows Wyoming
  // absent ENTIRELY — not among FY2025 waiver, FY2026 waiver, denial, OR
  // termination entries, a genuinely complete negative finding. No
  // county-level lookup needed — uniform statewide zero-waiver, same shape
  // as this file's VA/MO/TN/MD/CO/SC/LA/OK/VT entries.
  //
  // rmp_operated: false — no RMP mention anywhere in DFS's live consumer
  // materials or any of the nine SNAP/POWER Policy Manual sections this
  // pack fetched; consistent secondary-source corroboration. Disclosed,
  // not modeled (no engine consumer exists for this axis, grep-confirmed):
  // a genuinely time-sensitive, NOT-YET-EFFECTIVE fact worth flagging even
  // though this schema has no slot for it — Wyoming holds an APPROVED
  // 2-year USDA demonstration-project waiver excluding sweetened,
  // carbonated beverages from SNAP-purchasable items statewide, effective
  // February 1, 2027 (not yet in effect as of this build).
  //
  // Not representable in this schema, and not silently dropped — the SAME
  // pre-existing gap already filed as #824, newly confirmed present for
  // Wyoming: no engine axis exists for WY's certification-period structure
  // (Section 1201(D)(1)/(J) caps ALL certification periods at 12 months —
  // Wyoming does NOT extend to 24 months for all-elderly/disabled
  // no-earned-income households the way several other states in this file
  // do, a genuine structural contrast rather than an oversight, but purely
  // informational — no engine axis reads certification-period length).
  //
  // Oracle: WY's closest structural axis-twin among all 30 already-
  // registered states is OKLAHOMA — matching every verdict-and-benefit-
  // consequential axis exactly (bbce: false, bbce_fpl_basis: null,
  // asset_waiver: false, allotment_tier: "48", abawd_waiver_avail: false,
  // AND drug_felony_ban: "none" — a stronger match than OK's own IN twin
  // needed, since IN carries "modified"), differing only in the SUA dollar
  // figures. Built a fresh, independent Python calculator (not derived
  // from engine output, per #636) directly from verdict.ts/benefit-calc.ts/
  // gates/{income-tests,asset-test,abawd,student,composition,immigration,
  // disqualifications,categorical}.ts/facts.ts/constants/federal-tables.ts's
  // own read source, mirroring every gate and the benefit-calc formula
  // exactly, including decimal.ts's rounding conventions. Cross-validated
  // BEFORE trusting it for WY: 129/129 exact match (verdict AND benefit,
  // all 92 base profiles + 37 variant rows) reproducing OK's already-graded
  // oracle under OK's own StatePolicy params. Also checked all 37 rows
  // across the 18 non-expected_by_state variant profiles directly under
  // WY's own params for a WY-specific verdict_by_state override, the same
  // discipline every prior state's build used — found ONE real divergence
  // (matching MO's/SC's/OK's one-override precedent, not NC's/VA's/MD's/
  // CO's/LA's/VT's zero-override result): M23-variable-gig-income-
  // anticipation's two variants ($1,800 and $2,200 gross HH1) both clear
  // every BBCE state's threshold in this file but fail WY's plain federal
  // 130% screen ($1,696-97) for the same reason KS/OH/GA/IN/MO/OK already
  // fail — authored "WY": "DENY" into both variants' verdict_by_state
  // blocks, matching OK's/IN's/KS's/MO's already-authored value exactly
  // (an independent confirmation the divergence is real, not a calculator
  // bug). Authored all 92 expected_by_state.WY entries: 70 APPROVE / 22
  // DENY — independently confirmed IDENTICAL to OK's own (and, by OK's own
  // prior finding, IN's) already-graded 92-profile verdict set (0
  // divergence, the expected result since every verdict-controlling axis
  // is identical); only benefit-dollar figures differ, driven by WY's SUA
  // values ($510/$340/$57) vs OK's ($412/$354/$49).
  //
  // Verification: /profile-simulation state=WY — 129/129 PASS, 0 FAIL, 0
  // SKIP (clean, matching every 129/0/0-grade state in this file, not
  // PA's/NJ's/TN's/MN's SKIP-heavy shape — WY's real, current SUA figures
  // mean it did not need the null-SUA fallback). Every other registered
  // state's harness run reconfirmed unchanged from its documented
  // baseline (full per-state confirmation in this build's PR description
  // and the plan doc's execution-log entry). tsc --noEmit -p
  // packages/snap-rules clean, 323/323 snap-rules tests pass (0 new — a
  // schema-conformant pure addition needed no new unit tests), 44/47
  // profile-harness tests pass (3 pre-existing skips). Did not touch
  // packages/demeter-engine (WY's corpus was already complete and out of
  // scope) or any other state's StatePolicy/oracle coverage. No new
  // GitHub issue filed — the no-BBCE finding and the certification-period
  // gap are both per-state disclosed findings/gaps of an already-
  // documented class (a genuine minority-position policy finding already
  // expressible via bbce: false, or an #824-style informational gap), not
  // a new engine architecture gap, per this task's own instruction. This
  // is the second of three batch-tier-6 jurisdictions (VT done, WY here,
  // DC next) built in this same worktree/PR, one at a time, each appended
  // after the previous.
  WY: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "WY",
      label: "Wyoming / DFS",
      bbce: false,
      bbce_fpl_basis: null,
      asset_waiver: false,
      sua_by_tier: {
        HCSUA: new Decimal("510"),
        LUA: new Decimal("340"),
        phone: new Decimal("57"),
        none: new Decimal("0"),
      },
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // District of Columbia (batch tier 6, §6 step 6 — VT/WY/DC, third and
  // final of three, appended after WY in this same worktree/PR) — DC is a
  // jurisdiction, not a state, but administers SNAP as its own single,
  // unified jurisdiction (DHS's Economic Security Administration,
  // District-wide, no sub-jurisdictional policy variation) — structurally
  // the closest parallel in this file to a state-administered program
  // (NC/VA/TN/IN/MO/MD/CO/SC/LA/OK), and registers under state_code "DC"
  // the same way every other jurisdiction in this schema does. Built DC's
  // StatePolicy entry AND full 92-profile oracle coverage from scratch (DC
  // had neither before this PR), translating DC's already-merged Demeter
  // corpus pack (packages/demeter-engine/src/states/dc/, PROVENANCE.md +
  // supplements.json + freshness.json, built 2026-08-12) into the engine's
  // stricter typed shape per §5's process.
  //
  // bbce: true, bbce_threshold_pct: 200, bbce_fpl_basis: federal_fiscal_year
  // — DC Code § 4-261.02 grants categorical eligibility to ALL applicants
  // with income at or below 200% FPL GROSS income, achieved through a
  // Mayor-established TANF-funded program or service — directly codified
  // in a DC Council STATUTE (Title 4, Chapter 2B, the "Food Stamp
  // Expansion Act"), not merely described in an agency manual, the same
  // "codified in statute" structural pattern this file's VA entry already
  // found. DHS's own income-limits table (effective 10/1/2025-9/30/2026)
  // is FFY-dated, matching this file's federal_fiscal_year default. A
  // genuine internal DC page labeling inconsistency this pack's corpus
  // caught and this entry does NOT inherit: DHS's own table HEADER for
  // the 200% column literally reads "Maximum Net Monthly Income (200%
  // FPL)" even though the table's own footnote and the statute itself both
  // confirm 200% FPL is a GROSS-income standard — this entry encodes the
  // correct (gross) reading per the statute, not the header's mislabel.
  //
  // asset_waiver: true — DHS's own page states plainly that categorically
  // eligible households (the large majority, per DHS: "Most District
  // residents applying for SNAP are determined categorically eligible")
  // "do not have a limit on resources." For the minority NOT categorically
  // eligible, DHS's page states the resource limit plainly: $3,000 general
  // / $4,500 with a 60+/disabled member — matching the current federal
  // FY2026 COLA-adjusted floor exactly, the same federal fallback the
  // engine's own asset-test gate already applies when asset_waiver is
  // false for a non-cat-elig household.
  //
  // sua_by_tier: DELIBERATELY null — DC is a GENUINE STRUCTURAL GAP, not a
  // guess either way, same disclosed-gap discipline as this file's PA/NJ/
  // TN/MN entries. DHS's own current SNAP Eligibility Requirements page
  // states exactly ONE utility figure: "a Standard Utility Allowance of
  // $374, updated every October 1" — no separate Basic/Limited-Utility or
  // telephone-only standard anywhere in DHS's own text, and this pack's
  // freshness.json explicitly discloses that no second tier was located.
  // A single confirmed figure cannot populate this schema's required
  // 4-key {HCSUA, LUA, phone, none} shape without guessing the other two —
  // this entry does NOT guess. DC DOES carry a genuinely DC-specific
  // statutory mechanism worth flagging even though it's out of scope for
  // this null entry: DC Code § 4-261.03 ("LIHEAP Heat and Eat initiative")
  // requires the Mayor to provide the MAXIMUM Standard Utility Allowance
  // to SNAP households, with automatic enrollment via a statutory
  // $20.01/year minimum LIHEAP benefit — meaning DC's real-world SUA
  // assignment is close to universal at the single known $374 figure for
  // most households, but this entry still can't safely populate LUA/phone
  // without a citation.
  //
  // allotment_tier: "48" — no DC-specific elevated max-allotment schedule
  // found.
  //
  // drug_felony_ban: "none" — a VERIFIED FULL, UNCONDITIONAL STATUTORY
  // OPT-OUT, reached via direct statutory text rather than accepting a
  // secondary source's "opted out" framing at face value (the same
  // caution this file's VT entry already applies, since several secondary
  // sources describe OTHER states' bans imprecisely). DC Code § 4-205.71
  // states in full: "An adult who is a drug felon shall not be denied cash
  // or food assistance benefits...solely because he or she is a drug
  // felon" — no sentence-compliance condition, no treatment-program
  // requirement, originally added April 20, 1999 (D.C. Law 12-241) and
  // most recently amended November 26, 2019 (D.C. Law 23-31).
  //
  // abawd_waiver_avail: false — FLAGSHIP FINDING, and a genuine correction
  // of a widely-repeated secondary-source claim, confirmed by TWO
  // independent primary sources: DHS's own live SNAP Work Requirements
  // page states plainly "SNAP ABAWD work requirements implementation
  // started on June 1, 2026" (36-month clock through May 31, 2029) — the
  // OPPOSITE of several secondary sources' claim that DC still holds an
  // active, ongoing districtwide waiver. Independently cross-checked
  // against USDA FNS's own ABAWD Time Limit Waivers FY2025-2029 index,
  // which lists DC's most recent posted waiver-response entries as three
  // separate FY2025 responses with NO FY2026 entry, corroborating the
  // waiver lapsed and was not renewed. No county-level lookup needed — DC
  // is a single jurisdiction with no sub-jurisdictional geography for one
  // to apply to, the same reasoning this file's VA/MO/TN/MD/CO/SC/LA/OK/
  // VT/WY entries already use for a uniform statewide/district-wide
  // zero-waiver finding.
  //
  // rmp_operated: false — SECOND FLAGSHIP FINDING, confirmed by TWO
  // independent primary sources: USDA FNS's own official "States that
  // Operate a Restaurant Meals Program" list does NOT include DC (the
  // complete current list is AZ, MD, NY, CA, MA, RI, IL [Cook/Franklin
  // only], MI, VA) — despite several secondary sources stating plainly
  // that DC participates. Independently cross-checked against DHS's own
  // live consumer page's explicit purchase-restriction list ("Hot foods"
  // and "Prepared Foods fit for immediate consumption" are NOT
  // purchasable, no RMP exception mentioned). This pack's reading: the
  // secondary-source error likely conflates DC with its immediate
  // RMP-operating neighbors, Maryland and Virginia, both of which DO
  // appear on USDA's list — a genuinely useful correction given DC's
  // literal adjacency to two RMP states this file already carries.
  //
  // Not representable in this schema, and not silently dropped — the SAME
  // pre-existing gap already filed as #824, newly confirmed present for
  // DC: no engine axis exists for DC's genuinely longer 36-month ESAP
  // (Elderly Simplified Application Project) certification period for
  // all-elderly/disabled no-earned-income households, vs. the standard
  // 12-month track — an informational/certification-period gap, not a
  // verdict/benefit-consequential one, matching this file's OK/LA/SC/VT
  // certification-period disclosures. DHS's own page also states a
  // specific 4-person Standard Deduction figure could not be independently
  // located (DHS's own text skips the 4-person tier explicitly) — this
  // entry does not encode a state-specific Standard Deduction at all
  // (Standard Deduction is a shared federal-tables.ts constant, not a
  // per-state StatePolicy axis in this schema), so this particular corpus
  // gap has no engine-side consequence.
  //
  // Oracle: DC's closest structural axis-twin among all 31 already-
  // registered states is TENNESSEE — matching bbce: true,
  // bbce_threshold_pct: 200, bbce_fpl_basis: federal_fiscal_year,
  // asset_waiver: true, sua_by_tier: null, allotment_tier: "48",
  // abawd_waiver_avail: false, rmp_operated: false — a full match on every
  // verdict-and-benefit-consequential axis, differing only in
  // drug_felony_ban (TN "modified" vs DC "none" — zero verdict/benefit
  // consequence, grep-confirmed: only "full" disqualifies). Built a fresh,
  // independent Python calculator (not derived from engine output, per
  // #636) directly from verdict.ts/benefit-calc.ts/gates/{income-tests,
  // asset-test,abawd,student,composition,immigration,disqualifications,
  // categorical}.ts/facts.ts/constants/federal-tables.ts's own read
  // source, mirroring every gate and the benefit-calc formula exactly,
  // including decimal.ts's rounding conventions. Cross-validated BEFORE
  // trusting it for DC: reproduced TN's already-graded oracle under TN's
  // own StatePolicy params (34 PASS / 0 FAIL, the SUA-unblocked subset
  // exactly matching TN's documented 34/0/95 baseline — the null-SUA
  // gate's SKIP-before-any-other-gate behavior means the harness itself
  // never grades the other 58/95 rows regardless of what any fixture
  // authors for them, so this is the correct and complete cross-check for
  // a null-SUA twin).
  //
  // For DC's own oracle authoring, applied the SAME "SUA-invariant sweep"
  // methodology this file's PA/NJ/AK null-SUA builds already established
  // (per [[project_snap_rules_oracle_authoring]]): for the 58 of 92
  // profiles whose sua_tier isn't "none" and aren't homeless_deduction (the
  // profiles the composer SKIPs before reaching any gate today), swept a
  // hypothetical SUA value across a 13-point $0-$1,500 range and authored
  // a verdict (benefit: null) ONLY where the verdict held identical at
  // EVERY swept value — 0 of the 58 were genuinely indeterminate. (These
  // 58 authored verdicts document the correct answer for a future SUA fix
  // but are NOT graded PASS/FAIL by the harness today — the composer's
  // null-SUA check bails before any gate runs, so today's
  // `/profile-simulation state=DC` run SKIPs them regardless of what's
  // authored here, exactly matching PA's/NJ's/TN's own 34/0/95 shape.)
  // Also checked all 37 rows across the 18 non-expected_by_state variant
  // profiles under DC's own params using the same sweep methodology —
  // found ZERO verdict_by_state overrides needed (every SUA-unblocked
  // variant's verdict matches the shared default), but found ONE
  // genuinely-indeterminate row this file's prior null-SUA builds hadn't
  // yet encountered: P58-elderly-retiree-tips-over-net-limit's
  // "above_net_limit" variant is a household specifically engineered to
  // sit at the net-income margin with an UNCAPPED (elderly/disabled)
  // excess-shelter deduction — genuinely SUA-dependent by the profile's
  // own design, not a calculator bug — left unauthored rather than
  // guessed either way, the same "genuinely indeterminate stays
  // unauthored" discipline this file's null-SUA precedent already
  // establishes in principle (PA/NJ/AK's builds found 0 such rows only
  // because none of their swept profiles happened to sit exactly at that
  // margin; DC's is the first to actually hit one).
  //
  // Authored all 92 expected_by_state.DC entries: 80 APPROVE / 12 DENY —
  // the SAME shared 12-DENY set every 200%-BBCE state in this file shares
  // (D03-D10, M12, M19, S01, S04), all 12 independently confirmed
  // SUA-invariant. 34 of the 92 get a real computed benefit (sua_tier
  // "none" or homeless_deduction); the other 58 carry benefit: null with
  // an independently-swept verdict, per the discipline above.
  //
  // Verification: `/profile-simulation state=DC` — 34 PASS / 0 FAIL / 95
  // SKIP (matching PA's/NJ's/TN's exact SKIP-heavy shape, not the
  // 129/0/0-clean bar this file's real-SUA states hit — DC's null-SUA gap
  // means it needs the same null-SUA fallback PA/NJ/TN already established,
  // NOT a coverage gap). Every other registered state's harness run
  // reconfirmed unchanged from its documented baseline (full per-state
  // confirmation in this build's PR description and the plan doc's
  // execution-log entry). `tsc --noEmit -p packages/snap-rules` clean,
  // 323/323 snap-rules tests pass (0 new — a schema-conformant pure
  // addition needed no new unit tests), 44/47 profile-harness tests pass
  // (3 pre-existing skips). Did not touch `packages/demeter-engine` (DC's
  // corpus was already complete and out of scope) or any other
  // jurisdiction's StatePolicy/oracle coverage. No new GitHub issue filed
  // — the null-SUA gap is the SAME already-documented #824-adjacent class
  // of gap PA's/NJ's/TN's/MN's entries already carry (not a new instance
  // needing its own issue), and the DC-EITC-equivalent labeling
  // inconsistency + the 36-month-ESAP certification-period gap are both
  // per-jurisdiction disclosed findings of an already-documented class,
  // per this task's own instruction. This is the third and FINAL of three
  // batch-tier-6 jurisdictions (VT, WY, DC — all built one at a time in
  // this same worktree/PR, each appended after the previous). Batch tier
  // 6 (§6 step 6) is now complete.
  DC: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "DC",
      label: "District of Columbia / DHS — Economic Security Administration",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: null,
      allotment_tier: "48",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // U.S. Virgin Islands — DHS / Division of Family Assistance (DFA). Batch
  // tier (docs/plans/snap-rules-50-state-engine-completion.md §6), SOLO
  // ENTRY, and the FINAL batch-tier item — a genuine blank slate, no prior
  // StatePolicy or oracle coverage existed. Every axis below is TRANSLATED
  // from the already-merged Demeter corpus pack
  // (packages/demeter-engine/src/states/vi/PROVENANCE.md +
  // supplements.json + pack.json), built 2026-08-12, cross-checked directly
  // against USVI DHS's own current FY2026 (10/1/2025-9/30/2026) "Monthly
  // Allotments and Deductions" table (fetched fresh this build via
  // `curl` + `pdftotext -layout` — the corpus pack quoted several figures
  // from this table but not its full text) and USDA's own official BBCE
  // page + 17th-edition State Options Report.
  //
  // STEP 0, before authoring anything: independently re-confirmed VI runs
  // STANDARD FEDERAL SNAP, not the Nutrition Assistance Program (NAP) block
  // grant that Puerto Rico / American Samoa / CNMI run instead — this is
  // the SAME distinction a 2026-08 Demeter fix (#743) found matters: three
  // U.S. territories genuinely do NOT run SNAP. VI is not one of them.
  // USDA's own SNAP state directory entry names VI's program plainly as
  // "Supplemental Nutrition Assistance Program (SNAP)," and the 17th-edition
  // State Options Report's own introduction states "SNAP State agencies
  // include all 50 States, the District of Columbia, Guam, and the Virgin
  // Islands" — devoting a full state-summary page (pp.135-136) to VI's own
  // SNAP policy options, the treatment NOT given to PR/AS/CNMI. A
  // StatePolicy entry is appropriate.
  //
  // bbce: true, bbce_threshold_pct: 175 — confirmed directly on USDA's own
  // CURRENT, live Broad-Based Categorical Eligibility policy page
  // (fns.usda.gov/snap/broad-based-categorical-eligibility): VI listed with
  // "All households" categorically eligible (the broadest BBCE tier),
  // gross income limit "175%," corroborated by a second, independently
  // USDA-sourced FRAC compilation. A vi.gov press release quoting DHS
  // Commissioner Averil George confirms the underlying change and its date:
  // the threshold rose from 130% to 175% FPL effective 10/1/2024 — a
  // genuinely recent VI-specific policy choice. Cross-checked against the
  // real DHS-VI FY2026 table fetched this build: its "175% of Poverty"
  // column ($2,284/$3,085/$3,887/$4,690/... by HH size 1-8) reproduces the
  // standard 48-contiguous FPL table (federal-tables.ts's FY26
  // fpl_by_region.contiguous: $15,660/$5,500) times 1.75, floor-rounded,
  // almost exactly (HH4 $4,690 matches exactly; HH1 is $1 off, $2,284 vs a
  // computed $2,283 — the same order of minor table-vs-formula drift this
  // file's AK/VA entries already document, not a sign VI uses an elevated
  // FPL guideline). This ALSO confirms `bbce_fpl_basis` should NOT be an
  // elevated "vi" region in federal-tables.ts's fpl_by_region (unlike AK's
  // real #812 need) — VI's income limits derive from the SAME 48-contiguous
  // HHS guideline every other non-AK/HI state uses; only its BENEFIT
  // (max-allotment) table is genuinely elevated (see allotment_tier below).
  // DHS-VI's own table carries an UNRESOLVED internal ambiguity — a second,
  // unexplained "200% of Poverty" column sits beside the 175% one with no
  // distinguishing text — the corpus pack flagged this and deferred to
  // USDA's own singular, authoritative 175% BBCE-page figure rather than
  // guessing at the second column's purpose; this entry does the same.
  //
  // bbce_fpl_basis: "federal_fiscal_year" — DHS-VI's own table is captioned
  // "October 1, 2025, to September 30, 2026," the same FFY framing this
  // file's CA/NC/VA/AK(post-BBCE)/OK entries already use (contrast MA's
  // calendar_year).
  //
  // asset_waiver: true — USDA's own BBCE page states "No limit on assets"
  // for VI's "All households" tier — the broadest possible waiver, same
  // breadth as MN's/NC's entries (stronger than an asset-only carve-out).
  //
  // sua_by_tier: null — a disclosed gap, same discipline as PA's/NJ's/TN's/
  // MN's null entries, CONFIRMED (not merely suspected) by reading DHS-VI's
  // actual FY2026 table directly this build: it publishes a "MAXIMUM
  // SHELTER DEDUCTION" of $586.00 and a "TELEPHONE DEDUCTION" of $34.00,
  // but NO separate HCSUA/LUA(heating-vs-non-heating) breakdown at all —
  // the schema's required {HCSUA, LUA, phone, none} quad has no home for
  // a table that publishes a shelter-deduction CAP (not a utility standard)
  // and a phone standard but nothing in between. This matches USDA's own
  // 17th-edition State Options Report, which lists VI's "Treatment of
  // Utility Expenses" policy option as "SUAs not mandatory" — VI is not
  // required to use a flat SUA methodology at all, consistent with there
  // being no published HCSUA/LUA figures to encode. (VI's own $586 maximum
  // shelter deduction is ALSO not the same concept as `federal-tables.ts`'s
  // uniform `shelter_cap` ($744 FY26) — VI's real cap is lower, but this
  // engine has no per-state override slot for that federal-wide constant
  // either; noted here as a second, smaller disclosed gap of the same
  // "real-figure-the-schema-can't-hold" shape. Same for VI's own $31
  // minimum allotment for 1-2 person HHs vs. the federal $24 default.)
  //
  // allotment_tier: "VI" — FIXED (was "48", CONFIRMED WRONG, forced by the
  // schema's then-closed `"48" | "AK"` union). VI's own FY2026 table
  // (fetched fresh during VI's original build) publishes a REAL Maximum
  // Allotment column that is ~28.5-28.9% HIGHER than the 48-contiguous
  // table at EVERY household size (VI $383/$703/$1009/$1278/$1521/$1827/
  // $2019/$2300, +$281/additional vs. federal-tables.ts's FY26
  // $298/$546/$785/$994/$1183/$1421/$1571/$1789, +$218/additional) — VI's
  // own corpus pack independently corroborates this is structural, not a
  // fluke: "USVI is one of only four SNAP jurisdictions (with Alaska,
  // Hawaii, and Guam) that receives a COLA-adjusted income/deduction table
  // structurally different from the 48 contiguous states plus DC." Filed
  // as issue #858 (same class as this file's already-known HI/GU
  // AllotmentTier gap, plan doc §4 — confirmed with real VI numbers, not
  // just suspected) and now RESOLVED for VI by the schema-extension PR
  // that closes #858: `AllotmentTier` widened to `"48" | "AK" | "VI"`,
  // packages/snap-rules/src/constants/vi-allotment-table.ts carries VI's
  // real flat (non-zone) max-allotment + minimum-benefit table, and
  // federal-tables.ts's `maxAllotmentFor`/`minimumBenefitFor` both gained a
  // `state === "VI"` branch mirroring AK's existing one. VI's own $31
  // minimum allotment (vs. the federal $24 default) is fixed by that same
  // PR; VI's own lower $586 maximum shelter deduction (vs. federal's $744
  // `shelter_cap`) remains a DISCLOSED, UNFIXED gap — `shelterCapFor()` has
  // no per-state override slot at all (not even for AK), and #858 itself
  // frames this as the non-material side of the gap since it under-caps
  // rather than over-caps. With the fix landed, `benefit` in
  // `expected_by_state.VI`'s 34 real-engine-gradeable oracle rows carries
  // VI's real, non-null computed dollar figure instead of `null` — see
  // this file's oracle-authoring note below for the before/after
  // reconciliation. Verdicts are unaffected either way — `allotment_tier`
  // only feeds `benefit-calc.ts`, never a gate.
  //
  // drug_felony_ban: "none" — a VERIFIED FULL OPT-OUT per USDA's own
  // 17th-edition State Options Report, which lists VI's "Drug Felony
  // Disqualifications" policy option plainly as "No disqualification" — the
  // fullest opt-out tier, same category this file's DE/ND/OK entries
  // independently confirmed for their own jurisdictions. Disclosed gap: no
  // USVI Code section or DHS regulation implementing the opt-out was
  // located — DHS-VI's own public materials don't cite one, and no
  // codified, section-numbered USVI SNAP policy manual (comparable to
  // other states' administrative codes) was found publicly posted. The
  // POLICY OUTCOME is confirmed via a primary federal source; the
  // underlying territorial statutory citation is a disclosed, unresolved
  // gap (does not affect the classification: "none" is correct either way,
  // and per #805 only "full" ever gates).
  //
  // abawd_waiver_avail: false — an affirmative, current-materials-based
  // finding, not a fail-open default. USVI DHS's own current (2026-dated)
  // ABAWD webpage PDF and "SNAP Benefits Are Changing" flyer (both fetched
  // fresh this build) describe NEW post-OBBBA work requirements beginning
  // 3/1/2026 (already past as of this build) with NO mention anywhere of
  // an area-wide waiver — the same "new work rules now apply" framing this
  // file's VA/MO/TN/MD/CO/SC/LA/OK zero-waiver entries use, not language
  // consistent with an active exemption. USDA's own 17th-edition State
  // Options Report separately lists VI's "ABAWD Time Limit Waiver" status
  // as "Statewide ABAWD time limit waiver" — but that report uses PRE-OBBBA
  // data (as of 10/1/2024) and predates VI's own 3/1/2026 rule change; the
  // corpus pack explicitly flags this as stale and NOT evidence of a
  // currently active waiver under the post-3/1/2026 regime, and this entry
  // follows that same reasoning rather than the stale federal snapshot.
  //
  // rmp_operated: false — confirmed ABSENT from USDA's own current,
  // published Restaurant Meals Program participating-jurisdictions list
  // (fetched via the BBCE-page cross-check, listing AZ/CA/IL Cook-Franklin/
  // MD/MA/MI/NY/RI and others — VI is not among them). No USVI DHS page or
  // press release describes a pending or planned RMP.
  //
  // Oracle: VI's closest structural axis-twin among already-registered
  // null-SUA states is a BLEND — NJ (asset_waiver true, drug_felony_ban
  // "none" exactly, but abawd_waiver_avail TRUE, bbce_threshold_pct 185)
  // and TN/WI (abawd_waiver_avail FALSE exactly, but bbce_threshold_pct
  // 200 and drug_felony_ban "modified"). Built a fresh, independent Python
  // calculator (not derived from engine output, per #636) directly from
  // verdict.ts/benefit-calc.ts/gates/{income-tests,asset-test,abawd,
  // student,composition,immigration,disqualifications,categorical}.ts/
  // facts.ts/constants/federal-tables.ts's own read source, mirroring every
  // gate and the benefit-calc formula exactly, including decimal.ts's
  // half-up (roundDollar) and floor (floorDollar) rounding conventions.
  // Cross-validated BEFORE trusting it for VI: 92/92 exact verdict match
  // (bypassing only the null-SUA early-bail, since verdict never depends on
  // the actual SUA dollar figure for a BBCE-conferred household — the net
  // test is skipped entirely) reproducing NJ's AND PA's already-graded
  // 92-row oracles under their own params, PLUS a full 92/92 exact match on
  // BOTH verdict AND benefit reproducing WI's already-graded oracle under
  // WI's real (non-null) SUA table — the strongest available check of the
  // calculator's core benefit-calc arithmetic, not just its gates. A single
  // expected, EXPLAINED divergence surfaced cross-validating against TN
  // (MX4-bbce-max-income-with-any-benefit: TN's independently-authored
  // oracle applies TN's own additional net-income ceiling, issue #830, an
  // engine-architecture gap this engine doesn't implement and VI's own
  // corpus disclosed no evidence of; not a calculator bug). Also confirmed
  // the real-engine-gradeable subset (34 of 92, matching PA/NJ/TN's split
  // exactly) reproduces NJ's, PA's, and WI's graded benefit dollar amounts
  // with 0 mismatches before switching to VI's own policy params.
  //
  // Checked all 37 rows across the 18 non-`expected_by_state` variant
  // profiles (facts_patch A/B pairs) for a VI-specific `verdict_by_state`
  // override: all 18 variant profiles' BASE facts use `sua_tier: "HCSUA"`
  // (never "none", never `homeless_deduction`, and no variant patch changes
  // that) — meaning every one of the 37 rows hits VI's null-SUA engine-SKIP
  // regardless of any override authored, so none was added (the override
  // would be inert). Same reasoning this file's PA/NJ/TN entries already
  // established for their own null-SUA variant rows.
  //
  // Authored all 92 `expected_by_state.VI` entries: 79 APPROVE / 13 DENY.
  // VI's DENY set is NC's/VA's 12-profile DENY set PLUS TWO axis-driven
  // additions relative to different peers: `M12-abawd-in-a-waived-area`
  // (DENY, matching WI's/TN's `abawd_waiver_avail: false` — NOT NJ's/PA's
  // `true`) AND `MX4-bbce-max-income-with-any-benefit` (DENY — VI's 175%
  // threshold is LOWER than even NJ's 185%, so a profile engineered to
  // clear 185% by $2 but sit under 200% fails VI's threshold too, unlike
  // NJ where it barely clears). `benefit: null` for all 92 (see
  // allotment_tier above — a deliberate, disclosed, gap-driven choice, not
  // an oversight).
  //
  // Verification (VI's ORIGINAL build, superseded below): `/profile-
  // simulation state=VI` — 34 PASS / 0 FAIL / 95 SKIP (of 129: 92 base + 37
  // variant), matching PA's/NJ's/TN's exact SKIP-heavy shape (though VI's
  // root cause is a COMBINATION of the null-SUA gap blocking 58+37=95 rows
  // entirely AND the allotment_tier gap additionally blocking the
  // benefit-dollar assertion on the remaining 34 — both disclosed above,
  // neither silent). Every other registered state's harness run
  // reconfirmed unchanged from its documented baseline. `tsc --noEmit -p
  // packages/snap-rules` clean, 323/323 snap-rules tests pass (0 new — a
  // schema-conformant pure addition needed no new unit tests), 44/47
  // profile-harness tests pass (3 pre-existing skips). Did not touch
  // `packages/demeter-engine` (VI's corpus was already complete and out of
  // scope) or any other state's `StatePolicy`/oracle coverage.
  //
  // This is the LAST batch-tier entry (docs/plans/
  // snap-rules-50-state-engine-completion.md §6) — see that doc's own
  // updated §2/§6 for which batch-tier PRs (CT/UT/IA/AR, MS/NM/NE, ID/WV/
  // NH, ME/RI/MT, DE/SD/ND, VT/WY/DC) were merged vs. still in flight as of
  // this build; VI was NOT built alongside or coordinated with any of them.
  // After VI, the only remaining unstarted engine work is: HI/GU (blocked
  // on the AllotmentTier schema extension, §4, now also blocking VI per
  // issue #858) and MN (blocked on its own separate null-SUA gap, since
  // MN's null SUA additionally has no `sua_tier: "none"`-reachable rows the
  // way PA/NJ/TN/VI's 34-row subset does — a pre-existing, different-shaped
  // gap, not something this build touched).
  //
  // ── #858 RESOLVED (schema-extension PR, plan doc §4/§6 step 4) ─────────
  // `allotment_tier` below changed from "48" to "VI" now that
  // `AllotmentTier` has been widened and packages/snap-rules/src/constants/
  // vi-allotment-table.ts + federal-tables.ts's maxAllotmentFor/
  // minimumBenefitFor carry VI's real table. This did NOT touch VI's
  // null-`sua_by_tier` gap (a separate, unrelated finding) — the 58 base +
  // 37 variant rows that gap blocks remain SKIP. It DID backfill the ~34
  // real-engine-gradeable rows' `benefit` from `null` to VI's real computed
  // dollar figure in v0.6.json's `expected_by_state.VI` (fresh independent
  // Python calculator, #636 methodology, re-run WITH VI's real max-
  // allotment table and cross-validated against #858's own quoted table).
  // Re-verified: `/profile-simulation state=VI` still 34 PASS / 0 FAIL / 95
  // SKIP — same shape, now with real dollars instead of nulls on the 34
  // PASS rows. Zero regressions confirmed across every other registered
  // state (HI/GU remain unbuilt and untouched — plan doc §5, separate
  // future go-ahead).
  VI: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "VI",
      label: "U.S. Virgin Islands / DHS-DFA",
      bbce: true,
      bbce_threshold_pct: 175,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: null,
      allotment_tier: "VI",
      drug_felony_ban: "none",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // ── HAWAII (#861) ──────────────────────────────────────────────────────
  // The final individual jurisdiction of the original 53-jurisdiction plan
  // scope (docs/plans/snap-rules-50-state-engine-completion.md §5), built
  // alongside GU. Both required the #861 schema step (AllotmentTier widened
  // to add "HI"/"GU", mirroring #858/#860's VI precedent) before either
  // could be built — see states.ts's AllotmentTier doc-comment above.
  //
  // Every axis below is TRANSLATED from the already-merged Demeter corpus
  // pack's already-cited findings (packages/demeter-engine/src/states/hi/
  // PROVENANCE.md + supplements.json, built 2026-08-12) into the engine's
  // stricter typed shape, per plan doc §5 step 1 — re-verification against
  // the corpus's own primary sources, not fresh research, EXCEPT for the
  // allotment/FPL-table axes (independently re-sourced this build, since the
  // corpus pack explicitly deferred those to "a future packages/snap-rules
  // build," see below) and the BBCE percentage cross-check (independently
  // re-confirmed via a second primary source this build, see bbce below).
  //
  // bbce: true, bbce_threshold_pct: 200 — Hawaii DHS BESSD's own current
  // SNAP consumer page (effective 10/1/2025, humanservices.hawaii.gov/
  // bessd/snap/) lists a "200% FPL (BBCE)" gross-income column directly
  // (e.g. $3,000/month for HH1). Independently cross-checked this build
  // against USDA FNS's own current, live Broad-Based Categorical
  // Eligibility page (fns.usda.gov/snap/broad-based-categorical-eligibility,
  // mirror fns-prod.azureedge.us/snap/broad-based-categorical-eligibility —
  // the SAME primary source this file's ~45 other BBCE states, and #858's
  // VI entry, already cite for this exact axis): Hawaii listed with "All
  // households" categorically eligible, gross income limit "200%," asset
  // limit "No limit on assets" — confirming both bbce_threshold_pct AND
  // asset_waiver independently, not merely restating the corpus's own
  // finding. See #861 for the full cross-check (reproduced ~45 other
  // already-registered states' own bbce_threshold_pct/asset_waiver values
  // from this SAME page with zero discrepancies before trusting it here).
  //
  // bbce_fpl_basis: "federal_fiscal_year" — Hawaii DHS's own page is
  // captioned "effective 10/1/2025," the same FFY framing this file's
  // CA/NC/VA/AK(post-BBCE)/OK/VI entries already use.
  //
  // A genuinely more aggressive BBCE implementation than this file's other
  // BBCE-200 states (disclosed, not modeled as a separate axis — see
  // "engine behavior already matches" note below): Hawaii DHS's own page
  // states directly, "As of February 1, 2025, under BBCE households are
  // also not subject to the net income test" — a full waiver of BOTH the
  // gross AND net income tests for BBCE-conferred households, not merely an
  // elevated gross ceiling with the ordinary net test still applying after
  // deductions. VERIFIED this requires NO engine change: `verdict.ts`
  // already implements exactly this rule for EVERY bbce:true state
  // (`bbceConferred` — set the moment a household clears the (possibly
  // elevated) gross test in a BBCE state — bypasses BOTH the gross-test
  // block's alternate paths AND the net-income-test call entirely). Hawaii
  // DHS's own text is simply describing, in plain language, the SAME
  // universal BBCE mechanism this engine has modeled since before this
  // build — not a Hawaii-specific gap to close.
  //
  // asset_waiver: true — confirmed above (both HI DHS's own page and
  // USDA's own BBCE page independently state "unlimited"/"No limit on
  // assets" for HI's "All households" BBCE tier).
  //
  // sua_by_tier: null — a disclosed gap, same discipline as PA's/NJ's/TN's/
  // MN's/VI's null entries. Hawaii Administrative Rules § 17-676-73
  // confirms a genuinely different STRUCTURE (individually-calculated
  // per-utility-type standard allowances — sewer/trash, water,
  // electricity/gas, mandatory telephone — rather than a single flat or
  // two/three-tier SUA/LUA split this schema's {HCSUA, LUA, phone, none}
  // quad is shaped for), and the corpus pack explicitly could not locate
  // current dollar figures for any of those four individual standards in a
  // single dated HI DHS document. USDA's own 17th-edition State Options
  // Report corroborates the STRUCTURAL finding: Hawaii's "Treatment of
  // Utility Expenses" policy option is "SUAs not mandatory" (re-confirmed
  // this build via a direct fetch of that report's own Hawaii profile
  // page) — consistent with there being no single mandatory flat figure to
  // encode even before the dollar-amount gap.
  //
  // allotment_tier: "HI" — Hawaii is one of USDA's small set of
  // jurisdictions (with Alaska, Guam, and the Virgin Islands) using a
  // non-48-contiguous SNAP maximum-allotment table. #861 independently
  // re-sourced the exact current figures directly from USDA FNS's own
  // FY2026 SNAP Cost-of-Living Adjustments memorandum (usda.gov/sites/
  // default/files/guidance-documents/fns.snap-cola-fy26memo.pdf — the SAME
  // primary document #858/#860 sourced VI's table from) — HI's real table
  // is ~70% higher than the 48-contiguous table at every household size
  // (HI $506/$929/$1,334/$1,689/$2,010/$2,415/$2,668/$3,040, +$371/
  // additional vs. federal-tables.ts's FY26 $298/$546/$785/$994/$1,183/
  // $1,421/$1,571/$1,789, +$218/additional), plus a real $41 minimum
  // allotment (vs. the federal $24 default) — both now carried in
  // packages/snap-rules/src/constants/hi-allotment-table.ts, wired through
  // federal-tables.ts's maxAllotmentFor/minimumBenefitFor via new
  // state==="HI" branches (#861). The corpus pack's own "max-allotment-cola"
  // finding, sourced from the SAME USDA table, independently corroborated
  // this figure (HH4 $1,689) before this build re-fetched and re-verified
  // the full HH1-8 table directly.
  //
  // A SECOND, genuinely distinct gap #861 also closed: Hawaii's own HHS
  // poverty guideline (the income-ELIGIBILITY axis, not the benefit-
  // calculation axis above) is ALSO materially elevated above the
  // 48-contiguous table — unlike VI, whose income limits track the
  // ordinary 48-contiguous guideline exactly (see VI's entry above).
  // federal-tables.ts's `FederalTableSnapshot.fpl_by_region.hi` slot
  // existed since #812 but was left `null` ("HI has no StatePolicy
  // registered yet") — #861 populates it with HI's real annual guideline
  // (FY26: $17,990 first person, +$6,330 each additional, from the 2025
  // HHS Federal Register notice, 90 FR 5917 — the SAME notice #812 used
  // for AK's figure) and confirms HI's own rounding convention is CEILING,
  // same as AK's, by reproducing USDA's own FY2026 COLA memo's published
  // HI-specific income-eligibility table exactly at all 8 household sizes
  // across all three columns (100%/130%/165% FPL) — 0 mismatches. This is
  // a verdict-affecting fix (gates/income-tests.ts), not merely cosmetic —
  // HI households are entitled to a materially higher income ceiling than
  // the 48-contiguous table would give them.
  //
  // What this does NOT fix (disclosed, matching #858's own VI framing):
  // HI's own table also carries a higher Standard Deduction ($295 sizes
  // 1-4, $300 size 5, $344 size 6+ vs. federal FY26's $209/$223/$261/$299)
  // and a higher Maximum Excess Shelter Deduction ($1,003 vs. federal
  // FY26's $744). `standardDeductionFor()`/`shelterCapFor()` have no
  // per-state override slot at all, not even for AK — extending them is a
  // separate, larger schema change out of scope for #861. Both gaps work
  // in the household's favor if left unfixed (they UNDER-state the
  // deduction, not over-state it).
  //
  // drug_felony_ban: "modified" — Haw. Rev. Stat. § 346-53.3 conditions the
  // federal drug-felony ban's carve-out on treatment compliance: the
  // federal ban "shall not apply in Hawaii to persons who are complying
  // with treatment or who have not refused or failed to comply with
  // treatment" — a real, conditional restriction (someone who HAS refused
  // or failed treatment compliance remains subject to the federal ban),
  // the same #805 "modified" classification this file's FL/PA/AZ/WI/KS/AK
  // entries already use, not an unconditional full opt-out several
  // secondary sources incorrectly describe. Disclosed gap the corpus pack
  // itself flagged: both law.justia.com and capitol.hawaii.gov returned
  // HTTP 403 to every direct-fetch attempt, so this statute's exact text
  // rests on a WebSearch/Justia-excerpt corroboration rather than a
  // directly-fetched primary document — does not affect the "modified"
  // classification either way (per #805, only "full" ever gates).
  //
  // abawd_waiver_avail: false — an affirmative, current-materials-based
  // finding, not a fail-open default. USDA FNA's own current ABAWD Time
  // Limit Waivers FY2025-2029 state-response index does NOT list Hawaii
  // among the states that submitted a waiver request for FY2025 or FY2026
  // — despite federal law giving Hawaii (and Alaska) a more favorable
  // noncontiguous-state waiver threshold (1.5x the national average
  // unemployment rate, vs. the mainland's flat 10% floor) than the
  // mainland, Hawaii simply has not requested one. Hawaii DHS's own
  // OBBBA/ABAWD FAQ (posted 10/9/2025) corroborates active post-OBBBA
  // enforcement with no mention of an area-wide waiver.
  //
  // rmp_operated: false — confirmed ABSENT from USDA FNA's own current
  // Restaurant Meals Program state-operator list (nine listed
  // states/jurisdictions: AZ, MD, NY, CA, MA, RI, IL Cook/Franklin only,
  // MI, VA — Hawaii is not among them), a genuine secondary-source
  // correction the corpus pack made (several aggregators wrongly list
  // Hawaii as an RMP state).
  //
  // ── Oracle (#636 methodology) ────────────────────────────────────────
  // HI's closest structural axis-twin among already-registered states is
  // WI: identical bbce (true), bbce_threshold_pct (200), bbce_fpl_basis
  // (federal_fiscal_year), asset_waiver (true), drug_felony_ban
  // ("modified"), abawd_waiver_avail (false), rmp_operated (false) — every
  // axis matches except allotment_tier (differs by construction) and
  // sua_by_tier (WI real, HI null). Built a fresh, independent Python
  // calculator (not derived from engine output) directly from
  // verdict.ts/benefit-calc.ts/gates/{income-tests,asset-test,abawd,
  // student,composition,immigration,disqualifications,categorical}.ts/
  // facts.ts/constants/federal-tables.ts's own read logic, mirroring every
  // gate and the benefit-calc formula exactly (including decimal.ts's
  // half-up roundDollar / floorDollar / ceilDollar conventions). Cross-
  // validated BEFORE trusting it for HI: reproduced WI's AND IL's own
  // already-graded, FULLY REAL (non-null-SUA) oracles — 129/129 exact
  // match on BOTH verdict AND benefit for each, the strongest available
  // check (full benefit-dollar arithmetic, not just gates), not merely the
  // minimum 92/92 verdict-only bar.
  //
  // Applied HI's own params (bbce_threshold_pct 200 identical to WI, but
  // fpl_by_region ELEVATED unlike WI's plain contiguous table) to all 92
  // base + 37 variant rows: HI's verdict set is IDENTICAL to WI's at every
  // one of the 92 base profiles (HI's higher FPL threshold did not flip
  // any of WI's income-based DENYs — every income DENY in this profile set
  // sits far enough above even HI's higher ceiling that the elevation
  // makes no difference, the same directional-only-loosening finding
  // #804/#815/#819 established for AK's own FPL correction). Found exactly
  // ONE flip among the 37 variant rows — `P56-new-job-partial-first-
  // paycheck-vs-anticipated[ongoing_anticipated]` (HH3, gross $4,500): WI's
  // stored DENY reflects the 200%-of-contiguous-FPL HH3 threshold ($4,442);
  // HI's own real 200%-of-HI-FPL HH3 threshold is $5,110 (ceil($30,650/12)
  // x2), so $4,500 clears it — APPROVE for HI. Same profile, same
  // reasoning shape as #804/#815's AK M23/P56 flip; added an explicit
  // `HI: APPROVE` override to that variant's `verdict_by_state` map,
  // following that established pattern.
  //
  // Checked all 37 rows across the 18 non-`expected_by_state` variant
  // profiles for an HI-specific override beyond the one above: all 18
  // variant profiles' BASE facts use `sua_tier: "HCSUA"` (never "none",
  // never `homeless_deduction`), meaning every row hits HI's null-SUA
  // engine-SKIP regardless of any override authored — same reasoning
  // this file's PA/NJ/TN/VI entries already established for their own
  // null-SUA variant rows. The P56 override above is authored anyway
  // (documentation of the true expected answer), same discipline as
  // VI's/PA's/NJ's/TN's own blocked-row verdicts, even though the harness
  // never reaches it while HI's SUA remains unsourced.
  //
  // Authored all 92 `expected_by_state.HI` entries: 80 APPROVE / 12 DENY —
  // the SAME DENY set as WI's own (D08/D10/D03/D04/D05/D06/D07/D09/M12/
  // M19/S01/S04), confirming no base-profile flip occurred. `benefit`: real
  // computed dollar figure for the 34 profiles whose `shelter.sua_tier` is
  // "none" or `homeless_deduction: true` (the same 34-row subset PA's/NJ's/
  // TN's/VI's null-SUA entries already established as real-engine-
  // gradeable); `null` for the other 58 (blocked by the null-SUA
  // composer-level SKIP, same as VI's/PA's/NJ's/TN's shape) — the verdict
  // authored for those 58 (plus the 37 variant rows) is still the best-
  // available correct answer (documentation only, not graded), computed
  // the SAME way as the 34 gradeable rows since BBCE conferral makes
  // verdict independent of the actual SUA dollar amount for the large
  // majority of rows; the small subset where an E/D household's net test
  // genuinely runs (not BBCE-conferred, since grossTestApplies is false
  // for E/D households and bbceConferred is therefore never set) uses WI's
  // own real-SUA-computed result as the best-available documented proxy —
  // disclosed here since HI's own SUA dollar figure remains unconfirmed,
  // though this affects zero actually-graded rows (all such rows are
  // forced SKIP by the null-SUA gate regardless of what's authored).
  //
  // Verification: `/profile-simulation state=HI` — 34 PASS / 0 FAIL / 95
  // SKIP (of 129: 92 base + 37 variant), matching PA's/NJ's/TN's/VI's exact
  // SKIP-heavy shape. Every other registered jurisdiction's harness run
  // reconfirmed unchanged from its documented baseline; AK and VI
  // specifically double-checked unchanged (129/129 and 34/0/95
  // respectively) since HI's new branches sit directly next to theirs in
  // maxAllotmentFor/minimumBenefitFor/fpl_by_region. `tsc --noEmit -p
  // packages/snap-rules` clean, 354/354 snap-rules tests pass (23 new),
  // 44/47 profile-harness tests pass (3 pre-existing skips). Filed as issue
  // #861 before any of this file's HI-scoped edits, per CLAUDE.md's
  // "Engine-math: file issue first" rule.
  HI: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "HI",
      label: "Hawaii / DHS-BESSD",
      bbce: true,
      bbce_threshold_pct: 200,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: null,
      allotment_tier: "HI",
      drug_felony_ban: "modified",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],

  // ── GUAM (#861) ────────────────────────────────────────────────────────
  // Built alongside HI — see HI's entry above for the shared #861 schema
  // step's own doc-comment. This is the LAST jurisdiction of the original
  // 53-jurisdiction plan scope (docs/plans/snap-rules-50-state-engine-
  // completion.md §5) — completing the entire plan except MN, still
  // blocked on its own separate null-SUA gap (plan doc §6 step 7).
  //
  // Every axis below is TRANSLATED from the already-merged Demeter corpus
  // pack's already-cited findings (packages/demeter-engine/src/states/gu/
  // PROVENANCE.md + supplements.json, built 2026-08-12) into the engine's
  // stricter typed shape, per plan doc §5 step 1, EXCEPT the allotment-
  // table axis (independently re-sourced this build) and the BBCE
  // percentage — the corpus pack EXPLICITLY left this one unresolved
  // ("this pack could NOT independently locate Guam's own specific BBCE
  // gross-income percentage... secondary sources this pack found disagree
  // with each other (one states 165% FPL, another states 200% FPL, neither
  // independently verified against a Guam-specific primary text")).
  //
  // bbce: true — USDA's own SNAP State Options Report, 17th Edition
  // (re-fetched and re-confirmed this build via a working Azure CDN
  // mirror), lists Guam's own reported "BBCE" policy-option selection
  // plainly on its dedicated State Agency Profile page.
  //
  // bbce_threshold_pct: 165 — #861 RESOLVES the corpus's own disclosed
  // 165%-vs-200% ambiguity via a primary source the corpus pack did not
  // reach: USDA FNS's own current, live Broad-Based Categorical
  // Eligibility page (fns.usda.gov/snap/broad-based-categorical-
  // eligibility, mirror fns-prod.azureedge.us/snap/broad-based-
  // categorical-eligibility — the SAME page #858's VI entry and this
  // file's ~45 other BBCE states already cite for this exact axis) lists
  // Guam plainly: "All households," asset limit "No limit on assets,"
  // gross income limit "165%." Independently traced the competing 165%
  // claim's OWN source this build: fetched the secondary aggregator
  // (snapscreener.com) both conflicting web claims trace back to directly
  // — it cites NO primary source at all for its figure, unlike USDA's own
  // official table. Cross-checked USDA's BBCE page's reliability against
  // ~45 other already-registered states' own bbce_threshold_pct/
  // asset_waiver values from the SAME page with zero discrepancies (e.g.
  // New Jersey 185%, Georgia 130% + asset_waiver:false, Indiana $5,000 +
  // asset_waiver:false, Nebraska $25,000 liquid assets + asset_waiver:
  // false, Texas $5,000 + asset_waiver:false — all match this file's
  // already-registered entries exactly) before trusting it to resolve
  // Guam's own genuinely disputed figure. See #861 for the full table.
  //
  // bbce_fpl_basis: "federal_fiscal_year" — USDA's FY2026 COLA memo (the
  // same document sourcing the allotment table below) is captioned
  // "October 1, 2025, to September 30, 2026," the standard FFY framing.
  //
  // asset_waiver: true — confirmed via the SAME USDA BBCE page above
  // ("No limit on assets" for Guam's "All households" tier) — resolves a
  // gap the corpus pack itself did NOT explicitly confirm (its own
  // supplement text discusses the FEDERAL-BASELINE $3,000/$4,500 asset
  // limits, not whether BBCE-conferred GU households get a waiver from
  // them — the corpus's Finding 0 doesn't make this specific claim; #861's
  // BBCE-page fetch is the actual primary confirmation of this axis).
  //
  // sua_by_tier: null — a disclosed gap, same discipline as PA's/NJ's/
  // TN's/MN's/VI's/HI's null entries. USDA's own State Options Report
  // confirms Guam uses "Mandatory SUAs" (a flat allowance, not itemized
  // actual costs) — a STRUCTURE finding — but neither the corpus pack nor
  // this build's independent re-check located Guam's own specific
  // Heating/Cooling Standard Utility Allowance (or any other tier's)
  // dollar figure in any source.
  //
  // allotment_tier: "GU" — Guam is one of USDA's small set of
  // jurisdictions (with Alaska, Hawaii, and the Virgin Islands) using a
  // non-48-contiguous SNAP maximum-allotment table — but, genuinely
  // UNLIKE HI/AK, this elevation applies ONLY to Guam's benefit-
  // calculation figures, NOT its income-eligibility limits (see below) —
  // an asymmetric structure both this build and GU's own corpus pack
  // independently found and treat as the flagship finding for this
  // jurisdiction. #861 independently re-sourced the exact current figures
  // directly from USDA FNS's own FY2026 SNAP Cost-of-Living Adjustments
  // memorandum (the SAME primary document #858/#860 sourced VI's table
  // from, and this build sourced HI's from) — GU's real table is ~47%
  // higher than the 48-contiguous table at every household size (GU
  // $439/$806/$1,157/$1,465/$1,743/$2,095/$2,315/$2,637, +$322/additional
  // vs. federal-tables.ts's FY26 $298/$546/$785/$994/$1,183/$1,421/
  // $1,571/$1,789, +$218/additional), plus a real $35 minimum allotment
  // (vs. the federal $24 default) — both now carried in packages/
  // snap-rules/src/constants/gu-allotment-table.ts, wired through
  // federal-tables.ts's maxAllotmentFor/minimumBenefitFor via new
  // state==="GU" branches (#861). The corpus pack's own "income-and-
  // benefit-cola" finding, sourced from the SAME USDA memo, independently
  // corroborated this figure (HH4 $1,465) before this build re-fetched and
  // re-verified the full HH1-8 table directly.
  //
  // CONFIRMED: GU's income-ELIGIBILITY guideline is NOT elevated — the
  // SAME USDA FY2026 COLA memo groups "48 States, D.C., Guam, Virgin
  // Islands" into ONE shared Net/Gross Income Eligibility Standards
  // column, identical dollar figures at every household size. No
  // `fpl_by_region` entry exists for GU as a result — `fplRegionForState`
  // in federal-tables.ts only special-cases AK and HI; GU correctly falls
  // through to the `contiguous` table already, same as VI. GU's corpus
  // pack independently found and flagged this exact asymmetry as its own
  // flagship finding, corroborating rather than merely restating this
  // build's own primary-source read of the same memo.
  //
  // What this does NOT fix (disclosed, matching #858's own VI framing):
  // GU's own table also carries a higher Standard Deduction ($420 sizes
  // 1-3, $445 size 4, $522 size 5, $598 size 6+ vs. federal FY26's
  // $209/$223/$261/$299) and a higher Maximum Excess Shelter Deduction
  // ($873 vs. federal FY26's $744). `standardDeductionFor()`/
  // `shelterCapFor()` have no per-state override slot at all — extending
  // them is a separate, larger schema change out of scope for #861. Both
  // gaps work in the household's favor if left unfixed.
  //
  // drug_felony_ban: "modified" — USDA's own SNAP State Options Report
  // (17th Edition) lists Guam's own reported policy selection plainly as
  // "Modified disqualification" on its State Agency Profile page. Disclosed
  // gap the corpus pack itself flagged: it could not locate Guam's own
  // enabling statute defining the EXACT modification terms (attempted a
  // specific referenced bill, Bill No. 20-37, which 404'd) and explicitly
  // declined to repeat either of two mutually contradictory secondary-
  // source claims it found (one describing a full opt-out, another
  // describing a full lifetime ban) — neither traces to a primary
  // Guam-authored legal text. Does not affect the "modified" classification
  // either way (per #805, only "full" ever gates, and USDA's own
  // characterization is the most authoritative primary source located).
  //
  // abawd_waiver_avail: false — a disclosed judgment call resolving a
  // genuine tension the corpus pack itself flagged rather than silently
  // picking a side: USDA's SNAP State Options Report (17th Edition, data
  // reference period October 2024) shows Guam holding a "Statewide ABAWD
  // time limit waiver" as of that reference period — but Guam DPHSS's own
  // LIVE, LATER-DATED "SNAP FAQ_001" press release (January 23, 2026)
  // describes ACTIVE post-OBBBA work-requirement enforcement effective
  // 1/1/2026 with a real termination consequence for non-compliance, and
  // makes NO mention of any current area waiver. Chose DPHSS's own live,
  // later-dated enforcement FAQ as authoritative for CURRENT status over
  // the stale October-2024 federal snapshot — the SAME "new work rules now
  // apply supersedes an older positive federal report" reasoning #858's VI
  // entry used for its own identical tension (VI's SOR entry vs. VI DHS's
  // own live OBBBA materials). The corpus pack itself flags this reading
  // as likely-but-not-certain (it could not locate a document stating in
  // so many words that the prior waiver was formally ended) — disclosed
  // here rather than presented as settled.
  //
  // rmp_operated: false — Guam Legislature Bill No. 78-38 (COR), the
  // "Meals for At-Risk Households Act of 2025," which would establish a
  // Restaurant Meals Program for Guam, remains in SESSION status with no
  // Public Law number (confirmed via the corpus pack's direct fetch of the
  // Legislature's own bill-tracking page) — a genuinely live pending item,
  // not enacted. `false` is correct today; re-verify if this bill passes.
  //
  // ── Oracle (#636 methodology) ────────────────────────────────────────
  // GU's closest structural axis-twin among already-registered states is
  // IL: identical bbce_threshold_pct (165), asset_waiver (true),
  // abawd_waiver_avail (false) — a FUNCTIONALLY exact match despite IL's
  // drug_felony_ban being "none" rather than GU's "modified," since #805's
  // gate only distinguishes "full" from everything else ("none" and
  // "modified" behave identically — both fail open). Built a fresh,
  // independent Python calculator (not derived from engine output)
  // directly from verdict.ts/benefit-calc.ts/gates/{income-tests,
  // asset-test,abawd,student,composition,immigration,disqualifications,
  // categorical}.ts/facts.ts/constants/federal-tables.ts's own read logic,
  // mirroring every gate and the benefit-calc formula exactly (same
  // calculator built for HI's entry, parameterized per-state — see HI's
  // entry above for the shared cross-validation: reproduced WI's AND IL's
  // own already-graded, FULLY REAL 129/129-row oracles, both verdict AND
  // benefit, 0 mismatches, before trusting the calculator for either HI or
  // GU).
  //
  // Applied GU's own params to all 92 base + 37 variant rows: GU's verdict
  // set is IDENTICAL to IL's at EVERY one of the 129 rows (0 diffs) — the
  // expected result given GU's income-eligibility limits are confirmed
  // flat/unelevated (same contiguous FPL table as IL) and every other
  // verdict-relevant axis matches functionally. Only the BENEFIT dollar
  // amounts differ (GU's elevated allotment_tier vs. IL's federal "48").
  //
  // Checked all 37 rows across the 18 non-`expected_by_state` variant
  // profiles: all 18 variant profiles' BASE facts use `sua_tier: "HCSUA"`,
  // meaning every row hits GU's null-SUA engine-SKIP regardless of any
  // override — no GU-specific override needed (unlike HI's one P56
  // exception, since GU's fpl_by_region is unelevated, there is no
  // threshold-driven flip possible for GU at all).
  //
  // Authored all 92 `expected_by_state.GU` entries: 77 APPROVE / 15 DENY —
  // the SAME DENY set as IL's own (D01/D08/D10/D03/D04/D05/D06/D07/D09/
  // M12/M19/MX3/MX4/S01/S04), confirming zero divergence from IL.
  // `benefit`: real computed dollar figure for the same 34-row
  // real-engine-gradeable subset PA's/NJ's/TN's/VI's/HI's null-SUA entries
  // already established; `null` for the other 58 base + 37 variant rows
  // (documented best-available verdict authored anyway, using IL's own
  // real-SUA-computed result as the best-available proxy for the small
  // subset where an E/D household's net test genuinely runs and isn't
  // BBCE-conferred-skipped — disclosed here, matching HI's entry above;
  // affects zero actually-graded rows).
  //
  // Verification: `/profile-simulation state=GU` — 34 PASS / 0 FAIL / 95
  // SKIP (of 129: 92 base + 37 variant), matching PA's/NJ's/TN's/VI's/HI's
  // exact SKIP-heavy shape. Every other registered jurisdiction's harness
  // run reconfirmed unchanged from its documented baseline; AK, VI, and HI
  // specifically double-checked unchanged since GU's new branches sit
  // directly next to theirs in maxAllotmentFor/minimumBenefitFor. `tsc
  // --noEmit -p packages/snap-rules` clean, 354/354 snap-rules tests pass
  // (23 new, shared with HI's fix), 44/47 profile-harness tests pass (3
  // pre-existing skips). Filed as issue #861 before any of this file's
  // GU-scoped edits, per CLAUDE.md's "Engine-math: file issue first" rule.
  //
  // This is the LAST jurisdiction of the original 53-jurisdiction plan
  // scope (docs/plans/snap-rules-50-state-engine-completion.md §5/§6) —
  // see that doc's own updated execution log for the full completion
  // note. Only MN remains outside this build's scope, blocked on its own
  // separate, unrelated null-SUA structural gap (plan doc §6 step 7).
  GU: [
    {
      effective_start: new Date(Date.UTC(2020, 0, 1)),
      effective_end: new Date(Date.UTC(2099, 11, 31)),
      state_code: "GU",
      label: "Guam / DPHSS-BES",
      bbce: true,
      bbce_threshold_pct: 165,
      bbce_fpl_basis: "federal_fiscal_year",
      asset_waiver: true,
      sua_by_tier: null,
      allotment_tier: "GU",
      drug_felony_ban: "modified",
      abawd_waiver_avail: false,
      rmp_operated: false,
    },
  ],
};

export class UnknownStateError extends Error {
  constructor(state: string) {
    super(`No StatePolicy loaded for state ${state}. Add it before running determinations.`);
  }
}

// Issue #806: the date-lookup counterpart to federal-tables.ts's
// NoTableForDateError — distinct from UnknownStateError (the state has no
// StatePolicy AT ALL) because this case means the state IS registered but
// no snapshot covers the requested date, which should never happen today
// (every state's placeholder range is 2020-2099) but will once a state
// gains a second, narrower-dated entry.
export class NoStatePolicyForDateError extends Error {
  constructor(state: string, asOf: Date) {
    super(
      `No StatePolicy snapshot for ${state} covers ${asOf.toISOString().slice(0, 10)}. Add a dated entry for that period before running determinations.`,
    );
  }
}

export function statePolicyFor(state: string, asOf: Date): StatePolicy {
  const snapshots = STATES[state];
  if (!snapshots) throw new UnknownStateError(state);
  for (const s of snapshots) {
    if (asOf >= s.effective_start && asOf <= s.effective_end) return s;
  }
  throw new NoStatePolicyForDateError(state, asOf);
}
