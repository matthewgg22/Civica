# Counsel-prep analysis — 9 compliance copy strings

**Date:** 2026-05-19
**Status:** Pre-counsel review (Matthew commissioned this analysis as a structured artifact for counsel to actually sign). Recommendations below are draft only; final signoff still requires a credentialed attorney's signature on `counsel-batch-2026-05-19.md`.

This file complements `counsel-batch-2026-05-19.md` by capturing the row-by-row legal analysis and surfacing the open decisions Matthew needs to lock before counsel can sign.

## Regulatory citation correction (important)

The original counsel-batch doc cited "7 CFR 277.4 outreach standards." That's wrong: **§277.4 governs federal funding of state SNAP administrative costs** (the cost-share framework amplified by OBBBA §10106 — different scope entirely).

The correct outreach-content authority is:
- **7 CFR §272.5** (SNAP outreach)
- **FNS SNAP Outreach Toolkit** guidance

The substantive analysis below applies regardless of which provision controls — the core concern (promotional vs. neutral administrative copy) is consistent across both frameworks. Counsel should confirm the intended regulatory hook before final signoff.

## Quick-reference: 9-row disposition

| # | Location | Recommendation | Open decisions |
|---|---|---|---|
| 1 | Approval email subject | **APPROVE** | None — likely sails through |
| 2 | Decision-approved headline | **APPROVE WITH EDITS** | State-specific variants? "CalFresh" (CA) vs "SNAP" (MA) |
| 3 | Expedited banner | **APPROVE** | None — likely sails through |
| 4 | Estimator entry subtitle | **APPROVE WITH EDITS** | Fill `[Agency]` placeholder: "California Department of Social Services (CDSS) or your county welfare department" (CA), "Department of Transitional Assistance (DTA)" (MA) |
| 5 | Estimator apply CTA | **APPROVE WITH EDITS** | CA-only deployment (MA needs DTA Connect equivalent). Render as external-link control. Confirm CA-portal CTA received same signoff process MA's did |
| 6 | Doc-request SMS | **APPROVE WITH EDITS** | Add agency attribution: "Your SNAP application with [Agency] requires…". Complete the proposed text (currently ends with ellipsis) |
| 7 | Recert 1-day SMS | **APPROVE WITH EDITS** | Fill `[Portal]` placeholder. Confirm RECERT keyword pathway is implemented + tested (or remove the phrase). Add agency attribution |
| 8 | Recert 60-day email subject | **APPROVE** | None — likely sails through |
| 9 | EBT PIN button | **APPROVE WITH EDITS** | Render as external-link control. Confirm `ebt.ca.gov` is currently active URL (CA EBT portal domain may change with contract transitions). MA needs DTA EBT services portal equivalent |

## 6 concrete decisions Matthew needs to lock

These need answers BEFORE counsel can sign the "approve with edits" rows. Each is a 2-minute decision; together ~15 minutes total.

### Decision 1 — State-specific variants for SNAP vs CalFresh

The legal program name in CA is **CalFresh**, not **SNAP**. Three rows use "SNAP" generically. Pick one:

- **A. Single string per row using "SNAP"** — simpler; less branding awareness; counsel may push back
- **B. State-keyed variants ("CalFresh" for CA, "SNAP" for MA)** — accurate; doubles string count; needs registry tweak to be state-aware
- **C. "SNAP (CalFresh)" hybrid** — works in both states; mild redundancy

Affects rows 2, 6, 7, 8.

**Recommendation: B** — CA users see "CalFresh" everywhere else (BenefitsCal portal, EBT card), so calling it SNAP in the app creates a brand-name mismatch. Effort to support state variants in the registry is ~30min CC.

### Decision 2 — [Agency] placeholder resolution

Row 4 has `[Agency]` placeholder. Counsel-prep doc suggests:
- CA: "California Department of Social Services (CDSS) or your county welfare department"
- MA: "the Department of Transitional Assistance (DTA)"

Confirm these are the right institutional names. (CDSS is the state agency; counties administer day-to-day eligibility. Both names are correct depending on who applicants interact with.)

### Decision 3 — RECERT keyword pathway

