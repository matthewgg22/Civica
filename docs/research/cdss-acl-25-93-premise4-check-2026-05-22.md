# CDSS ACL Premise Check — §10102 / ABAWD / HR1 (Premise #4 of B2G pitch)

**Question (TODO-21):** Has CDSS issued an All County Letter since 2025-07-04 covering §10102 / ABAWD / OBBBA that would change how counties handle ABAWD tracking?

**Asked because:** Premise #4 of the Civica B2G pitch states "CDSS will not provide the tracking tool — counties are on their own." If CDSS *is* building it, the pitch needs a precise pivot before the first county outreach email goes out.

---

## TL;DR

**Premise #4 is materially wrong as currently worded.** CDSS confirmed via [ACL 25-93](https://cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACLs/2025/25-93.pdf) (dated December 31, 2025; effective June 1, 2026) that CalSAWS — the statewide automated welfare system — *is* the mandated ABAWD time-limit tracking infrastructure. Counties are explicitly forbidden from manual processes or system workarounds.

**But** the ACL governs **county case actions and policy enforcement**, not **applicant-facing UX**. Civica's actual surface (applicant hour logging, exemption screening prompts, document prep, reminders, education) sits *outside* what the ACL forbids. The pitch needs to pivot from "Civica is the county's tracking system" → "Civica is the applicant-facing layer that complements CalSAWS so well-prepared applicants arrive at the county with hours logged, exemptions pre-screened, and docs uploaded."

## The verbatim quote (ACL 25-93, page 2)

> Due to the complexity of these policy changes and other factors beyond CDSS's control, the guidance provided via this letter is effective June 1, 2026. This is the earliest possible implementation date that reflects the time required to design and implement the necessary automation changes within the **California Statewide Automated Welfare System (CalSAWS)** and to train county staff to ensure consistent and accurate application of the guidance statewide.
>
> **Counties must not attempt to implement HR 1 related policy changes through manual processes or system workarounds.** Relying on manual processes at this scale would create a high risk of inconsistent data entry, incorrect case actions, and data tracking gaps the system would not be able to reconcile. These errors could lead to systemic and long-term inaccurate eligibility outcomes and disruptions in benefits. That said, until the required CalSAWS automation changes are implemented, counties must continue to enter information to assist with future exemption screening using current system functionality.

## What the ACL is actually about

Strictly: **policy implementation** (the new 18–64 age band per HR1, new exemption criteria, the 36-month clock starting 2026-01-01, waiver tightening). Those *changes* must flow through CalSAWS — counties cannot bolt on third-party systems to make official eligibility determinations or run a parallel time-limit clock.

The ACL says nothing about:
- Applicant-facing apps that **prepare** applicants (hour logging, exemption screening prompts, reminders, doc upload)
- CBO / community-partner intake layers
- Third-party tools that **inform** applicants what counts as work
- OCR / income-verification helpers

CalSAWS is a case-management tool for county workers. There is no CalSAWS-equivalent applicant-facing app for ABAWDs. That gap is exactly where Civica operates.

## What the ACL changes for the Civica pitch

