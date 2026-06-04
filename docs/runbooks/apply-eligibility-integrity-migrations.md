# Apply Eligibility-Integrity Ledger Migrations (#429)

**Audience:** operator with Civica Supabase **Project Owner** access (the linked CLI project IS prod — pasting via the dashboard SQL Editor is the project convention; see [reference_supabase_migration_apply](../../~/.claude/projects/-Users-matthewgreer-gentis-Developer-Civica/memory/reference_supabase_migration_apply.md) auto-memory).

**Time:** ~10 minutes total. ~3 min per migration paste + verification queries.

**What this does:** activates the two `service_role`-only ledger tables that the read-only Eligibility & Integrity Engine shadow sweep writes to. **No data changes** — applies brand-new tables; nothing migrates into them until `backend/civic_api/snap/shadow/sweep.py` runs.

**Why not `supabase db push --linked`:** the linked CLI project is PROD. Per project convention every Civica migration applies via the dashboard SQL Editor paste so each apply is an explicit human action.

---

## Pre-flight (already verified — 2026-06-03)

The branch `claude/migrations-prep-issue-429` ran these read-only checks against PROD via the Supabase MCP. All gates pass:

| Gate | Status |
|---|---|
| Last applied migration is `20260589` (`distress_flags`) | ✓ confirmed via `list_migrations` |
| `20260602` + `20260603` NOT applied | ✓ confirmed |
| `snap_enrollment` schema exists | ✓ |
| `snap_enrollment.snap_packets` exists (FK target) | ✓ — 15 columns |
| `pgcrypto` extension installed (for `gen_random_uuid()`) | ✓ |
| Target tables NOT present (`eligibility_determinations`, `eligibility_rule_trace`, `eligibility_outcomes`, `v_rate_eligible_outcomes`) | ✓ — all 4 absent |

If you re-run the pre-flight before pasting, drop this into the SQL Editor:

```sql
-- Pre-flight: should return all false (none applied yet) on the bottom row.
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='snap_enrollment' AND table_name='snap_packets') AS snap_packets_exists,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='snap_enrollment' AND table_name='eligibility_determinations') AS det_exists,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='snap_enrollment' AND table_name='eligibility_rule_trace') AS trace_exists,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='snap_enrollment' AND table_name='eligibility_outcomes') AS outcomes_exists,
  EXISTS (SELECT 1 FROM information_schema.views
          WHERE table_schema='snap_enrollment' AND table_name='v_rate_eligible_outcomes') AS rate_view_exists;
-- Expected before apply:
-- snap_packets_exists=true, others all false.
```

---

## Apply order

**Order matters.** `20260603` has a FK to `eligibility_determinations` which is created by `20260602` — paste them in numeric order, NOT in parallel tabs.

### Step 1 — Apply `20260602_eligibility_determinations.sql`

1. Open the Civica project's Supabase dashboard → **SQL Editor** → New query.
2. Paste the entire contents of [`supabase/migrations/20260602_eligibility_determinations.sql`](../../supabase/migrations/20260602_eligibility_determinations.sql).
3. Hit **Run**.
4. Expected: green checkmark, ~50ms. The DDL creates two tables + two indexes + enables RLS + grants service_role.

Then in a fresh query tab, verify:

```sql
-- Verify 20260602 applied cleanly.
SELECT
  -- (a) Both tables exist.
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='snap_enrollment' AND table_name='eligibility_determinations') AS det_exists,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='snap_enrollment' AND table_name='eligibility_rule_trace') AS trace_exists,
  -- (b) RLS is enabled on both.
  (SELECT relrowsecurity FROM pg_class WHERE oid='snap_enrollment.eligibility_determinations'::regclass) AS det_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid='snap_enrollment.eligibility_rule_trace'::regclass) AS trace_rls;
-- Expected after Step 1: det_exists=true, trace_exists=true, det_rls=true, trace_rls=true.

-- Verify service_role has SELECT + INSERT, and that anon + authenticated have NOTHING.
SELECT grantee, privilege_type, table_name
FROM information_schema.role_table_grants
WHERE table_schema='snap_enrollment'
  AND table_name IN ('eligibility_determinations', 'eligibility_rule_trace')
ORDER BY table_name, grantee, privilege_type;
-- Expected: only `service_role` rows. Two rows per table (SELECT, INSERT).
-- ⚠ If you see `anon` or `authenticated` here, STOP — that breaks the
--    shadow firewall.
```

### Step 2 — Apply `20260603_eligibility_outcomes_ledger.sql`

1. Same dashboard, new query tab.
2. Paste [`supabase/migrations/20260603_eligibility_outcomes_ledger.sql`](../../supabase/migrations/20260603_eligibility_outcomes_ledger.sql).
3. Hit **Run**. The DDL creates the `eligibility_outcomes` table + two indexes + `v_rate_eligible_outcomes` view + RLS + service_role grants.

Verify (this is the critical firewall check):