Row 7 mentions "text RECERT for a link." This needs to be implemented as a Twilio keyword response OR removed from the copy. Currently:
- T14 Twilio outreach is shipped (PR #153) with opt-in/opt-out (STOP/START/HELP)
- A custom RECERT keyword route would extend `apps/enrollment-api/src/routes/twilio-webhook.ts`

Pick one:
- **A. Build the RECERT keyword pathway** before this copy ships — ~1h CC. Sends a per-user recert link via Twilio response.
- **B. Remove "or text RECERT for a link"** from row 7 copy. Replace with just "To recertify, visit [Portal]."

**Recommendation: B** — fewer moving parts for pilot. Add RECERT keyword as a v1.1 enhancement after first 10 enrollments.

### Decision 4 — External-link rendering for Rows 5 and 9

Rows 5 (Apply on BenefitsCal) and 9 (Set your EBT PIN at ebt.ca.gov) navigate to external state portals. Counsel-prep flagged that these should render as **external-link controls** (with the system's external-link affordance — e.g., the SF Symbols `arrow.up.right.square` glyph or similar) so users understand they're leaving the Civica app.

This is a small SwiftUI change in two view files. ~15min CC. Should bundle with the copy update PR.

### Decision 5 — URL freshness check

- Row 5: `BenefitsCal` URL — should be `https://benefitscal.com` (confirm with counsel; ACL 25-93E + CalSAWS JPA docs reference this)
- Row 9: `ebt.ca.gov` — confirm currently active (counsel-prep notes domain may change with EBT vendor contract transitions)

Both URLs should be verified before deploy. **Action:** spot-check each URL loads correctly + lands on the intended portal page.

### Decision 6 — Row 16 production bug status

The original counsel-batch doc flagged a "live production bug" at `SNAPAgencyDirectory.swift` row 16 (CA State Hearings address: MS 19-37 + street address instead of MS 21-37 + PO Box).

**Status: ALREADY FIXED.** Verified in current `codex/rebuild-feb18` source:
- `Civica/Features/SNAP/SNAPAgencyDirectory.swift:75` — "PO Box 944243, MS 21-37"
- `Civica/Features/SNAP/SNAPAgencyDirectory.swift:76` — "Sacramento, CA 94244-2430"
- `Civica/Features/SNAP/SNAPAgencyDirectory.swift:113-114` — same address in English + Spanish body-paragraph variant

The bug was apparently fixed in a prior PR. The `COMPLIANCE_AUDIT_OBBBA.md` audit doc is stale on this point. **Action:** update the audit doc to clear the "live production bug" flag on Q19 row 16.

## LPIE ACL citation — fastest path

The counsel-prep analysis points to a faster route than waiting on counsel: **email `CalFreshPolicy@dss.ca.gov` directly**. This is the operational policy contact identified in CDSS ACL 25-68; they know the LPIE expansion ACL number immediately.

The ACL is likely in the 2026 series (e.g., ACL 26-XX). Search terms for the CDSS ACL database (cdss.ca.gov/inforesources/letters-regulations/letters-notices/all-county-letters): "student exemption," "LPIE," "higher education," "college."

**Suggested email (works today):**

> Subject: LPIE student-exemption expansion — ACL number request
>
> Hi CalFresh Policy team,
>
> I'm building a CalFresh enrollment app for California Community College and CSU students. We're implementing the June 1, 2026 LPIE expansion (half-time degree students at CCC/CSU/UC auto-qualify for the SNAP student exemption per 7 CFR §273.5(b)).
>
> What's the CDSS ACL number for this expansion? Our codebase has placeholder citations that I want to replace with the correct ACL reference.
>
> Happy to send our implementation details if useful for your records.
>
> Thanks,
> Matthew

Once Matthew has the number, grep + replace at every site:

```bash
grep -rn "TODO: replace with actual CA CDSS ACL number" .
# Replace at each site:
# Source: CA CDSS ACL 26-XX — LPIE expansion, effective June 1, 2026 (7 CFR §273.5(b))
```

## Source

`snap_compliance_copy_review.docx` (Matthew's local Desktop) — pre-counsel structured analysis. This file is the working summary; the full row-by-row §272.5 analysis lives in the docx.
