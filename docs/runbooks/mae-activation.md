# Runbook — activate Mae (caseworker assistant) in staging and measure

Mae (the staff SNAP assistant in the CBO dashboard) ships fully built but
**inert** until the operator sets one secret. This runbook turns it on in a
**non-production** environment first and runs the answer eval so we have real
numbers before considering any wider use. Hands-on-keyboard steps only the
operator can do are marked **[OPERATOR]**.

> Order matters: the answer eval (step 4) is the gate to having any real measure
> of Mae's correctness. Do not widen exposure (and never expose Mae to applicants
> or on the public `/cbo-preview`) before the eval passes and counsel has signed
> `docs/mae-citation-signoff.md`.

## 1. [OPERATOR] Set secrets (staging dashboard / `civica-api` project)
- `ANTHROPIC_API_KEY` — enables generation. Without it `/api/mae` returns 503
  and the panel shows "not configured."
- `SUPABASE_SERVICE_ROLE_KEY` — enables the audit + feedback writes. Without it
  those degrade to structured logs (Mae still answers).
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — already set for
  the dashboard.

## 2. [OPERATOR] Apply the migrations (Supabase SQL editor — Civica project)
Civica migrations apply by pasting into the dashboard SQL editor (no automated
pipeline). Apply, in order:
- `supabase/migrations/20260606_mae_query_log.sql` (audit log)
- `supabase/migrations/20260607_mae_feedback.sql` (feedback)

Verify: `select count(*) from snap_enrollment.mae_query_log;` returns 0 rows, no
error.

## 3. Smoke test (staging)
Sign in as a staff user (navigator/supervisor/admin), open **Ask Mae**, ask
"What counts as a shelter deduction?" Confirm:
- A streamed answer citing `7 CFR 273.9(d)(6)`.
- A **Citation check** trailer (✓ in sources).
- A **Sources as of …** footer.
- 👍/👎 feedback appears; a 👍 writes a row to `snap_enrollment.mae_feedback`.
- A row lands in `snap_enrollment.mae_query_log` (PII-scrubbed question).

## 4. Run the answer-faithfulness eval (the gate)
With the key available to the shell:

```sh
cd apps/dashboard
ANTHROPIC_API_KEY=sk-ant-... pnpm mae:eval
```

This generates a real Mae answer for each gold question (`lib/mae/eval/answer-eval.ts`)
through the exact production system assembly and scores it: citation
faithfulness, verify/defer disclaimer, off-scope refusal, expected-cite, and PII
non-echo. It prints `MAE LIVE ANSWER EVAL — N/M passed` with the failing checks
per case. **Re-run after every prompt or corpus change.** Without the key it is
skipped (so CI stays green).

## 5. Gate criteria before widening
- [ ] Step 4 eval passes (all gold cases).
- [ ] `docs/mae-citation-signoff.md` Section B signed by counsel.
- [ ] (Recommended) red-team pass + the LLM-judge correctness layer before any
      **partner-CBO** exposure.

## Rollback
Unset `ANTHROPIC_API_KEY` → `/api/mae` 503s and the panel shows "not configured."
No data migration to reverse; the log/feedback tables can remain (empty).
