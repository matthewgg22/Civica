# LA DPSS PRA Request No. 6 — ABAWD/OBBBA correspondence findings

**Date:** 2026-08-15
**Source:** LA County Counsel's final response to Matthew's May 26, 2026 CPRA request (`HOA.106063718.1`), Request No. 6 — "final written communications between DPSS and CDSS, CWDA, other counties, or the LA County Board of Supervisors since July 1, 2025 concerning (a) OBBBA §10102 implementation readiness, (b) ABAWD waiver designation consideration under 7 CFR 273.24(f), or (c) county operational concerns about the June 1, 2026 effective date." This was the last of 7 requests to be produced — earlier requests (1,2,3,7 → 7/14/26; 4,5 → 7/30/26) already landed and are tracked in `project_pra_productions_2026_07_23` auto-memory.
**Production:** 404 Bates-stamped pages, `COLA002132`–`COLA002535`.
**Method:** The PDF has a font-encoding issue that renders as garbled glyphs in some tools (confirmed readable normally in the user's own PDF viewer) — `pdftotext -layout` extracted clean text for all 404 pages. 4 parallel agents each read a full ~2,500-line slice, cross-referenced against the SNAP edge-case taxonomy from the same conversation, and flagged unresolved/pending items. Every claim below traces to a Bates-stamped quote one of those agents actually read.

**What's actually in the production:** not raw email chains (as initially expected) but the county's own primary policy artifacts — CDSS All County Letters (ACL 25-50, 25-93, 25-93E, 26-25, 26-26, 26-29), the CalFresh ABAWD Time Limit Handbook v3.0, FNS waiver-approval/rescission letters, CF-notice/CF-886/CF-377.11 form templates, and DPSS/CDSS internal training decks (including a Nov 2025 "H.R. 1 CalFresh Implementation Advisory Group" deck). This is richer than raw correspondence would have been — it's the state's actual operative guidance, not just discussion about it.

---

## General overview: what's actually in the 404 pages

A rough chronological document index, reconstructed from the four agents' reports plus a direct read of the FNS letter (the one exhibit legible without `pdftotext`). Bates ranges are approximate — documents don't always start/end on a stamp boundary the agents called out explicitly.

| Document | Date | Approx. Bates range |
|---|---|---|
| FNS → CDSS: ABAWD waiver rescission/reissue (2yr→1yr) | ~Feb 2026 | COLA002133–36 |
| CDSS ACL No. 25-93 — ABAWD dependent-child exemption, original | Dec 31, 2025 | COLA002140s–2190s |
| CDSS ACL No. 25-93E — errata narrowing the above | April 1, 2026 | COLA002160s |
| FNS → CDSS: approval of a waiver modification (4 additional counties) | Feb 10, 2026 | COLA002190–94 |
| CDSS ACL No. 26-26 — revised CalFresh Work Rules Oral Script | April 10, 2026 | COLA002195–202 |
| CDSS ACL No. 26-29 — **CalFresh ABAWD Time Limit Handbook v3.0** (the largest single document — work registration, exemptions, workfare, ESAP, discretionary exemptions, noticing) | April 15, 2026 | COLA002203–~2340s |
| CDSS ACL No. 25-50 — general HR1/OBBBA impact notice, covering ALL of §§10102–10108 (not just ABAWD) | July 14, 2025 (same day HR1 was signed) | ~COLA002270–2290 |
| DPSS internal "Federal and State Changes to DPSS Programs" briefing deck | undated, ~2025–26 | COLA002467–2489 |
| "CalFresh ABAWD/Work and Community Engagement" eligibility-worker training deck | undated | COLA002346–2466 |
| CDSS "H.R. 1 CalFresh Implementation Advisory Group" meeting deck | Nov 2025 | COLA002490–2535 |
| "ABAWD Work and Community Engagement Webinar" deck | May 5, 2026 | tail of the 5151–7700 range |

**The genuinely important structural finding: this is almost entirely CDSS's statewide broadcast guidance, not LA-specific correspondence.** Targeted searches across the full text for `"Board of Supervisors"` and `"CWDA"` — both explicitly named in the request itself ("communications between DPSS and CDSS, CWDA, other counties, or the LA County Board of Supervisors") — return **zero hits, in all 404 pages.** `"Los Angeles County"` itself appears only twice (same content, duplicated), and it's not deliberative correspondence — it's a list of LA-specific outreach partners in an ACL-adjacent slide (COLA002285, COLA002471): Department of Health Services, the CEO's Center for Strategic Partnerships, LA County Library, City of LA's Community Investment for Families Department, Department of Economic Opportunity, Imagine LA, and LA County of Education (LACOE). That's the entire LA-specific content found by targeted search — everything else is generic-to-every-county CDSS material that would look identical in a production to any other county in the state.

This doesn't necessarily mean nothing else exists — the county's own letter says only that "DPSS has located responsive, disclosable records" (not "all records," and CPRA productions can legitimately withhold deliberative/privileged material without saying so beyond the standard non-waiver boilerplate at the end of the cover letter). But as a factual matter, **the actual internal deliberation, Board-level discussion, or CWDA coordination that Request 6 was written to surface does not appear to be in what was produced.** Worth deciding whether that's worth a follow-up request narrowly scoped to "any record showing DPSS declined to produce, or found none, specific to Board of Supervisors or CWDA communications" — that's a different, sharper question than the original broad request, and CPRA responses sometimes answer a narrow follow-up more directly than a broad initial one.

---

## Cross-reference against the edge-case taxonomy

### 1. Household composition

- **The ABAWD dependent-child-under-14 exemption does NOT require physical/legal custody or even the child living with the exemption-claiming adult — but this was walked back.** ACL 25-93 (Dec 31, 2025), COLA002179/2104-06: "A dependent child under this provision is defined as a child under age 14 who relies on the individual for care or supervision. The child is not required to be included in the CalFresh household, nor is physical or legal custody required." Then **ACL 25-93E errata (April 1, 2026)**, COLA002162/1349-64, narrows this: "the term household strictly means the CalFresh household as defined at 7 CFR 273.1(a) and does not simply mean a group of people residing in the same physical structure" — an adult must now share the SAME CalFresh household as the child (with a 30-day temporary-absence allowance) to claim the exemption, reversing the original broader informal-caregiving language, citing an FNS Handbook 310 update. **Directly bears on the joint/shared-custody edge case**: a non-co-resident parent in a joint-custody arrangement could originally claim this exemption under the Dec 2025 guidance but cannot under the April 2026 correction unless the child is within their own CalFresh household.
- Same "household strictly means CalFresh household, not shared roof" clarification repeated independently at COLA002218/3851-57 and COLA002326/7411-19 — consistent across multiple ACLs, not a one-off.
- **A single dependent child under 14 can exempt more than one adult in the same CalFresh household** (COLA002326/7411-19) — worth noting for multi-adult households.
- **Foster care / former-foster-youth ABAWD exemption eliminated by HR1/OBBBA**, originally set to sunset October 1, 2030 — eliminated immediately on implementation instead (COLA002177/1992-94, COLA002505/9915-18, COLA002531/10226-33).

### 2. Employment volatility

- **Voluntary quit**: 60-day lookback window — sanction applies only if the quit occurred within 60 days prior to application or while receiving CalFresh; does not apply if fired or laid off (COLA002212/3514-30).
- **California-specific good-cause protections** not in generic federal guidance: unpredictable/gig work hours (WIC 18929) qualify for good cause (COLA002212-13/3554-60); a labor-law-rights violation qualifies even without the applicant naming the specific right violated (COLA002213/3560-68).
- **Gig/self-employment income-to-hours conversion methodology**: subtract allowable deductions from gross self-employment income, divide by federal minimum wage, to compute ABAWD-qualifying work hours (COLA002233/4638-49).
- **Involuntary seasonal layoff → discretionary exemption, not a sanction.** Worked training example: an ABAWD "fired because they were no longer needed for the holiday season" should receive a discretionary exemption for having a special circumstance (COLA002370/7972-76); "Seasonally Employed" is a named discretionary-exemption category (COLA002261/6042-47, COLA002368/7941).
- No content found on administrative leave or furlough/shutdown specifically.

### 3. Student/trainee status

- **Half-time enrollment methodology**: determined per-institution in coordination with the CWD — no single federal credit-count threshold (COLA002209-10/3426-34).
- **Below-half-time internships and work-experience programs CAN count toward the 20-hr/week ABAWD requirement** when part of a "Local Program that Increases Employability" (LPIE) (COLA002237-38/4874-78). **ACL 26-25 expanded the LPIE list to include ALL associate and bachelor's degree programs at public institutions**, effective June 1, 2026 (COLA002416/8675-81) — directly relevant to the "trade/vocational vs. academic" edge case, since this materially widens which school programs qualify as work-equivalent.
- **ORR (Office of Refugee Resettlement) training program participation, at least half-time, is its own separate exemption path** — explicitly "not limited to Cuban/Haitian entrants and refugees" (COLA002236/4564-69, COLA002529/10198-203).
- No content found specifically on medical residents or dual-enrollment/high-school seniors.

### 4. Shelter/utility

- **LIHEAP/"Heat and Eat" auto-SUA trigger was narrowed by OBBBA §10103, effective October 31, 2025** — no longer applies to all LIHEAP recipients; now limited to households with an elderly or disabled member, implemented in California as "SUAS" (State Utility Allowance Subsidy) (COLA002277/6673-75, COLA002503/9872-78, COLA002474/9429). **This is a real, dated update** — the broader pre-OBBBA "any LIHEAP payment triggers full HCSUA" rule (which Demeter currently explains correctly per this session's earlier live-conversation audit) is now the SUPERSEDED rule for most households going forward.
- **Basic internet expenses excluded from SUA calculation** (COLA002277/6694, COLA002503/9868-69) — new OBBBA §10104 restriction.
- **Chronic homelessness is explicitly NOT an automatic ABAWD exemption** — must be independently tied to a physical/mental unfitness-to-work finding (COLA002226/4252-58, COLA002522-23/10110-32, COLA002320/7337-48). CDSS's own multi-prong definition: homeless 6+ months, OR homeless more than once in the last year, OR unable to meet basic needs (shelter, heating/cooling, electricity, water, food, clothing).
- **Homelessness's own exemption category (separate from the unfitness pathway) was eliminated by HR1**, alongside veteran and foster-youth exemptions (COLA002143/468-69, COLA002505/9915-18).

### 5. VA benefits, disability, public assistance

- **Any VA disability rating — even 0-10% — qualifies for the ABAWD medical-unfitness exemption.** "The VA assigns a percentage disability rating, but CalFresh participants with any rating meet the threshold for an exemption from the time limit" (COLA002222-23/4094-4111, confirmed independently at COLA002520/10078-92 and COLA002317/7294-7308). This is narrower elsewhere: Medi-Cal's own veteran exemption requires a 100%/total rating (COLA002393/8283-84, COLA002395/8326-27) — **CalFresh and Medi-Cal use genuinely different VA-disability thresholds for their own respective exemptions**, worth being precise about if a reader asks about both programs in one conversation.
- **A pending SSDI/SSI/disability application (not yet approved) is sufficient on its own** — same citations as above, verification standard is "proof of receipt OR pending application... may be known to county."
- **Standalone veteran status (without a qualifying disability rating) no longer exempts anyone from ABAWD** — the categorical veteran exemption was eliminated by HR1 alongside homelessness and foster-youth (same citations as household/shelter sections above).

### 6. Health/life transitions

- **Pregnancy exemption**: effective "beginning the month of conception" through the month of birth; client statement is sufficient, no affidavit required (COLA002218-19/3872-80, COLA002528/10186-93, COLA002327/7424-31) — consistent across every ACL/handbook version checked.
- **Domestic violence survivor definition is explicitly broader than intimate-partner relationships** — "not restricted to just an intimate partner. It could apply to other relationships (e.g., sibling, parent, friend, etc.)" and "not limited to those who are in a domestic violence shelter" (COLA002227/4330-33, COLA002322/7360-70, COLA002524-25/10147-57). A "domestic relationship" is statutorily defined broadly: current/former spouses, people who live/lived together, people dating/dated, same-sex relationships, people with a child in common, and more.
- **DV survivor status is NOT itself an automatic ABAWD exemption** — same as homelessness and substance-use struggles, it's an "indicator of obvious unfitness" that must be independently tied to a physical or mental unfitness finding (COLA002224/4165-74, COLA002522/10110-17). Self-attestation of survivor status must be accepted ("the individual's statement that they are a current or past survivor must be accepted," COLA002228/4376-77), but that attestation alone doesn't establish the exemption without the unfitness link.
- **Cross-reference for the "prior inclusion on abuser's case" edge case**: points to ACL No. 19-51 (DV shelter definition) and the duplicate-aid-rules exemption in ACL No. 17-30 (April 17, 2017) (COLA002227/4333-34) — flagged as a pointer to pull if this specific scenario needs a firmer answer than what's in this production.
- **Re-entry/post-incarceration/pre-release**: "Re-entry/Probation/Criminal Record" is a named discretionary-exemption "special circumstance," explicitly including "young people re-entering the community from placement in the juvenile justice system" (COLA002261/6032-41). A specific re-entry E&T program (CEO, a nonprofit employment social enterprise) with county-by-county sites is documented (COLA002427/8832-43).
- **Individuals impacted by the child welfare/juvenile justice systems** — same "indicator, not automatic exemption, must tie to unfitness" pattern (COLA002323/7372-85, COLA002229/4400-07).
- Medical verification, when unfitness isn't obvious on its face: **CF 887** ("CalFresh Request for Medical/Mental Health Verification" form), acceptable from physicians, nurse practitioners, dentists, social workers, and similar (COLA002526/10159-70).
- No content found on the $35 unreimbursed medical expense deduction threshold, or full D-SNAP/disaster provisions — only a bare "declaration of disaster" listed as a good-cause category (COLA002246/5301), no substantive D-SNAP mechanics.

### 7. Immigration

**This is the single richest category in the production.**

- **OBBBA §10108 eliminated SNAP eligibility for refugees, asylees, parolees, battered non-citizens, and trafficking victims** — categories that were previously eligible (COLA002279-80/6800-26, restated identically at COLA002282/6865-67, COLA002468/9331-33, COLA002506/9936-41). Eligibility is now limited to: citizens, LPRs, Cuban/Haitian entrants, and individuals residing under a Compact of Free Association (COFA) agreement. **This matches and extends what's already in `system-prompt.ts`** (which currently names "refugees/asylees/TPS removed" — the production additionally confirms parolees, battered non-citizens, and trafficking victims by name).
- **A now-ineligible non-citizen's income/resources still count toward the household's eligibility and benefit determination** even though they can't receive benefits themselves (COLA002280/6824-26) — an important nuance for mixed-status household questions.
- **California Food Assistance Program (CFAP)** is a state-funded backstop for qualified non-citizens barred under 1996-era PRWORA rules who don't qualify for federal CalFresh — until October 1, 2027, CFAP recipients are still subject to ABAWD time-limit rules; after that date, WIC §18930.5 eliminates both work registration and the ABAWD time limit for CFAP participants entirely (COLA002263-64/6176-6211).
- **New Indian/Urban Indian/California Indian ABAWD exemption** (added by HR1) — verified by client self-attestation alone, no further documentation required (COLA002180/2144-46, COLA002276/6640-41, COLA002329/7448-59).
- **ABAWD waiver eligibility narrowed**: now requires an area unemployment rate above 10% (the "insufficient jobs" waiver basis was removed); FNS caps waivers at 1 year (was previously up to 2). **California's own statewide waiver ended January 31, 2026** — a 1-year waiver (Nov 1, 2025 – Oct 31, 2026) was separately approved for 7 named counties only: Colusa, Imperial, Tulare, Alpine, Merced, Monterey, Plumas (COLA002298/7085-95, COLA002276-77/6652-54).
- Confirmed via the FNS→CDSS letter itself (readable directly, not via `pdftotext`): FNS **rescinded** CA's originally-approved 2-year statewide waiver (Feb 2025–Jan 2027) and reissued it as a 1-year waiver (Feb 2025–Jan 2026) as a general FNS policy shift away from 2-year approvals — this is the origin event behind the Jan 31, 2026 statewide expiration above.

---

## Still pending / watch for a formal answer

These are explicit "forthcoming guidance," "TBD," or "pending FNS approval" statements found in the production — genuinely open as of the documents' own dates, not resolved anywhere else in the 404 pages:

1. **OBBBA §10105 (Payment Error Rate funding match)** — CORRECTION to how this was first characterized here: the *county-level implementation mechanics* are genuinely still "CWD action will be required. Additional policy and implementation guidance is forthcoming" (COLA002278/6711-12) — but the underlying **federal statutory formula is fully specified already**, and it matters a lot. Verbatim (ACL 25-50, COLA002278):
   > "Effective FFY 2028 (October 1, 2027), state agencies will be required to pay a percentage of CalFresh benefit allotments, on the sliding scale set forth below, if they have a PER above 6.00 percent... For states with a PER below 6.00 percent there is a 0.00 percent state match; PER 6.00–7.99 percent → 5.00 percent state match; PER 8.00–9.99 percent → 10.00 percent state match; PER at 10.00 percent or higher → 15.00 percent state match. For FFY 2028, states are allowed to choose between using their PER in FFY 2025 or FFY 2026 to calculate their match percentage... If, for FFY 2025, the PER of a state multiplied by 1.5 is equal to or above 20 percent, the initial implementation date of a state match shall be FFY 2029 (instead of FFY 2028)."

   **This is directly relevant to the existing PER research thread** (`project_pra_productions_2026_07_23` auto-memory): CA's honest (Federal-series) PER has run 10.50/12.47/9.69‡/11.01 across FFY22–25 — every one of those years is at or above the 8.00% band, several above 10.00%. If that pattern holds into FFY2025/2026 (the years CA gets to choose from for its first match calculation), **California is looking at a 10–15% state match on CalFresh benefit allotments starting FFY2028** under the Act's own formula — a real, dollar-denominated fiscal consequence of the error-rate problem this research has been documenting, not an abstract compliance concern. Worth flagging to whoever owns the PER research thread. Question contact for whenever the county-level implementation guidance actually lands: **CalFreshPolicy@dss.ca.gov** (also the general contact named at the foot of ACL 25-50, COLA002280).
2. **OBBBA §10106 (Administrative Cost Sharing)** — same pattern: the federal formula is already fully known (COLA002278): "the federal portion of administrative costs will be reduced from 50 percent to 25 percent" effective FFY2027 (Oct 1, 2026), meaning "the state will be responsible for 52.5 percent and the counties will be responsible for 22.5 percent of the total cost" under California's existing 70/30 state/county split (WIC §18906.5). What's actually pending is the *county fiscal letter* implementing this — "a CFL will be drafted to provide additional guidance" (COLA002504/9891-93).
3. **Discretionary-exemption allocation mechanism** — "there are currently zero discretionary exemptions available for county use. Counties may not apply discretionary exemptions at this time... Once California has been allocated a new number of discretionary exemptions, CDSS will release a separate letter with further instructions" (COLA002184/2367-83). Open as of the most recent ACL in this production.
4. **Waiver-request criteria changes under HR1** — "A forthcoming ACL will provide more information on federal changes to the criteria for requesting a waiver of the time limit" (COLA002175/1895-96).
5. **FFY2026 SUA methodology** — CDSS committed to submit a new SUA methodology to FNS for approval "prior to October 1, 2025" (COLA002277/6696-97) — worth confirming whether that submission/approval has since surfaced in a later document not yet in hand.
6. **Four counties' waiver modification requests (Plumas, Alpine, Merced, Monterey) were listed as "pending FNS approval"** as of the Nov 2025 advisory-group deck (COLA002509/9969, COLA002505/9924-26) — later resolved by the time of the ACL/webinar materials elsewhere in this same production (7 counties confirmed approved, COLA002298/7091-95), so this one is now answered *within* the production itself, just not at the point it was first raised.
7. **"H.R. 1 ABAWD Webinar TBD"** (COLA002509/9973) and an "Upcoming ACLs" list naming a not-yet-issued "H.R. 1 ABAWD Implementation Instructions" ACL (COLA002509/9970-72) as of the same Nov 2025 deck — largely superseded by ACL 26-29 (the Handbook v3.0) later in the same production, but worth confirming that ACL is in fact the final implementation-instructions letter referenced here, not a separate one still outstanding.

---

## Recommended follow-up (not started — your call)

Several of the findings above are concrete, dated, CA-specific facts that could sharpen `packages/demeter-engine/src/system-prompt.ts`'s existing CA-ABAWD paragraph or the corpus, beyond what a federal-only assistant would know:

- The LIHEAP/heat-and-eat narrowing (elderly/disabled households only, eff. 10/31/25) — this is a case where Demeter's current live behavior (verified in this same session's earlier testing) explains the OLD, now-superseded rule correctly and confidently. Worth checking whether the corpus needs a superseded-text flag here the way it already does for pre-OBBBA ABAWD/non-citizen text.
- VA disability "any rating" + the CalFresh-vs-Medi-Cal threshold mismatch.
- The DV survivor definition's explicit non-intimate-partner scope, and the "indicator, not automatic exemption" framing (this actually already matches what's in `system-prompt.ts` almost verbatim — good confirmation, not a gap).
- The household-strictly-means-CalFresh-household clarification (directly resolves ambiguity in the joint-custody edge case).
- The full list of removed non-citizen categories (parolees, battered non-citizens, trafficking victims — currently only "refugees/asylees/TPS" are named).
- California's actual current waiver status (statewide ended 1/31/26; only 7 named counties still waived) — this is more precise than what's currently in the prompt.

None of this touches `packages/snap-rules` (engine math, being built out separately per your note) — everything above is conversational/grounding-layer content (prompt + corpus), the same layer as the rest of this session's work. Say the word if you want any of it turned into an actual PR.