| Pre-ACL pitch (Premise #4) | Post-ACL pitch (corrected) |
|---|---|
| "CDSS will not provide the tracking tool" | "CDSS is building CalSAWS automation for case-side tracking; effective June 1, 2026" |
| "Counties are on their own to track hours" | "Counties enter data into CalSAWS; cannot use manual workarounds for case actions" |
| "Civica is the county's tracking system" | "Civica is the applicant-facing prep layer; CalSAWS is the system of record" |
| "Counties pay Civica to do what CDSS isn't" | "Counties save staff time because well-prepared applicants arrive at intake with hours pre-logged, exemptions pre-screened, docs uploaded — county worker still confirms in CalSAWS" |

## The Civica value props that survive

Verified against the ACL text:

- ✅ **Applicant hour logging** — `me-work-hours.ts` (TODO-15 ABAWD route). The applicant logs hours into Civica; they prepare to *report* those hours to the county. The county worker confirms in CalSAWS. No workaround.
- ✅ **Exemption screening prompts** to the applicant. Page 4: "Counties must screen individuals age 60 through 64 for any applicable ABAWD time limit exemptions ... including all the work registration exemptions under 7 CFR 273.7(b)(1) other than age." The county does the screening; Civica helps the applicant know what exemptions to surface. Complementary.
- ✅ **Document upload + OCR.** Applicants gather docs in Civica; counties accept them as evidence at intake. No conflict.
- ✅ **Education and reminders** ("you have N countable months left"). Applicant-facing information layer.
- ✅ **OBBBA age band update** (`packages/snap-rules/src/work-requirements/evaluate.ts` MAX_AGE 54→64, FY2026 CA county waiver list) — already shipped in PR #245.

## The Civica value props that need to pivot

- ❌ "Civica is the county tracking system" — contradicts the ACL. Drop this framing.
- ❌ "Civica replaces what counties would otherwise build manually" — counties aren't allowed to build manually anyway.
- ⚠️ **Civica → CalSAWS data feed** — possible but requires going through the official CalSAWS integration path, not a back-door. Long-term play, not a Q3 pitch.

## What this means for the first county outreach email

**Do NOT send the email with Premise #4 as currently worded.** Rewrite the pitch around:

1. CalSAWS handles case-side tracking. Civica handles applicant-side prep.
2. The 560,000 Californians estimated to fall off CalFresh on June 1, 2026 (per the OBBBA enforcement) are the addressable population — they need help understanding the new rules, logging hours, and surfacing exemptions *before* they hit intake.
3. Counties save staff hours because well-prepared applicants reduce intake friction. That's the dollar-figure ROI, not "Civica replaces a tool you don't have."

## Additional ACLs to scan before any county pitch ships

Per ACL 25-93's reference list (page 1):
- **ACL 25-50** (July 14, 2025) — initial HR1 CalFresh overview
- **ACL 25-50E** (August 26, 2025) — erratum / update to 25-50
- **ACL 25-41** — referenced; subject not captured in this scan
- **ACL 25-64** (September 18, 2025) — referenced separately in CDSS index
- **ACL 23-80** — Fiscal Responsibility Act of 2023 ABAWD changes (age 54)
- **ACL 19-93** — the state time-limit policy handbook (the foundation doc)

Also referenced: a **forthcoming ACL** on federal changes to waiver criteria (page 2: "A forthcoming ACL will provide more information on federal changes to the criteria for requesting a waiver of the time limit").

Worth doing before the first county email: a second pass scanning ACL 25-50, 25-50E, and 25-64 for any language about third-party vendors, CBO integrations, or applicant-facing tools.

## Confidence

- **HIGH confidence** that ACL 25-93 exists, says what's quoted, and forbids county manual workarounds.
- **HIGH confidence** that the ACL governs case actions, not applicant-facing apps.
- **MEDIUM confidence** that no other 2025–2026 ACL explicitly addresses third-party applicant-facing tools (couldn't fully verify; would require the 25-50 / 25-64 scan above).
- **HIGH confidence** that Premise #4 as currently worded is wrong and needs to be rewritten before the first county outreach email.

## Sources

- [ACL No. 25-93 (Dec 31, 2025) — CalFresh Implementation of HR1: Changes to Time Limit for ABAWDs](https://cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACLs/2025/25-93.pdf)
- [CDSS ACL No. 25-50 (Jul 14, 2025) — initial HR1 CalFresh overview](https://www.calsaws.org/wp-content/uploads/2025/10/CIT-0117-25-CDSS-All-County-Letter-ACL-25-50.pdf)
- [CDSS 2025 All County Letters index](https://www.cdss.ca.gov/inforesources/letters-regulations/letters-and-notices/all-county-letters/2025-all-county-letters)
- [LSNC summary: Implementation of CalFresh time limit](https://reg.summaries.guide/2026/01/implementation-of-calfresh-time-limit/)
- [Western Center on Law & Poverty: CalFresh Work Reporting overview](https://wclp.org/calfresh-work-reporting/)
- [CDSS ABAWD landing page](https://www.cdss.ca.gov/inforesources/calfresh/abawd)

---

**Generated:** 2026-05-22 by /autoplan TODO-21 research pass. Closes the engineering side of TODO-21. Operator action remaining: rewrite the county outreach email's Premise #4 framing before send (TODO-13 Session G).
