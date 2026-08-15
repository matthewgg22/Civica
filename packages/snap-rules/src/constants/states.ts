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
export type AllotmentTier = "48" | "AK";

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
