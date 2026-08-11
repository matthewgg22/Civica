# Michigan pack — provenance

**Created:** 2026-08-11 (Wave 2, per `docs/plans/mae-state-corpus-framework.md` — Michigan taken
ahead of the framework's original Wave-2 order because it is the cheapest reliable fetch in the
remaining roster and directly demonstrates the table-not-rule-text SUA pattern the #619 states
(FL/IL/PA/OH) got stuck on).
**Method:** direct fetch of ~35 BEM/BAM/RFT PDFs + the BPG Glossary from `dhhs.michigan.gov/OLMWEB`
(stable per-document URLs, plain curl, text-layer PDFs — no headless browser or Wayback fallback
needed anywhere in this pack) plus MCL 400.10b from `legislature.mi.gov`, then drafted directly
from the fetched text with page-level citations, then adversarially fact-checked before PR.

## Why Michigan matters to the schema
- **The cleanest table-not-rule-text SUA case in the roster so far.** BEM 554 (the rule) contains
  zero dollar amounts; RFT 255 (the annual Reference Table Bulletin, RFB 2025-006, eff. 10/1/2025)
  is the sole dollar source — exactly the pattern that blocked FL/IL/PA/OH in #619, on a state
  where the table fetch is trivial.
- **A third distinct BBCE-conferral mechanism.** Georgia uses a TANF-funded information/referral
  service (TCOS); Michigan uses an "enhanced authorization for Domestic Violence Prevention
  Services" — structurally identical (a universally-available non-cash TANF service unlocks a
  200% income screen with FULL asset-test exemption, not just income relief) but a different named
  vehicle. Confirms the pattern generalizes rather than being GA-specific.
- **A second combined-application-project path** (MiCAP) alongside the standard application —
  SSI recipients get FAP through a centralized unit via a simplified form, structurally distinct
  from the general categorical-eligibility conferral.
