# RegOps Engine — On-Call Runbook

> **Scope:** Operational response procedures for the RegOps Engine
> (`packages/regops-engine` + `apps/dashboard/app/regops/` + Cloudflare
> Workflows drafter + GitHub Actions polling).
>
> **Audience:** On-call engineer with no prior RegOps context.
> The standard this runbook holds itself to: a contractor unfamiliar with
> the engine can ship a fix in <1 day using only this document + linked
> source files. If you find yourself needing context that isn't in this
> document, update this document as part of the fix.
>
> **Related:**
> [docs/designs/regops-engine.md](../designs/regops-engine.md) (design + decisions),
> [docs/regops/source-adapters.md](./source-adapters.md) (per-source detail),
> [docs/regops/war-room-playbook.md](./war-room-playbook.md) (OBBBA-class events).

---

## Quick reference — Sentry alert → response

| Alert name | Severity | First action | Escalation |
|---|---|---|---|
| `regops.source.fetch_failed` | warn | Check source-health dashboard | After 24h continuous failure: `source_wedged` |
| `regops.source.wedged` | page | Open admin queue, mark source `needs_attention` | Email contact admin (see source-adapters.md) |
| `regops.source.schema_changed` | page | Inspect raw doc; parser likely broken | Fix parser; bump source adapter version |
| `regops.drafter.workflow_failed` | warn | Check Workflows dashboard for step that failed | Retry step manually; if step has known bug, document here |
| `regops.drafter.precision_below_baseline` | page | Block all draft merges until investigated | See "Drafter precision regression" below |
| `regops.drafter.adversarial_fixture_fail` | page | Block all drafter PRs; security control failed | See "Adversarial fixture failure" below |
| `regops.ere.gate_failed` | warn | Inspect ERE diff; usually a real eligibility-affecting change | Expected behavior; gate did its job |
| `regops.ere.coverage_dropped` | page | Held-out set no longer covers all rule paths | See "ERE coverage regression" below |
| `regops.counsel_queue.signoff_orphan` | warn | Reviewer removed mid-flight; reassign drafts | See "Counsel reviewer offboarding" below |
| `regops.cost.soft_cap_warning` | warn | Monthly LLM spend > $250 | Investigate cause; usually a busy regulatory week |
| `regops.cost.war_room_hard_cap` | page | War-room event hit $1500 in LLM spend | Drafter pauses pending human approval to continue |
| `regops.warroom.triggered` | info | New OBBBA-class bill detected | See [war-room-playbook.md](./war-room-playbook.md) |

---

## Source wedged (404, 5xx for >24h)

**Symptom:** `regops.source.wedged` alert fires after 24h continuous failure.
Admin queue shows source in `needs_attention` state. Counsel UI shows the
domain-specific banner "USDA FNS source needs attention — last successful
fetch <N> hours ago."

**Diagnosis:**

1. Check the source URL directly in a browser. Is the site down for everyone,
   or just blocking us?
2. Check `regops_audit_log` for the last successful fetch's response headers.
   Look for `Retry-After`, `X-RateLimit-*`, or `Cloudflare-Ray` (CF often
   shields government sites).
3. If 429 / 403: we're being rate-limited or blocked. Increase `pollIntervalMs`
   in the source's config and reduce concurrent requests.
4. If 5xx persistent: site is broken. Continue backoff polling; alert
   contact admin (see source-adapters.md) by email after 48h.
5. If 404 on a previously-200 URL: schema/URL likely changed. Site moved the
   doc. Update the source config.

**Resolution checklist:**

- [ ] Investigated root cause (network vs. blocked vs. moved vs. broken).
- [ ] Updated polling config if needed.
- [ ] Cleared `needs_attention` flag once 3 successful polls in a row.
- [ ] If contact-admin reached out: documented in `regops_audit_log` metadata.
- [ ] If schema changed: bumped source adapter version + added test fixture
      of the old vs new shape.

**Do NOT:** fabricate data to "fill the gap." Silence is the correct answer.
The stale-rules banner already exists to surface that we're using last-known
values until a real update lands.

---

## Drafter precision regression

**Symptom:** `regops.drafter.precision_below_baseline` alert. Eval suite
ran on a prompt change (E6 CI gate); precision dropped below the baseline
recorded for the prior prompt version.

**Diagnosis:**

1. Check what changed. Was it a prompt edit? An LLM model version bump?
   A new eval-set entry?
2. Compare current prompt's checksum vs. the baseline file's
   `prompt_checksum` field.
3. If prompt changed: was the intent to improve precision, or was it a
   refactor that accidentally hurt?
4. If model version bumped (Anthropic released a new Sonnet/Opus): expected;
   needs explicit re-baselining.
