# Recertification Product Design

**Status:** LOCKED 2026-05-18 via /plan-eng-review T11 design pass
**Pattern:** Chatbot + voice prep + proactive outreach; new `recert` domain in enrollment-api
**Owner:** Coordinator session (claude/clever-albattani-816917)

## Summary

SNAP recertification is the 6–12 month clock that runs after initial enrollment. Households who miss the window or fail the recertification interview lose benefits. For many CCC students and low-income households, recertification failure — not initial denial — is the primary drop-off. Civica's recertification product has three components that together constitute the "recertification-as-product moat":

1. **Practice interview chatbot** — AI-guided conversational prep that walks the household through expected recertification interview questions using their actual stored data. Reduces interview anxiety, surfaces documentation gaps in advance.
2. **Twilio call prep + reminders** — Outbound SMS/call reminders tied to the household's recert deadline; day-of phone prep script; post-interview status capture.
3. **AI-refreshed packet** — Before the recert deadline, the QC engine re-runs on updated income/asset signals and emits a refreshed evidence packet the navigator can review and hand off.

This document is the spec consumed by T11 build session. T14 (Twilio/outreach infra) is a dependency that T14 build session can scaffold in parallel.

---

## Data model additions

### `snap_enrollment.recertifications` table

```sql
CREATE TABLE snap_enrollment.recertifications (
  recert_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id       UUID NOT NULL REFERENCES snap_enrollment.snap_packets(packet_id),
  org_id          UUID NOT NULL REFERENCES snap_enrollment.orgs(org_id),
  applicant_id    UUID NOT NULL,               -- denorm for fast lookup

  -- Deadline tracking
  cert_period_end DATE NOT NULL,               -- from county confirmation or estimated
  cert_period_end_source TEXT NOT NULL,        -- 'county_confirmation' | 'navigator_entry' | 'estimated_6mo' | 'estimated_12mo'
  reminder_opted_in BOOLEAN NOT NULL DEFAULT TRUE,

  -- Outreach state
  first_reminder_sent_at TIMESTAMPTZ,          -- T-30 days
  second_reminder_sent_at TIMESTAMPTZ,         -- T-7 days
  day_of_reminder_sent_at TIMESTAMPTZ,         -- T-0 morning
  phone_prep_sent_at TIMESTAMPTZ,
  post_interview_captured_at TIMESTAMPTZ,

  -- Interview prep state
  practice_session_count INT NOT NULL DEFAULT 0,
  last_practice_at TIMESTAMPTZ,

  -- Refreshed packet
  refreshed_packet_id UUID REFERENCES snap_enrollment.snap_packets(packet_id),
  refresh_triggered_at TIMESTAMPTZ,
  refresh_completed_at TIMESTAMPTZ,

  -- Outcome
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'submitted', 'approved', 'denied', 'missed')),
  outcome_recorded_at TIMESTAMPTZ,
  outcome_notes TEXT,

  -- Standard audit cols
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT recert_org_match CHECK (org_id IS NOT NULL)
);

CREATE INDEX ON snap_enrollment.recertifications (packet_id);
CREATE INDEX ON snap_enrollment.recertifications (org_id, cert_period_end);
CREATE INDEX ON snap_enrollment.recertifications (cert_period_end) WHERE status = 'pending';
```

### `snap_enrollment.recert_practice_sessions` table

```sql
CREATE TABLE snap_enrollment.recert_practice_sessions (
  session_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recert_id       UUID NOT NULL REFERENCES snap_enrollment.recertifications(recert_id),
  org_id          UUID NOT NULL,               -- RLS anchor

  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  turn_count      INT NOT NULL DEFAULT 0,

  -- AI session reference (opaque to DB; used by chatbot service to resume)
  ai_session_ref  TEXT,

  -- Flags surfaced during practice
  flags           JSONB,                       -- e.g. {"missing_proof_of_income": true, "address_change": true}

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON snap_enrollment.recert_practice_sessions (recert_id);
```

---

## New package: `packages/recert-engine/`

The recertification engine handles two concerns: deadline math + AI interview orchestration.

```
packages/recert-engine/
├── src/
│   ├── index.ts                    # public API
│   ├── deadline.ts                 # deadline estimation + reminder schedule
│   ├── interview/
│   │   ├── questions.ts            # standard recert interview question bank (CA/MA)
│   │   ├── personalizer.ts         # injects packet data into question prompts
│   │   ├── orchestrator.ts         # turn-by-turn chatbot state machine
│   │   └── flags.ts                # extracts flags from session (missing docs, changes)
│   ├── refresh/
│   │   ├── trigger.ts              # determines when to auto-trigger a packet refresh
│   │   └── diff.ts                 # compares refreshed QcResult to original
│   └── schemas.ts                  # Zod for all shapes
├── test/
│   ├── deadline.test.ts
│   ├── interview-orchestrator.test.ts
│   └── refresh-trigger.test.ts
└── package.json
```

