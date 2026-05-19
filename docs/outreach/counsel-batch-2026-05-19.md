# Counsel batch — Civica SNAP launch

**Sent:** [date when emailed]
**Recipients:** [3 attorneys / firms]
**Hard deadline:** 2026-06-02
**Total estimated attorney time:** 2-3 hours across 4 items

Scope: SNAP outreach platform for California Community College students. Operating as a CBO (BenefitsCal CBO Manager credentials pending). Need rapid signoff on three independent items before pilot launch.

## Item 1 — 9 user-facing copy strings (Track 2 / OBBBA Q3)

Counsel needs to confirm: (a) the proposed replacement string is acceptable under 7 CFR 277.4 outreach standards, and (b) it doesn't reintroduce the issue flagged in the rationale. Each row independent — counsel can sign one without holding the others.

Source of truth: `Civica/Features/SNAP/Generated/SNAPComplianceCopyRegistry+Generated.swift`

| # | ID | Surface | Current text | Proposed text | Rationale |
|---|---|---|---|---|---|
| 1 | `approval_email_subject` | Approval email subject | "Approved. ${monthlyBenefit}/mo, starting this month." | "Your SNAP application: eligibility determination complete" | Dollar-amount-first subject reads as incentive, not state-agency notice |
| 2 | `decision_approved_headline` | Decision-approved headline | "You're approved." | "You have been determined eligible for SNAP benefits." | Attributes the state agency's determination to Civica |
| 3 | `expedited_banner_almost` | Expedited banner | "Almost — one more answer could speed this up" | "You may qualify for expedited SNAP benefits — answer one more question to check." | Gamifies a regulatory eligibility category (7 CFR 273.2(i)) |
| 4 | `estimator_entry_subtitle` | Estimator entry subtitle | "Five questions. See your monthly dollar amount before you apply." | "Answer a few questions to estimate your potential SNAP eligibility. Results are estimates only — actual eligibility is determined by [Agency]." | Pairs ease cue with incentive cue tied to applying |
| 5 | `estimator_apply_cta` | Estimator apply CTA | "Apply for SNAP" | "Apply on BenefitsCal" | Generic CTA without official-link attribution; CA-portal naming needs same signoff MA's did |
| 6 | `doc_requested_sms_body` | Doc-requested SMS | "DTA needs one more thing: a recent paystub... By {deadline} keeps your application moving." | "Your SNAP application requires additional documentation. Please submit a recent paystub by {deadline}. You can reply to this message with a photo or upload it in the app." | "Keeps your application moving" is loss-aversion framing |
| 7 | `recert_one_day_sms` | Recert 1-day SMS | "Tomorrow is your recert deadline ({recertDate}). 4 minutes if you start now. If you miss it, benefits pause..." | "Your SNAP recertification is due {recertDate}. To recertify, visit [Portal] or text RECERT for a link." | Urgency + ease + loss-aversion stacked |
| 8 | `recert_heads_up_email_subject` | Recert 60-day email subject | "Recertify in 60 days. Usually 4 minutes." | "SNAP recertification required — deadline in 60 days" | Ease framing tied to recertification |
| 9 | `ebt_pin_cta` | EBT PIN button label | "Set the EBT PIN" | "Set your EBT PIN at ebt.ca.gov" | Implies Civica performs the PIN action |

**Action requested:** Sign each row individually (approve / approve-with-edits / reject). Edits land via PR updating the `approvedEnglish` + `approvedSpanish` fields in the Generated registry file and flipping `status: .pendingSignoff` → `.approved`.

## Item 2 — App Store listing copy (OBBBA Q16)

Hard launch gate: no App Store submission until signed. Compliant draft exists in `COMPLIANCE_AUDIT_OBBBA.md` (Q16 section). Counsel reviews under 7 CFR 277.4 (state/federal funded outreach). No dollar amounts, no approval language, no ease/urgency stack.

## Item 3 — Source-citation reviewer signoffs (OBBBA Q19)

18 rows of SNAP eligibility rule citations in `docs/SNAP-source-citation-signoff.md` need policy-reviewer signoff (SNAP-literate attorney or DTA-experienced counsel).

**Live production bug to verify in same review:** row 16 (CA State Hearings address) has two errors in `SNAPAgencyDirectory.swift` — MS code `19-37` should be `21-37`, and a street address is used instead of the PO Box. Correct: **PO Box 944243, MS 21-37, Sacramento CA 94244-2430**. This field surfaces in user-printable appeal letters.

## Item 4 — LPIE ACL citation (Session A follow-up)

Civica's iOS + TypeScript code has `// TODO: replace with actual CA CDSS ACL number for LPIE expansion (Matthew to provide)` at multiple sites. Looking for the actual CA CDSS All-County Letter (ACL) number for the LPIE expansion (effective June 1, 2026 — half-time degree students at CCC/CSU/UC auto-qualify for the student exemption). Counsel either knows it or can pull it from CDSS publications.

Once received, grep the codebase for that TODO string and replace at every site.

---

## Suggested email skeleton (verbatim)

> Subject: Civica SNAP launch — counsel review request, hard deadline 2026-06-02
>
> Hi [Name],
>
> I'm launching Civica — a SNAP enrollment platform for California Community College students operating as an authorized CBO. Pilot launch is gated on counsel signoff for four items, all independent:
>
> 1. Nine user-facing copy strings — reviewing whether proposed replacements meet 7 CFR 277.4 outreach standards. Each row sign-off-able independently. Side-by-side comparison in the linked doc.
> 2. App Store listing copy — full draft attached; one-pass review.
> 3. Eighteen source-citation rows — SNAP eligibility rule citations need policy-reviewer signoff (state + federal). Plus one live production bug (CA State Hearings address) for you to verify.
> 4. CA CDSS ACL number for LPIE expansion (June 2026 student-exemption change) — if you have it handy.
>
> Total scope: ~2-3 hours of attorney time. Hard deadline 2026-06-02 (estimator + App Store launch gate).
>
> Can you take this on, or refer me?
>
> — Matthew

## Candidate channels (reach 3 in parallel this week)

- **NLADA (National Legal Aid + Defender Association)** — SNAP/benefits-law referral network
- **California Rural Legal Assistance (CRLA)** — SNAP-literate, often does student work
- **Bay Area Legal Aid / Legal Aid Foundation of LA** — both have CalFresh practices
- **Western Center on Law and Poverty (Sacramento)** — CA CalFresh policy experts
- **Public Counsel (LA)** — pro bono; worth one call
- **Standing engagement** — any prior counsel Civica has worked with

## Tracking

| Recipient | Sent | Response | Items signed |
|---|---|---|---|
| [Name] | [date] | [open/declined/accepted] | [list] |
| [Name] | [date] | [open/declined/accepted] | [list] |
| [Name] | [date] | [open/declined/accepted] | [list] |
