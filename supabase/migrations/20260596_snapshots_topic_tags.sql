-- regops — Topic tags on snapshots (P1).
--
-- Source design: docs/designs/regops-engine.md §"Topic classification"
-- (planned for OBBBA depth + multi-source filtering).
--
-- Adds a topic_tags TEXT[] column to regops.snapshots so the orchestrator
-- can stamp each Success outcome with classifier-derived topics. The
-- classifier is keyword-based in v1 (no LLM dependency) — it searches
-- the snapshot's title + description for known terms and emits matched
-- topic tags from a controlled vocabulary.
--
-- Why an array column, not a join table:
--   - One snapshot can carry multiple topics (e.g., an ACL about ABAWD
--     work requirements gets ['abawd', 'work_requirement']).
--   - The query pattern is "give me all snapshots tagged X" which is
--     an array containment check — fast on a GIN index.
--   - A join table would add a write per topic per snapshot, which is
--     wasteful for the cardinality we expect (~50 snapshots/day across
--     all sources, 10-12 topics in the vocabulary).
--
-- Backwards compatibility:
--   - Default empty array, so existing rows + adapters that don't yet
--     classify just write [] and queries don't break.
--   - The column is NOT NULL (with default), enforcing that every
--     snapshot has a definitive answer about its topics — even if that
--     answer is "no recognized topics."

alter table regops.snapshots
  add column topic_tags text[] not null default array[]::text[];

comment on column regops.snapshots.topic_tags is
  'Classifier-derived topic tags from a controlled vocabulary in '
  'packages/regops-engine/src/classifier/topic-classifier.ts. Empty '
  'array means no recognized topics. Multiple tags are common '
  '(e.g., an ABAWD work-requirements ACL gets [''abawd'', '
  '''work_requirement'']).';

-- GIN index for fast `where topic_tags @> array['obbba']` queries —
-- this is the primary read pattern (counsel + dashboard surfaces).
create index snapshots_topic_tags_gin_idx
  on regops.snapshots using gin (topic_tags);
