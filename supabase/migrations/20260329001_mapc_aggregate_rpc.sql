-- Harden MAPC aggregate RPCs to support app-wide counters while preserving row privacy.

create or replace function public.mapc_call_sums_for_current_user()
returns table (
  total_completed_calls bigint,
  monthly_completed_calls bigint,
  user_completed_calls bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) filter (
      where event_type = 'call_completion_confirmed'
        and completed is true
    ) as total_completed_calls,
    count(*) filter (
      where event_type = 'call_completion_confirmed'
        and completed is true
        and created_at >= date_trunc('month', now())
    ) as monthly_completed_calls,
    count(*) filter (
      where event_type = 'call_completion_confirmed'
        and completed is true
        and user_id = auth.uid()
    ) as user_completed_calls
  from public.mapc_call_events;
$$;

revoke all on function public.mapc_call_sums_for_current_user() from public;
grant execute on function public.mapc_call_sums_for_current_user() to authenticated;

create or replace function public.mapc_call_issue_sums(issue_ids text[])
returns table (
  issue_id text,
  total_completed_calls bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with requested as (
    select distinct nullif(trim(value), '') as issue_id
    from unnest(coalesce(issue_ids, '{}'::text[])) as value
    where nullif(trim(value), '') is not null
  ),
  counts as (
    select
      lower(m.issue_id) as issue_id_key,
      count(*)::bigint as total_completed_calls
    from public.mapc_call_events m
    join requested r
      on lower(m.issue_id) = lower(r.issue_id)
    where m.event_type = 'call_completion_confirmed'
      and m.completed is true
    group by lower(m.issue_id)
  )
  select
    r.issue_id,
    coalesce(c.total_completed_calls, 0)::bigint as total_completed_calls
  from requested r
  left join counts c
    on lower(r.issue_id) = c.issue_id_key;
$$;

revoke all on function public.mapc_call_issue_sums(text[]) from public;
grant execute on function public.mapc_call_issue_sums(text[]) to authenticated;
