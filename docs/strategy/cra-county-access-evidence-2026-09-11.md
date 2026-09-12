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

**What this does for each CA bank's need case:**
- **Five Star** — its Sacramento AA carries *both* the access-denial verdict *and* dated ES/30-day CAP language, and Yolo adds a second dated ES CAP. Two audited AA counties with formal CDSS actions.
- **American Business Bank / City National** — San Bernardino carries the access-denial verdict *and* an ES CAP since 2022; City National's AA adds Ventura's ES CAP since 2023.
- **Bank of Marin** — three of its four AA counties carry formal actions: Sonoma (ES CAP since 2018, the state's longest-running here), Marin (since 2019), and San Francisco (30-day below goal).

*(Verbatim quotes and line numbers are in the raw ME text; pull the exact sentence per bank at packet-assembly time. The verdict is a structured field, so this ledger is reproducible: grep each report for the "Assessment:" declaratives.)*

---

## Where to find more leads like these

1. **The rest of this same production — mined deeper.** Each report has ~6 "Assessment:" verdicts; we've pulled the two highest-value families. Others worth extracting the same way: **notice-language** verdicts (wrong-language NOAs), **confidentiality** breaches (PII disclosed before authentication), and **over-verification** verdicts — several are equally quotable and county-specific.
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
