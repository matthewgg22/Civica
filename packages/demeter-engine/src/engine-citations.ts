// Mae's grounding in the SAME federal + state authorities the Civica eligibility
// engine uses to compute verdicts and benefit amounts. This keeps Mae's answers
// consistent with what the engine actually does, and makes its citations
// traceable to primary law rather than model-recalled.
//
// PROVENANCE — every citation below is mirrored from the engine's own source,
// which was triple-checked against primary sources (eCFR / FNS / CDSS / Congress)
// on 2026-06-02:
//   • Benefit math + citations:  packages/snap-rules/src/benefit-calc.ts
//   • Verdict gates:             packages/snap-rules/src/verdict.ts + gates/*
//   • Verification / Component R: packages/snap-recommendation/src/candidates.ts
//   • CA state policy:           packages/snap-rules/src/constants/states.ts
//   • Canonical FY26 values:     docs/snap_source_citation_fy26_federal.json
//   • Signoff + verification:    docs/SNAP-source-citation-signoff.md
//                                docs/findings/2026-06-02-snap-source-citation-triple-check.md
//
// CAVEATS Mae must honor (also stated in the prompt):
//   • Dollar figures are FY26 (eff. 2025-10-01 .. 2026-09-30) on the annual USDA
//     FNS COLA cycle — frame them as "as of FY26, confirm the current figure."
//   • The citation set is engineering-verified but NOT yet counsel-signed
//     (0 reviewer signatures on the signoff doc as of 2026-06-02).
//   • The exact FY dollar figures are injected separately from getEngineParams()
//     so they always track the engine; THIS file is the citation/authority layer.
//
// Refresh alongside the engine on each COLA cycle.

import { getEngineParams } from "@civica/snap-rules";

export const MAE_CITATIONS_PROVENANCE =
  "The citations below mirror the Civica eligibility engine's own source, " +
  "engineering-verified against eCFR / USDA FNS / CDSS / Congress.gov primary " +
  "sources on 2026-06-02. They are not yet counsel-signed. Dollar figures are " +
  "FY26 (Oct 1, 2025 - Sep 30, 2026) and change on the annual COLA cycle.";

/**
 * The rule → authority map the engine evaluates with, in engine order. Mae cites
 * these so its answers match the engine's basis. Percentage/fixed rules that ARE
 * the law (20% EID, 30% benefit reduction, 50% shelter threshold, $35 medical
 * floor, FPL multipliers) are included; the FY dollar tables are injected live.
 */
