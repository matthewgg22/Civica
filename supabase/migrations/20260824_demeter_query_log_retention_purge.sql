-- Demeter query-log retention, enforced by the database (#926).
--
-- The policy was already implemented in TypeScript and invoked by a Vercel
-- cron. That worked, but it could not START working until an operator set
-- CRON_SECRET in Vercel — the route fails closed without it — so the promise
-- in the Privacy Policy stayed intent wearing the grammar of fact.
--
-- This repo already had a retention mechanism that runs: pg_cron, scheduled by
-- 20260529, executing snap_enrollment.purge_snap_retention() at 04:00 UTC every
-- day and verified active in prod. Enforcement belongs next to the data, on the
-- schedule that already exists, with nothing to configure in a hosting dashboard.
--
-- WHAT EXPIRES IS THE TEXT, NOT THE ROW. The non-text columns — citations,
-- certainty, verifier outcome, token counts — are the accuracy dataset the
-- grounded-rate work runs on, and none of them is personal information.
-- Deleting whole rows would destroy the evidence base to solve a privacy
-- problem that only the text creates.
--
-- THE WINDOWS BELOW ARE DUPLICATED FROM lib/legal/types.ts, and that is the one
-- real cost of moving this into SQL. The TypeScript version imported
-- RETENTION_DAYS so a policy promising 7 days could never be enforced at 90.
-- SQL cannot import a TS constant, so demeter-retention.pg.test.ts reads both
-- this file and that one and fails if they disagree. The guarantee is kept; it
-- is just enforced by a test now instead of by the module system.

-- ===========================================================================
-- 1. The sweep.
-- ===========================================================================

create or replace function snap_enrollment.purge_mae_query_log_retention(
  p_dry_run boolean default false
)
returns table (tier text, window_days integer, rows_swept bigint)
language plpgsql
security definer
set search_path = snap_enrollment
as $$
declare
  -- Keep in step with RETENTION_DAYS in apps/web/lib/legal/types.ts.
  -- A test fails if these drift apart.
  c_ordinary constant integer := 7;
  c_flagged  constant integer := 30;
  -- Not NULL: question_redacted is NOT NULL, and a tombstone also
  -- distinguishes "expired on schedule" from "never had one", which matters
  -- when reading an old row during an accuracy review.
  c_tombstone constant text := '[expired per retention policy]';
  r record;
  v_rows bigint;
begin
  for r in
    -- Two tiers, because a row flagged for accuracy review is the one somebody
    -- may still need to read.
    select * from (values
      ('ordinary'::text, c_ordinary, false),
      ('flagged'::text,  c_flagged,  true)
    ) as t(tier, days, flagged)
  loop
    if p_dry_run then
      select count(*) into v_rows
      from snap_enrollment.mae_query_log m
      where m.created_at < now() - make_interval(days => r.days)
        -- Already-expired rows are skipped, so a daily run touches only what
        -- newly crossed the line rather than rewriting the whole table.
        and m.question_redacted <> c_tombstone
        and (case when r.flagged then m.unrecognized_count > 0
                                 else m.unrecognized_count = 0 end);
    else
      with swept as (
        update snap_enrollment.mae_query_log m
        set question_redacted = c_tombstone,
            answer            = null
        where m.created_at < now() - make_interval(days => r.days)
          and m.question_redacted <> c_tombstone
          and (case when r.flagged then m.unrecognized_count > 0
                                   else m.unrecognized_count = 0 end)
        returning 1
      )
      select count(*) into v_rows from swept;
    end if;

    tier := r.tier;
    window_days := r.days;
    rows_swept := v_rows;
    return next;
  end loop;
end;
$$;

comment on function snap_enrollment.purge_mae_query_log_retention(boolean) is
  'Blanks expired question/answer text in mae_query_log. Ordinary rows at 7 '
  'days, rows flagged for accuracy review (unrecognized_count > 0) at 30. '
  'Columns other than the text are retained deliberately — they are the '
  'accuracy dataset and carry no personal information. Pass true to count '
  'without writing. Scheduled daily 04:10 UTC via pg_cron.';

-- ===========================================================================
-- 2. Schedule it.
-- ===========================================================================
--
-- A SEPARATE JOB from snap-purge-retention-daily rather than a second
-- statement inside purge_snap_retention(): the two policies are unrelated
-- (7-year packet records vs 7/30-day chat text), answer to different
-- obligations, and either may need to be paused without the other.
--
-- 04:10 rather than 04:00 so the two sweeps do not contend for the same
-- autovacuum window.
--
-- GUARDED on pg_cron actually being installed. Supabase has it; a stock
-- postgres image does not, and the migration-replay CI job applies this file
-- to exactly that. Without the guard this migration would have to join the
-- skip list, which would mean the function above never gets replayed either.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('demeter-purge-query-log-daily');
    exception when others then
      null;  -- no prior schedule; fine on first install
    end;

    perform cron.schedule(
      'demeter-purge-query-log-daily',
      '10 4 * * *',
      $job$ select snap_enrollment.purge_mae_query_log_retention(); $job$
    );
  else
    raise notice 'pg_cron not installed — function created, schedule skipped';
  end if;
end;
$$;
