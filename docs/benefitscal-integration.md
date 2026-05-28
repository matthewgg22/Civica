# BenefitsCal CBO Integration Design

**Status:** SUPERSEDED 2026-05-27 by [docs/designs/submission-lane-v1.md](./designs/submission-lane-v1.md)
**Reason:** Architectural disagreement on actuator location (server-side Playwright vs. browser extension) and ABCDM 229 storage. See the new doc's "Why this supersedes the locked design" section.
**Original status:** LOCKED 2026-05-18 via /plan-eng-review T13 investigation spike
**Pattern (superseded):** Hybrid navigator workflow + Playwright UI automation (no API exists)
**Owner (superseded):** Coordinator session (claude/clever-albattani-816917)
**Critical non-eng blocker (still applies):** BenefitsCal CBO Manager account approval (county-gated, ~2-4 weeks)

> The text below is preserved verbatim for historical reference. Do not implement against this spec.

---

## Summary

No public API exists for CBO or third-party programmatic submission to BenefitsCal. CalSAWS (operated by Deloitte/Accenture) exposes only internal county-to-county APIs. The only integration pathway is a **county-approved CBO Portal Account** — a browser-based interface where human Civica navigators submit applications on behalf of clients. This is the same model Code for America used for GetCalFresh at scale (50% of CA CalFresh filings); GetCalFresh sunset June 2025 without ever getting a real API.

The practical "API" for MVP is **Playwright UI automation**: a Civica-operated browser script that logs in as a Civica Assister account, pre-fills the BenefitsCal application from Civica's data model, and pauses for a navigator to review + click Submit. This mirrors how GetCalFresh worked.

The 60-day milestone ("first CCC student enrolled through Civica") therefore has a **2-4 week hard dependency on Matthew obtaining CBO Manager account approval from LA DPSS or SF HSA**. This is not eng work.

---

## What exists in BenefitsCal for CBOs

### CBO Manager / Assister accounts (confirmed, live)
- Register at `benefitscal.com/AccountManagement/request-cbo-account`
- Submits to the county for approval (LA DPSS or SF HSA recommended)
- CBO Manager creates sub-accounts for each navigator/assister
- Assiters can: submit applications, upload documents, check limited status, export referral reports — statewide across all 58 counties
- Approval is discretionary county decision; no automated/programmatic path

### ABCDM 229 Release of Information (ROI) — case visibility
- Client signs digitally in BenefitsCal (2025 rollout per ACL 24-91)
- Gives Civica navigators view access to: NOA notices, verification requests, benefit awards, program status, termination reasons, **SAR 7/recertification due dates**
- Critical for T11 (recertification product): this is how Civica gets the recert deadline
- Client must initiate — Civica cannot self-authorize; individual-level per household

### Authorized Representative
- Must be a natural individual (per CalFresh rules); entity-level AR not allowed
- Each Civica navigator must be individually named per client via DPA 19 form or written note
- No digital AR designation path in BenefitsCal; paper-anchored process

---

## What does NOT exist

- Public API, developer portal, OAuth/SAML, sandbox environment — none
- Entity-level authorized representative — only individual staff members
- County-level API layer — all 58 counties consolidated into one CalSAWS/BenefitsCal system as of Oct 2023
- Any special API arrangement available even for major statewide partners (GetCalFresh confirms this — no API even at scale)

---

## Architecture: Civica BenefitsCal submission pipeline

```
Civica iOS app                  Civica Dashboard                    BenefitsCal
     │                               │                                   │
     │  Client completes             │                                   │
     │  pre-screen + docs            │                                   │
     ▼                               │                                   │
enrollment-api                       │                                   │
  (packet + QcResult)                │                                   │
     │                               │                                   │
     │  POST /benefitscal/prepare-export                                 │
     ▼                               │                                   │
packages/benefitscal-cbo/            │                                   │
  normalizeForPortal()               │                                   │
  → BenefitCalPayload (JSON)         │                                   │
                                     │                                   │
                                     │  Navigator reviews payload        │
                                     │  in dashboard                     │
                                     │  → clicks "Submit to BenefitsCal" │
                                     ▼                                   │
                            Playwright worker                            │
                            (server-side, Civica infra)                  │
                            - Opens BenefitsCal as Assister              │
                            - Pre-fills application fields               │
                            - Attaches documents                         │
                            - Pauses for human review                    │──▶ Navigator clicks Submit
                                                                         │
                                                                         │  Application submitted
                                                                         ▼
                                                              enrollment-api
                                                              records benefitscal_submission_id
                                                              + submitted_at + navigator_id
```