- **A negative finding on drug-felony bans, stated with the hedge it deserves.** BEM 203's
  disqualification list is exhaustive (fleeing felon, probation/parole violator, IPV, duplicate
  receipt) and contains no drug-felony-conviction category; MCL 400.10b's felony bar is
  warrant-based, not conviction-based, and explicitly carves OUT controlled-substance warrants
  from the FAP bar. This is corroborating, not conclusive, evidence of no standalone drug-felony
  ban — the supplement text says so explicitly and this pack does not set an engine-side
  `drug_felony_ban` boolean (that's `packages/snap-rules`, parked; see companion issue).
- **Cross-state contrasts now live:** child support is a DEDUCTION here (same as GA; NY: exclusion)
  but MI additionally dropped OCS cooperation as a FAP condition (10/1/2024) — WA/GA/TX/NY/CA don't
  carry that fact; RMP is statewide by household composition (contrast IL's Cook/Franklin-county-only
  program flagged in #619); the TLFA clock (1/1/25–12/31/27) doesn't align with GA's (12/1/23–11/30/26)
  or WA's (1/1/24–12/31/26), reconfirming the framework's #5 rule that ABAWD clocks never share logic
  across states.

## Sources

| Source | Access | Dated |
|---|---|---|
| Bridges Eligibility Manual (BEM) 203, 212, 213, 225, 245, 255, 400, 403, 406, 500, 501, 503, 505, 550, 554, 556, 615, 617, 618, 619, 620, 708 | **plain curl** — `dhhs.michigan.gov/OLMWEB/EX/BP/Public/BEM/<NNN>.pdf`, HTTP 200 on every document fetched, text-layer PDFs | per-document header: BPB bulletin number + effective date |
| Bridges Administrative Manual (BAM) 105, 110, 115, 116, 117, 119, 130, 200, 210, 220, 400, 401E, 502, 600 | plain curl — same host, `.../BAM/<NNN>.pdf` | per-document BPB stamp |
| Reference Tables Manual (RFT) 250, 255, 260, 262 | plain curl — `.../RF/Public/RFT/<NNN>.pdf` | per-document RFB bulletin stamp; current cycle RFB 2025-006, eff. 10/1/2025 |
| Bridges Policy Glossary (BPG) | plain curl — `.../BP/Public/BPG/GLOSSARY.pdf` | BPB 2026-014, eff. 5/1/2026 |
| MCL 400.10b, Social Welfare Act 280 of 1939 | plain curl (User-Agent set; served fine without it too) — `legislature.mi.gov/documents/mcl/pdf/mcl-400-10b.pdf` | statute text, rendered 7/21/2026, current through PA 20 of 2026 |
| FNS BBCE chart (June 2026) | corroboration only — confirms MI's 200% BBCE line; the manual is authoritative on the DVPS mechanism, which the chart does not describe | self-dated |

## Findings a maintainer must know

1. **The whole manual set is plain-curl-fetchable at a predictable URL shape.** No 403s, no
   redirects requiring browser headers, no Wayback fallback needed anywhere in ~35 documents.
   `dhhs.michigan.gov/OLMWEB/EX/{BP,RF}/Public/{BEM,BAM,RFT,BPG}/<code>.pdf` — this is the cheapest
   fetch surface confirmed in the roster to date.
2. **RFT 255 does not use the three-tier HCSUA/LUA/telephone shape our other packs assume.**
   Michigan publishes SEVEN individually-priced standards (H/U $682, non-heat electric $181,
   water/sewer $119, telephone $31, cooking fuel $33, trash $30, homeless-shelter $199) that a
   group can combine (multiple non-H/U standards stack) or that substitute for each other (H/U
   preempts everything else). A schema assuming exactly three tiers would silently drop cooking
   fuel and trash/garbage.
3. **An SDV group can get the mandatory H/U standard even with heat included in rent**, via a
   LIHEAP or Home Heating Credit payment over $20 in the current or prior 12 months (BEM 554) —
   but this bypass is explicitly SDV-restricted ('SNAP SDV groups whose heat is included in their
   rent may still qualify'), NOT available to a non-SDV group in the same situation. Caught and
   corrected during this pack's own adversarial pass, since the first draft over-generalized the
   bypass to any group — worth flagging for a future maintainer as the easiest sentence in BEM 554
   to misread.
4. **MI's felony bar is warrant-based, and explicitly NOT drug-conviction-based for FAP.**
   MCL 400.10b(1) bars FAP for an outstanding felony warrant with active law-enforcement pursuit —
   then carves OUT warrants for controlled-substance violations (part 74 of the public health code)
   from that exact bar. Read quickly, this section could be mistaken for evidence of a drug-felony
   ban; it is closer to the opposite.
5. **MiCAP is a second, narrower categorical-eligibility-adjacent path** (SSI recipients only, its
   own application form DHS-513, its own 36-month benefit period, ineligible for simplified
   reporting) — a maintainer extending the income-pathways supplement should not merge it into the
   DVPS-conferred 200% path; they are structurally distinct routes to eligibility.
6. **20% earned-income deduction is stated only as a worksheet instruction** ("Enter 80 percent of
   the amount on line 3," BEM 556), never spelled out as "20% earned income deduction" in prose —
   worth knowing if a future automated diff tries to grep for the phrase and comes up empty.
7. **BPG Glossary is the primary source for two load-bearing definitions** (SDV member, DVPS
   categorical eligibility) that don't appear spelled out anywhere in BEM 213 itself — a
   maintainer chasing "what does SDV mean" needs the glossary PDF, not just the eligibility manual.

## Refresh triggers
- **Oct 2026 RFB cycle** → successor to RFB 2025-006 (RFT 250/255/260) — freshness entry.
- **Dec 31, 2027** → TLFA fixed window rolls; new window Jan 1, 2028 — freshness entry.
- **Dec 1, 2026** (annual-ish cadence observed) → re-verify BEM 620's waived-county/city list against
  the current FNS ABAWD waiver file — freshness entry.
- New BPB bulletins touching BEM 213/400/554/620 or RFB bulletins touching RFT 250/255/260 →
  update the affected supplement (bulletin cover stamps are printed on every page, diffable by
  re-fetching the same URL).

## Verification log
- **Draft-time source discipline:** every dollar figure in this pack traces to its own RFT PDF page
  (RFT 250/255/260, all RFB 2025-006), never to a curated secondary extract or to BEM rule text
  (which the source itself confirms carries no dollar amounts). Every eligibility-mechanics claim
  traces to a specific BEM/BAM section fetched directly, quoted where feasible.
- **Adversarial refute pass (2026-08-11, self-conducted — re-read every claim against the original
  fetched PDF text, checking for overgeneralization, wrong attribution, and internal
  inconsistency):** 4 corrections found and applied before merge:
  1. **sua-values overgeneralized the LIHEAP/Home Heating Credit bypass.** First draft said any
     group with heat included in rent could qualify for the H/U standard via a LIHEAP/HHC payment.
     The source restricts this specific path to SDV groups only ('SNAP SDV groups whose heat is
     included in their rent may still qualify for the h/u standard,' BEM 554) — a non-SDV group in
     the same situation does NOT get this bypass. Corrected in both `supplements.json` and this
     file's finding #3.
  2. **sua-values stated the BEM 556 worksheet's H/U-path order backwards.** First draft said
     LIHEAP, then HHC, then the direct-expense path. The worksheet (lines 24-26) actually checks
     the direct heat/cooling expense FIRST, then the SDV-only LIHEAP path, then the SDV-only HHC
     path. Corrected.
  3. **abawd-tlfa's age-exception sentence was internally inconsistent** — it named "the general
     age-60-63 deferral" in one clause and "ages 60-64" in the next clause of the same sentence.
     Source language is "60 to 64" throughout (BEM 620). Corrected to remove the wrong number.
  4. **reporting-and-certification miscited which RFT 250 column the Simplified Reporting limit
     matches.** First draft said SR (column E) equals the 200% categorical column (D). The table
     (RFT 250) shows E is numerically identical to the 130% GROSS column (A) at every group size
     ($1,696 = $1,696 for HH1; $2,610 is a different, larger number) — D and E are NOT the same.
     Corrected; the separate `income-pathways` supplement already stated the correct dollar VALUES,
     only this supplement's characterization of which column they matched was wrong.
  No fabricated facts or invented citations were found; all four corrections were mischaracterizations
  of correctly-fetched source text, not sourcing failures. Structural tests, the retrieval-recall
  probe (15/15), and the frontdoor eval (13/13 MI cases) were re-run clean after each fix.
