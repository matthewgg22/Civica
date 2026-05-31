# intake-help eval script

Validates Tier B prompt quality for `POST /v1/intake/help` (Civica's universal contextual-help explainer) before Monday TestFlight ship.

## When to run

**Saturday EOD before TestFlight ship**, per the dashboard-state-coverage design doc (T11). Re-run any time the system prompt in `apps/enrollment-api/src/routes/intake-help.ts` is edited.

## What it does

Sends **50** representative SNAP-intake question titles (**35 EN + 15 ES**) to the live endpoint and asserts, per response:

- HTTP `200`.
- `explainer_text` is a non-empty string.
- `explainer_text` is under **1,500 chars** (rough proxy for the design doc's "under 200 words" target).
- `explainer_text` does NOT contain any forbidden eligibility-commitment phrase (mirror of the route's server-side safety filter, run client-side against the final response so a prompt regression can't sneak past).
- `was_filtered: true` is recorded as a **soft note**, not a failure. The safety net firing is doing its job; the prompt may still need a polish pass, but it isn't a launch blocker.

These four are the **hard-fail gate** — they are the only checks that affect the exit code.

Samples span all the intake categories from the design doc:

1. Income reporting (paystubs, wages, pay frequency)
2. Gig / 1099 income (rideshare, delivery, platform work)
3. Self-employment income (gross income + business expenses)
4. Household composition (who buys/prepares food, boarders, dependents)
5. Work hours / ABAWD requirements (hours, age band, caregiver exemptions)
6. Asset disclosure (bank accounts, savings, vehicles)
7. Citizenship and immigration status
8. Deductions and expenses (rent/mortgage, utilities, medical, childcare, insurance)
9. Child support paid
10. Address and residency (including no stable housing)
11. Student / LPIE (half-time enrollment, approved education programs)
12. Expedited service (low income + low resources screen)
13. Change reporting (income / household / address changes)

**15 of the 50** titles are in Spanish, written natively (not word-for-word translations of the English samples), to exercise the bilingual path.

### Optional `question_helper` grounding path

About **10** of the samples (a mix of EN and ES) also send an optional `question_helper` string — a plausible on-screen helper paragraph that the iOS form shows beneath the question. The request contract is:

```jsonc
{
  "question_title": "...",      // required
  "locale": "en" | "es",        // required
  "question_helper": "..."       // optional — when present, the route grounds the explainer on it
}
```

Samples carrying a helper are marked `+helper` in the per-sample status line, so you can confirm the grounding path is being exercised.

## Optional LLM grader (`ANTHROPIC_API_KEY`)

When the `ANTHROPIC_API_KEY` environment variable is set, each explainer is additionally graded by a second Claude call (model `claude-sonnet-4-6`, via `https://api.anthropic.com/v1/messages` with the `x-api-key` header and `anthropic-version: 2023-06-01`). The grader rates the explainer **1–5** on three axes — **clarity**, **accuracy**, and **plain-language helpfulness** for a SNAP applicant — and raises a boolean `fail` flag if the explainer commits to an eligibility outcome (e.g. "you qualify") or refuses to help. It returns a small JSON object the script parses.

If `ANTHROPIC_API_KEY` is **not** set, grading is skipped entirely; the run prints a one-line note (`LLM grader: SKIPPED`) and runs only the forbidden-phrase + length + status checks. Enabling the grader can **never** make a previously-passing run fail.

```bash
# Enable the grader for a run:
ANTHROPIC_API_KEY=sk-ant-... node tools/intake-help-eval.mjs --base-url=http://localhost:8787
```

### Grades are advisory (soft warnings)

- A per-sample **average below 3** (or a grader-raised `fail`) is logged as a **SOFT WARNING** and listed under "Low-grade warnings" in the summary. It does **not** affect the exit code.
- The **hard-fail gate stays** the forbidden-phrase + non-empty + status-200 checks. So gate semantics never regress when the grader is on.
- A grading attempt that errors (network, non-200 from the Messages API, or unparseable output) is a **soft note** too — the sample's hard assertions still decide pass/fail; the grade just shows as `n/a`.

### How to read the grades

Per sample, the status line appends e.g. `[grade 4.3 c5/a4/h4]`:

- the first number is the **average** of the three axes,
- `c` / `a` / `h` are **clarity / accuracy / helpfulness** (each 1–5),
- `GRADER-FAIL` appears if the grader raised its `fail` flag,
- `(warn)` appears if this sample is a soft warning (avg < 3 or grader-fail).

The summary block then reports:

- `grade:    avg N.NN/5 over K graded (clarity ... / accuracy ... / helpfulness ...)` — the run-wide averages,
- `warnings: N  (...SOFT, does not affect exit code)` — count of soft warnings,
- a **Low-grade warnings** section listing each flagged sample with its per-axis scores and the grader's short note,
- a **Grading errors** section if any grader calls failed.

Use the warnings to decide whether to tune `TIER_B_SYSTEM_PROMPT_EN/ES` before ship — but a clean exit code (`0`) with low grades still means the safety gate passed.

## How to run

The script paces itself at ~6.5 s between requests to stay below the route's strict-tier rate limit (10/min per anonymous-id). A full 50-sample run takes about **5.5 minutes** end-to-end (a little longer with the grader enabled, since each sample adds one extra Claude round-trip before the pacing delay).

### Locally against wrangler dev

```bash
# Terminal 1
cd apps/enrollment-api
wrangler dev   # starts on http://localhost:8787

# Terminal 2 — from the repo root
node tools/intake-help-eval.mjs --base-url=http://localhost:8787

# …or with the optional grader:
ANTHROPIC_API_KEY=sk-ant-... node tools/intake-help-eval.mjs --base-url=http://localhost:8787
```

The local dev path requires `ANTHROPIC_API_KEY` available to the Worker — either via `wrangler secret put ANTHROPIC_API_KEY` once, or via a `.dev.vars` file in `apps/enrollment-api/` for local-only runs. (That key is for the Worker. The script reads `ANTHROPIC_API_KEY` from its **own** process env to decide whether to grade; when running locally both can be the same key.)

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

### Environment

| Var | Required | Effect |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | no | When set, enables the optional LLM grader. When absent, grading is skipped and only the hard assertions run. |

## How to interpret pass / fail

| Result | Exit | Meaning |
| --- | --- | --- |
| **All 50 pass** the hard gate (filtered count + low grades optional) | `0` | Prompt is locked. Safe to ship. |
| **Any hard-fail** | `1` | Tune the prompt and re-run. Each failure prints the matched forbidden phrase or the failed assertion. |
| **Usage error** (missing `--base-url`, wrong sample count) | `2` | Fix the invocation / sample set and re-run. |

Specifically:

- **`forbidden phrase matched: "..."`** — The model said something eligibility-prescriptive that the server-side filter missed. Tighten the hard-rule list in `TIER_B_SYSTEM_PROMPT_EN/ES` or add the phrase to `FORBIDDEN_PHRASES_EN/ES` in `intake-help.ts` and ship a route patch alongside the prompt edit.
- **`explainer_text is N chars (> 1500 ...)`** — Response too long for the iOS sheet's design budget. Tighten the prompt's formatting rule (currently "2–5 short sentences").
- **`expected status 200, got 4xx/5xx`** — Worker is down, rate-limited (run the script with a fresh `--anonymous-id`), or `ANTHROPIC_API_KEY` is not configured server-side.
- **`fetch failed: ...`** — Network or DNS issue; not a prompt problem.
- **`was_filtered: true` notes** — Logged at the end of the run for human review. Each note shows the title and the SAFE_FALLBACK response that was returned. If the same category trips the filter on every run, edit the prompt to steer the model away from that drift pattern.
- **Low-grade warnings** — Advisory only (when the grader is enabled). Tune the prompt for clarity/accuracy/helpfulness, but they do not block ship on their own.

## Why the script does not auto-grade Spanish vs. English language match

The route's prompt already includes a "respond in `<locale>` only" hard rule (rule #5). A dedicated language-match assertion would need a heavy dependency (a language detector). The optional LLM grader's **accuracy** axis will partially catch a locale drift (an English explainer for a Spanish question reads as inaccurate/unhelpful), and the EN/ES forbidden-phrase lists are split by locale, but a subtle mid-response language switch still shows up only on a manual eyeball check. Re-read the printed responses for the 15 ES samples before declaring the run clean.
