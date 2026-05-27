# RegOps Engine — War-Room Playbook (OBBBA-class events)

> **Scope:** Procedures for the engine's "war-room mode" — the automated
> coordination response when a major regulatory event lands. Operationalizes
> what the OBBBA emergency audit (May 2026) taught.
>
> **Audience:** On-call engineer + Civica leadership during a major
> regulatory event. Counsel reviewers receive automated notifications;
> they don't need to read this document.
>
> **Related:**
> [runbook.md](./runbook.md) (routine on-call),
> [source-adapters.md](./source-adapters.md) (per-source detail),
> [COMPLIANCE_AUDIT_OBBBA.md](../../COMPLIANCE_AUDIT_OBBBA.md) (historical
> precedent — the event this playbook is calibrated against).

---

## What war-room mode is

Normal mode: incremental rule updates one at a time. A COLA memo lands,
the engine drafts one PR, counsel reviews, it merges.

War-room mode: a major bill (OBBBA-class, page-count >100, SNAP-keyword
density >20 occurrences, CRS-classified as "major legislation") lands and
might affect dozens of rule paths at once. The engine enters coordinated
response: fan-out, dashboard banner, ERE re-validation across the corpus,
30-day retro.

## Trigger heuristic

War-room mode fires when **all three** of the following are true for a
detected document:

1. **Page count** > 100 (PDF page count or HTML word-count / 250)
2. **SNAP keyword density** > 20 occurrences of `{"SNAP", "Food Stamp",
   "7 USC", "7 CFR 273", "ABAWD", "FNS", "USDA Food and Nutrition Service"}`
3. **CRS-summary classification** = "major legislation" OR
   `federal-register-snap` `type` = "Rule" + agency = FNS

The threshold is intentionally conservative. False negatives (missing a
real war-room event) are caught by the manual periodic review of
congressional activity that counsel does anyway. False positives (firing
on a non-event) are caught by the manual-review gate below.

## First 3 trigger fires require manual review

Because N=1 historical event (OBBBA), the heuristic is a tripwire, not a
tuned model. The first 3 times war-room mode fires under the new engine:

- The engine raises the trigger event in the admin queue
- An on-call engineer reviews within 24h
- If false positive: dismiss with reason logged; tune the trigger
- If real: manually authorize fan-out; engine takes it from there

After 3 fires (real OR false positive) have been manually reviewed and
the trigger has been validated against those events, auto-fan-out
activates. Until then, war-room mode notifies but doesn't act.

If 2 of the first 3 fires were false positives, retune the trigger
(usually by raising the SNAP-keyword threshold). Do not switch to an
LLM-based classifier — the trigger should remain interpretable and
deterministic.

## Fan-out protocol (post-manual-validation)

When war-room mode auto-fan-out activates, the engine:

1. **Counsel queue fan-out**
   - Posts the detected document + extracted summary to all four counsel
     domain queues (federal, CA, MA, FTC) simultaneously
   - Each domain reviewer sees only the parts relevant to their domain
     (via RLS scoping — same as normal mode)
   - Sets SLA: 24 hours from trigger to first counsel touch (vs. 5 biz
     days in normal mode)
   - Sends a dedicated email to each named reviewer with subject prefix
     `[REGOPS WAR-ROOM]`

2. **Dashboard banner (global, all dashboard users)**
   - Banner appears on every dashboard route: "Active regulatory event:
     {bill name}. Counsel review in progress. Expected impact: {N} rule
     paths. Last update: {timestamp}."
   - Banner color: brick (matches recovery-flow color semantics per
     [feedback_civica_vs_wevote_color_semantics] — this is a real
     regulatory event, not a positive outcome)
   - Banner persists until war-room mode exits (manual op action)

3. **ERE re-validation across the full rule corpus**
   - Runs the 2k held-out eligibility evaluations against the *current*
     `FederalDefaultRules.swift` + `ca.json` + `ma.json`
   - Compares against a fresh baseline captured at trigger time
   - Surfaces rule paths whose outputs would change once the engine's
     drafts merge
   - Cost: ~$50-200 in compute depending on corpus size
   - Soft cap: $300 per re-validation; hard cap $1500/event total LLM
     spend (matches runbook cost cap)

