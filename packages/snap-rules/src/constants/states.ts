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