```sql
-- (a) Table + view exist; RLS on the table; service_role grants only.
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='snap_enrollment' AND table_name='eligibility_outcomes') AS outcomes_exists,
  EXISTS (SELECT 1 FROM information_schema.views
          WHERE table_schema='snap_enrollment' AND table_name='v_rate_eligible_outcomes') AS rate_view_exists,
  (SELECT relrowsecurity FROM pg_class
   WHERE oid='snap_enrollment.eligibility_outcomes'::regclass) AS outcomes_rls;
-- Expected: outcomes_exists=true, rate_view_exists=true, outcomes_rls=true.

-- (b) Service-role-only grants — anon/authenticated must be absent.
SELECT grantee, privilege_type, table_name
FROM information_schema.role_table_grants
WHERE table_schema='snap_enrollment'
  AND table_name IN ('eligibility_outcomes', 'v_rate_eligible_outcomes')
ORDER BY table_name, grantee;
-- Expected: only `service_role` rows.
```

### Step 3 — The measurement-firewall canary

This is the critical check the issue body asks for: the generated column `counts_toward_rate` must be `true` ONLY for `sampling_origin = 'random'` AND `label_source IN ('internal_gold', 'qc_overlap')`. Bake-test it with a tiny in-place INSERT-then-rollback transaction so no rows persist:

```sql
-- Service-role-only check; run as the project owner via the SQL Editor
-- (the Editor connects as the postgres superuser, which is RLS-exempt).
BEGIN;

-- First, fabricate a determination row to satisfy the FK (rolled back below).
INSERT INTO snap_enrollment.eligibility_determinations
  (packet_id, engine_version, state_code, as_of_date, outcome, allotment_cents)
SELECT packet_id, 'firewall-canary', 'CA', CURRENT_DATE, 'eligible', 0
FROM snap_enrollment.snap_packets
LIMIT 1
RETURNING determination_id \gset

-- Now insert the 5 combinations and read back counts_toward_rate.
WITH cases(label, sampling_origin, label_source) AS (VALUES
  ('random+internal_gold',   'random',   'internal_gold'),
  ('random+qc_overlap',      'random',   'qc_overlap'),
  ('random+engine',          'random',   'engine'),
  ('targeted+internal_gold', 'targeted', 'internal_gold'),
  ('random+self_report',     'random',   'self_report')
)
INSERT INTO snap_enrollment.eligibility_outcomes
  (determination_id, packet_id, region, sampling_origin, label_source)
SELECT :'determination_id'::uuid,
       (SELECT packet_id FROM snap_enrollment.eligibility_determinations
        WHERE determination_id = :'determination_id'::uuid),
       'ca-bay',
       c.sampling_origin,
       c.label_source
FROM cases c;

-- Expected: ONLY the first two rows have counts_toward_rate=true.
SELECT sampling_origin, label_source, counts_toward_rate
FROM snap_enrollment.eligibility_outcomes
WHERE determination_id = :'determination_id'::uuid
ORDER BY sampling_origin, label_source;

ROLLBACK;
```

Expected result table:

| sampling_origin | label_source | counts_toward_rate |
|---|---|---|
| random | engine | false |
| random | internal_gold | **true** |
| random | qc_overlap | **true** |
| random | self_report | false |
| targeted | internal_gold | false |

If any other combination returns `true`, **stop and file a bug** — the generated-column expression in `20260603_eligibility_outcomes_ledger.sql:50–53` drifted from the firewall spec.

The `ROLLBACK` at the end drops both the canary determination row and the 5 outcome rows; nothing persists.

---

## Post-apply hand-off

1. Add to [`docs/runbooks/prod-activation-2026-05.md`](prod-activation-2026-05.md) Step tracker that 20260602 + 20260603 are applied.
2. Comment on issue #429 with timestamps of the two applies + a screenshot of the firewall canary results.
3. The shadow sweep at [`backend/civic_api/snap/shadow/sweep.py`](../../backend/civic_api/snap/shadow/sweep.py) can now write — but it does not yet run on a schedule. Wiring the cron is **not** part of this runbook; it's separate engineering work (the sweep needs a service_role key wired into the worker env).

## Rollback

If either migration is wrong, drop in reverse order:

```sql
-- ⚠ DESTRUCTIVE. Only run if the apply was wrong AND nothing has written rows.
DROP VIEW IF EXISTS snap_enrollment.v_rate_eligible_outcomes;
DROP TABLE IF EXISTS snap_enrollment.eligibility_outcomes;
DROP TABLE IF EXISTS snap_enrollment.eligibility_rule_trace;
DROP TABLE IF EXISTS snap_enrollment.eligibility_determinations;
```

The migration files are in `supabase/migrations/`, so re-applying after a fix is just another Editor paste.

## Sources

- Migration files: [`supabase/migrations/20260602_eligibility_determinations.sql`](../../supabase/migrations/20260602_eligibility_determinations.sql), [`supabase/migrations/20260603_eligibility_outcomes_ledger.sql`](../../supabase/migrations/20260603_eligibility_outcomes_ledger.sql)
- Companion plan docs: [`docs/plans/snap-rules-matrix.md`](../plans/snap-rules-matrix.md), [`docs/plans/payment-integrity-engine.md`](../plans/payment-integrity-engine.md)
- Issue: [#429](https://github.com/matthewgg22/Civica/issues/429)
- Author of the migrations: PR #427 (`acbe022`).
