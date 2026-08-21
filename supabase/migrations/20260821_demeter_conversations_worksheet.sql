-- snap_enrollment — the drafted application rides on the saved conversation (#905).
--
-- REVERSES A DELIBERATE OMISSION, deliberately. 20260617 chose NOT to store
-- the worksheet because the estimate rail then promised "Nothing here is
-- saved. Close this tab and it is gone." Two things changed since:
--   1. That copy was rewritten (#703): the rail now states retention honestly,
--      and the SAVED state has its own line — updated with this feature to say
--      the estimate is stored too. The promise this omission protected no
--      longer exists in that form.
--   2. The product now wants the opposite (#898 P2-9, third-pass audit): a
--      real tester read "the whole drafted application tracking is removed at
--      the end" as the product deleting their work. Same-session restores were
--      fixed client-side; a conversation reopened DAYS later can only get its
--      worksheet back from this row.
--
-- What is stored: { mode: 'ask'|'estimate', facts: <extracted household
-- facts>, classification: <engine verdict> | null } — the same JSON the
-- client already holds in sessionStorage for the in-tab restore. Facts are
-- derived from the transcript stored one column over; the classification is
-- recomputable from them. Nothing here is new INFORMATION about the user —
-- it is the working state that makes resume actually resume.
--
-- RLS: existing policies cover this column automatically (they are row-level,
-- not column-level) — only the owner can read or write it.
--
-- The route tolerates this column being absent (it retries the write without
-- the worksheet), so code-before-migration deploy order is safe. Until this is
-- pasted, saves succeed without the worksheet and resume behaves as before.
--
-- Applies via the Supabase dashboard SQL editor (NOT `db push --linked`).

ALTER TABLE snap_enrollment.demeter_conversations
  ADD COLUMN IF NOT EXISTS worksheet jsonb
    CHECK (worksheet IS NULL OR jsonb_typeof(worksheet) = 'object');

COMMENT ON COLUMN snap_enrollment.demeter_conversations.worksheet IS
  'The estimate rail''s state at last save: { mode, facts, classification }. NULL for rows saved before #905 and for ask-mode conversations with nothing gathered. Validated and size-bounded in the route (normalizeWorksheet).';

-- The old comments promised the opposite; keep the schema telling the truth.
COMMENT ON COLUMN snap_enrollment.demeter_conversations.messages IS
  'The chat''s own Msg[] shape: role user|assistant|divider. The worksheet column carries the drafted application (#905); the saved-state privacy copy says so.';
COMMENT ON TABLE snap_enrollment.demeter_conversations IS
  'Saved public-chat conversations, owned by an individual auth user. The chat stays free and anonymous; an account only buys save/resume. Stores the transcript AND the estimate-rail worksheet (#905). RLS is the real access control here (routes use the user-scoped client).';
