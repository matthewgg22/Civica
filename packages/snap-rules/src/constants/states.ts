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
  // SUA (#619): FL, IL, and OH now carry sourced production values — each
  // state publishes its utility standards in an annual table, not the rule
  // text, so the citations below point at that table, not the OAC/rule
  // sections that merely describe the framework. PA's sua_by_tier stays
  // null — a genuine, logged verification gap, see the PA entry's own
  // comment for exactly what was and wasn't found.
  //
  // DRUG FELONY BAN (#619, sourced 2026-08-11): all four now stay `false` for
  // a REASON, not as a default. Two distinct reasons, and the distinction
  // matters to anyone reading the value:
  //   • IL and OH are VERIFIED FULL OPT-OUTS — `false` is the correct answer,
  //     confirmed against primary statute text. Nothing pending.
  //   • FL and PA are MODIFIED bans, which this boolean cannot express. FL
  //     denies only trafficking convictions; PA conditions eligibility on
  //     treatment compliance. Flipping either to `true` would disqualify every
  //     drug-felony household in the state, including the large majority the
  //     statute protects. `false` under-claims a narrow real ban rather than
  //     over-applying it — the #614 RMP discipline, and the direction-of-error
  //     rule in #608: never deny on data the type cannot represent.
  //     A richer type is filed separately; see each state's comment.
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
  FL: {
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
    // Stays false because `true` would deny all drug-felony households, not
    // just the trafficking subset the statute actually excludes.
    drug_felony_ban: false,
    abawd_waiver_avail: true,
    rmp_operated: false,
  },
  // Illinois is BBCE at 165% — the same "BBCE is not a boolean" case as TX.
  //
  // Utility standards: IDHS WAG 13-01-08-b (The Utility Allowance), MR
  // #25.33 (October 2025 SNAP COLA adjustments), effective 09/26/2025.
  // Confirmed live 2026-08-09 at dhs.state.il.us (page.aspx?item=16170).
  // IL's "Single Utility" tier ($78, one non-heat/non-phone utility) has
  // no slot in this engine's {HCSUA, LUA, phone} shape — undermodeled the
  // same way as OH's identically-named tier (see OH's own comment).
  IL: {
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
    drug_felony_ban: false,
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
  PA: {
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
    // `false` regardless: a conditional ban cannot be expressed by this
    // boolean, and `true` would deny every PA drug-felony household outright.
    drug_felony_ban: false,
    abawd_waiver_avail: true,
    rmp_operated: false,
  },
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
  OH: {
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
    drug_felony_ban: false,
    abawd_waiver_avail: true,
    rmp_operated: false,
  },
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
  MI: {
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
    drug_felony_ban: false,
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
  NY: {
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
    // progressive-policy state already in this file (IL, NV, MA all `false`).
    drug_felony_ban: false,
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
  NV: {
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
    drug_felony_ban: false,
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
  AZ: {
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
    // under-claim, not a fail-open default.
    drug_felony_ban: false,
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
  OR: {
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
    drug_felony_ban: false,
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
  WI: {
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
    drug_felony_ban: false,
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
  MN: {
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
    // boolean can't express), MN's `false` is a clean, unconditional finding
    // — the same shape as IL's and NV's entries above.
    drug_felony_ban: false,
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
  // Kansas utility standards — KEESM §7226 (Shelter Costs), rev. 07-26,
  // confirmed live 2026-08-09 at content.dcf.ks.gov/EES/KEESM/Current/keesm7226.htm.
  // Unlike TX/WA (mandatory standards, no election), KEESM does not state
  // households must use the standard over actual costs — treated as the
  // ordinary SNAP default (household may elect either) absent a stated
  // mandatory-standard clause.
  KS: {
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
    drug_felony_ban: false,
    abawd_waiver_avail: false,
    rmp_operated: false,
  },
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
  AK: {
    state_code: "AK",
    label: "Alaska (non-BBCE, higher allotments)",
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
