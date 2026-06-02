-- snap_enrollment — Migration: shared origin-tagged outcome ledger (§5).
--
-- The single ground-truth ledger BOTH wings read (docs/plans/snap-rules-matrix.md
-- + payment-integrity-engine.md): the prevention wing (pre-determination) and the
-- error-rate wing (post-hoc). One row per outcome LABEL on a determination.
--
-- TWO firewalls, orthogonal — both enforced here:
--   • sampling_origin (random | targeted) — the RATE-ESTIMABILITY firewall. The
--     payment error rate is estimable ONLY from the random arm; the targeted
--     review/clarification queue must NEVER feed a reported rate. The generated
--     column `counts_toward_rate` bakes this in (random AND authoritative label).
--   • label_source — the FIDELITY firewall (mirrors packet_outcomes 20260600):
--     only internal_gold / qc_overlap are authoritative truth for the accuracy
--     rate. self_report / county_authoritative are lagging approve/deny signals
--     (they live in packet_outcomes); engine = our own (non-truth) determination.
--
-- Ground truth is the Civica-internal gold-standard re-determination
-- (b_star_gold_cents) on a RANDOM internal sample — NOT federal QC-overlap
-- (statistically near-empty for a single-state pilot). error_cents = b_hat − b_star
-- is the measured determination error; τ (region-conditional) is applied by the
-- scoring spine, not here.
--
-- POSTURE: read-only shadow — service_role only; no rate is published until the
-- gold standard exists and the pre-registered causal design runs.

CREATE TABLE snap_enrollment.eligibility_outcomes (
  outcome_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  determination_id    UUID        NOT NULL
                        REFERENCES snap_enrollment.eligibility_determinations(determination_id) ON DELETE CASCADE,
  packet_id           UUID        NOT NULL
                        REFERENCES snap_enrollment.snap_packets(packet_id) ON DELETE CASCADE,
  -- B̂ (our determination) and B* (the gold-standard re-determination, when sampled).
  b_hat_cents         INTEGER,
  b_star_gold_cents   INTEGER,                  -- null until internally re-determined
  error_cents         INTEGER,                  -- b_hat − b_star_gold (null until gold exists)
  region              TEXT        NOT NULL,     -- the 4-way region at determination
  -- RATE-ESTIMABILITY firewall: the rate uses the random arm ONLY.
  sampling_origin     TEXT        NOT NULL CHECK (sampling_origin IN ('random', 'targeted')),
  -- Where the label came from. Only the authoritative truth sources move the rate.
  label_source        TEXT        NOT NULL CHECK (label_source IN (
                        'engine',                 -- our determination, not truth
                        'internal_gold',          -- Civica gold-standard re-determination (PRIMARY truth)
                        'qc_overlap',              -- rare federal QC intersection (external check)
                        'self_report',             -- applicant-reported approve/deny (see packet_outcomes)
                        'county_authoritative'     -- county-confirmed approve/deny (see packet_outcomes)
                      )),
  -- THE FIREWALL, in the schema: a row counts toward the measured accuracy rate
  -- ONLY if it is random AND an authoritative truth label. Everything else
  -- (targeted, engine-only, lagging approve/deny) is excluded by construction.
  counts_toward_rate  BOOLEAN GENERATED ALWAYS AS (
                        sampling_origin = 'random'
                        AND label_source IN ('internal_gold', 'qc_overlap')
                      ) STORED,
  meta                JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON snap_enrollment.eligibility_outcomes (packet_id, created_at DESC);
CREATE INDEX ON snap_enrollment.eligibility_outcomes (counts_toward_rate) WHERE counts_toward_rate;

-- The ONLY rows rate math may read. Querying through this view (not the table)
-- makes the random/authoritative firewall impossible to bypass by accident.
CREATE VIEW snap_enrollment.v_rate_eligible_outcomes AS
  SELECT * FROM snap_enrollment.eligibility_outcomes WHERE counts_toward_rate;

ALTER TABLE snap_enrollment.eligibility_outcomes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON snap_enrollment.eligibility_outcomes TO service_role;
GRANT SELECT ON snap_enrollment.v_rate_eligible_outcomes TO service_role;

COMMENT ON TABLE snap_enrollment.eligibility_outcomes IS
  'Shared origin-tagged outcome ledger for both integrity wings. One row per label '
  'on an eligibility_determination. sampling_origin (random|targeted) is the rate '
  'firewall; counts_toward_rate (generated) = random AND authoritative truth label. '
  'Ground truth = internal gold-standard re-determination (b_star_gold_cents), NOT '
  'federal QC-overlap. Read-only shadow; service_role only; no rate published until '
  'the gold standard + causal design exist.';
