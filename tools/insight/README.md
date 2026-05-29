# `/insight` — canonical insight from the error-rate truth point

Turns the live error-rate **truth point** into a **cited finding**, with a
human approval gate. It is the ergonomic "give the data, get an insight" loop —
except the numbers come from the canonical snapshot and the output lands in the
ledger, so insights don't drift between AI chats.

Method of record: [`docs/findings/2026-05-29-error-rate-truth-point.md`](../../docs/findings/2026-05-29-error-rate-truth-point.md).

## Why the skill lives here (and not only in `.claude/skills/`)

`.claude/skills/` is **gitignored** — skills created there are local and
disappear with the worktree that made them (this is exactly how the earlier
`/finding` skill was lost). So the **source of truth is the committed
`SKILL.md` in this folder**; you install a copy into the gitignored skills dir.
Versioned, reviewable, reproducible — the same anti-drift posture as the
findings themselves.

## Install (makes `/insight` invocable)

From the repo root:

```bash
mkdir -p .claude/skills/insight
cp tools/insight/SKILL.md .claude/skills/insight/SKILL.md
```

Re-run after pulling changes to `tools/insight/SKILL.md` to stay current.

## Use

In a Civica session: `/insight` (optionally `/insight <topic>`).

It will:
1. **Fetch** the latest `snap_enrollment.v_error_rate_current` run — via
   `fetch-truth-point.mjs` when service creds are set, else by asking you to
   paste a one-line SQL result.
2. **Draft** the key insights from *only* those numbers (engagement-implied vs
   baseline, distance to the projection, measured PER once n ≥ 30), with
   provenance.
3. **Show** the full finding for your **approval** — nothing is written yet.
4. On OK: write `docs/findings/<date>-<slug>.md`, append `INDEX.md`,
   `make findings`, and `/sync-gbrain`.

If the snapshot is empty (refresh hasn't run), it stops and tells you to
populate it first — it will not fabricate numbers from constants.

## `fetch-truth-point.mjs`

Prints the truth point as JSON; never throws (always exits 0 with an
`{available: false, reason, ...}` object on any failure) so the skill can branch
cleanly. Needs `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. If
`@supabase/supabase-js` won't resolve from the repo root (pnpm isolation), run
it through a workspace that has it:

```bash
pnpm --filter dashboard exec node ../../tools/insight/fetch-truth-point.mjs
```

…or just use the SQL fallback the script prints.
