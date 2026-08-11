-- snap_enrollment — Saved conversations for the public Demeter chat.
--
-- Launch criterion #6. The chat itself stays FREE and ANONYMOUS: nobody is ever
-- blocked from asking. An account exists for exactly one thing — coming back to
-- a conversation you already had. Anonymous chats keep being recorded the way
-- they already are (mae_query_log, session_id + turn_index); nothing here
-- changes that path.
--
-- WHY THIS TABLE BREAKS THE SCHEMA'S SERVICE-ROLE CONVENTION
--
-- Every other Demeter table (demeter_screenings, demeter_usage, mae_feedback)
-- is service_role-only, with access enforced in the Next.js route, because its
-- subjects are ANONYMOUS or GUEST — a guest_token has no auth.uid() for a
-- policy to key on, so Postgres cannot express the rule and the route has to.
--
-- This table is the first in the schema whose owner IS an ordinary
-- authenticated user, so the rule ("you see your rows and nobody else's") is
-- expressible in Postgres — and therefore belongs in Postgres. The routes use
-- the USER-SCOPED client, not the service key, which makes these policies
-- load-bearing rather than decorative: a bug in a route cannot hand someone
-- else's conversation over, because the database refuses the read.
--
-- Verified against prod 2026-08-11 before choosing this: `authenticated` HAS
-- USAGE on snap_enrollment, `anon` does NOT. So the authenticated path works,
-- and the anonymous one is closed at the schema level before these grants even
-- come into it.
--
-- WHAT IS DELIBERATELY NOT STORED: the worksheet's `facts` and its computed
-- classification. The estimate rail promises "Nothing here is saved. Close this
-- tab and it is gone," and persisting them would make that line false. Resume
-- rebuilds the estimate from the transcript on the next turn, which the
-- worksheet route already does on every turn anyway.
--
-- Applies via the Supabase dashboard SQL editor (NOT `db push --linked`).

-- Shared updated_at trigger function. Already present in prod from 20260516001
-- and this body is BYTE-IDENTICAL to what is live there (checked with
-- pg_get_functiondef before writing this), so the CREATE OR REPLACE is a true
-- no-op on prod. It is restated here so this file applies standalone against a
-- bare database — which is what CI does, since the repo's migration chain
-- cannot be replayed from scratch (issue #679).
CREATE OR REPLACE FUNCTION snap_enrollment.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

CREATE TABLE IF NOT EXISTS snap_enrollment.demeter_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- auth.users.id. No FK: this schema does not reference the auth schema by
  -- convention (see demeter_screenings.created_by). Orphan rows after an
  -- account deletion are cleaned by the service role, not by a cascade.
  user_id     uuid NOT NULL,
  -- Derived from the first question by the route, not typed by the user.
  title       text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  -- [{ role: 'user' | 'assistant' | 'divider', content: string }] — the chat's
  -- own Msg shape, so resume is a straight hydrate with no translation layer.
  --
  -- The length cap is a floor under storage abuse by an authenticated user: the
  -- chat itself only ever sends the last 20 turns to the engine, so 200 is far
  -- above any real conversation and far below anything worth worrying about.
  -- Byte size is bounded in the route (jsonb_array_length cannot see it, and
  -- octet_length on a cast is not immutable enough for a CHECK).
  messages    jsonb NOT NULL DEFAULT '[]'::jsonb
                CHECK (jsonb_typeof(messages) = 'array'
                       AND jsonb_array_length(messages) <= 200),
  -- NULL = the federal floor, exactly as the picker means it. Shape-checked
  -- only: which codes are VERIFIED changes every time a pack lands, and a CHECK
  -- enumerating them would need a migration in lockstep with a TypeScript
  -- constant. The route validates against the real roster.
  state_code  text CHECK (state_code IS NULL OR state_code ~ '^[A-Z]{2}$'),
  -- Same reasoning: ANSWER_LANGS grows (en/es/vi/zh today), so this is a shape
  -- check and the route validates the value.
  lang        text NOT NULL DEFAULT 'en' CHECK (char_length(lang) BETWEEN 2 AND 8),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- The only read path there is: "my conversations, most recently touched first."
CREATE INDEX IF NOT EXISTS demeter_conversations_user_idx
  ON snap_enrollment.demeter_conversations (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS demeter_conversations_updated_at
  ON snap_enrollment.demeter_conversations;
CREATE TRIGGER demeter_conversations_updated_at
  BEFORE UPDATE ON snap_enrollment.demeter_conversations
  FOR EACH ROW EXECUTE FUNCTION snap_enrollment.set_updated_at();

ALTER TABLE snap_enrollment.demeter_conversations ENABLE ROW LEVEL SECURITY;

-- anon gets nothing, ever. It already lacks USAGE on this schema; this makes
-- the intent explicit at the table so a future schema-level grant cannot
-- quietly open the public role onto saved conversations.
REVOKE ALL ON snap_enrollment.demeter_conversations FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON snap_enrollment.demeter_conversations TO authenticated;
GRANT ALL ON snap_enrollment.demeter_conversations TO service_role;

-- Four policies rather than one FOR ALL, so the INSERT rule is written as a
-- WITH CHECK on its own: FOR ALL would let a row be inserted under someone
-- else's user_id if the USING clause were ever loosened for reads.
--
-- `(select auth.uid())` and not a bare `auth.uid()`: the subquery form is
-- evaluated once as an InitPlan instead of per row, which is the difference
-- between an index scan and a re-evaluation for every row examined.

DROP POLICY IF EXISTS demeter_conversations_own_select
  ON snap_enrollment.demeter_conversations;
CREATE POLICY demeter_conversations_own_select
  ON snap_enrollment.demeter_conversations
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS demeter_conversations_own_insert
  ON snap_enrollment.demeter_conversations;
CREATE POLICY demeter_conversations_own_insert
  ON snap_enrollment.demeter_conversations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- USING gates which rows may be updated; WITH CHECK gates what they may become.
--
-- Stated explicitly, though measurement says it is not load-bearing ON ITS OWN:
-- Postgres falls back to USING when WITH CHECK is omitted, and reassigning a row
-- to another user is independently refused by the SELECT policy anyway, because
-- the updated row would no longer be visible to the user writing it. Both were
-- checked against a real database — widening either one alone still refuses the
-- reassignment; only widening BOTH lets a conversation be planted in someone
-- else's list. It is written out so the two rules cannot drift into one: if
-- USING is ever loosened (to let a support role read, say), what a row may
-- BECOME must not loosen with it.
DROP POLICY IF EXISTS demeter_conversations_own_update
  ON snap_enrollment.demeter_conversations;
CREATE POLICY demeter_conversations_own_update
  ON snap_enrollment.demeter_conversations
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS demeter_conversations_own_delete
  ON snap_enrollment.demeter_conversations;
CREATE POLICY demeter_conversations_own_delete
  ON snap_enrollment.demeter_conversations
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

COMMENT ON TABLE snap_enrollment.demeter_conversations IS
  'Saved public-chat conversations, owned by an individual auth user. The chat stays free and anonymous; an account only buys save/resume. RLS is the real access control here (routes use the user-scoped client), unlike the guest-token tables in this schema.';
COMMENT ON COLUMN snap_enrollment.demeter_conversations.messages IS
  'The chat''s own Msg[] shape: role user|assistant|divider. Worksheet facts are deliberately NOT stored — the estimate rail promises nothing is saved.';
