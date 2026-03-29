-- Harden identity binding and least-privilege access controls.
-- This migration enables RLS and applies explicit policies for user-owned access.
-- Service role writes (backend) continue to work via BYPASSRLS.

do $$
begin
  if to_regclass('public.mapv_plans') is not null then
    execute 'alter table public.mapv_plans enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'mapv_plans' and column_name = 'user_id'
    ) then
      execute 'alter table public.mapv_plans alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists mapv_plans_own_all on public.mapv_plans';
    execute 'create policy mapv_plans_own_all on public.mapv_plans for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;

  if to_regclass('public.feedback') is not null then
    execute 'alter table public.feedback enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'feedback' and column_name = 'user_id'
    ) then
      execute 'alter table public.feedback alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists feedback_own_all on public.feedback';
    execute 'create policy feedback_own_all on public.feedback for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;

  if to_regclass('public.device_tokens') is not null then
    execute 'alter table public.device_tokens enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'device_tokens' and column_name = 'user_id'
    ) then
      execute 'alter table public.device_tokens alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists device_tokens_own_all on public.device_tokens';
    execute 'create policy device_tokens_own_all on public.device_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;

  if to_regclass('public.scheduled_notifications') is not null then
    execute 'alter table public.scheduled_notifications enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'scheduled_notifications' and column_name = 'user_id'
    ) then
      execute 'alter table public.scheduled_notifications alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists scheduled_notifications_own_all on public.scheduled_notifications';
    execute 'create policy scheduled_notifications_own_all on public.scheduled_notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;

  if to_regclass('public.address_search_events') is not null then
    execute 'alter table public.address_search_events enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'address_search_events' and column_name = 'user_id'
    ) then
      execute 'alter table public.address_search_events alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists address_search_events_own_all on public.address_search_events';
    execute 'create policy address_search_events_own_all on public.address_search_events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;

  if to_regclass('public.mapc_call_events') is not null then
    execute 'alter table public.mapc_call_events enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'mapc_call_events' and column_name = 'user_id'
    ) then
      execute 'alter table public.mapc_call_events alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists mapc_call_events_own_all on public.mapc_call_events';
    execute 'create policy mapc_call_events_own_all on public.mapc_call_events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;

  if to_regclass('public.user_election_status') is not null then
    execute 'alter table public.user_election_status enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'user_election_status' and column_name = 'user_id'
    ) then
      execute 'alter table public.user_election_status alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists user_election_status_own_all on public.user_election_status';
    execute 'create policy user_election_status_own_all on public.user_election_status for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;

  if to_regclass('public.issue_catalog') is not null then
    execute 'alter table public.issue_catalog enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'issue_catalog' and column_name = 'user_id'
    ) then
      execute 'alter table public.issue_catalog alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists issue_catalog_select_own on public.issue_catalog';
    execute 'create policy issue_catalog_select_own on public.issue_catalog for select to authenticated using (user_id = auth.uid())';
  end if;

  if to_regclass('public.call_briefs') is not null then
    execute 'alter table public.call_briefs enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'call_briefs' and column_name = 'user_id'
    ) then
      execute 'alter table public.call_briefs alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists call_briefs_select_own on public.call_briefs';
    execute 'create policy call_briefs_select_own on public.call_briefs for select to authenticated using (user_id = auth.uid())';
  end if;

  if to_regclass('public.call_logs') is not null then
    execute 'alter table public.call_logs enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'call_logs' and column_name = 'user_id'
    ) then
      execute 'alter table public.call_logs alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists call_logs_select_own on public.call_logs';
    execute 'create policy call_logs_select_own on public.call_logs for select to authenticated using (user_id = auth.uid())';
  end if;

  if to_regclass('public.call_launch_events') is not null then
    execute 'alter table public.call_launch_events enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'call_launch_events' and column_name = 'user_id'
    ) then
      execute 'alter table public.call_launch_events alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists call_launch_events_select_own on public.call_launch_events';
    execute 'create policy call_launch_events_select_own on public.call_launch_events for select to authenticated using (user_id = auth.uid())';
  end if;

  if to_regclass('public.call_events') is not null then
    execute 'alter table public.call_events enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'call_events' and column_name = 'user_id'
    ) then
      execute 'alter table public.call_events alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists call_events_select_own on public.call_events';
    execute 'create policy call_events_select_own on public.call_events for select to authenticated using (user_id = auth.uid())';
  end if;

  if to_regclass('public.call_score_snapshots') is not null then
    execute 'alter table public.call_score_snapshots enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'call_score_snapshots' and column_name = 'user_id'
    ) then
      execute 'alter table public.call_score_snapshots alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists call_score_snapshots_select_own on public.call_score_snapshots';
    execute 'create policy call_score_snapshots_select_own on public.call_score_snapshots for select to authenticated using (user_id = auth.uid())';
  end if;

  if to_regclass('public.leaderboard_call_rollups') is not null then
    execute 'alter table public.leaderboard_call_rollups enable row level security';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'leaderboard_call_rollups' and column_name = 'user_id'
    ) then
      execute 'alter table public.leaderboard_call_rollups alter column user_id set default auth.uid()';
    end if;
    execute 'drop policy if exists leaderboard_call_rollups_select_own on public.leaderboard_call_rollups';
    execute 'create policy leaderboard_call_rollups_select_own on public.leaderboard_call_rollups for select to authenticated using (user_id = auth.uid())';
  end if;

  if to_regclass('public.issue_legislation_links') is not null then
    execute 'alter table public.issue_legislation_links enable row level security';
    execute 'drop policy if exists issue_legislation_links_select_own on public.issue_legislation_links';
    execute $policy$
      create policy issue_legislation_links_select_own
      on public.issue_legislation_links
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.issue_catalog ic
          where ic.issue_id = issue_legislation_links.issue_id
            and ic.user_id = auth.uid()
        )
      )
    $policy$;
  end if;

  if to_regclass('public.rep_issue_signals') is not null then
    execute 'alter table public.rep_issue_signals enable row level security';
    execute 'drop policy if exists rep_issue_signals_select_own on public.rep_issue_signals';
    execute $policy$
      create policy rep_issue_signals_select_own
      on public.rep_issue_signals
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.issue_catalog ic
          where ic.issue_id = rep_issue_signals.issue_id
            and ic.user_id = auth.uid()
        )
      )
    $policy$;
  end if;

  if to_regclass('public.member_statement_sources') is not null then
    execute 'alter table public.member_statement_sources enable row level security';
    execute 'drop policy if exists member_statement_sources_read on public.member_statement_sources';
    execute 'drop policy if exists member_statement_sources_write on public.member_statement_sources';
  end if;
end
$$;
