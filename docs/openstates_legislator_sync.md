# Open States -> Supabase Legislator Sync

This pipeline treats the [Open States people repo](https://github.com/openstates/people) as the raw source and Supabase as the serving layer for current state legislators.

## Scope

Included:
- `data/{state}/legislature/*.yml`
- active/current legislative roles only (`upper`, `lower`, `legislature`)

Excluded:
- federal files under `data/us/legislature/*`
- executives/municipalities/retired roles/committees (outside the scoped path and role filter)

## Files Added

- `scripts/ingest_openstates_legislators.py`
- `scripts/upsert_openstates_legislators.py`
- `scripts/sync_openstates_legislators.sh`
- `supabase/migrations/20260405_add_state_legislators_current.sql`

## Normalized Fields

Required serving fields:
- `state`
- `chamber`
- `district`
- `name`
- `title`
- `party`
- `website`
- `phone`

Additional operational fields:
- `legislator_key` (stable upsert key)
- `source_person_id`
- `seat_key`
- `source_file`
- `source_snapshot_url`
- `source_snapshot_as_of`
- `last_synced_at`

## Upsert Key Strategy

`legislator_key` is:

```text
{openstates_person_id}:{state}:{chamber}:{district_slug}
```

Why this key:
- stable across reruns for the same active role
- preserves uniqueness where a person can hold role-specific records
- supports deterministic pruning of stale rows after each full snapshot sync

## Setup

1. Install Python dependencies:

```bash
python3 -m pip install -r requirements-data-sync.txt
```

2. Run the Supabase migration (`supabase db push` or SQL editor):

```bash
supabase db push
```

3. Set database URL for writes:

```bash
export SUPABASE_DB_URL='postgresql://postgres:<password>@<project-ref>.supabase.co:5432/postgres'
```

## Run (State-by-State First)

Single state example:

```bash
python3 scripts/ingest_openstates_legislators.py --state CA
python3 scripts/upsert_openstates_legislators.py
```

Multiple states:

```bash
python3 scripts/ingest_openstates_legislators.py --state CA --state NY --state TX
python3 scripts/upsert_openstates_legislators.py
```

Full default scope (50 states + DC):

```bash
python3 scripts/ingest_openstates_legislators.py
python3 scripts/upsert_openstates_legislators.py
```

One-command helper:

```bash
./scripts/sync_openstates_legislators.sh
```

Prune behavior:
- default upsert mode is `--prune-scope included_states` (safe for state-by-state syncs)
- for a true full-snapshot prune, run with `--prune-scope all`

## Validation Checks To Review

1. **Record count by state**

```sql
select state, count(*) as legislators
from public.state_legislators_current
group by state
order by state;
```

2. **Potential missing contact details**

```sql
select state, chamber, district, name
from public.state_legislators_current
where website is null or phone is null
order by state, chamber, district;
```

3. **Chamber/title sanity**

```sql
select state, chamber, title, count(*)
from public.state_legislators_current
group by state, chamber, title
order by state, chamber, count(*) desc;
```

## Edge Cases / Notes

- Some jurisdictions are unicameral (`chamber = legislature`) and may not map cleanly to upper/lower assumptions.
- Open States role dates can be partial (`YYYY` or `YYYY-MM`); ingest handles this conservatively for current filtering.
- Multi-member districts exist in some states; do **not** enforce uniqueness on `(state, chamber, district)`.
- Official contact data quality varies; website scoring prefers `.gov` and official/homepage links, while phone scoring prefers `capitol` offices.
- If a person appears with multiple active legislative roles, the script keeps unique role keys and skips exact duplicates.

## Automation Path

Recommended production cadence:
- daily scheduled run of `scripts/sync_openstates_legislators.sh`
- alert if total row count changes beyond expected threshold (e.g., >5% day-over-day)
- keep a JSON snapshot artifact per run for rollback/debug
