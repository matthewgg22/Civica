# SNAP Compliance Copy — Counsel Review Packet

**Date issued:** 2026-05-18  
**Prepared by:** Civica Engineering  
**Status:** Awaiting counsel sign-off

---

## How to use this packet

This packet contains nine user-facing strings from the Civica SNAP feature that require legal sign-off before they can ship. For each string, you will find the current production copy (verbatim), the engineering reason the copy needs revision, and the OBBBA audit question it maps to. Please fill in the **Approved English**, **Approved Spanish**, and any **Counsel Notes** fields directly in this document (or in a parallel Word/email reply). Once all nine rows are returned, engineering will apply the approved strings in a single pull request and flip each row's status from `pendingSignoff` to `approved`. No copy will change in the app until that PR is merged.

---

## OBBBA audit context

These strings were flagged during the internal OBBBA compliance audit documented in [`docs/snap/COMPLIANCE_AUDIT_OBBBA.md`](COMPLIANCE_AUDIT_OBBBA.md) (Revision 2, §6). The audit identified two categories of concern across all nine strings:

1. **Attribution** — copy that implies Civica performs an action that belongs to a state agency (e.g., "You're approved," "Set the EBT PIN") without clearly attributing the determination or action to the appropriate government body.
2. **Behavioral framing** — copy that uses incentive, urgency, ease-cue, or loss-aversion language in a context (government-benefit eligibility) where neutral, factual phrasing is required under the applicable regulatory guidance.

California (CDSS / BenefitsCal) is the launch state. Where strings reference a state agency portal, the approved replacement must cover both CA ("BenefitsCal") and MA ("MA DTA Connect") — counsel sign-off on this batch is expected to cover both states simultaneously rather than landing CA-first.

---

## The 9 strings

---

### Row 1 — `approvedEmail.subject`

- **Surface:** `CivicaNotificationTemplates.swift`
- **Current English (production):**

  > Approved. ${monthlyBenefit}/mo, starting this month.

- **Engineering rationale:** Dollar-amount-first subject reads as incentive; reframe as factual state-agency status update.
- **OBBBA reference:** Q3

| Field | Fill in below |
|---|---|
| **Approved English** | _____________________________________ |
| **Approved Spanish** | _____________________________________ |
| **Counsel Notes** | _____________________________________ |

---

### Row 2 — `SNAPDecisionApprovedStrings.headline`

- **Surface:** `SNAPDecisionApprovedView.swift`
- **Current English (production):**

  > You're approved.

- **Engineering rationale:** Attributes the state agency's determination to Civica. Replace with state-attributed phrasing.
- **OBBBA reference:** Q3 (boundary)

| Field | Fill in below |
|---|---|
| **Approved English** | _____________________________________ |
| **Approved Spanish** | _____________________________________ |
| **Counsel Notes** | _____________________________________ |

---

### Row 3 — `almostHeadline`

- **Surface:** `SNAPExpeditedBanner.swift`
- **Current English (production):**

  > Almost — one more answer could speed this up

- **Engineering rationale:** Gamification of a regulatory eligibility category. Reframe to attribute expedited criteria to 7 CFR 273.2(i).
- **OBBBA reference:** Q3 / Q2.4

| Field | Fill in below |
|---|---|
| **Approved English** | _____________________________________ |
| **Approved Spanish** | _____________________________________ |
| **Counsel Notes** | _____________________________________ |

---

### Row 4 — `entryCardSubtitle`

- **Surface:** `SNAPBenefitEstimatorStrings.swift`
- **Current English (production):**

  > Five questions. See your monthly dollar amount before you apply.

- **Engineering rationale:** Pairs ease cue with incentive cue connected to applying. Reframe as a screening estimate.
- **OBBBA reference:** Q3 / Q2.3

| Field | Fill in below |
|---|---|
| **Approved English** | _____________________________________ |
| **Approved Spanish** | _____________________________________ |
| **Counsel Notes** | _____________________________________ |

---

### Row 5 — `applyCTA`