### `recertEngine.deadline` API

```typescript
import { recertEngine } from '@civica/recert-engine';

// Estimate deadline from enrollment date
const schedule = recertEngine.deadline.estimate({
  enrolledAt: '2026-01-15',
  state: 'CA',
  householdType: 'student_household',    // affects cert period length
});
// Returns: { certPeriodEnd: '2026-07-14', source: 'estimated_6mo', reminders: [...] }

// Compute reminder dates from a confirmed deadline
const reminders = recertEngine.deadline.reminders({
  certPeriodEnd: '2026-07-14',
});
// Returns: [{ type: 'T-30', sendAt: '2026-06-14' }, { type: 'T-7', ... }, { type: 'T-0', ... }]
```

### `recertEngine.interview` API

```typescript
// Start a practice session
const session = await recertEngine.interview.start({
  recertId: 'uuid',
  packetSnapshot: PacketSnapshot,  // anonymized subset of the packet — no PII in AI context
  state: 'CA',
});
// Returns: { sessionId, firstQuestion: InterviewTurn }

// Advance a turn
const next = await recertEngine.interview.respond({
  sessionId: 'uuid',
  userMessage: 'I still work at the same place',
});
// Returns: { turn: InterviewTurn, flags: Flag[], done: boolean }
```

The AI call is made inside `orchestrator.ts` using the Anthropic Messages API. The engine formats a system prompt with the question context + packet snapshot, appends the conversation history, and returns the next question + any flags raised. No PII is passed directly — the packet snapshot uses anonymized field names (e.g. `income_source_count: 2`, `has_utility_sua: true`, not names or SSNs).

### `recertEngine.refresh` API

```typescript
// Determine if a refresh is warranted
const should = recertEngine.refresh.shouldTrigger({
  lastEvaluatedAt: '2026-01-15',
  certPeriodEnd: '2026-07-14',
  flags: session.flags,   // from practice session if run
});
// Returns: { trigger: boolean, reason: string }

// Diff old vs new QcResult
const diff = recertEngine.refresh.diff({
  original: QcResult,
  refreshed: QcResult,
});
// Returns: { defensibilityChanged: boolean, newWarnings: Warning[], resolvedWarnings: Warning[], factorChanges: ... }
```

---

## New routes in `apps/enrollment-api`

All routes are under `/recert/*`. RLS anchor: `org_id` from JWT claim.

```
POST   /recert/:packetId/init          Create recertification record for a packet
GET    /recert/:packetId               Fetch recertification status + schedule
PATCH  /recert/:recertId              Update status, outcome, opt-out

POST   /recert/:recertId/practice/start        Start a practice session
POST   /recert/:recertId/practice/:sessionId/respond   Advance a turn
GET    /recert/:recertId/practice/:sessionId   Get session state + flags

POST   /recert/:recertId/refresh               Trigger packet refresh (queues job)
GET    /recert/:recertId/refresh/diff          Get diff of original vs refreshed QcResult
```

---

## Navigator dashboard (T11 scope — `apps/dashboard`)

New page: `/navigator/recertifications` — a table of all pending recerts for the org, sorted by `cert_period_end ASC`. Columns:

| Applicant (initials) | Cert Period End | Days Until | Reminders Sent | Practice Sessions | Status |
|---|---|---|---|---|---|

Each row links to `/navigator/recertifications/:recertId` — the detail page with:
- Reminder timeline (sent / scheduled)
- Practice session transcript summary + flags raised
- Refreshed packet diff (if triggered)
- Manual outcome recording

The navigator can also manually trigger a packet refresh or send an ad-hoc reminder from this page.

### iOS (Civica app)

Applicant-facing: a "Recertification" card appears in the main feed when `cert_period_end` is within 45 days. Tapping enters the practice chatbot flow (native SwiftUI chat UI over the enrollment-api `/recert/:recertId/practice/*` routes).

---

## Twilio integration (T14 dependency)

T11 build session should assume a `TwilioAdapter` interface exists:

```typescript
type TwilioAdapter = {
  sendSMS(to: E164, body: string): Promise<void>;
  scheduleCall(to: E164, at: Date, script: CallScript): Promise<void>;
};
```

T14 builds the implementation. T11 wires the reminder scheduler to inject an adapter at startup (default: `NoopTwilioAdapter` so routes work without Twilio credentials in dev).

---

## Reminder scheduler (cron job in `apps/enrollment-api`)