export const MAE_ENGINE_CITATIONS = `## Authorities the Civica engine uses (cite these)

The engine computes a verdict then a benefit amount. It cites federal law as 7 CFR Part 273 (and 272), federal statute as the Food and Nutrition Act (FNA) and OBBBA (Pub. L. No. 119-21), and California rules as CDSS All-County Letters (ACL) / All-County Information Notices (ACIN). Match these when you answer.

### Verdict (eligibility gates, in order)
- Household composition — 7 CFR 273.1
- Disqualifications — IPV 7 CFR 273.16; fleeing felon 7 CFR 273.11(n); state-option drug felony 7 CFR 273.11(m); substantial lottery/gambling winnings 7 CFR 273.11(r) (state data-match procedure 7 CFR 272.17)
- Student eligibility — 7 CFR 273.5
- Immigration / non-citizen eligibility — 7 CFR 273.4; FNA § 6(f); OBBBA § 10108
- ABAWD work requirement — 7 CFR 273.24, as amended by OBBBA § 10102
- Gross income test (130% FPL; skipped for categorically eligible and elderly/disabled) — 7 CFR 273.9(a)(1)
- Net income test (100% FPL, after the deduction stack) — 7 CFR 273.9(a)(2)
- Asset/resource test (waived under BBCE / broad-based categorical eligibility) — 7 CFR 273.8
- Categorical eligibility / BBCE — 7 CFR 273.2(j); in California, BBCE raises the gross-income test to 200% FPL per CDSS ACIN I-46-25 (FFY2026)
- Mixed-status households use the eligible-only household size for size, income, and allotment — 7 CFR 273.11(c)(1)

### Benefit calculation — 7 CFR 273.10
- Earned income deduction = 20% of earned income — 7 CFR 273.9(d)(2)
- Standard deduction (by household size) — 7 CFR 273.9(d)(1)
- Medical deduction = unreimbursed medical over $35, elderly/disabled members only — 7 CFR 273.9(d)(3)
- Dependent-care and legally-owed child-support deductions — 7 CFR 273.9(d)(4),(5)
- Excess shelter deduction = shelter costs (rent + utility SUA + internet) minus 50% of adjusted income; capped for households WITHOUT an elderly/disabled member, uncapped with one — 7 CFR 273.9(d)(6)
- Homeless households may take the homeless shelter deduction in lieu of actual shelter — 7 CFR 273.9(d)(6)(i)
- Benefit = max allotment − 30% of net income (rounded) — 7 CFR 273.10(e)(2)(ii)(A)
- Minimum benefit for 1-2 person households — 7 CFR 273.10(e)(2)(ii)(C)
- OBBBA § 10104 excludes internet/telecommunication costs from the shelter deduction (effective-date question is open — confirm county practice)

### Verification & recommendations (the engine's Component R)
- Verification hierarchy (4 steps: document → collateral → home visit, per the regulatory order) — 7 CFR 273.2(f)
- Income verification — 7 CFR 273.9(b)(1); 7 CFR 273.2(f)
- Expedited service (apply within 7 days when income/resources are very low) — 7 CFR 273.2(i)
- Quality control sampling basis — 7 CFR 275.12

### Procedural (caseworker-facing)
- Residency — 7 CFR 273.3
- Social Security number requirement — 7 CFR 273.6
- Work provisions: registration, Employment & Training, voluntary quit (distinct from the ABAWD time limit at 273.24) — 7 CFR 273.7
- Reporting requirements / change reporting — 7 CFR 273.12
- Notice of adverse action — 7 CFR 273.13
- Recertification — 7 CFR 273.14
- Fair hearings (appeals; aid paid pending) — 7 CFR 273.15
- Restoration of lost benefits (underissuances) — 7 CFR 273.17

### California specifics
- Standard Utility Allowance (SUA) — CDSS ACL 25-68 (FY26 chart)
- BBCE income standard (200% FPL) — CDSS ACIN I-46-25 (FFY2026)
- Restaurant Meals Program (RMP) is a statewide mandate (AB 942, eff. 2019) — every CA county operates it
- ABAWD time limits: California time limits RESUMED 2026-06-01 (CDSS ACL 25-93). Only a small set of counties hold a waiver through 2026-10-31. The engine cannot tell you whether a SPECIFIC county is waived this month — always have the caseworker confirm current county ABAWD waiver status before relying on it.

### OBBBA (Pub. L. No. 119-21, enacted 2025-07-04) — key changes
- ABAWD age band is 18-64 (§ 10102 / FNS implementation)
- ABAWD exemption covers "Indian, Urban Indian, or California Indian" per the Indian Health Care Improvement Act — broader than ANCSA; removed exemptions for homeless, veterans, foster youth ≤24, and parents of children over 13 (FNS ABAWD Exceptions memo, 2025-10-03)
- Non-citizen eligibility narrowed (§ 10108): eligible groups now U.S. nationals, LPRs, Cuban/Haitian entrants, and COFA migrants; refugees, asylees, and TPS holders removed (FNS Alien Eligibility memo, 2025-10-31)`;

/**
 * Render the LIVE FY figures the engine actually computes with, for one state, so
 * Mae quotes the same numbers as the determination. Pulled from getEngineParams()
 * at request time, so it tracks the engine across COLA updates. Deterministic
 * output (sorted sizes) so the cached system prefix stays byte-stable within a FY.
 */
/** Throws (UnknownStateError from snap-rules) when the engine has no policy
 *  for `state`. Callers decide what to say about that — see buildMaeSystem.
 *
 *  `state` is a plain string, not a "CA" | "MA" union: getEngineParams takes a
 *  string and works for every state snap-rules has authored. The old narrow
 *  union was written when only CA and MA existed and silently froze this at
 *  two states while the engine grew to eleven. */
