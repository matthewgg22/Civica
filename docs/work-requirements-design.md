# Work Requirements Tracking Design (OBBBA §10102)

**Status:** LOCKED 2026-05-18 via /plan-eng-review T12 design pass
**Pattern:** New `work_requirements` domain in snap-rules + enrollment-api; navigator dashboard extension
**Owner:** Coordinator session (claude/clever-albattani-816917)
**Urgency:** §10102 effective date is in the statute; CA counties have zero existing infrastructure for this

## Summary

OBBBA §10102 expands SNAP work requirements to adults 18–54 who do not have dependents under age 14 (previously the ABAWD cutoff was 18–49 with no dependents). California counties currently have no systematic way to track whether affected households are meeting work requirements, documenting exemptions, or approaching the 3-month time limit. Civica's navigator dashboard is the natural fit — navigators already have the household data; adding a work-requirement status layer is additive, not a new system.

This is also a county sales asset for the §10106 admin-cost pitch: counties that demonstrate proactive work-requirement tracking reduce their audit exposure and can argue for lower effective PER.

## §10102 Rules (locked from statutory text)

**Who is subject:**
- Adults 18–54 (new upper age: previously 49)
- No dependent child under age 14 in the household
- Not otherwise exempt (see exemptions below)

**Work requirement:**
- Must work or participate in a qualifying work program at least 20 hours/week (averaged monthly)
- OR be enrolled in a qualifying education/training program

**Time limit:**
- 3 months of SNAP benefits in any 36-month period without meeting the work requirement
- After 3 months: benefits terminate until requirement is met for 30 days

**Exemptions (tracked by Civica):**
- Physically or mentally unfit for work (documented disability/medical)
- Pregnant
- Caretaker of dependent child under 6 (note: §10102 raises this from "any child" to "under 6" — households with children 6–13 may now be subject)
- Already meeting SNAP E&T or other qualifying work program participation
- Residing in an area with a USDA-approved waiver (waiver counties — CA has had broad waivers; post-OBBBA waiver availability is restricted)
- Age 18–17 (minors — already exempt under base statute)
- Receiving disability-based benefits (SSI, SSDI, GA)

**CA-specific:** California's prior broad ABAWD waivers covered most counties. Post-OBBBA, USDA waiver criteria are tightened. CA counties that previously relied on statewide waivers now need to track individual compliance. This is the gap Civica fills.

---

## Data model

### `snap_enrollment.work_requirement_statuses` table

```sql
CREATE TABLE snap_enrollment.work_requirement_statuses (
  wr_status_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id         UUID NOT NULL REFERENCES snap_enrollment.snap_packets(packet_id),
  org_id            UUID NOT NULL REFERENCES snap_enrollment.orgs(org_id),
  applicant_id      UUID NOT NULL,               -- denorm for fast lookup

  -- Subject determination
  is_subject        BOOLEAN NOT NULL,            -- true if household member(s) meet §10102 criteria
  subject_member_ids UUID[] NOT NULL DEFAULT '{}', -- which household members are subject
  determination_basis TEXT NOT NULL,             -- 'rules_engine' | 'navigator_override'
  determined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Exemption (if not subject or exempt)
  exemption_type    TEXT CHECK (exemption_type IN (
    'disability', 'pregnancy', 'caretaker_under_6', 'qualifying_program',
    'waiver_county', 'ssdi_ssi', 'none'
  )),
  exemption_documented_at TIMESTAMPTZ,
  exemption_expires_at    TIMESTAMPTZ,           -- for temporary exemptions (pregnancy, etc.)
  exemption_notes         TEXT,

  -- Compliance tracking (for subject, non-exempt households)
  compliance_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (compliance_status IN ('unknown', 'compliant', 'at_risk', 'non_compliant')),
  hours_reported_per_week NUMERIC(4,1),          -- self-reported or documented
  compliance_verified_at  TIMESTAMPTZ,
  compliance_notes        TEXT,

  -- Time limit clock
  months_used_in_window   INT NOT NULL DEFAULT 0, -- 0–3 in the 36-month window
  window_start_date       DATE,
  time_limit_reached_at   TIMESTAMPTZ,

  -- Navigator tracking
  last_reviewed_by  UUID,                        -- navigator user_id
  last_reviewed_at  TIMESTAMPTZ,
  next_review_due   DATE,

  -- Audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON snap_enrollment.work_requirement_statuses (packet_id);
CREATE INDEX ON snap_enrollment.work_requirement_statuses (org_id, compliance_status);
CREATE INDEX ON snap_enrollment.work_requirement_statuses (next_review_due)
  WHERE compliance_status IN ('unknown', 'at_risk');
```

### `snap_enrollment.work_requirement_events` table (audit log)

```sql
CREATE TABLE snap_enrollment.work_requirement_events (
  event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wr_status_id    UUID NOT NULL REFERENCES snap_enrollment.work_requirement_statuses(wr_status_id),
  org_id          UUID NOT NULL,
  actor_id        UUID NOT NULL,                 -- navigator user_id
  event_type      TEXT NOT NULL CHECK (event_type IN (
    'subject_determination', 'exemption_granted', 'exemption_revoked',
    'compliance_verified', 'hours_updated', 'time_limit_incremented',
    'time_limit_reset', 'navigator_note'
  )),
  payload         JSONB NOT NULL,                -- event-specific data
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON snap_enrollment.work_requirement_events (wr_status_id);
```