A cron job runs nightly (or on every `fly deploy`). It queries:

```sql
SELECT r.*, p.org_id
FROM snap_enrollment.recertifications r
JOIN snap_enrollment.snap_packets p USING (packet_id)
WHERE r.status = 'pending'
  AND r.reminder_opted_in = TRUE
  AND (
    -- T-30 not yet sent and we're within the window
    (r.first_reminder_sent_at IS NULL AND r.cert_period_end - CURRENT_DATE <= 30)
    OR (r.second_reminder_sent_at IS NULL AND r.cert_period_end - CURRENT_DATE <= 7)
    OR (r.day_of_reminder_sent_at IS NULL AND r.cert_period_end = CURRENT_DATE)
  );
```

For each row it calls `TwilioAdapter.sendSMS()` and updates the `*_sent_at` column. Idempotent: a second run sees the `*_sent_at` already set and skips.

Implementation lives in `apps/enrollment-api/src/lib/recert-scheduler.ts`. Fly.io machines + Cloudflare Cron Triggers are both options; start with Fly.io scheduled process (simplest, no new infra).

---

## AI prompt design (interview orchestrator)

System prompt template (rendered server-side with packet snapshot):

```
You are a SNAP recertification interview coach helping a CalFresh household practice for their upcoming recertification interview with the county.

Household context (anonymized):
- State: {state}
- Certification period end: {cert_period_end}
- Household size: {household_size}
- Income sources on file: {income_source_count}
- Has standard utility allowance: {has_utility_sua}
- Documented asset count: {asset_count}

Your job:
1. Ask the household standard recertification interview questions one at a time, in the order below.
2. Listen to their answer. If their answer is complete and consistent with what we have on file, affirm and move on.
3. If their answer reveals a change (new job, new address, new household member, change in income), flag it clearly and note what documentation they'll need to bring.
4. If they seem uncertain or anxious, reassure them — the county interviewer is not trying to trip them up.
5. After all questions, summarize any flags and next steps.

Standard CA recertification questions:
{questions_for_state}

Begin with the first question now.
```

`questions_for_state` is pulled from `packages/recert-engine/src/interview/questions.ts` — a static, reviewable list per state. Not AI-generated. Counsel can review and approve this list as a compliance artifact.

---

## MVP scope vs. deferred

| Feature | MVP (T11) | Deferred |
|---|---|---|
| Practice chatbot (text) | ✓ | |
| Reminder SMS (T-30, T-7, T-0) | ✓ (needs T14) | |
| Navigator recerts dashboard | ✓ | |
| iOS practice chatbot flow | ✓ | |
| Packet refresh on practice flags | ✓ | |
| Voice call prep (Twilio outbound call) | | post-MVP |
| Post-interview IVR capture | | post-MVP |
| County portal submission of refreshed packet | | T13 dependency |
| Spanish-language practice session | | post-MVP (translate questions) |
| ML-based deadline estimation from county data | | post-MVP |

---

## Migration plan (PR-level)

1. **DB migration** — add `recertifications` + `recert_practice_sessions` tables. RLS policies: same pattern as `snap_packets` — scoped to `org_id` claim.
2. **Scaffold `packages/recert-engine/`** — deadline math + question bank only. No AI call yet.
3. **Enrollment-api routes** — `POST /recert/:packetId/init`, `GET /recert/:packetId`, `PATCH`. Tests.
4. **Practice routes** — `POST /recert/:recertId/practice/start` with `NoopAI` (returns static first question). Confirm route structure works.
5. **Wire Anthropic client** — real AI orchestration behind a `RECERT_AI_ENABLED` env flag. Off by default in test/dev.
6. **Reminder scheduler** — nightly cron stub (logs without sending). Wire `NoopTwilioAdapter`.
7. **Dashboard page** — `/navigator/recertifications` table. Read-only first.
8. **iOS chat UI** — SwiftUI chat view over practice routes. Minimal: shows question, accepts free-text response, shows next question. No custom keyboard.
9. **T14 unlocks**: real Twilio adapter drops in; SMS sends live.
10. **T13 unlocks**: packet refresh outcome gets a "submit to county" button.

---

## Dependencies

- `@civica/snap-qc-engine` — for packet refresh (re-run `evaluate()`)
- `@anthropic-ai/sdk` — AI interview orchestration (server-side only, never in browser)
- Twilio SDK (T14 implements; T11 uses interface only)
- Supabase Postgres — recertifications + practice sessions
- `zod` — schema validation
- No new infra; runs in existing enrollment-api Fly.io app

---

## Sign-off

Locked in `/plan-eng-review` coordinator session 2026-05-18. T11 design deliverable complete. Spawned T11 build session consumes this document as authoritative spec.
