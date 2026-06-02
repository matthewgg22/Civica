-- snap_enrollment — Migration: Eligibility & Integrity Engine persistence (L5).
--
-- The determination of record + its rule trace. This is the artifact the
-- Eligibility and Integrity Engine produces (docs/plans/snap-rules-matrix.md):
-- a cited, replayable eligibility determination for a real packet. Today Civica
-- produces NO such artifact in prod (the county/BenefitsCal determines); these
-- two tables are where the engine-of-record's output lands.
--
-- BOUNDARY (consistency vs payment error): these tables record what OUR rules
-- determined and why (rule-execution consistency — provable by replay). They do
-- NOT record whether we were right vs actual policy — that is the Payment
-- Integrity Engine (packet_outcomes 20260600 + reconcile). Keep that firewall:
-- nothing here may carry a measured-PER / error-dollar value.
--
-- eligibility_determinations — one row per determination EVENT (append-only;
--   never updated — a re-run inserts a new row, so history + replay are intact).
--   `as_of_date` + `engine_version` are what make a determination reproducible:
--   replay re-resolves the rules in force on as_of_date and must reproduce
--   `outcome`. `facts_snapshot` freezes the inputs + per-fact provenance at
--   decision time so replay reads the same facts, not whatever was verified later.
--   `outcome='pending'` is the engine's INSUFFICIENT_INFORMATION — NOT a denial;
--   `needs` lists the fact keys that were missing / below the verification bar.
--
-- eligibility_rule_trace — one row per rule the engine fired, in order. Each
--   row's `citation_id` resolves to a regulatory authority (7 CFR / MPP / CMR);
--   null until the citation registry (L0) is structured. This is the audit trail:
--   "which rule, citing which reg, produced this determination."
--
-- POSTURE: this starts as a READ-ONLY SHADOW. A batch sweep (service_role) reads
--   packets, runs the engine, and writes determinations here — it changes nothing
--   in the live applicant/navigator flow. RLS is therefore locked to service_role;
--   applicant / navigator read policies are deferred until a determination is
--   actually surfaced in-product.

CREATE TABLE snap_enrollment.eligibility_determinations (
  determination_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id           UUID        NOT NULL
                        REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE CASCADE,
  -- The rules build that produced this (EligibilityResult.rules_version), e.g.
  -- "federal-20260601/CA-20251001". Half of the replay key (with as_of_date).
  engine_version      TEXT        NOT NULL,
  state_code          TEXT        NOT NULL,
  -- WHICH event is being determined. Defaults to initial; recert/periodic land
  -- here once the recert path feeds the engine (see snap-rules-matrix.md §3).
  action_type         TEXT        NOT NULL DEFAULT 'initial' CHECK (action_type IN (
                        'initial',
                        'recertification',
                        'periodic_report',
                        'change_report'
                      )),
  -- WHEN: the date the rules are pinned to (packet filing date). The other half
  -- of the replay key — re-resolve the rules in force on this date.
  as_of_date          DATE        NOT NULL,
  -- The four-state outcome (engine EligibilityStatus). 'pending' = the engine's
  -- INSUFFICIENT_INFORMATION: we could not decide because a required fact was
  -- missing / unverified. NOT a denial.
  outcome             TEXT        NOT NULL CHECK (outcome IN (
                        'eligible',
                        'ineligible',
                        'eligible_with_conditions',
                        'pending'
                      )),
  -- Monthly benefit in cents (EligibilityResult.monthly_benefit). Null unless eligible.
  allotment_cents     INTEGER,
  -- The fact keys that blocked a decision (populated when outcome='pending') or
  -- the required verifications outstanding. This is the collection-gap signal.
  needs               TEXT[]      NOT NULL DEFAULT '{}',
  ineligibility_reason TEXT,
  -- The engine input (constructed Household) + per-fact provenance/status, FROZEN
  -- at decision time. This is what makes replay reproducible and what the Payment
  -- Integrity Engine reads as prediction features.
  facts_snapshot      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  determined_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Latest determination per packet: ORDER BY determined_at DESC LIMIT 1.
CREATE INDEX ON snap_enrollment.eligibility_determinations (packet_id, determined_at DESC);

CREATE TABLE snap_enrollment.eligibility_rule_trace (
  trace_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  determination_id  UUID        NOT NULL
                      REFERENCES snap_enrollment.eligibility_determinations(determination_id) ON DELETE CASCADE,
  seq               INTEGER     NOT NULL,         -- evaluation order
  rule_id           TEXT        NOT NULL,         -- TestOutcome.test_name
  citation_id       TEXT,                         -- 7 CFR / MPP / CMR — null until L0 registry exists
  predicate_result  BOOLEAN,                      -- TestOutcome.passes
  threshold         NUMERIC,                      -- TestOutcome.threshold
  actual            NUMERIC,                      -- TestOutcome.actual
  effect_applied    TEXT,                         -- what the rule did (EMIT / WAIVE / MODIFY / ...)
  notes             TEXT,                         -- TestOutcome.notes (human-readable why)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON snap_enrollment.eligibility_rule_trace (determination_id, seq);

-- Locked to service_role: the shadow batch writes; nothing else reads yet.
ALTER TABLE snap_enrollment.eligibility_determinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_enrollment.eligibility_rule_trace      ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON snap_enrollment.eligibility_determinations TO service_role;
GRANT SELECT, INSERT ON snap_enrollment.eligibility_rule_trace      TO service_role;

COMMENT ON TABLE snap_enrollment.eligibility_determinations IS
  'Eligibility & Integrity Engine determination of record (L5). Append-only; one '
  'row per determination event. (engine_version, as_of_date) is the replay key; '
  'facts_snapshot freezes inputs+provenance for reproducibility. outcome=pending '
  'is INSUFFICIENT_INFORMATION (not a denial); needs lists the blocking fact keys. '
  'Records rule-execution consistency only — never measured PER (see packet_outcomes). '
  'Starts service_role-only (read-only shadow); applicant/navigator read deferred.';

COMMENT ON TABLE snap_enrollment.eligibility_rule_trace IS
  'Per-rule audit trail for an eligibility_determination. One row per fired rule, '
  'in seq order; citation_id resolves to the regulatory authority (null until the '
  'L0 citation registry is structured). This is the "which rule, citing which reg" '
  'audit trail that makes a determination defensible.';
