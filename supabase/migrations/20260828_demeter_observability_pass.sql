-- Demeter observability: what the answer log could not tell us (#1049 follow-on).
--
-- ONE MIGRATION, DELIBERATELY. Migrations here are pasted by hand, and the
-- last gap between "written" and "applied" cost twelve days of the accuracy
-- record with no outward sign. Four separate files would be four chances to
-- paste three of them.
--
-- Idempotent throughout: safe to re-run, and safe to paste twice.

-- ── 1. The answer log learns three things it never recorded ────────────────
--
-- lang: mae_feedback has had it since the start; the answer log has not. So
--   "are the Spanish answers worse than the English ones" has been
--   unanswerable for a product that ships in four languages.
-- worksheet_mode: `mode` is public/case (who is asking). This is ask/estimate
--   (what they are doing), and they are not the same question.
-- latency: no timing at all. An answer that takes 30 seconds and one that
--   takes 3 are indistinguishable in this table.
alter table snap_enrollment.mae_query_log
  add column if not exists lang text,
  add column if not exists worksheet_mode text,
  add column if not exists ttft_ms integer,
  add column if not exists total_ms integer,
  -- Set when the reader pressed Stop. An abandoned answer is not a failed
  -- one, and lumping them together would flatter the failure rate.
  add column if not exists stopped boolean not null default false;

comment on column snap_enrollment.mae_query_log.lang is
  'Answer language (en/es/vi/zh). Enables per-language quality review.';
comment on column snap_enrollment.mae_query_log.worksheet_mode is
  'ask | estimate — what the reader was doing, distinct from `mode`.';
comment on column snap_enrollment.mae_query_log.ttft_ms is
  'Milliseconds to first streamed token.';
comment on column snap_enrollment.mae_query_log.total_ms is
  'Milliseconds from request to last token.';
comment on column snap_enrollment.mae_query_log.stopped is
  'The reader pressed Stop. Not a failure — do not count it as one.';

-- Per-language quality, the query this exists for.
create index if not exists mae_query_log_lang_idx
  on snap_enrollment.mae_query_log (created_at desc, lang)
  where lang is not null;

-- ── 2. Everything that is NOT an answer ────────────────────────────────────
--
-- THE HOLE THIS FILLS. Every early return in /api/demeter — 429, the daily IP
-- cap, at-capacity, malformed input — returns BEFORE the audit sink is even
-- constructed. So a person who hit a rate limit and left was invisible, and
-- "how often does someone hit a wall" could not be asked at all.
--
-- Conversions live here too, in the same table and keyed the same way, so the
-- funnel from "asked a question" to "took the outline away" is one query
-- rather than a join across three tables that do not share a key.
--
-- NO FREE TEXT. `detail` is for codes and counts. The question itself belongs
-- in mae_query_log, where the retention job can reach it; nothing here should
-- ever need tombstoning, and a jsonb blob is exactly where PII goes to hide.
create table if not exists snap_enrollment.demeter_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Same browser-generated id as mae_query_log.session_id, so the two join.
  -- Dies with the tab; never sent to the model; not an account.
  session_id text,
  turn_index integer,
  -- 'failure' or 'conversion'. Deliberately text, not an enum: a new event
  -- name should not need a migration, and an enum comparison against a
  -- non-label is the exact footgun #679 was.
  kind text not null,
  -- e.g. rate_limited, ip_daily_cap, at_capacity, bad_request, stream_error,
  --      saved, pdf_downloaded, outline_emailed, portal_opened
  event text not null,
  -- HTTP status where there was one.
  status integer,
  scope_state text,
  lang text,
  -- Codes and counts only. See above.
  detail jsonb not null default '{}'::jsonb
);

comment on table snap_enrollment.demeter_events is
  'Everything that is not an answer: refusals, errors, and conversions. '
  'Joins to mae_query_log on session_id. Carries no free text by design.';

create index if not exists demeter_events_created_idx
  on snap_enrollment.demeter_events (created_at desc);
create index if not exists demeter_events_kind_idx
  on snap_enrollment.demeter_events (created_at desc, kind, event);
create index if not exists demeter_events_session_idx
  on snap_enrollment.demeter_events (session_id, turn_index)
  where session_id is not null;

-- SERVICE ROLE ONLY. Written by the server, read by staff tooling. No
-- anon/authenticated policy is granted, so RLS denies everything else by
-- default — the same posture mae_query_log has.
alter table snap_enrollment.demeter_events enable row level security;