- **Surface:** `SNAPBenefitEstimatorStrings.swift`
- **Current English (production):**

  > Apply for SNAP

- **Engineering rationale:** Generic 'Apply for SNAP' CTA without official-link attribution; should route via the state apply portal (e.g. 'Open BenefitsCal application' for CA, 'Open MA DTA Connect application' for MA) or similar neutral path. CA-portal naming requires the same counsel sign-off MA's did.
- **OBBBA reference:** Q3 / Q2.3

| Field | Fill in below |
|---|---|
| **Approved English** | _____________________________________ |
| **Approved Spanish** | _____________________________________ |
| **Counsel Notes** | _____________________________________ |

---

### Row 6 — `documentRequestedSMS.body`

- **Surface:** `CivicaNotificationTemplates.swift`
- **Current English (production):**

  > DTA needs one more thing: a recent paystub. Send a photo here or upload in the app. By {deadline} keeps your application moving.

- **Engineering rationale:** 'Keeps your application moving' is loss-aversion framing. Reframe as factual deadline.
- **OBBBA reference:** Q3

| Field | Fill in below |
|---|---|
| **Approved English** | _____________________________________ |
| **Approved Spanish** | _____________________________________ |
| **Counsel Notes** | _____________________________________ |

---

### Row 7 — `recertOneDayBeforeSMS.body`

- **Surface:** `CivicaNotificationTemplates.swift`
- **Current English (production):**

  > Tomorrow is your recert deadline ({recertDate}). 4 minutes if you start now. If you miss it, benefits pause until you submit — text RECERT for a fast link any time.

- **Engineering rationale:** Urgency + ease + loss-aversion stacked. Reframe as factual deadline with consequence stated neutrally.
- **OBBBA reference:** Q3

| Field | Fill in below |
|---|---|
| **Approved English** | _____________________________________ |
| **Approved Spanish** | _____________________________________ |
| **Counsel Notes** | _____________________________________ |

---

### Row 8 — `recertHeadsUpEmail.subject`

- **Surface:** `CivicaNotificationTemplates.swift`
- **Current English (production):**

  > Recertify in 60 days. Usually 4 minutes.

- **Engineering rationale:** Ease framing tied to recertification. Reframe to factual deadline only.
- **OBBBA reference:** Q3

| Field | Fill in below |
|---|---|
| **Approved English** | _____________________________________ |
| **Approved Spanish** | _____________________________________ |
| **Counsel Notes** | _____________________________________ |

---

### Row 9 — `approvedEmail.buttonLabel`

- **Surface:** `CivicaNotificationTemplates.swift`
- **Current English (production):**

  > Set the EBT PIN

- **Engineering rationale:** Implies Civica performs the PIN action. Reframe as 'Learn how to set your EBT card PIN' linking to official EBT/DTA instructions.
- **OBBBA reference:** Q3

| Field | Fill in below |
|---|---|
| **Approved English** | _____________________________________ |
| **Approved Spanish** | _____________________________________ |
| **Counsel Notes** | _____________________________________ |

---

## Where to send the filled packet

- **Email:** TBD — Matthew to insert before sending
- **Expected turnaround:** TBD

Please return the filled document (reply inline to this markdown, or paste into an email reply). Engineering will not merge any copy change until all nine rows have an approved English string. Spanish can follow in a subsequent batch if a Spanish reviewer is on a separate track, but the row will not flip to `.approved` in production until both languages are confirmed.

---

## Post-signoff engineering steps

1. Receive filled markdown / doc back from counsel.
2. For each row, edit `Civica/Features/SNAP/SNAPComplianceCopyRegistry.swift`:
   - `status: .pendingSignoff` → `status: .approved`
   - `approvedEnglish: nil` → `approvedEnglish: "<from counsel>"`
   - `approvedSpanish: nil` → `approvedSpanish: "<from counsel or Spanish reviewer packet>"`
3. Run iOS test suite + `RegistryConsistencyTests` to confirm all assertions pass.
4. Open one PR titled **"Apply counsel-signed compliance strings"** against `codex/rebuild-feb18`.