export function formatEngineParams(state: string, asOf: Date): string {
  const p = getEngineParams(state, asOf);
  const row = (rec: Record<string, number> | undefined) =>
    rec
      ? Object.keys(rec)
          .map(Number)
          .sort((a, b) => a - b)
          .map((n) => `HH${n} $${rec[String(n)]}`)
          .join(", ")
      : "n/a";

  const lines: string[] = [];
  lines.push(`## Live engine parameters — ${state}, current federal fiscal year`);
  lines.push(
    "These are the exact figures the engine uses right now. Quote them as the engine's current values, and remind the caseworker they renew on the Oct 1 COLA cycle.",
  );
  if (p.max_allotment) lines.push(`- Maximum monthly allotment: ${row(p.max_allotment)}`);
  if (p.sd) lines.push(`- Standard deduction (by HH size): ${row(p.sd)}`);
  if (p.shelter_cap !== undefined) lines.push(`- Excess shelter cap (no elderly/disabled member): $${p.shelter_cap}`);
  if (p.homeless_ded !== undefined) lines.push(`- Homeless shelter deduction: $${p.homeless_ded}`);
  if (p.min_benefit !== undefined) lines.push(`- Minimum benefit (HH 1-2): $${p.min_benefit}`);
  if (p.asset_limit !== undefined) lines.push(`- Asset limit (standard): $${p.asset_limit}`);
  if (p.asset_limit_ed !== undefined) lines.push(`- Asset limit (elderly/disabled household): $${p.asset_limit_ed}`);
  if (p.fpl) {
    // Printed as dollars so answers QUOTE the operative thresholds instead of
    // deriving them — a derived figure is invisible-wrong in EN and trips the
    // ES numeric-equivalence gate into a degrade (live eval, es-pii-deflection).
    // The base comes from fplMonthly via getEngineParams, the same helper the
    // income gates compare against, so these agree with a determination and
    // with CDSS ACIN I-46-25 (fixed in #601).
    const scaled = (pct: number): Record<string, number> =>
      Object.fromEntries(
        Object.entries(p.fpl as Record<string, number>).map(([k, v]) => [
          k,
          Math.round((v * pct) / 100),
        ]),
      );
    // BBCE threshold is per-state. This map is DUPLICATED from snap-rules'
    // `bbce_threshold_pct` (constants/states.ts) because statePolicyFor is not
    // exported from that package's public entry, so there is no way to read it
    // — see the issue linked below for deleting this in favour of the engine's
    // own value.
    //
    // Every value here was read from states.ts, not recalled. The narrow key
    // type is a deliberate TRIPWIRE, kept: adding a state without adding its
    // real percentage fails the typecheck instead of printing 200% for a state
    // that never adopted it. That tripwire has already caught this once (the
    // hardcoded-200-for-TX bug) and caught it again when this file was widened
    // from CA/MA to every state with authored math.
    // IL: 165 mirrors snap-rules' bbce_threshold_pct, which (like GA's 130%
    // all-adult-E/D sub-screen) only encodes the GENERAL screen — IL's real
    // 200% screen for households with an elderly/disabled "Qualifying
    // Member" is not yet modelled here either. Same accepted limitation as
    // GA's; the full two-tier picture lives in the IL corpus pack's own
    // income-pathways supplement, which retrieval also surfaces.
    // NV: 200 is a genuine flat screen (not tiered like IL/GA) — Nevada's
    // Expanded Categorical Eligibility applies the SAME 200% FPL gross test
    // to every household, conferred via the "This Is Your Copy" TANF-brochure
    // page every applicant already receives (E&P MS A-180.2).
    // AZ: 200 is a genuine flat screen, no tiering — Arizona's Expanded
    // Categorical Eligibility applies the SAME 200% FPL gross test to every
    // household, and unlike several other states' TANF-info-brochure
    // conferral pathway (see the AZ corpus pack's income-pathways
    // supplement), there is no conferring document at all — it is a pure
    // income comparison (CNAP FAA5.I.01.B).
    // OR: 200 is a genuine flat screen — Oregon's Broad-Based Categorical
    // Eligibility applies the SAME 200% FPL gross test to every household,
    // conferred via the "Information and Referral Services" pamphlet every
    // applicant already receives (OAR 461-135-0505(2)(a)(C)), the same
    // conferral-vehicle family as NV's TANF brochure.
    // WI: 200 mirrors snap-rules' bbce_threshold_pct for standard households,
    // conferred via a "Job Center of Wisconsin" services notice (FSH 4.2.1) —
    // the same conferral-vehicle family as NV/OR. WI's EBD households with
    // gross income OVER 200% get an even more generous pathway (NO gross
    // limit at all, only a 100% net test) not modelled here — same accepted
    // limitation as IL's and GA's asymmetric-tier gaps; the full picture
    // lives in the WI corpus pack's own income-pathways supplement.
    // MN: 200 mirrors snap-rules' bbce_threshold_pct, conferred via a
    // Domestic Violence Information Brochure (CM 0013.06) — a distinct
    // conferral document from every other state's TANF/services-notice
    // pathway. MN's BBCE also exempts units from the NET income test (not
    // just the asset test), and its own EBD-over-200% exception (no gross
    // limit at all) is not modelled here — same accepted limitation as
    // WI's; the full picture lives in the MN corpus pack's income-pathways
    // supplement.
    // PA: 200 is a genuine flat screen — Pennsylvania calls it "Expanded
    // Categorical Eligibility" and confers it via the PUB 567 brochure,
    // "Help for Pennsylvanians in Need" (PAH 512.1). Unlike GA/IL/WI's
    // tiered structure, PA applies the SAME 200% FPL gross test to every
    // household regardless of elderly/disabled status, and — like MN —
    // households under this screen face NO resource limit at all (not
    // merely a waived asset test); the full picture, including the
    // narrower 130%/$3,000 and 100%-net/$4,500 tiers that apply only to
    // disqualified/sanctioned households, lives in the PA corpus pack's
    // own income-pathways and asset-rule supplements.
    // OH: 130 mirrors snap-rules' bbce_threshold_pct as-is — this is a
    // DISCLOSED, UNRESOLVED DISCREPANCY, not a confirmed value like the
    // other entries above. The OH corpus pack's own primary-source read of
    // OAC 5101:4-2-02 found a genuine 200% FPL broad-based pathway ("Ohio
    // careline" — a routine notice-plus-text-message TANF-funded service,
    // the same conferral-vehicle family as NV/OR/WI/MN/GA/PA above) that
    // waives the 130% gross test, net income test, AND resource limit —
    // structurally the SAME shape as this file's other 200%-flat-screen
    // entries, not GA's asset-only 130% pattern the states.ts comment
    // claims OH matches. This file mirrors snap-rules' constant by design
    // (see the note above the map) and packages/snap-rules is out of
    // scope for corpus-only work, so the value here stays 130 pending a
    // human decision — see the OH corpus pack's PROVENANCE.md ("BBCE
    // threshold: states.ts says 130%; this pack found a genuine 200% FPL
    // pathway") for the full writeup. Do not treat 130 as independently
    // re-confirmed by this comment.
    const BBCE_PCT = {
      CA: 200,
      MA: 200,
      TX: 165,
      WA: 200,
      GA: 130,
      MI: 200,
      IL: 165,
      FL: 200,
      NV: 200,
      AZ: 200,
      OR: 200,
      OH: 130,
      WI: 200,
      MN: 200,
      PA: 200,
    } as const;
    const bbcePct: number | undefined = (BBCE_PCT as Record<string, number>)[state];
    lines.push(`- 100% FPL, monthly (net-income test basis): ${row(p.fpl)}`);
    lines.push(`- Gross-income limit, 130% FPL (federal test): ${row(scaled(130))}`);
    if (bbcePct === undefined) {
      // Unknown percentage: say nothing rather than guess. Silence costs one
      // line of context; a wrong screen costs someone their eligibility.
      lines.push(
        `- BBCE categorical-eligibility screen for ${state}: not encoded here — do not state a ${state} BBCE percentage; cite the state's own issuance.`,
      );
    } else if (bbcePct <= 130) {
      // GA is 130 — identical to the federal gross test, i.e. its BBCE confers
      // ASSET relief and no income relief. Printing it as "the operative
      // screen" without that context reads as a higher limit than it is.
      lines.push(
        `- ${state} BBCE gross screen is ${bbcePct}% FPL — the SAME as the federal gross test above, so BBCE gives ${state} households asset-test relief, NOT a higher income limit. Do not describe it as raising the income limit.`,
      );
    } else {
      lines.push(
        `- BBCE categorical-eligibility gross screen, ${bbcePct}% FPL (the operative ${state} test${state === "CA" ? ", ACIN I-46-25" : ""}): ${row(scaled(bbcePct))}`,
      );
    }
  }
  if (p.sua) {
    lines.push(
      `- Standard Utility Allowance tiers: HCSUA $${p.sua.HCSUA}, LUA $${p.sua.LUA}, phone-only $${p.sua.phone}`,
    );
  }
  return lines.join("\n");
}
