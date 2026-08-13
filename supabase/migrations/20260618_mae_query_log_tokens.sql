-- Token counts on the answer audit log, so spend can be attributed.
--
-- WHY: fewer than 30 short prompts cost about a dollar, and that could not be
-- investigated at all. mae_query_log had twenty columns and not one of them was
-- a token count — the orchestrator computed usage, handed it to
-- events.onUsage, and nothing wrote it down. So spend attributed to no state,
-- no turn, no retry, and no extraction call, and any trimming would have been
-- guesswork nobody could check afterwards.
--
-- Both columns are SUMMED over the whole answer, retry included: a
-- citation-failure retry is a second full generation and has to show up as one
-- expensive row rather than disappearing into the average.
--
-- NULL, not 0, when unknown. Attempt 1 can be aborted mid-stream with no final
-- message, in which case usage genuinely is not known — and a zero there would
-- quietly drag every average down while looking like a measurement.

alter table snap_enrollment.mae_query_log
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer;

comment on column snap_enrollment.mae_query_log.input_tokens is
  'Input tokens, summed across attempt 1 and any retry. NULL when a mid-stream abort left usage unknown.';
comment on column snap_enrollment.mae_query_log.output_tokens is
  'Output tokens, summed across attempt 1 and any retry. NULL when a mid-stream abort left usage unknown.';

-- Cost is a time series and every question about it is "over the last N days",
-- so the index is on time. Kept partial: rows predating this migration have no
-- tokens and would only pad the index.
create index if not exists mae_query_log_tokens_created_idx
  on snap_enrollment.mae_query_log (created_at desc)
  where input_tokens is not null;
