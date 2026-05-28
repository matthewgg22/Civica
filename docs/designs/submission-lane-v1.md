# Submission Lane v1 — Design

**Status:** ACTIVE 2026-05-27 (supersedes [BenefitsCal CBO Integration Design](../benefitscal-integration.md), locked 2026-05-18)
**Branch:** `claude/civica-submission-lane`
**First migration:** `supabase/migrations/20260595_submission_lane_foundation.sql`
**Why we superseded:** see [§ Why this supersedes the locked design](#why-this-supersedes-the-locked-design)

## What this design covers

The "last mile" between a packet that has been reviewed and prepared inside Civica
and the act of actually delivering it to the agency that runs the SNAP / CalFresh
case. v1 target: California, via BenefitsCal's CBO Assister channel, with Civica
as a registered CBO.

## Architecture in one diagram

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────────┐    ┌─────────────────┐
│  Applicant  │    │   enrollment-api │    │   CBO Assister      │    │   BenefitsCal   │
│  (iOS app)  │    │   (Hono / CF)    │    │   (Civica dashboard │    │   (CalSAWS)     │
│             │    │                  │    │    + browser ext)   │    │                 │
└──────┬──────┘    └─────────┬────────┘    └──────────┬──────────┘    └────────┬────────┘
       │                     │                        │                        │
       │  1. Complete intake │                        │                        │
       ├────────────────────▶│                        │                        │
       │                     │                        │                        │
       │  2. Sign ABCDM 229  │                        │                        │
       ├────────────────────▶│ stores release row     │                        │
       │                     │                        │                        │
       │  3. Tap "Submit"    │                        │                        │
       ├────────────────────▶│ creates packet_        │                        │
       │   "Sent to your     │  submissions row       │                        │
       │    assister"        │  status='queued'       │                        │
       │                     │                        │                        │
       │                     │  4. Assister polls     │                        │
       │                     │     /assister/queue    │                        │
       │                     │◀───────────────────────┤                        │
       │                     │                        │                        │
       │                     │   5. Assister opens    │                        │
       │                     │   case in dashboard,   │                        │
       │                     │   reviews scoring,     │                        │
       │                     │   clicks "Approve &    │                        │
       │                     │   Submit"              │                        │
       │                     │◀───────────────────────┤                        │
       │                     │   status='in_review',  │                        │
       │                     │   submitted_by_staff_id│                        │
       │                     │                        │                        │
       │                     │                        │  6. Browser extension  │
       │                     │                        │     active in assister's│
       │                     │                        │     own BenefitsCal    │
       │                     │                        │     session, fills     │
       │                     │                        │     form fields,       │
       │                     │                        │     uploads docs       │
       │                     │                        ├───────────────────────▶│
       │                     │                        │                        │
       │                     │                        │  7. Assister reviews   │
       │                     │                        │     filled form in     │
       │                     │                        │     BenefitsCal and    │
       │                     │                        │     clicks Submit      │
       │                     │                        │     (THE legal         │
       │                     │                        │     attestation event) │
       │                     │                        ├───────────────────────▶│
       │                     │                        │                        │
       │                     │                        │  8. Extension captures │
       │                     │                        │     case # from        │
       │                     │                        │     success page       │
       │                     │   9. Assister marks    │◀──────────────────────│
       │                     │      submission        │                        │
       │                     │      complete          │                        │
       │                     │◀───────────────────────┤                        │
       │                     │   status='confirmed',  │                        │
       │                     │   external_case_number │                        │
       │                     │                        │                        │
       │  10. Push: "Sent to │                        │                        │
       │       county"       │                        │                        │
       │◀────────────────────┤                        │                        │
```

## Key architectural choices

### 1. Browser extension actuator, not server-side Playwright

The actuator that types into BenefitsCal is a Chrome MV3 browser extension running
**inside the assister's already-authenticated browser session.** It is not a
headless service operating credentials from a server.

The extension polls Civica's `/assister/jobs` endpoint, receives the prepared
packet data, fills the BenefitsCal application form, uploads documents, and then
stops at the BenefitsCal Submit button. The assister — sitting at the keyboard,
logged in, with the form filled and visible — reviews and clicks Submit themselves.

**This is the legally-meaningful attestation event.** The assister is the actor
in CalSAWS's logs because the assister is in fact the one operating the session
and clicking the button. The extension is a typing tool, in the same category
as 1Password autofill, Grammarly, or accessibility screen readers.

### 2. Civica-side ABCDM 229 capture with structured release tracking

Civica generates the official CalSAWS ABCDM 229 form pre-filled with the client's
information, captures the client's signature attestation, stores the signed PDF,
and tracks expiry (1 year per ACL 24-91 guidance) and revocation.

There is a known nuance: ACL 24-91 supports digital signing **inside BenefitsCal**
as a method. Civica's posture is that capturing an off-portal signature on the
official form is also valid (the form is the form regardless of where it's signed),
and Civica uploads the signed PDF to BenefitsCal as documentation of the ROI via
the Assister account.

**Open question for the CDSS conversation:** confirm that an off-portal-signed
ABCDM 229, uploaded to BenefitsCal, satisfies the ROI mechanism for ongoing
CBO case-status visibility. If CDSS requires the in-BenefitsCal signature path,
Civica's flow becomes: (a) capture intent + Civica-side consent in the iOS app,
(b) prompt client to also sign in BenefitsCal at submission time. The schema
supports this — `signed_pdf_storage_key` is just an artifact column, not a
load-bearing legal identifier.

### 3. Per-attempt submission records + immutable event log

Each submission attempt is a row in `packet_submissions`. A failed attempt (county
asks for re-submission, BenefitsCal portal error, etc.) creates a new attempt with
`attempt_number = N+1`. The history is preserved.

Every state transition + significant operational event writes a row in
`packet_submission_events`. The table is UPDATE/DELETE-blocked by trigger. This
gives forensic clarity for PER reporting, grant compliance, and any future audit
by CDSS or USDA.

### 4. Process status vs. case outcome separation

`submission_status` tracks the **submission process**: queued, in_review,
submitted_to_external, confirmed, failed, cancelled. It deliberately does NOT
include outcome vocabulary (Approved / Denied / Eligible). Those words belong
on `snap_packets.county_outcome` (existing enum, migration 20260564).

This split matters: a submission can be "confirmed" (the county acknowledged
receipt) while the case outcome is still "PendingDetermination" weeks later.
Conflating these into one status causes UX bugs ("Submitted" looks like
"Approved" to applicants).

### 5. Future-proofed attestation kind without pre-breaking the policy posture

`submission_attestation_kind` is an enum with three values: `human_assister_review`
(v1; always this today), `auto_fast_track_human_confirm` (future: low-risk score
auto-prepped, human still confirms), and `civica_sanctioned_agent` (hypothetical:
if CDSS ever explicitly sanctions an automated submitter for Civica).

The column existing does NOT permit autonomous submission. Application code
enforces `human_assister_review` only. The enum existing means we don't need a
schema migration if policy ever changes.

## Schema overview

Migration `20260595_submission_lane_foundation.sql` adds:

| Object | Purpose |
|---|---|
| `submission_status` enum | Process states (no outcome vocabulary) |
| `submission_channel` enum | Delivery mechanism; v1 = `benefitscal_cbo` |
| `submission_attestation_kind` enum | Who/how attested at submit; v1 = `human_assister_review` only |
| `abcdm_229_releases` table | Civica-side ABCDM 229 capture, 1-year expiry, EXCLUDE-active-uniqueness per (packet, org) |
| `packet_submissions` table | Per-attempt records, EXCLUDE-only-one-active per packet, structured destination jsonb + frozen review summary jsonb |
| `packet_submission_events` table | Append-only event log, immutability-trigger-blocked |

RLS on all three: `service_role` full, applicant own-data read, staff-at-org read.

## Gateway route surface (to be built)

Under `apps/enrollment-api/src/routes/submission/`:

```
POST   /packets/:id/abcdm-229          create + sign release (gateway stores PDF in Storage)
POST   /packets/:id/abcdm-229/revoke   revoke an active release
GET    /packets/:id/submissions        list submission attempts for a packet
POST   /packets/:id/submit             create a queued submission (creates row, no actuation yet)
POST   /submissions/:id/start-review   assister picks up: status→in_review, sets in_review_at
POST   /submissions/:id/attest         assister attests: requires release_id active, attestation_kind, freezes review_summary
POST   /submissions/:id/complete       extension reports completion: status→confirmed, external_case_number captured
POST   /submissions/:id/fail           extension or assister reports failure: status→failed, failure_reason
POST   /submissions/:id/cancel         applicant withdraws or release revoked: status→cancelled
POST   /submissions/:id/status-event   external_status sync from extension polling BenefitsCal status pages
GET    /assister/queue                 multi-tenant work queue for assister UI
GET    /assister/queue/:id             case detail for the assister workbench
```

Authentication via Supabase JWT. Assister-only routes verify `staff_users` membership
at the matching `org_id`. Applicant routes verify `applicants.auth_uid = auth.uid()`.

## iOS surface (to be built)

Under `Civica/Features/SNAP/Submission/` following the EBT layering convention
in CLAUDE.md:

- `SubmissionStore` (state) + `SubmissionRepository` (data) + `SubmissionAPIClient` (HTTP)
- `Strings/SubmissionStrings.swift` (en + es parity, enforced by `EBTStringParityTests`-equivalent)
- Views: `SendToCountyButton`, `Abcdm229SignSheet`, `SubmissionStatusRow`
- Tests under Swift Testing with `@Suite(.serialized)` if any nonisolated static state

## Dashboard surface (to be built)

Under `apps/dashboard/app/cbo/queue/`:

- `page.tsx` — assister queue list, filtered by org
- `[id]/page.tsx` — case detail with structured copy panels (per [feedback_packet_detail_suspense_pattern](../packet-detail-suspense.md))
- `lib/cbo-queue-fetchers.ts` — cached server fetchers
- Suspense sections for review summary, applicant detail, doc inventory, ABCDM 229 status

## Browser extension (Phase 2, to be built)

Under `apps/civica-submitter-extension/`:

- Chrome MV3 manifest
- Background service worker (job polling, auth token storage)
- Content script for `benefitscal.com` (form-fill, doc upload, success-page scrape)
- Popup (status + manual override)
- Field-mapping config: `field-map/ca-benefitscal.json` — page-by-page selector → packet field

## Why this supersedes the locked design

The locked design (`docs/benefitscal-integration.md`, 2026-05-18) and this design
diverge on three load-bearing decisions:

**1. Actuator location.** Locked design: server-side Playwright pausing for navigator
click in Civica's dashboard. This design: browser extension running in the assister's
own browser, the assister clicks Submit inside BenefitsCal itself.

The legal-posture argument: in the locked design, every BenefitsCal action — login,
field fill, document upload, AND the submit click — is performed by Civica's server
using credentials issued to a named human (the Assister). CalSAWS's audit logs
record actions attributed to that named human, who in fact was not at the keyboard
for any of them. This is a misrepresentation risk under California Penal Code § 502
("accessing any system... in ways not intended by the State of California") and a
potential ToU violation under BenefitsCal's Conditions of Use.

The extension architecture lets the named human actually be at the keyboard,
authenticated, viewing the form, clicking Submit. The extension is a typing
assistant — same legal pattern as password managers, accessibility tools, and
form-fill utilities that have decades of operational precedent inside government
portals.

**2. ABCDM 229 storage.** Locked design: client signs in BenefitsCal; Civica
just observes via Assister account. This design: Civica captures the signed
ABCDM 229 in its own table with full forensic attestation metadata, then
uploads the signed PDF to BenefitsCal as ROI documentation.

The argument: Civica needs a defensible attestation record for its own internal
authorization, separate from BenefitsCal's system-of-record entry. If a client
disputes "I never authorized Civica to act on my behalf," Civica's response
should be a signed PDF + cryptographic attestation metadata held by Civica,
not "go ask CalSAWS." The BenefitsCal-side signature remains valid in parallel
if/when required.

**3. Schema expressiveness.** Locked design: `benefitscal_submissions` table
with a single `payload_json` jsonb column. This design: structured columns for
status / channel / attestation_kind, separate `packet_submission_events` for
the immutable event log.

The argument: PER (Payment Error Rate) reporting, grant compliance, and audit
queries need indexed access to status, timestamps, and attempt history. A single
jsonb payload makes those queries SELECT-filter-on-jsonb-key, which is functional
but performance-fragile. Structured columns + an event log mirror the existing
`packet_status_history` pattern.

**Acknowledged tradeoff:** the extension model has higher engineering complexity
(MV3 lifecycle, content script reliability, field-map maintenance against
BenefitsCal HTML changes) than server-side Playwright. This is a deliberate
choice to spend engineering effort on a legally cleaner posture.

## What this design does NOT cover (deferred)

- **MA (DTA Connect) submission.** Different state, different portal, different
  release form. v1 is CA-only. The schema's CA-specific guard (check constraint
  on `state_code = 'CA'` for ABCDM 229) is intentional to prevent silent overload
  when MA support is added.
- **Fax / mail / telephonic channels.** Enum values reserved (`fax`, `mail`,
  `in_person`, `telephone`) but no implementations. Built only if BenefitsCal
  channel becomes uneconomic or politically blocked.
- **CalSAWS direct integration.** If CalSAWS eventually publishes an API, the
  extension becomes obsolete and a `civica_sanctioned_agent` attestation_kind
  comes online. Multi-year B2G horizon.
- **Auto-score fast-track UX.** Reserved as an `attestation_kind` value
  (`auto_fast_track_human_confirm`) but not built. v1 = human reviews everything.

## Critical path before launch

1. **CDSS / CalSAWS conversation** via political contact in Newsom's office.
   Confirm: (a) extension-assisted autofill within an authorized Assister session
   is within intended use, (b) off-portal-signed ABCDM 229 + portal upload
   satisfies ROI mechanism, (c) Civica's CBO registration is on track.
2. **Legal review** by a CA-licensed attorney with administrative law experience.
   Scope: Penal Code § 502 exposure analysis, BenefitsCal ToU compliance,
   ABCDM 229 dual-path defensibility, individual-Assister vs entity AR posture.
3. **BenefitsCal CBO Manager account approval** via LA DPSS or SF HSA.
   Operational dependency; 2-4 week timeline per the previous locked design.
4. **First Assister hires or contracts** — staffed model is intrinsic to the
   architecture; assister labor is in the critical path for any volume.

## Sign-off

Drafted by Claude Opus 4.7 (1M context) under direct instruction from Matthew on
2026-05-27. Supersedes the 2026-05-18 locked design via explicit user decision.
Not yet adversarial-reviewed; recommend `/plan-eng-review` pass before merge.