5. If eval set grew: new cases may be harder; check whether overall
   precision dropped or just the new cases failed.

**Resolution paths:**

- **Prompt change broke things:** revert prompt to prior version. Don't
  ship the change without iteration.
- **Model change:** re-baseline explicitly via `bun run regops:rebaseline`
  with a documented reason. Cannot be automated.
- **Hard eval cases:** legitimate quality regression. Iterate on prompt
  until baseline holds.

**Do NOT:** auto-update the baseline. The baseline is a deliberate
human-in-loop step. Auto-update would defeat the gate's purpose.

---

## Adversarial fixture failure

**Symptom:** `regops.drafter.adversarial_fixture_fail` alert. One of the
15-20 prompt-injection fixtures (`packages/regops-engine/test/adversarial/`)
no longer produces the expected rejection.

**Severity:** P0. Security control failed. Block all drafter PRs.

**Diagnosis:**

1. Which fixture failed? Read the fixture description.
2. Did the drafter actually generate a draft that contained the injected
   instruction's output? Or did it merely fail the assertion in a benign
   way?
3. If a real injection slipped through: do NOT ship any drafts until
   mitigated.

**Resolution:**

- Strengthen the schema-lock (the drafter's output should never include
  text matching the injection's intent — schema enforcement is the primary
  control).
- Strengthen the quarantine (source text must never sit in instruction
  position of the prompt; verify in `packages/regops-engine/src/drafter/`).
- Add a more aggressive fixture covering the new attack shape.
- If the failure was a flake (LLM non-determinism), run the fixture 5
  times and confirm consistent rejection before unblocking.

---

## ERE coverage regression

**Symptom:** `regops.ere.coverage_dropped` alert. The held-out eval dataset
no longer hits 100% of declared rule paths.

**Cause:** Almost always one of:
- A new rule was added to `FederalDefaultRules.swift` / `ca.json` / `ma.json`
  without a corresponding held-out eval added.
- The held-out set was edited and a rule-path-exercising case was removed.

**Resolution:**

- Identify the uncovered rule path from the meta-test output.
- Add a held-out eval that exercises it. Use representative real-world data,
  not synthetic edge cases.
- Re-run the meta-test until it passes.

**Do NOT:** loosen the meta-test threshold. 100% coverage is the discipline
that makes the gate real.

---

## Counsel reviewer offboarding

**Symptom:** `regops.counsel_queue.signoff_orphan` alert. A counsel
reviewer was removed (role revoked or magic-link disabled) while they had
pending drafts assigned.

**Resolution:**

1. Identify the orphaned drafts in `regops_audit_log` (filter by
   `assignee_id` = removed user).
2. Reassign each draft to the alternate reviewer for the same domain
   (see source-adapters.md "counsel roster" section, which you should
   keep updated).
3. Preserve the removed reviewer's historical signoffs — they are part
   of the audit trail and must remain accessible.
4. If no alternate reviewer exists for the domain: park drafts in
   the holding queue (no SLA promise) and escalate to engineering
   leadership to find new counsel.

---

## Cost cap exceeded (soft / hard)

**Soft cap ($250/mo):** investigate but don't pause. Usually means a busy
regulatory week (e.g., COLA memo released). Check whether spend pattern is
proportional to source activity.

**War-room hard cap ($1500/event):** drafter automatically pauses pending
human approval. To resume:

1. Confirm the war-room event is real (not a false positive).
2. Estimate remaining cost to complete the corpus re-validation.
3. Get explicit approval (from Matthew or designated decision-maker) to
   continue.
4. Run `bun run regops:warroom:resume --event-id <id>` to unblock.

**Do NOT:** auto-resume on hard-cap. The hard cap exists specifically because
war-room events can blow through credits faster than any normal day.

---

## Catastrophic failure: kill switch

If the engine is producing actively harmful drafts (e.g., consistently
hallucinating citations, or somehow auto-merging despite controls):

1. **Disable the GitHub Actions polling workflow** (`.github/workflows/regops-poll.yml`)
   via the GitHub UI. This stops new diffs from arriving.
2. **Disable the Workflows drafter** by setting the feature flag
   `regops_drafter_enabled` to `false` in Cloudflare. New diffs queue but
   drafter doesn't run.
3. **Counsel UI degraded banner** auto-appears when drafter is disabled.
4. **Revert any in-flight engine-drafted PRs** that are still open.
5. **Investigate and post-mortem** before re-enabling.

This is the rollback path defined in the design doc's "Liability Posture #5."

---

## Updating this runbook

This document is part of the code. If you fix a failure mode not covered
here, add it. If a procedure becomes stale, fix it. PRs touching this file
should be merged without ceremony — runbook drift is the bus-factor
disaster the runbook exists to prevent.