---

## Package: `packages/benefitscal-cbo/`

```
packages/benefitscal-cbo/
├── src/
│   ├── index.ts                    # public API
│   ├── normalize.ts                # Civica packet → BenefitsCalPayload
│   ├── field-map.ts                # Civica field names ↔ BenefitsCal form field IDs
│   ├── automation/
│   │   ├── submitter.ts            # Playwright automation (server-side only)
│   │   ├── session.ts              # Assister login + session management
│   │   └── document-uploader.ts   # BenefitsCal document upload flow
│   ├── roi/
│   │   └── status-checker.ts      # Check ABCDM 229 ROI case status
│   └── schemas.ts                  # Zod for BenefitsCalPayload + SubmissionResult
├── test/
│   ├── normalize.test.ts           # Unit tests against field map fixtures
│   └── submitter.test.ts           # Playwright tests against local HTML mock of BenefitsCal form
└── package.json
```

### Key types

```typescript
type BenefitsCalPayload = {
  // Application identity
  packet_id: string;           // Civica packet ID (stored in submission log)

  // Personal info (from packet)
  first_name: string;
  last_name: string;
  date_of_birth: string;
  ssn_last4: string;           // only last 4 stored; full SSN from document scan
  address: PostalAddress;
  phone: E164;

  // Household
  household_members: HouseholdMember[];

  // Income
  income_sources: IncomeSource[];

  // Utility / SUA
  utility_allowance_type: 'standard' | 'limited' | 'telephone_only' | 'none';

  // Documents (Supabase Storage URLs; Playwright will download and upload to BenefitsCal)
  document_urls: { type: DocumentType; url: string }[];

  // Consent
  telephonic_consent_recorded_at?: string;   // ISO 8601; if phone-guided submission
  client_signature_type: 'in_person' | 'telephonic' | 'async_portal';
};

type SubmissionResult = {
  benefitscal_confirmation_number?: string;
  submitted_at: string;
  submitted_by_navigator_id: string;
  assister_account_id: string;
  status: 'submitted' | 'failed' | 'pending_navigator_review';
  error?: string;
};
```

### `normalizeForPortal()` API

```typescript
import { normalizeForPortal } from '@civica/benefitscal-cbo';

const payload = normalizeForPortal({
  packet: SnapPacket,
  qcResult: QcResult,
  documents: DocumentItem[],
});
// Returns: BenefitsCalPayload
```

This is pure logic — no I/O. Maps Civica's data model to BenefitsCal's field structure using `field-map.ts`. Build the field map incrementally as we discover BenefitsCal's actual form fields during account-approved testing.

---

## New enrollment-api routes

```
POST   /benefitscal/prepare-export/:packetId
  → normalizes packet, stores BenefitsCalPayload as draft, returns payload for navigator review

POST   /benefitscal/submit/:packetId
  → triggers Playwright worker with approved payload; returns SubmissionResult

GET    /benefitscal/status/:packetId
  → returns last submission attempt + status

POST   /benefitscal/roi-check/:packetId
  → checks ABCDM 229 case status if ROI is on file; returns case status + next recert date
```

---

## Migration plan (PR-level)

### Phase 0 — non-eng (Matthew, now)
1. Register for BenefitsCal CBO Manager account via `benefitscal.com/AccountManagement/request-cbo-account`
2. Submit to LA County DPSS or SF HSA for approval (contact the county CalFresh CBO liaison)
3. Create Assister sub-accounts for each Civica navigator
4. Join CalSAWS Advocates Group (California Association of Food Banks) for future API advocacy
5. Estimated timeline: 2-4 weeks for county approval

**60-day milestone is blocked on Phase 0 completing. This is the critical path.**

### Phase 1 — field map + normalize (eng, ~3 days, can start now)
1. Scaffold `packages/benefitscal-cbo/` with Zod schemas and `normalize.ts`
2. Write `field-map.ts` against BenefitsCal's publicly visible form fields (can inspect `benefitscal.com` without an account to identify field names)
3. Unit tests for `normalizeForPortal()` with fixture packets
4. `POST /benefitscal/prepare-export/:packetId` route + DB table `snap_enrollment.benefitscal_submissions`

