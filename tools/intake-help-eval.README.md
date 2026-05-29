# intake-help eval script

Validates Tier B prompt quality for `POST /v1/intake/help` (Civica's universal contextual-help explainer) before Monday TestFlight ship.

## When to run

**Saturday EOD before TestFlight ship**, per the dashboard-state-coverage design doc (T11). Re-run any time the system prompt in `apps/enrollment-api/src/routes/intake-help.ts` is edited.

## What it does

Sends 20 representative SNAP-intake question titles (15 EN + 5 ES) to the live endpoint and asserts, per response:

- HTTP `200`.
- `explainer_text` is a non-empty string.
- `explainer_text` is under **1,500 chars** (rough proxy for the design doc's "under 200 words" target).
- `explainer_text` does NOT contain any forbidden eligibility-commitment phrase (mirror of the route's server-side safety filter, run client-side against the final response so a prompt regression can't sneak past).
- `was_filtered: true` is recorded as a **soft note**, not a failure. The safety net firing is doing its job; the prompt may still need a polish pass, but it isn't a launch blocker.

Samples cover the 10 categories from the design doc:

1. Income reporting (paystubs, 1099s, gig income)
2. Household composition
3. Work hours / ABAWD requirements
4. Asset disclosure
5. Citizenship and immigration status
6. Deductions and expenses (rent, medical, childcare)
7. Child support paid or received
8. Address and residency
9. School enrollment / student status
10. Self-employment income

At least 5 of the 20 titles are in Spanish to exercise the bilingual path.

## How to run

The script paces itself at ~6.5 s between requests to stay below the route's strict-tier rate limit (10/min per anonymous-id). Full run takes about **2 minutes** end-to-end.

### Locally against wrangler dev

```bash
# Terminal 1
cd apps/enrollment-api
wrangler dev   # starts on http://localhost:8787

# Terminal 2 — from the repo root
node tools/intake-help-eval.mjs --base-url=http://localhost:8787
```

The local dev path requires `ANTHROPIC_API_KEY` available to the Worker — either via `wrangler secret put ANTHROPIC_API_KEY` once, or via a `.dev.vars` file in `apps/enrollment-api/` for local-only runs.

### Against the deployed worker

```bash
# Replace with the URL printed by `wrangler deploy`.
node tools/intake-help-eval.mjs \
  --base-url=https://civica-enrollment-api.workers.dev \
  --anonymous-id=eval-$(date +%Y%m%d)
```

Passing an explicit `--anonymous-id` is useful when you want the run to be greppable in server logs alongside the structured violation events that the route logs when the safety filter triggers.

### CLI flags

| Flag | Required | Default | Notes |
| --- | --- | --- | --- |
| `--base-url` | yes | — | Worker base URL. Trailing slash is stripped. The script appends `/v1/intake/help`. |
| `--anonymous-id` | no | random UUID | Sent as `x-anonymous-id`. Use a stable value when you want one bucket in the rate-limiter for the whole run. |

## How to interpret pass / fail

| Result | Exit | Meaning |
| --- | --- | --- |
| **All 20 pass** (filtered count optional) | `0` | Prompt is locked. Safe to ship. |
| **Any fail** | `1` | Tune the prompt and re-run. Each failure prints the matched forbidden phrase or the failed assertion. |

Specifically:

- **`forbidden phrase matched: "..."`** — The model said something eligibility-prescriptive that the server-side filter missed. Tighten the hard-rule list in `TIER_B_SYSTEM_PROMPT_EN/ES` or add the phrase to `FORBIDDEN_PHRASES_EN/ES` in `intake-help.ts` and ship a route patch alongside the prompt edit.
- **`explainer_text is N chars (> 1500 ...)`** — Response too long for the iOS sheet's design budget. Tighten the prompt's formatting rule (currently "2–5 short sentences").
- **`expected status 200, got 4xx/5xx`** — Worker is down, rate-limited (run the script with a fresh `--anonymous-id`), or `ANTHROPIC_API_KEY` is not configured server-side.
- **`fetch failed: ...`** — Network or DNS issue; not a prompt problem.
- **`was_filtered: true` notes** — Logged at the end of the run for human review. Each note shows the title and the SAFE_FALLBACK response that was returned. If the same category trips the filter on every run, edit the prompt to steer the model away from that drift pattern.

## Why the script does not auto-grade Spanish vs. English language match

The route's prompt already includes a "respond in `<locale>` only" hard rule (rule #5). A language-match assertion in this script would need either a heavy dependency (a language detector) or a Claude-grades-Claude pass — both out of scope for a 2-minute eval. If the model drifts on locale, the filtered notes section will surface it because the EN forbidden-phrase list won't fire on Spanish text and vice versa, but a mid-response language switch will show up only as a manual eyeball check. Re-read the printed responses for the 5 ES samples before declaring the run clean.
