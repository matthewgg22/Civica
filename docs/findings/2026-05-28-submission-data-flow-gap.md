---
id: 2026-05-28-submission-data-flow-gap
date: 2026-05-28
scope: [submission, b2g, pitch-honesty]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: file
    ref: apps/enrollment-api/src/routes/benefitscal.ts
    line: 72
    note: "Phase 1 (live): POST /benefitscal/prepare-export/:packetId snapshots the packet into a benefitscal_submissions row at status 'pending_review' for navigator review."
  - kind: file
    ref: apps/enrollment-api/src/routes/benefitscal.ts
    line: 387
    note: "Phase 2 (NOT live): the submit path returns { message: 'DRIVER_NOT_WIRED' } — portal automation degrades gracefully until the CBO Assister account + BROWSERLESS_API_KEY + captured selectors all clear."
  - kind: memory
    ref: project_submission_data_flow
    note: "Full phase breakdown + the three closure shapes for the missing approval loop (manual webhook / scrape / CalSAWS API). A `county-outcome` route does not exist in apps/enrollment-api/src/ as of 2026-05-28 — confirmed by grep."
  - kind: file
    ref: apps/enrollment-api/src/routes/county-outcome-webhook.ts
    note: "UPDATE 2026-05-31: the approval loop now HAS code. POST /webhooks/county-outcome (HMAC-signed authoritative ingestion, PR #413) is the exact endpoint shape this finding recommended — resolving the 'no code path at all' claim below."
  - kind: file
    ref: apps/enrollment-api/src/cron/kpi-snapshot.ts
    note: "UPDATE 2026-05-31: measured PER now has a live internal source — kpi-snapshot reads QC review (qc_outcomes) into measured_per (PR #412), independent of any county feed. County-adjudicated realized PER still awaits the feed flowing + production traffic."
---

## What we found

The end-to-end SNAP flow is **real through enrollment and packet preparation, but stops before the two things a data-proven pitch actually needs**: agency submission and outcome capture.

- **Download → Enroll → Prepare:** production-grade. OTP sign-in, Fernet-encrypted packet intake, document upload, live error-risk badge, and `POST /benefitscal/prepare-export/:packetId`, which snapshots a reviewable `benefitscal_submissions` row at `pending_review`.
- **Submit (Phase 2):** NOT live. `runBenefitsCalSubmission` returns `DRIVER_NOT_WIRED` until a county CBO Assister account, the `BROWSERLESS_API_KEY` secret, and 9 captured BenefitsCal selectors all clear. Today a navigator copies the prepared packet into the portal by hand.
- **Get approved (the feedback loop):** **no code path at all.** Nothing ingests county outcome (approved / denied / withdrawn) back into Civica. `qc_outcomes` is populated by Civica's own navigator review, so it measures *predicted* PER, not *realized* (county-adjudicated) PER.

> **UPDATE 2026-05-31 — the approval loop now has code.** The "no code path at all" above is no longer true. The KPI / outcome-ingestion work shipped exactly the endpoint this finding recommended: `POST /webhooks/county-outcome` (HMAC-signed authoritative ingestion, PR #413) + `POST /me/packets/:id/outcome` (applicant self-report, PR #409) → `packet_outcomes`, and `kpi-snapshot` now derives a **measured** PER from internal QC review (`qc_outcomes`, PR #412) — independent of the county feed. What remains: **(a)** BenefitsCal auto-submit is still `DRIVER_NOT_WIRED` (Phase 2 unchanged); **(b)** no county is *sending* to the webhook yet — the code is built, the feed + data-sharing agreement are not; **(c)** a *county-adjudicated* realized PER still awaits that feed + production traffic. So the gap moved from **"no code"** → **"built, awaiting activation + the feed."** Still a real gap for the *realized*-PER pitch, but no longer the load-bearing engineering hole. (Kept `active`, not superseded: the auto-submit gap + the pitch-honesty point below remain valid.)

## Why it matters

- **Pitch honesty.** "Civica submits your application" is true only in Phase 2. Phase 1 is "Civica prepares a reviewable packet a navigator submits manually." Conflating them in a first-contact CBO pitch is the overclaim that burns the relationship irreversibly.
- **The data flywheel has no source.** "We improved approval rate by X%" cannot be substantiated until the approval loop closes — every outcome claim currently rests on internal QC, which counties will discount.

## What changes

- B2G framing leads with what's real (prepare-export snapshot + navigator review + pre-submission error-risk scoring) and explicitly marks Phase 2 as "activates once we hold a CBO Assister account in your county."
- Closing the approval loop is the highest-leverage unblocked move. Cheapest shape: a navigator-marks-outcome endpoint (`POST /webhooks/county-outcome` accepting `approved|denied|withdrawn|info_requested`) + dashboard UI (~1d CC). The scraped and official-CalSAWS/BenefitsCal-API paths trade fidelity for county cooperation and multi-year timelines.

## Open questions

- Which outcome-capture shape to commit to — the manual webhook is unblocked today; the scraped and API paths are higher cost / lower near-term feasibility.
- Until the loop closes, can any "measured PER" claim survive county scrutiny? The [[2026-05-28-error-attribution-framework]] scorer and the [[2026-05-28-civica-tam-repositioning]] PER framing both depend on realized outcomes this gap does not yet provide.