---

## Package: `packages/snap-rules/src/states/california/work_requirements.ts`

Extend the existing `packages/snap-rules` package (already exists from PR #95/#96 — the JSON DSL rules engine).

Add a new rule module:

```typescript
// packages/snap-rules/src/work-requirements/index.ts

export type WorkRequirementInput = {
  state: 'CA' | 'MA';
  householdMembers: HouseholdMember[];   // from QC engine types
  hasWaiverCounty: boolean;              // looked up from county FIPS
};

export type WorkRequirementResult = {
  isSubject: boolean;
  subjectMemberIds: string[];
  exemptionType: ExemptionType | null;
  exemptionReason: string | null;
  timeLimitApplicable: boolean;
  citations: Citation[];                  // 7 CFR 273.24, OBBBA §10102
};

// Pure function — no I/O
export function evaluateWorkRequirement(input: WorkRequirementInput): WorkRequirementResult
```

Logic:
1. Filter household members aged 18–54
2. For each: check if they have a dependent child under 14 in the household → not subject
3. For remaining: check exemption flags (disability, pregnancy, caretaker of child under 6, SSI/SSDI)
4. If `hasWaiverCounty: true` → not subject (waiver covers them)
5. Return subject members + applicable exemption + citations

Add to `packages/snap-rules/test/work-requirements.test.ts`:
- Single adult no dependents → subject
- Adult with child age 8 (under 14) → not subject (§10102 cutoff)
- Adult with child age 15 (over 14) → subject (new §10102 expansion)
- Pregnant adult → exempt
- Disabled adult → exempt
- Waiver county → not subject
- CA vs MA comparison

---

## Enrollment-API routes

New file: `apps/enrollment-api/src/routes/work-requirements.ts`

```
POST   /v1/enrollment/work-requirements/:packetId/evaluate
  → Runs evaluateWorkRequirement() against the packet's household data
  → Upserts a work_requirement_statuses row
  → Returns determination + citations

GET    /v1/enrollment/work-requirements/:packetId
  → Returns current WR status for the packet

PATCH  /v1/enrollment/work-requirements/:wrStatusId
  → Navigator updates: exemption_type, hours_reported_per_week, compliance_status, notes
  → Inserts a work_requirement_events row for the change

POST   /v1/enrollment/work-requirements/:wrStatusId/events
  → Navigator logs a manual event (e.g. "called household, confirmed hours")
```

---

## Navigator dashboard (T12 scope — hold UI until design review)

New page: `/navigator/work-requirements` — a queue of packets where:
- `is_subject = true`
- `compliance_status IN ('unknown', 'at_risk')`
- Sorted by `next_review_due ASC`

Columns: Applicant (initials), Subject Members, Exemption Status, Hours Reported, Months Used (of 3), Next Review

Each row links to the packet detail page with a "Work Requirements" tab added.

**Hold this UI until design review completes.** Backend routes + rules engine are the build scope for T12 chip.

---

## County waiver lookup

Post-OBBBA, USDA is republishing which counties retain ABAWD waivers. For MVP:
- Hardcode a `waiverCounties` set in `packages/snap-rules/src/work-requirements/waiver-counties.ts`
- Initially empty (conservative — assume no waivers until confirmed)
- Update as USDA publishes FY2026 waiver approvals
- The county FIPS is already resolved by T9 (`packages/state-connectors`)

---

## Citations

- 7 CFR 273.24 — SNAP work requirements (base rule)
- OBBBA §10102 — expansion to age 54, dependent cutoff to age 14
- OBBBA §10102(b) — waiver restriction post-OBBBA
- MA: DTA ABAWD policy (equivalent state implementation)

These are emitted in `WorkRequirementResult.citations` — same `Citation` type as the QC engine.

---

## Migration plan (PR-level)

1. **DB migration** — `work_requirement_statuses` + `work_requirement_events` tables + RLS + indexes
2. **`packages/snap-rules` extension** — `evaluateWorkRequirement()` pure function + waiver county stub + tests
3. **Enrollment-api routes** — evaluate, GET, PATCH, events. Tests for each.
4. **Wire auto-evaluation on packet init** — when a packet reaches `status='submitted'`, auto-run `evaluateWorkRequirement()` and store the result. Low overhead; navigator sees WR status immediately without manual trigger.
5. **Dashboard UI** — hold until design review. Then: `/navigator/work-requirements` queue + packet detail tab.

---

## What this design does NOT include (deferred)

- **County reporting.** WR compliance data is for navigator use only in MVP; CDSS/DPSS reporting is post-MVP.
- **E&T program integration.** Qualifying work program verification (the actual hour tracking) is manual navigator entry in MVP. Automated program data feed is a future integration.
- **USDA waiver API.** No such API exists. Waiver county list is manually maintained.
- **Time-limit clock automation.** The `months_used_in_window` counter is navigator-entered in MVP. Automated increment from county data feed is post-MVP.

---

## Sign-off

Locked in `/plan-eng-review` coordinator session 2026-05-18. T12 design deliverable complete. Spawned T12 build session consumes this document as authoritative spec.