### Phase 2 — Playwright automation (eng, ~1 week, needs Phase 0 account)
1. `automation/session.ts` — login + session keep-alive for Civica Assister account
2. `automation/submitter.ts` — pre-fill form fields using BenefitsCalPayload
3. `automation/document-uploader.ts` — upload documents from Supabase Storage URLs
4. `POST /benefitscal/submit/:packetId` route — triggers Playwright worker
5. Navigator "Submit to BenefitsCal" button in dashboard (pauses for human review before final submit)
6. Playwright tests against a local HTML mock of the BenefitsCal application form

### Phase 3 — ROI case status (eng, ~3 days, needs Phase 0 account)
1. `roi/status-checker.ts` — logs in as Assister, checks ROI case status, extracts recert due date
2. `POST /benefitscal/roi-check/:packetId` route
3. Wire recert due date into `snap_enrollment.recertifications.cert_period_end` (T11 integration)

### Phase 4 — longer-term
- Formal engagement with CalSAWS Advocates Group to request a real API
- If BenefitsCal exposes an API in 2026+, replace Playwright layer with API client; `normalizeForPortal()` becomes `normalizeForAPI()` — same data, different delivery

---

## DB: `snap_enrollment.benefitscal_submissions`

```sql
CREATE TABLE snap_enrollment.benefitscal_submissions (
  submission_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id             UUID NOT NULL REFERENCES snap_enrollment.snap_packets(packet_id),
  org_id                UUID NOT NULL,

  -- Payload snapshot
  payload_json          JSONB NOT NULL,    -- BenefitsCalPayload at time of submission

  -- Submission outcome
  status                TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'submitted', 'failed', 'cancelled')),
  benefitscal_confirmation_number TEXT,
  submitted_at          TIMESTAMPTZ,
  submitted_by          UUID,             -- navigator user_id

  -- Assister account used
  assister_account_id   TEXT,

  -- Consent
  consent_type          TEXT NOT NULL
    CHECK (consent_type IN ('in_person', 'telephonic', 'async_portal')),
  telephonic_consent_recorded_at TIMESTAMPTZ,

  -- Error tracking
  error_message         TEXT,
  retry_count           INT NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON snap_enrollment.benefitscal_submissions (packet_id);
CREATE INDEX ON snap_enrollment.benefitscal_submissions (org_id, status);
```

---

## Key constraints & compliance notes

- **Telephonic signature**: If client is phone-guided through the application, record telephonic consent before submitting. Store `telephonic_consent_recorded_at` in the submissions table. County may require audio recording; coordinate with the county's telephonic signature process.
- **FNS nonmerit personnel rules**: Civica's CBO submission assistance is lawful as outreach facilitation, not as a core certification function, as long as: (a) the county's SNAP outreach plan covers Civica's activity, and (b) a county merit employee still makes the eligibility determination. Civica never makes the eligibility decision.
- **AR designation**: For ongoing case management (not just initial submission), individual Civica navigators should be designated as AR by the client on DPA 19. No blanket entity AR.
- **ABCDM 229 ROI**: Must be client-initiated. Civica can prompt the client to sign it in BenefitsCal after submission; Civica cannot sign on their behalf.

---

## What this design does NOT include (deferred)

- **Fully headless automation without navigator review**: MVP always has a human navigator confirming before final submit. Removing the review gate is a future optimization.
- **Real BenefitsCal API client**: No API exists. If CalSAWS ships one, replace Playwright layer.
- **Multi-county Assister account management**: MVP uses one primary Civica Assister account (or one per navigator). Role-based Assister account management deferred.
- **Cross-state expansion**: BenefitsCal is CA-only. MA uses DTA Connect (different system, different integration). Out of scope for T13.

---

## Sign-off

Locked in `/plan-eng-review` coordinator session 2026-05-18. T13 investigation spike complete. T13 build session consumes this document as authoritative spec.

**Critical path**: 60-day milestone (first CCC student enrolled) is blocked on BenefitsCal CBO Manager account approval. This is Matthew's immediate action item, not an eng task.
