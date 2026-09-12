# CRA pilot: county-level documented-access evidence (CDSS ME reviews)

**Date:** 2026-09-11 · **Author:** Demeter · **Status:** recommendation, pre-first-send
**Source material:** CDSS CalFresh Management Evaluation (ME) review production, FOIA R012681, FFY 2024–2025 — 36 California counties. Companion: the county friction map (navigable artifact + `county-friction-map.md`).

---

## What changed and why it matters for the pitch

The bank materials to date establish **need quantitatively** — per-county unenrolled persons and non-enrollment rate (`data-ops/analysis/county-bank-map`, the generator's Page 1). CDSS's own ME reviews now let us establish **need qualitatively and from a government primary source**: county by county, the state's own auditors documented *why* eligible people don't get through — wrong-language notices, unreachable phone lines, over-verification, missed expedited-service deadlines, and procedural denials.

For a CRA examiner this is the strongest kind of performance-context input. It is:
- **County-grain**, so it lands inside a bank's delineated assessment area, not a state average.
- **Third-party and governmental** (CDSS reviewing its own counties), not a self-serving Civica estimate.
- **About access, not just headcount** — it speaks directly to the *responsiveness* of a benefits-access program to a documented unmet need, which is what raises responsiveness weighting under the CD/Investment analysis.

**This does not change any number in the funnel or the ask.** It adds a sourced sentence or two to the *need* case, per bank, and sharpens one claim already in the one-pager.

---

## Integrity guardrails (carry the generator's posture verbatim)

The ME material is **documented barrier evidence**, used exactly the way the qualification memo already frames need: *performance-context input that raises responsiveness weighting — never "earns credit."* Apply the same rules:

1. **Never claim the grant fixes an ME finding or improves a CRA rating.** The county's access failures are CDSS's to remediate with the county; we are pointing to a documented need a benefits-access program is *responsive* to. Say "responsive to a documented access gap," never "closes the gap CDSS found."
2. **Quote CDSS, don't paraphrase into a stronger claim.** Use the county's own review language ("does not provide appropriate access," "unable to take your call," "on a Timeliness Corrective Action Plan since …").
3. **CA only.** The ME production covers California counties. It does **not** cover the Florida cluster (Helm, Banco do Brasil, Ocean). Do not imply equivalent documentation exists there — see §Florida below.
4. **Access barrier ≠ our attribution.** The chatbot is a plausible alternative front door for these specific failure modes (a 24/7 multilingual channel where the county's phone line drops callers and mails wrong-language notices). Frame it as *responsive to*, and let the measured quarterly report — not the pitch — carry any observed outcome.

---

## Per-bank language (drop-in for the need paragraph)

Each bank's targeted assessment-area counties are from `tools/cra-artifact/inputs/assessment_areas.json` (verified against the PE). Only counties covered by the ME production are cited; other AA counties keep the existing quantitative need treatment.

### American Business Bank — AA: LA, Orange, San Bernardino, Riverside ($25K)
An anchor fact of the whole roster sits in this AA. **San Bernardino** is one of only **two** counties in the 36-county production (the other is Sacramento) whose review carries CDSS's declarative structured verdict **"The county does not provide appropriate access to potential CF applicants"** — with a 46-minute average call-center wait (some callers never reached a person), notices mailed in English to Spanish-preferred households, and expedited service under a Corrective Action Plan since May 27, 2022 that had not improved. Riverside is documented over-verification and in-person interview requests overridden to phone.
> Suggested: *"In San Bernardino County — one of your four assessment-area counties — the state's own 2025 review concluded the county 'does not provide appropriate access to potential CalFresh applicants,' citing a 46-minute call-center wait and notices sent in the wrong language. A 24/7 multilingual benefits-access channel is directly responsive to that documented gap."*

### City National Bank — AA: LA, Orange, Ventura, Riverside, San Bernardino ($75K)
Same San Bernardino anchor, plus **Ventura**: the only county in the set that staffs an indigenous language (Mixtec) yet whose phone line averaged a 58-minute wait and *disconnected* callers, and which still mailed a notice in the wrong language. City National's own documented gap is the **Service Test (Low Satisfactory)** — the access/service story maps to it precisely. (Never imply a grant repairs the rating; Investment is already Outstanding.)

### Five Star Bank — AA: El Dorado, Placer, Sacramento, Yolo, Yuba, Sutter ($25K)
Three of the six AA counties are audited, and this AA carries the **second** of the two "does not provide appropriate access" verdicts. **Sacramento** is a top-tier case: CDSS's review gives the same declarative structured verdict as San Bernardino — **"The county does not provide appropriate access to potential CF applicants"** — for a genuinely multilingual caseload (Farsi, Vietnamese, Russian, Hmong, Mien, Cantonese/Mandarin, Dari) that nonetheless received notices in the wrong language, with a call center where *most* mystery callers could not reach a live person and those who did waited over two hours (a corrective action was issued for callers unable to get CalFresh information by phone at all), and both 3-day ES and 30-day processing below the federal goal. **Yolo** is on a 3-day ES Timeliness Corrective Action Plan since May 27, 2022 and shows an eligible household **wrongly told it was "over the income limit" and withdrawing**. Yuba is the benchmark contrast (its review carries the *positive* "provides appropriate access" verdict) — cite as the achievable ceiling, not a gap.
> Suggested: *"Your Sacramento assessment area is one of just two counties in the state's most recent review cycle where CDSS concluded the county 'does not provide appropriate access to potential CalFresh applicants' — documenting notices mailed in the wrong language and a call center most applicants could not reach. That is precisely the front-door failure a multilingual, always-on channel is built to be responsive to."*

### Bank of Marin — AA: Marin, Sonoma, Napa, San Francisco ($10K)
**Sonoma** is a tier-1 access story: 3-day expedited service at **52.62%** on a Corrective Action Plan since 2018, a 30-day online-application backlog, 46-minute call waits, and a call center closing at 3:30 p.m. Marin shows notices mailed in the wrong language (Russian, Chinese) and mishandled non-citizen eligibility. San Francisco documents eligible applicants **decided without an interview** and photo ID wrongly rejected — while running the deepest CBO network in the state (a co-funding/partnership angle).

### Bank Irvine · Hanmi Bank · Mega Bank — AA: LA (+ Orange) ($5K–$25K)
**Los Angeles**, the largest caseload in the country, has as its marquee ME finding **CW 2200 verification requests and notices sent in the wrong preferred language**, alongside call waits of 39 minutes to 1 hour 22 minutes. Orange is the counter-example — strong six-language staffing — where the documented friction is over-verification and confusing denial notices rather than language. Use LA for the need paragraph; note Orange as evidence the program targets the *specific* barrier each county has.

### Florida cluster — Helm, Banco do Brasil, Ocean (Miami-Dade / Broward / Palm Beach)
**No ME evidence in hand.** The CDSS production is California-only. Keep the existing quantitative need treatment for these banks and do **not** import CA access language. If we want the same primary-source access evidence for the Miami AA, it requires the equivalent Florida DCF program-access/QC review — a separate FOIA/records pull. *(Candidate follow-up; not a blocker for the CA sends that go first.)*

---

## Examiner verdict ledger — the structured, quotable findings

The ME reports are not prose we have to characterize; each has a set of **standard "Assessment:" verdicts** — one per rubric area (telephone access, application-processing timeliness, notices, etc.) — phrased as a declarative the examiner either passes or fails. That makes them clean, verbatim, primary-source pull-quotes. The two highest-value verdict families, mapped to the counties that *failed* them and the target banks whose assessment areas contain those counties:

### A. "The county does **not** provide appropriate access to potential CF applicants"
The strongest single line. **2 of 38 reviews** carry it (31 carry the positive "provides appropriate access"; 5 use a non-standard structure).

| County | FFY | In a target bank's AA? |
|---|---|---|
| **Sacramento** | 2024 | **Five Star Bank** |
| **San Bernardino** | 2025 | **American Business Bank, City National** |

### B. "The county is not meeting the … goal of 90 percent for [three-day ES / thirty-day] processing" + a dated Timeliness Corrective Action Plan
Formal, dated regulator actions — examiner-grade and verbatim-quotable ("on a Timeliness Corrective Action Plan since [date]").

| County | Verdict | On CAP since | Target bank AA |
|---|---|---|---|
| **Sonoma** | 3-day ES below goal | Sep 17, 2018 | **Bank of Marin** |
| **Marin** | 3-day ES below goal | Oct 1, 2019 | **Bank of Marin** |
| **Tulare** | 3-day ES + 30-day below goal | 2019 / Mar 24, 2023 | — |
| **Stanislaus** | 3-day ES below goal | Jul 2019 | — |
| **Kern** | 3-day ES below goal | Feb 22, 2022 | — |
| **San Bernardino** | 3-day ES below goal | May 27, 2022 | **American Business Bank, City National** |
| **Yolo** | 3-day ES below goal | May 27, 2022 | **Five Star Bank** |
| **Shasta** | 3-day ES below goal | Jul 1, 2023 | *(Five Star's Redding AA — not targeted)* |
| **Santa Clara** | 30-day below goal | Dec 8, 2023 | — |
| **Humboldt** | 30-day below goal | Oct 1, 2023 | — |
| **Ventura** | 3-day ES below goal | Sep 21, 2023 | **City National** |
| **Merced** | 3-day ES + 30-day below goal | Mar 26 / Jun 7, 2024 | — |
| **Butte** | 3-day ES + 30-day below goal | Apr 2, 2025 / Jun 7, 2024 | *(Five Star's Chico AA — not targeted)* |
| **Sacramento** | 3-day ES + 30-day below goal | (both below goal, FFY24) | **Five Star Bank** |
| **San Francisco** | 30-day below goal | (below goal, FFY24) | **Bank of Marin** |

### C. Wrong-language notices — CW 2200 / NOAs mailed in a language the household can't read
The verdict that maps most directly to the multilingual-chatbot value proposition (and to corpus issue #1128). **16 of 38 reviews** document a notice sent in the wrong language, naming **8 preferred languages** that were failed: Spanish, Chinese, Farsi, Vietnamese, Korean, Hmong, Arabic, and English (reverse errors). Each entry is a specific, verbatim, case-level finding — not a category.

| County | FFY | Documented mismatch (preferred → sent in) | Target bank AA |
|---|---|---|---|
| **Sacramento** | 2024 | Farsi → English **with no GEN 1365 attached**; Spanish → English; English → Vietnamese | **Five Star Bank** |
| **San Bernardino** | 2025 | Spanish → English (CW 2200) | **American Business Bank, City National** |
| **San Francisco** | 2024 | Chinese → English; Spanish → English | **Bank of Marin** |
| **Marin** | 2025 | CW 2200 sent in Chinese to an English household; Russian & Chinese underserved | **Bank of Marin** |
| **Ventura** | 2024 | English → Vietnamese; Spanish → English | **City National** |
| **Los Angeles** | 2024 | CW 2200 & notices "not sent in the correct language" (marquee finding) | **Bank Irvine, Hanmi, Mega, City National** |
| **San Diego** | 2024 | Chinese → English; **Arabic packet contained the English application form, not the Arabic version** (El Cajon FRC) | *(Hanmi's SD AA — not targeted)* |
| **Alameda** | 2025 | Chinese → English; Spanish → English; English → Spanish | *(Bank of Marin excludes Alameda-partial)* |
| **Contra Costa** | 2025 | Korean → English; Spanish → English | — |
| **Santa Clara** | 2025 | Spanish → English; Vietnamese → English | — |
| **Stanislaus** | 2025 | Spanish; **Arabic** (primary-language failures) | — |
| **Yolo** | 2025 | Spanish → English (CW 2200) | **Five Star Bank** |
| **San Benito** | 2025 | Spanish → English (NA 960Y / notices) | — |
| **Monterey** | 2024 | Spanish → English *and* English → Spanish; **GEN 1365 not sent** | — |
| **Madera** | 2025 | forms & notices not in preferred written language (Spanish) | — |
| **Fresno** | 2025 | Hmong-preferred household served in English (spoken) | — |

Verbatim pull-quotes captured for packet assembly, e.g.:
- **Sacramento:** *"…the applicant's preferred written language was Farsi. The form was not accompanied with the Notice of Language Services (GEN 1365). (MPP 21-115; ACL 17-102)"*
- **San Diego:** *"At the El Cajon FRC, the application form in Arabic application packets was in English, rather than the Arabic version. (MPP 21-115.2, 63-202.21, and 63-300.34)"*
- Every failed county carries the standard recommendation *"Ensure that notices sent to households are in their preferred written language."*

### D. Confidentiality not maintained — CF program / PII exposed
Verdict: *"Confidentiality was not consistently maintained."* **15 of 38 reviews.** The dominant specific is disclosing the CalFresh case **before authenticating the caller with two items of PII** (MPP 19-002.1 / 63-201.34); the rest are unsecured/unattended workstations and, in Merced, full names called aloud in the lobby.

| County | FFY | Specific | Target bank AA |
|---|---|---|---|
| **Sacramento** | 2024 | CF disclosed before 2-item PII authentication | **Five Star Bank** |
| **Yolo** | 2025 | CF disclosed before 2-item PII authentication | **Five Star Bank** |
| **Riverside** | 2024 | CF disclosed before authentication (Coachella & Indio offices) | **American Business Bank, City National** |
| **San Francisco** | 2024 | not maintained at the Mission Service Center (workstations) | **Bank of Marin** |
| **Marin** | 2025 | CF disclosed before 2-item PII authentication | **Bank of Marin** |
| **Sonoma** | 2024 | CF disclosed before 2-item PII authentication | **Bank of Marin** |
| Monterey, SLO, Santa Clara, Alameda, Madera, Humboldt | 24–25 | CF disclosed before 2-item PII authentication | — |
| **Merced** | 2025 | full first-and-last names called aloud in the lobby | — |
| **Stanislaus** | 2025 | unattended workstations/screens | — |
| **Fresno** | 2025 | workstations left unattended (callers *were* PII-authenticated) | — |

### E. Over-verification — CW 2200 demanding what CalFresh can't require
The near-universal finding: verifications requested that are **not required for CalFresh, already available electronically (MEDS/IEVS), or not questionable**, or limited to a single document type. Named as a finding in **34 of 38 reviews** — the hard count behind the friction map's #1 pattern, and the direct evidence base for corpus issue #1125. Most-demanded improper items across counties:

| # counties | Improper item demanded |
|---:|---|
| 10 | a sworn / "penalty of perjury" statement not required for CF |
| 7 | bank / checking / savings-account balances |
| 5 | immunization records |
| 5 | school attendance / schedule / end date |
| 5 | limited verification to a single type/source |
| 3 | citizenship/immigration already verified (MEDS/SAVE) |
| 3 | identity already A-verified in MEDS |
| 3 | pregnancy due date |
| 2 | proof of a *negative* ("proof you do not receive meals / income") |
| 2 | tax returns |

Bank-AA-mapped standouts (quotable specifics): **Riverside** (ABB/City National) demanded "proof you do not receive meals" and bank/immunization records; **San Bernardino** (ABB/City National) requested tax returns; **Sacramento** (Five Star) demanded immunization and sworn statements; **Yuba** (Five Star) demanded bank verification of a *categorically-eligible* household; **Sonoma** (Bank of Marin) demanded bank/checking/savings; **Marin** (Bank of Marin) limited proof to a single type and demanded sworn statements.

### F. Expedited-service criteria / methods-to-apply not explained to callers
Verdict: *"ES-entitlement criteria and time frames were not consistently explained to callers"* (MPP 63-301.521), and/or the methods to apply (fax/mail/online) omitted. **9 of 38 reviews.** Distinct from Family B (which is the *timeliness* of ES) — this is applicants not being told the emergency track *exists*.

| County | FFY | Target bank AA |
|---|---|---|
| **San Bernardino** | 2025 | **American Business Bank, City National** |
| **Yolo** | 2025 | **Five Star Bank** |
| Humboldt, Monterey, Siskiyou, Merced, San Benito, San Joaquin, Sierra | 24–25 | — |

### G. Missed-interview / NOMI misuse — a procedural-denial engine
The Notice of Missed Interview (NOMI) mishandled: **not sent** when required, **sent after the household completed/attended** the interview, sent when the household was never contacted, or carrying the **wrong compliance date**. A mishandled NOMI wrongly terminates or denies a household that actually did interview — a direct under-enrollment mechanism. Named as an error in **28 of 38 reviews.** Bank-AA-mapped: Sacramento, Yolo (Five Star); Riverside FFY24 & FFY25, San Bernardino (ABB/City National); San Francisco, Marin (Bank of Marin); Los Angeles, Orange (Bank Irvine/Hanmi/Mega/City National).

### H. NVRA voter registration not offered
Verdict: *"Voter Registration was not consistently offered"* / *"Voter Registration Card (VRC) was not consistently provided."* **7 of 38 reviews** — a federal (National Voter Registration Act) compliance miss, quotable and on the record. Bank-AA-mapped: **Riverside FFY24** and **San Bernardino** (ABB/City National), **San Francisco** (Bank of Marin); also Inyo, Tulare, Tuolumne, Butte. *(Use with care — it speaks to administrative compliance generally, not to the benefits-access thesis; strongest as corroboration that the county's front-of-house process is slipping, not as a standalone need lever.)*

**What this does for each CA bank's need case (all eight verdict families):**
- **Five Star** — Sacramento carries the access-denial verdict, dated ES/30-day CAP, three wrong-language notices, confidentiality, over-verification, **and** NOMI misuse; Yolo adds a dated ES CAP, a Spanish wrong-language finding, confidentiality, over-verification, **ES-not-explained**, and a NOMI sent "in error after the interview was completed." Both audited AA counties fail across almost every family.
- **American Business Bank / City National** — San Bernardino carries the access-denial verdict, ES CAP since 2022, Spanish wrong-language, over-verification (tax returns), **ES-not-explained**, NOMI misuse, **and NVRA**; Riverside adds confidentiality, "proof of a negative" over-verification, NOMI misuse, **and NVRA**; City National's AA adds Ventura and Los Angeles.
- **Bank of Marin** — all four AA counties fail on something: Sonoma (ES CAP since 2018 + confidentiality + over-verification), Marin (ES CAP since 2019 + wrong-language + confidentiality + over-verification + NOMI), San Francisco (30-day below goal + wrong-language + confidentiality + NOMI + **NVRA**), Napa (quantitative need only).
- **Bank Irvine / Hanmi / Mega** — Los Angeles's marquee wrong-language finding, over-verification, and NOMI misuse sit in every one of these AAs.

*(Verbatim quotes and line numbers are in the raw ME text; pull the exact sentence per bank at packet-assembly time. All eight families are structured and reproducible: grep each report for the "Assessment:" declaratives, the "preferred … language was …" findings, "Confidentiality was not … maintained," the CW 2200 "not required / not questionable / already available" findings, "not consistently explained to callers," "Notice of Missed Interview (NOMI)" error phrasings, and "Voter Registration … not … offered.")*

---

## Where to find more leads like these

1. **The rest of this same production — mined deeper.** Eight families are now extracted (access-denial, Timeliness CAP, wrong-language notices, confidentiality, over-verification, ES-not-explained, NOMI-misuse, NVRA). Remaining quotable "Assessment:" verdicts, lower priority: **shelter/income budget miscalculations** (lost deductions), **BDA/date-stamp not preserved** (lost filing dates), and **preferred-interview-method not honored** — county-specific but further from the benefits-access thesis.
2. **The other folders in R012681.** The FOIA production also includes PER/QC scorecard material (the `__2_`/`__3_` folders) — county payment- and negative-error rates that corroborate the "0% payment error masks broken access" through-line with hard numbers.
3. **Florida equivalent (for the Miami cluster).** The CDSS ME has no FL counterpart in hand; the Miami-AA access evidence for Helm / Banco do Brasil / Ocean would come from **Florida DCF** program-access / QC review records — a separate public-records request.
4. **Public, non-FOIA sources that often contain quotable access findings** (no request needed): the **California State Auditor** (has audited CalFresh/county human-services access), county **civil grand jury** reports (frequently scathing and specific on county benefits administration), FNS **Program Access Reviews** and management-evaluation summaries, and **litigation/consent-decree** language (e.g. access or language-access settlements). These carry the same "third-party, on the record" weight the ME verdicts do.
5. **Reproducing this at scale.** The verdict extraction is a grep over the "Assessment:" declaratives — it can be re-run over any future ME cycle or an expanded county set, and keyed straight to the `assessment_areas.json` bank AAs to auto-surface which banks gain a new documented-access lead.

---

## One-pager edit (already applied in this branch)

The call one-pager (`bank-call-one-pager-2026-08-26.md`) asserted "~2 of 3 CA denials are procedural — missed interviews alone are up to half of all denials." That claim is now **corroborated county-by-county from a government primary source**: across the 36-county ME production, procedural/negative-action error (CAPER) runs 50–100% in many counties even where the payment-error rate is 0.00%, and missed/mishandled interviews and wrong-language notices are recurring top findings. The line now carries the CDSS ME citation, and the "CRA credit?" objection now notes the need side is documented at county level by the state's own reviews.

---

## Recommended generator enhancement (proposed, not yet built)

Add an optional **"documented access barriers in your assessment area"** callout to Page 1 (the need page) of the per-bank artifact, sourced from a new `inputs/county_access_evidence.json` keyed by county with a verbatim CDSS quote + PE-style provenance (review FFY, one-line finding). This keeps the same integrity invariants the generator already enforces:
- Renders only for counties with an entry; absent = silent (never a fabricated barrier), mirroring the no-data-is-gray rule.
- Quote-only, with a `source` string, so the artifact never paraphrases CDSS into a stronger claim.
- Excluded from all funnel/score math — it is context, not a computed figure.

Filed as #1129 so the tested, send-gated code changes go through the normal review + oracle gate rather than riding this docs PR.