4. **Scheduled 30-day retrospective**
   - Creates a calendar event 30 days post-trigger for the team to retro
     the response
   - Retro template generated automatically; populated with: timeline,
     drafts opened, counsel turnaround, merges, false positives,
     surfaces missed, cost spent
   - Retro doc lives in `~/.gstack/projects/matthewgg22-Civica/retros/
     {date}-war-room-{event-slug}.md`

## What war-room mode does NOT do

- **Does not auto-merge anything.** Every draft still requires counsel
  signoff + ERE gate pass + human merge.
- **Does not skip the adversarial fixture suite.** Drafter still has to
  pass injection tests on every PR.
- **Does not lower the precision baseline.** Draft quality bar is the
  same as normal mode.
- **Does not change iOS app behavior automatically.** The dashboard
  banner is the only user-visible change until counsel + engineer
  merge actual rule changes.
- **Does not page anyone outside Civica's eng + counsel team** until a
  rule change actually lands. Households are not notified of "pending
  legislative changes" — that's panic-inducing and not actionable for
  them.

## Exit conditions

War-room mode exits when **either**:

1. All counsel queues for the event are clear (every draft either merged
   or rejected with documented reason), OR
2. Manual op action: `bun run regops:warroom:exit --event-id <id>
   --reason "<explanation>"`

The 30-day retro fires regardless of exit timing.

## Historical precedent: OBBBA (May 2026)

OBBBA (P.L. 119-21) landed in July 2025. Civica's response:

- Manual emergency audit: ~1 month elapsed (PR #62 timeline)
- Track 1 (engineering, no counsel needed): completed within 2 weeks
- Track 2 (counsel-blocked): several items still pending as of
  2026-05-12, see [COMPLIANCE_AUDIT_OBBBA.md](../../COMPLIANCE_AUDIT_OBBBA.md)
- Track 3 (external dependencies): Q15 (SOC 2), Q19 (reviewer
  signoffs) — long-running

**What war-room mode would change for the next OBBBA-class event:**

- Detection: immediate (vs. several days of "did anyone notice?")
- Draft generation: hours (vs. days of human drafting per item)
- Counsel queue: structured fan-out (vs. ad-hoc Slack threads)
- Surface impact mapping: explicit ERE re-validation (vs. piecemeal
  testing per item)
- Cost: ~$1500-2000 in LLM spend per event (vs. ~3-4 engineer-weeks of
  human time per event)

**What war-room mode would NOT change:**

- Counsel turnaround on Track 2 items is still the bottleneck.
  Faster engine drafting doesn't help if counsel can't review faster.
  This is the "engine cannot move faster than counsel will" constraint
  from the CEO review.

## Retro template (auto-populated)

```markdown
# War-Room Retro — {event-slug}

**Event detected:** {trigger timestamp}
**Source:** {source adapter id} — {document URL}
**Trigger heuristic:** page-count {N}, SNAP-keyword density {N},
CRS classification {label}
**Manual validation:** {pass/fail/N-A if N >= 3 fires already validated}

## Timeline
- T+0: trigger fired
- T+{Nh}: counsel fan-out completed
- T+{Nh}: ERE re-validation completed
- T+{Nd}: first counsel signoff
- T+{Nd}: last draft merged
- T+30d: this retro

## Drafts opened
| Domain | Drafts | Merged | Rejected | Pending |

## Counsel performance
| Domain | First-touch SLA | Time to signoff |

## ERE re-validation impact
- Rule paths affected: {N}
- Tests recomputed: {N}
- New regressions surfaced: {N}

## Cost
- LLM spend: ${N}
- Hard cap hit: {yes/no}

## What worked
- ...

## What didn't
- ...

## Action items
- [ ] Tune trigger if false positive rate > 33%
- [ ] Update counsel SLA targets if consistently missed
- [ ] Update runbook if a failure mode wasn't covered
```

## When to invoke this playbook manually

You can manually trigger war-room mode (e.g., counsel hears about a bill
before the engine detects it, or for a tabletop exercise):

```bash
bun run regops:warroom:trigger \
  --event-name "manual-{slug}" \
  --reason "<why you're triggering manually>" \
  --skip-manual-review-gate=false
```

Use this sparingly. The trigger is designed to fire automatically; manual
triggers should be rare exceptions, not workflow.
